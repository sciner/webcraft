"use strict";

import {PlayerControlManager} from "@client/control/player_control_manager.js";
import type {PacketBuffer} from "@client/packet_compressor.js";
import {
    MAX_PACKET_AHEAD_OF_TIME_MS, MAX_PACKET_LAG_SECONDS, PHYSICS_INTERVAL_MS, PHYSICS_POS_DECIMALS,
    PLAYER_STATUS, DEBUG_LOG_PLAYER_CONTROL, DEBUG_LOG_PLAYER_CONTROL_DETAIL, PHYSICS_MAX_TICKS_PROCESSED
} from "@client/constant.js";
import type {ServerPlayer} from "../server_player.js";
import {DONT_VALIDATE_AFTER_MODE_CHANGE_MS, PLAYER_EXHAUSTION_PER_BLOCK, SERVER_SEND_CMD_MAX_INTERVAL,
    SERVER_UNCERTAINTY_MS, WAKEUP_MOVEMENT_DISTANCE} from "../server_constant.js";
import {ServerClient} from "@client/server_client.js";
import {ArrayHelpers, MonotonicUTCDate, SimpleQueue, Vector} from "@client/helpers.js";
import {ServerPlayerTickData} from "./server_player_tick_data.js";
import {PlayerControlCorrectionPacket, PlayerControlPacketReader, PlayerControlSessionPacket} from "@client/control/player_control_packets.js";
import type {PlayerTickData} from "@client/control/player_tick_data.js";
import type {Player} from "@client/player.js";

const MAX_ACCUMULATED_DISTANCE_INCREMENT = 1.0 // to handle sudden big pos changes (if they ever happen)
const MAX_CLIENT_QUEUE_LENGTH = MAX_PACKET_LAG_SECONDS * 1000 / PHYSICS_INTERVAL_MS | 0 // a protection against memory leaks if there is garbage input

export class ServerPlayerControlManager extends PlayerControlManager {
    private lastData: ServerPlayerTickData
    private newData = new ServerPlayerTickData()
    private controlPacketReader = new PlayerControlPacketReader(ServerPlayerTickData)
    private correctionPacket = new PlayerControlCorrectionPacket()

    // Data from client. Some of it may be waiting for WorldAction to be executed
    private clientDataQueue = new SimpleQueue<ServerPlayerTickData>()
    // ids of WorldAction of that player that are related to physics and have been recently executed
    private worldActionIdsExecuted: {
        performanceNow: number, // it's to delete old records
        id: string | int
    }[] = []   // we don't have to wait these actions
    private expectedExternalChangeTick: int

    /** {@see DONT_VALIDATE_AFTER_MODE_CHANGE_MS} */
    private maxUnvalidatedPhysicsTick: int = -Infinity

    /**
     * All client's physics ticks in the current session up to this number are processed and/or skipped.
     * A client can't send data to these ticks again, only to the later ticks.
     */
    private clientPhysicsTicks: int
    private accumulatedExhaustionDistance = 0
    private accumulatedSleepSittingDistance = 0
    private lastCmdSentTime = performance.now()

    constructor(player: ServerPlayer) {
        super(player as any as Player)
        // super constructor doesn't call these methods correctly, so call them here
        this.physicsSessionId = -1 // revert to what it was before the super constructor
        const pos = new Vector(player.sharedProps.pos)
        this.updateCurrentControlType(false)
        this.startNewPhysicsSession(pos)
    }

    get serverPlayer(): ServerPlayer { return this.player as any as ServerPlayer }

    /** The current physics tick according to the clock. The actual tick for which the state is known usually differs. */
    private getPhysicsTickNow(): int {
        return Math.floor((MonotonicUTCDate.now() - this.baseTime) / PHYSICS_INTERVAL_MS)
    }

    updateCurrentControlType(notifyClient: boolean): boolean {
        if (!super.updateCurrentControlType(notifyClient)) {
            return false
        }
        this.maxUnvalidatedPhysicsTick = this.knownPhysicsTicks + Math.floor(DONT_VALIDATE_AFTER_MODE_CHANGE_MS / PHYSICS_INTERVAL_MS)
        this.updateLastData()
        if (notifyClient) {
            // Send the correction to the client, which may or may not be needed.
            // An example when it's needed: a player was flying as a spectator, then started falling.
            // The client continues to fly (when it shouldn't), but it will be corrected soon.
            // Don't wait until we receive the wrong coordinates from the client.
            this.sendCorrection()
        }
        return true
    }

