"use strict";

import {PlayerControlManager} from "@client/control/player_control_manager.js";
import type {PacketBuffer} from "@client/packet_compressor.js";
import {
    MAX_PACKET_AHEAD_OF_TIME_MS, MAX_PACKET_LAG_SECONDS, PHYSICS_INTERVAL_MS, PHYSICS_POS_DECIMALS,
    PLAYER_STATUS, DEBUG_LOG_PLAYER_CONTROL
} from "@client/constant.js";
import type {ServerPlayer} from "../server_player.js";
import {
    DONT_VALIDATE_AFTER_MODE_CHANGE_MS, SERVER_UNCERTAINTY_MS,
    PLAYER_EXHAUSTION_PER_BLOCK, SERVER_SEND_CMD_MAX_INTERVAL
} from "../server_constant.js";
import {ServerClient} from "@client/server_client.js";
import {MonotonicUTCDate, Vector} from "@client/helpers.js";
import {ServerPlayerTickData} from "./server_player_tick_data.js";
import {PlayerControlCorrectionPacket, PlayerControlPacketReader, PlayerControlSessionPacket} from "@client/control/player_control_packets.js";
import type {PlayerTickData} from "@client/control/player_tick_data.js";

const MAX_ACCUMULATED_DISTANCE_INCREMENT = 1.0 // to handle sudden big pos changes (if they ever happen)

export class ServerPlayerControlManager extends PlayerControlManager {
    //@ts-expect-error
    player: ServerPlayer

    private lastData: ServerPlayerTickData | null = null
    private clientData = new ServerPlayerTickData()
    private newData = new ServerPlayerTickData()
    private controlPacketReader = new PlayerControlPacketReader()
    private correctionPacket = new PlayerControlCorrectionPacket()

    /** {@see DONT_VALIDATE_AFTER_MODE_CHANGE_MS} */
    private maxUnvalidatedPhysicsTick: int = -Infinity

    private clientPhysicsTicks: int // How many physics ticks in the current session are received from the client
    private accumulatedDistance = 0
    private lastCmdSentTime = performance.now()

    updateCurrentControlType(notifyClient: boolean): boolean {
        if (!super.updateCurrentControlType(notifyClient)) {
            return false
        }
        this.maxUnvalidatedPhysicsTick = this.knownPhysicsTicks + Math.floor(DONT_VALIDATE_AFTER_MODE_CHANGE_MS / PHYSICS_INTERVAL_MS)
        const lastData = this.lastData
        if (!lastData) {
            return true
        }
        lastData.initContextFrom(this.player as any)
        lastData.initOutputFrom(this.current)

        if (notifyClient) {
            // Send the correction to the client, which may or may not be needed.
            // An example when it's needed: a player was flying as a spectator, then started falling.
            // The client continues to fly (when it shouldn't), but it will be corrected soon.
            // Don't wait until we receive the wrong coordinates from the client.
            this.sendCorrection()
        }
        return true
    }

    startNewPhysicsSession(pos: IVector) {
        super.startNewPhysicsSession(pos)
        this.lastData = null
        // clear the previous value, otherwise validation might be disabled for a long time
        this.maxUnvalidatedPhysicsTick = -Infinity
        this.clientPhysicsTicks = 0
    }

    /**
     * If the player is lagging too much, the server executes the old player ticks even without knowing the input.
     * @see SERVER_UNCERTAINTY_MS
     */
    doLaggingServerTicks(doSimulation: boolean) {
        if (this.player.status !== PLAYER_STATUS.ALIVE || !this.physicsSessionInitialized) {
            return // this physics session is over, nothing to do until the next one starts
        }

        const stateTimeMustBeKnown = MonotonicUTCDate.now() - SERVER_UNCERTAINTY_MS
        let physicsTicks = Math.floor((stateTimeMustBeKnown - this.knownTime) / PHYSICS_INTERVAL_MS )
        if (physicsTicks <= 0) {
            return
        }
        if (!doSimulation) {
            this.knownPhysicsTicks += physicsTicks
            return
        }
        if (DEBUG_LOG_PLAYER_CONTROL) {
            console.log(`Control ${this.username}: need to simulate ${physicsTicks} lagging ticks`)
        }

        const newData = this.newData
        newData.initInputEmpty(this.lastData, physicsTicks)
        newData.initContextFrom(this.player as any)

        if (this.current === this.spectator) {
            newData.initOutputFrom(this.spectator)
        } else {
            this.applyPlayerStateToControl()
            if (!this.simulate(this.lastData, newData)) {
                if (DEBUG_LOG_PLAYER_CONTROL) {
                    console.log(`   simulation failed`)
                }
                return // the chunk is not ready. No problem, just wait
            }
        }
        this.knownPhysicsTicks += physicsTicks
        this.onNewData()
        if (this.current !== this.spectator) {
            this.sendCorrection()
        }
    }

    onClientSession(data: PlayerControlSessionPacket): void {
        if (data.sessionId !== this.physicsSessionId) {
            return // it's for another session, skip it
        }
        if (this.physicsSessionInitialized) {
            throw 'this.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000'
        }
        const now = MonotonicUTCDate.now()
        if (data.baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS) {
            throw 'baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS'
        }
        // ensure the server doesn't freeze on calculations
        if (data.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000) {
            throw 'baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS'
        }
        this.physicsSessionInitialized = true
        this.baseTime = data.baseTime
        // If the client sent us base time that is too far behind, we mustn't accept a large batch of outdated of commands afterwards
        this.doLaggingServerTicks(false)
    }

    onClientTicks(data: PacketBuffer): void {
        const reader = this.controlPacketReader

        // check if it's for the current session
        const packetPhysicsSessionId = reader.startGetSessionId(data)
        if (packetPhysicsSessionId !== this.physicsSessionId) {
            reader.finish()
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: skipping physics session ${packetPhysicsSessionId} !== ${this.physicsSessionId}`)
            }
            return // it's from the previous session. Ignore it.
        }

        if (!this.physicsSessionInitialized) { // we should have received CMD_PLAYER_CONTROL_SESSION first
            throw 'this.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000'
        }

        if (this.player.status !== PLAYER_STATUS.ALIVE) {
            reader.finish()
            // It's from the current session, but this session will end when the player is resurrected and/or teleported.
            return
        }

        const clientData = this.clientData
        const newData = this.newData
        const now = MonotonicUTCDate.now()
        let clientStateAccepted = false
        this.applyPlayerStateToControl()

        while (reader.readTickData(clientData)) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: received ${clientData.toStr(this.clientPhysicsTicks)}`)
            }

            // validate time
            let prevClientPhysicsTicks = this.clientPhysicsTicks
            this.clientPhysicsTicks += clientData.physicsTicks
            const clientStateTime = this.baseTime + this.clientPhysicsTicks * PHYSICS_INTERVAL_MS
            if (clientStateTime > now + MAX_PACKET_AHEAD_OF_TIME_MS) {
                // The client sends us a state too ahead of time
                throw'clientStateTime > now + MAX_PACKET_AHEAD_OF_TIME_MS'
            }

            // check if the data is at least partially outside the time window where the changes are still allowed
            if (prevClientPhysicsTicks < this.knownPhysicsTicks) {
                const canSimulateTicks = this.clientPhysicsTicks - this.knownPhysicsTicks
                // if it's completely outdated
                if (canSimulateTicks <= 0) {
                    continue
                }
                // The data is partially outdated. Remove its older part, leave the most recent part.
                clientData.physicsTicks = canSimulateTicks
                prevClientPhysicsTicks = this.knownPhysicsTicks
            }

            newData.copyInputFrom(clientData)
            newData.initContextFrom(this.player as any)
            let simulatedSuccessfully: boolean
            if (this.current === this.spectator ||
                this.knownPhysicsTicks <= this.maxUnvalidatedPhysicsTick
            ) {
                simulatedSuccessfully = false
            } else {
                simulatedSuccessfully = this.simulate(this.lastData, newData)
            }
            this.knownPhysicsTicks = this.clientPhysicsTicks

            if (simulatedSuccessfully) {
                // Accept the server state on the server. We may or may not correct the client.
                if (DEBUG_LOG_PLAYER_CONTROL) {
                    console.log(`    simulated ${newData.toStr(prevClientPhysicsTicks)}`)
                }
                clientStateAccepted = newData.contextEqual(clientData) && newData.outputSimilar(clientData)
            } else {
                newData.copyOutputFrom(clientData)
                clientStateAccepted = this.onWithoutSimulation()
            }
        }
        reader.finish()

        this.onNewData()
        if (clientStateAccepted) {
            if (this.lastCmdSentTime < performance.now() - SERVER_SEND_CMD_MAX_INTERVAL) {
                this.player.sendPackets([{
                    name: ServerClient.CMD_PLAYER_CONTROL_ACCEPTED,
                    data: this.knownPhysicsTicks
                }])
                this.lastCmdSentTime = performance.now()
            }
        } else {
            this.sendCorrection()
        }
    }

    private updateLastData() {
        const newData = this.newData
        const lastData = this.lastData ??= new ServerPlayerTickData()
        lastData.copyInputFrom(newData)
        lastData.copyContextFrom(newData)
        lastData.copyOutputFrom(newData)
    }

    private onNewData() {
        this.newData.applyOutputToPlayer(this.player)
        this.updateLastData()
    }

    /** Sends {@link lastData} as the correction to the client. */
    private sendCorrection(): void {
        const cp = this.correctionPacket
        cp.knownPhysicsTicks = this.knownPhysicsTicks
        cp.data = this.lastData
        this.player.sendPackets([{
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
        const prevData = this.lastData
        const newData = this.newData
        const pc = this.controlByType[newData.contextControlType]
        let accepted: boolean
        try {
            accepted = pc.validateWithoutSimulation(prevData, newData)
        } catch (e) {
            accepted = false
        }
        if (accepted) {
            if (prevData && !prevData.outPos.equal(newData.outPos)) {
                this.onSimulationMoved(prevData.outPos, newData)
            }
            this.updateLastData()
        } else {
            // Either cheating or a bug detected. The previous output remains unchanged.
            if (prevData) {
                newData.copyOutputFrom(prevData)
            } else {
                newData.initOutputFrom(pc)
            }
        }
        return accepted
    }

    protected onSimulationMoved(prevPos: Vector, data: PlayerTickData): void {
        super.onSimulationMoved(prevPos, data)

        // add exhaustion
        this.accumulatedDistance += Math.min(data.outPos.distance(prevPos), MAX_ACCUMULATED_DISTANCE_INCREMENT)
        let accumulatedIntDistance = Math.floor(this.accumulatedDistance)
        if (accumulatedIntDistance) {
            const player = this.player
            player.state.stats.distance += accumulatedIntDistance
            this.accumulatedDistance -= accumulatedIntDistance
            player.addExhaustion(PLAYER_EXHAUSTION_PER_BLOCK * accumulatedIntDistance)
        }
    }
}