    startNewPhysicsSession(pos: IVector): void {
        super.startNewPhysicsSession(pos)
        this.updateLastData()
        this.maxUnvalidatedPhysicsTick = -Infinity // clear the previous value, otherwise validation might be disabled for a long time
        this.clientPhysicsTicks = 0
        if (this.worldActionIdsExecuted) { // if the subclass constructor finished
            this.worldActionIdsExecuted.length = 0
        }
        this.expectedExternalChangeTick = -1
    }

    setPos(pos: IVector, worldActionId?: string | int | null): void {
        super.setPos(pos, worldActionId)
        this.player.state.pos.copyFrom(pos)
        if (worldActionId) {
            this.worldActionIdsExecuted.push({
                performanceNow: performance.now(),
                id: worldActionId
            })
            this.expectedExternalChangeTick = this.knownPhysicsTicks
        }
    }

    onClientSession(data: PlayerControlSessionPacket): void {
        if (data.sessionId !== this.physicsSessionId) {
            return // it's for another session, skip it
        }
        if (this.physicsSessionInitialized) {
            throw 'this.physicsSessionInitialized'
        }
        const now = MonotonicUTCDate.now()
        if (data.baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS) {
            throw `baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS ${data.baseTime} ${now} ${Date.now()}`
        }
        // ensure the server doesn't freeze on calculations
        if (data.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000) {
            throw `baseTime < now - MAX_PACKET_LAG_SECONDS * 1000 ${data.baseTime} ${now} ${Date.now()}`
        }
        this.physicsSessionInitialized = true
        this.baseTime = data.baseTime
    }

    /**
     * Adds the client ticks' data to the queue.
     * Executes some physics ticks if possible.
     */
    onClientTicks(buf: PacketBuffer): void {
        const reader = this.controlPacketReader

        // check if it's for the current session
        const [header, ticksData] = reader.readPacket(buf)
        if (header.physicsSessionId !== this.physicsSessionId) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: skipping physics session ${header.physicsSessionId} !== ${this.physicsSessionId}`)
            }
            return // it's from the previous session. Ignore it.
        }

        if (!this.physicsSessionInitialized) { // we should have received CMD_PLAYER_CONTROL_SESSION first
            throw '!this.physicsSessionInitialized'
        }

        for(const clientData of ticksData) {
            if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                console.log(`Control ${this.username}: received ${clientData}`)
            }
            this.clientDataQueue.push(clientData)
        }

        // Move the player ASAP.
        // It ensures that the player has moved before its next WorldAction is processed, and WorldActions don't have
        // to wait for the physics (e.g. for the player to come close to a block).
        this.tick()
    }

    /**
     * It must be called regularly.
     * It executes player's input, and processes changes that are not a direct result of the player's input, e.g.
     * - if the player is lagging too much, do the old player ticks even without knowing the input
     * - detect external position/velocity/sleep/etc. changes and send a correction
     * @see SERVER_UNCERTAINTY_MS
     */
    tick(): void {
        if (this.player.status !== PLAYER_STATUS.ALIVE || !this.physicsSessionInitialized) {
            this.doGarbageCollection()
            return // there is nothing to do until the next physics session starts
        }

        const clientDataQueue = this.clientDataQueue
        const physicsTickNow = this.getPhysicsTickNow()
        const maxAllowedPhysicsTick = physicsTickNow + Math.ceil(MAX_PACKET_AHEAD_OF_TIME_MS / PHYSICS_INTERVAL_MS)
        let clientDataMatches = false // if multiple ticks are simulated, it shows whether the last of them is accepted

        this.applyPlayerStateToControl()

        // do ticks for severely lagging clients without their input
        let hasNewData = this.doServerTicks(physicsTickNow - Math.floor(SERVER_UNCERTAINTY_MS / PHYSICS_INTERVAL_MS))
        let processedClientData = false
        while(clientDataQueue.length) {
            const clientData = clientDataQueue.getFirst()

            if (clientData.physicsSessionId !== this.physicsSessionId || // it's from the previous session
                // or it's from the current session, but this session will end when the player is resurrected and/or teleported
                this.player.status !== PLAYER_STATUS.ALIVE
            ) {
                clientDataQueue.shift()
                continue
            }

            // validate time, update this.clientPhysicsTicks
            const newClientPhysicsTicks = clientData.endPhysicsTick
            if (newClientPhysicsTicks > maxAllowedPhysicsTick) {
                this.serverPlayer.terminate(`newClientPhysicsTicks > maxClientTickAhead ${newClientPhysicsTicks} ${maxAllowedPhysicsTick}`)
                return
            }
            if (clientData.startingPhysicsTick < this.clientPhysicsTicks) {
                this.serverPlayer.terminate(`clientData.startingPhysicsTick < this.clientPhysicsTicks ${clientData.startingPhysicsTick} ${this.clientPhysicsTicks}`)
                return
            }

            // check if the data is at least partially outside the time window where the changes are still allowed
            if (clientData.startingPhysicsTick < this.knownPhysicsTicks) {
                const canSimulateTicks = newClientPhysicsTicks - this.knownPhysicsTicks
                // if it's completely outdated
                if (canSimulateTicks <= 0) {
                    this.clientPhysicsTicks = newClientPhysicsTicks
                    clientDataQueue.shift()
                    continue
                }
                // The data is partially outdated. Remove its older part, leave the most recent part.
                clientData.physicsTicks = canSimulateTicks
                clientData.startingPhysicsTick = this.knownPhysicsTicks

                // check if ticks are skipped in the client data sequence
            } else if (clientData.startingPhysicsTick > this.knownPhysicsTicks) {
                // It happens, e.g. when the client skips simulating physics ticks (we could have sent a message in this case, but we don't)
                // It may also happen due to bugs.
                if (!this.doServerTicks(clientData.startingPhysicsTick)) {
                    break // can't simulate, the chunk is missing
                }
                clientDataMatches = false // we skipped ticks, so it probably differs from the client
                hasNewData = true
            }

            // check if it's waiting for WorldActions
            if (clientData.inputWorldActionIds) {
                // if an action was executed, and a tick data was waiting for it, remove this action's id from both lists
                ArrayHelpers.filterSelf(this.worldActionIdsExecuted, (v) =>
                    !ArrayHelpers.fastDeleteValue(clientData.inputWorldActionIds, v.id)
                )
                // if the tick data is still waiting for an action
                if (clientData.inputWorldActionIds.length) {
                    break
                }
            }

            this.clientPhysicsTicks = newClientPhysicsTicks
            clientDataQueue.shift() // the data will be processed, so extract it from the queue

            // data used in the simulation
            const newData = this.newData
            newData.copyInputFrom(clientData)
            newData.initContextFrom(this)

            // Do the simulation if it's needed
            let simulatedSuccessfully: boolean
            if (clientData.inputWorldActionIds) {
                newData.initOutputFrom(this.current)
                simulatedSuccessfully = true
            } else if (this.current === this.spectator ||
                this.knownPhysicsTicks <= this.maxUnvalidatedPhysicsTick
            ) {
                simulatedSuccessfully = false
            } else {
                simulatedSuccessfully = this.simulate(this.lastData, newData)
            }
            this.knownPhysicsTicks = this.clientPhysicsTicks

            if (simulatedSuccessfully) {
                // Accept the server state on the server. We may or may not correct the client.
                const contextEqual = newData.contextEqual(clientData)
                clientDataMatches = contextEqual && newData.outputSimilar(clientData)
                if (clientDataMatches) {
                    DEBUG_LOG_PLAYER_CONTROL_DETAIL && console.log(`    simulation matches ${newData}`)
                } else if (contextEqual) {
                    DEBUG_LOG_PLAYER_CONTROL && console.log(`    simulation doesn't match ${clientData} ${newData}`)
                } else {
                    DEBUG_LOG_PLAYER_CONTROL && console.log(`    simulation context doesn't match ${newData}`)
                }
            } else {
                newData.copyOutputFrom(clientData)
                clientDataMatches = this.onWithoutSimulation()
            }
            hasNewData = true
            processedClientData = true
        }

        if (!hasNewData && this.detectExternalChanges()) {
            hasNewData = true
            clientDataMatches = false
        }
        if (hasNewData) {
            this.lastData.applyOutputToPlayer(this.serverPlayer)
            if (clientDataMatches) {
                if (this.lastCmdSentTime < performance.now() - SERVER_SEND_CMD_MAX_INTERVAL) {
                    this.serverPlayer.sendPackets([{
                        name: ServerClient.CMD_PLAYER_CONTROL_ACCEPTED,
                        data: this.knownPhysicsTicks
                    }])
                    this.lastCmdSentTime = performance.now()
                }
            } else {
                if (DEBUG_LOG_PLAYER_CONTROL_DETAIL || DEBUG_LOG_PLAYER_CONTROL && processedClientData) {
                    console.log(`Control ${this.username}: sending correction`)
                }
                this.sendCorrection()
            }
        }

        this.doGarbageCollection()
    }

    /**
     * Increases {@link knownPhysicsTicks} up to {@link tickMustBeKnown}, if it's less than that.
     * @return true if anything changed
     */
    private doServerTicks(tickMustBeKnown: int): boolean {
        const prevKnownPhysicsTicks = this.knownPhysicsTicks
        let physicsTicks = tickMustBeKnown - this.knownPhysicsTicks
        if (physicsTicks <= 0) {
            return false
        }

        const newData = this.newData
        newData.initInputEmpty(this.lastData, this.knownPhysicsTicks, physicsTicks)
        newData.initContextFrom(this)

        const skipPhysicsTicks = physicsTicks - PHYSICS_MAX_TICKS_PROCESSED
        if (skipPhysicsTicks > 0) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: skipping ${skipPhysicsTicks} ticks`)
            }
            this.knownPhysicsTicks += skipPhysicsTicks
            physicsTicks = PHYSICS_MAX_TICKS_PROCESSED
            // these skipped ticks become the last data
            newData.initOutputFrom(this.current)
            this.updateLastData()
            // prepare to simulate new ticks
            newData.initInputEmpty(this.lastData, this.knownPhysicsTicks, physicsTicks)
        }

        if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
            console.log(`Control ${this.username}: simulate ${physicsTicks} ticks without client's input`)
        }

        if (this.current === this.spectator) {
            // no simulation
            newData.initOutputFrom(this.spectator)
            this.updateLastData(newData)
            this.knownPhysicsTicks = tickMustBeKnown
        } else {
            if (this.simulate(this.lastData, newData)) {
                this.knownPhysicsTicks = tickMustBeKnown
            } else {
                if (DEBUG_LOG_PLAYER_CONTROL) {
                    console.log(`   simulation without client's input failed`)
                }
            }
        }

        return this.knownPhysicsTicks !== prevKnownPhysicsTicks
    }

    /**
     * Detects external changes to the player.
     * If they happen, it adds a new tick data containing them, so it can be sent to the client.
     * @return true if the changed
     */
    private detectExternalChanges(): boolean {
        if (this.expectedExternalChangeTick === this.knownPhysicsTicks) {
            return false
        }
        const lastData = this.lastData
        const newData = this.newData
        newData.initContextFrom(this)
        newData.initOutputFrom(this.current)
        const contextEqual = lastData.contextEqual(newData)
        if (!(contextEqual && lastData.outputSimilar(newData)) &&
            // and knownPhysicsTicks isn't too far in the future (so we can add another tick)
            this.knownPhysicsTicks <= Math.max(this.clientPhysicsTicks, this.getPhysicsTickNow())
        ) {
            if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                if (contextEqual) {
                    console.log(`Control ${this.username}: detected external changes ${lastData} -> ${newData}`)
                } else {
                    console.log(`Control ${this.username}: detected external context changes ${lastData} -> ${newData}`)
                }
            }
            newData.initInputEmpty(this.lastData, this.knownPhysicsTicks, 1)
            this.knownPhysicsTicks++
            this.updateLastData(newData)
            return true
        }
        return false
    }

    private doGarbageCollection() {
        // prevent memory leak if something goes wrong
        while (this.clientDataQueue.length > MAX_CLIENT_QUEUE_LENGTH) {
            this.clientDataQueue.shift()
        }
        // remove obsolete data (normally it's removed when used, but it may remain due to bugs)
        const worldActionIdsExecuted = this.worldActionIdsExecuted
        while(worldActionIdsExecuted.length &&
            worldActionIdsExecuted[0].performanceNow < performance.now() - MAX_PACKET_LAG_SECONDS * 1000
        ) {
            worldActionIdsExecuted.shift()
        }
    }

    private updateLastData(newData?: ServerPlayerTickData) {
        const lastData = this.lastData ??= new ServerPlayerTickData()
        if (newData) {
            lastData.copyInputFrom(newData)
            // the simulation may have changed context, e.g. flying, so init context from the player, not from newData
            lastData.initContextFrom(this)
            lastData.copyOutputFrom(newData)
        } else {
            lastData.initInputEmpty(null, this.knownPhysicsTicks - 1, 1)
            lastData.initContextFrom(this)
            lastData.initOutputFrom(this.current)
        }
    }

    /** Sends {@link lastData} as the correction to the client. */
    private sendCorrection(): void {
        if (this.current === this.spectator) {
            return
        }
        const cp = this.correctionPacket
        cp.physicsSessionId = this.physicsSessionId
        cp.knownPhysicsTicks = this.knownPhysicsTicks
        cp.data = this.lastData
        this.serverPlayer.sendPackets([{
            name: ServerClient.CMD_PLAYER_CONTROL_CORRECTION,
            data: cp.export()
        }])
        this.lastCmdSentTime = performance.now()
    }

    /**
     * It updates the current control according to the changes made by the game to the player's state
     * outside the control simulation.
     * It must be called once before each series of consecutive simulations.
     *
     * We assume {@link current} is already updated and correct.
     */
    private applyPlayerStateToControl() {
        const pcState = this.current.player_state
        const playerState = this.player.state

        // we need to round it, e.g. to avoid false detections of changes after sitting/lying
        pcState.pos.copyFrom(playerState.pos).roundSelf(PHYSICS_POS_DECIMALS)
        pcState.yaw = playerState.rotate.z
    }

    /**
     * Accepts or rejects the {@link newData} received from the client without simulation.
     * If it's rejected, the player's state remain unchanged.
     * @returns true if the data is accepted
     */
    private onWithoutSimulation(): boolean {
        const lastData = this.lastData
        const newData = this.newData
        const pc = this.controlByType[newData.contextControlType]
        let accepted: boolean
        try {
            accepted = pc.validateWithoutSimulation(lastData, newData)
        } catch (e) {
            accepted = false
        }
        if (!accepted) {
            // Either cheating or a bug detected. The previous output remains unchanged.
            newData.copyOutputFrom(lastData)
        }
        this.onSimulation(lastData.outPos, newData)
        this.updateLastData(newData)
        return accepted
    }

    protected simulate(prevData: ServerPlayerTickData | null | undefined, data: ServerPlayerTickData,
                       outPosBeforeLastTick?: Vector): boolean {
        const res = super.simulate(prevData, data, outPosBeforeLastTick)
        if (res) {
            this.updateLastData(data)
        }
        return res
    }

    protected onSimulation(prevPos: Vector, data: PlayerTickData): void {
        super.onSimulation(prevPos, data)

        const ps = this.player.state
        const sitsOrSleeps = ps.sitting || ps.lies || ps.sleep
        const moved = !prevPos.equal(data.outPos)
        if (!moved) {
            if (!sitsOrSleeps) {
                this.accumulatedSleepSittingDistance = 0
            }
            return
        }

        const distance = Math.min(data.outPos.distance(prevPos), MAX_ACCUMULATED_DISTANCE_INCREMENT)

        if (sitsOrSleeps) {
            // If the player moved too much while sitting/sleeping, then there is no more chair or a bed under them
            this.accumulatedSleepSittingDistance += distance
            if (this.accumulatedSleepSittingDistance > WAKEUP_MOVEMENT_DISTANCE) {
                this.accumulatedSleepSittingDistance = 0
                ps.sitting = false
                ps.lies = false
                ps.sleep = false
                this.serverPlayer.sendPackets([{name: ServerClient.CMD_STANDUP_STRAIGHT, data: null}])
            }
        }

        // add exhaustion
        this.accumulatedExhaustionDistance += distance
        let accumulatedIntDistance = Math.floor(this.accumulatedExhaustionDistance)
        if (accumulatedIntDistance) {
            const player = this.serverPlayer
            player.state.stats.distance += accumulatedIntDistance
            this.accumulatedExhaustionDistance -= accumulatedIntDistance
            player.addExhaustion(PLAYER_EXHAUSTION_PER_BLOCK * accumulatedIntDistance)
        }
    }
}