"use strict";

import {PHYSICS_SESSION_STATE, PlayerControlManager, PlayerTickData} from "@client/control/player_control_manager.js";
import {InDeltaCompressor, InPacketBuffer, OutPacketBuffer, unpackBooleans} from "@client/packet_compressor.js";
import {
    MAX_PACKET_AHEAD_OF_TIME_MS, MAX_PACKET_LAG_SECONDS, PHYSICS_INTERVAL_MS, PHYSICS_POS_DECIMALS,
    PLAYER_STATUS, DEBUG_LOG_PLAYER_CONTROL
} from "@client/constant.js";
import type {ServerPlayer} from "../server_player.js";
import {
    ACCEPTABLE_PLAYER_POS_ERROR, ACCEPTABLE_PLAYER_VELOCITY_ERROR,
    DONT_VALIDATE_AFTER_MODE_CHANGE_MS, SERVER_UNCERTAINTY_MS,
    PLAYER_EXHAUSTION_PER_BLOCK, SERVER_SEND_CMD_MAX_INTERVAL
} from "../server_constant.js";
import {ServerClient} from "@client/server_client.js";
import {monotonicUTCMillis, Vector} from "@client/helpers.js";

const tmpOutPacketBuffer = new OutPacketBuffer()

const MAX_ACCUMULATED_DISTANCE_INCREMENT = 1.0 // to handle sudden big pos changes (if they possible)

class ServerPlayerTickData extends PlayerTickData {

    /** @returns true if the outputs of two simulations are similar enough that a client doesn't need a correction */
    outputSimilar(other: ServerPlayerTickData): boolean {
        return this.outFlags === other.outFlags &&
            this.outPos.distanceSqr(other.outPos) < ACCEPTABLE_PLAYER_POS_ERROR * ACCEPTABLE_PLAYER_POS_ERROR &&
            this.outVelocity.distanceSqr(other.outVelocity) < ACCEPTABLE_PLAYER_VELOCITY_ERROR * ACCEPTABLE_PLAYER_VELOCITY_ERROR
    }

    applyOutputToPlayer(player: ServerPlayer) {
        this.applyOutputToControl(player.controlManager.current)
        const [sneak, flying] = unpackBooleans(this.outFlags, PlayerTickData.OUT_FLAGS_COUNT)
        player.changePosition(this.outPos, this.inputRotation, sneak)
    }
}

export class ServerPlayerControlManager extends PlayerControlManager {
    //@ts-expect-error
    player: ServerPlayer

    lastData: ServerPlayerTickData | null = null
    clientData = new ServerPlayerTickData()
    newData = new ServerPlayerTickData()

    /** {@see DONT_VALIDATE_AFTER_MODE_CHANGE_MS} */
    maxUnvalidatedPhysicsTick: int = -Infinity

    clientPhysicsTicks: int // How many physics ticks in the current session are received from the client
    accumulatedDistance = 0
    lastCmdSentTime = performance.now()

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
        if (this.player.status !== PLAYER_STATUS.ALIVE || this.physicsSessionState < PHYSICS_SESSION_STATE.ONGOING) {
            return // this physics session is over, nothing to do until the next one starts
        }

        const stateTimeMustBeKnown = monotonicUTCMillis() - SERVER_UNCERTAINTY_MS
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

        this.applyPlayerStateToControl()
        if (!this.simulate(this.lastData, newData)) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`   simulation failed`)
            }
            return // the chunk is not ready. No problem, just wait
        }
        this.knownPhysicsTicks += physicsTicks
        this.onNewData()
        this.sendCorrection()
    }

    onClientTicks(buf: InPacketBuffer) {
        const now = monotonicUTCMillis()
        const dc = this.inDeltaCompressor.start(buf)

        // read the header
        const packetPhysicsSessionId = dc.getInt()
        if (packetPhysicsSessionId !== this.physicsSessionId) {
            this.skipClientData(dc)
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: skipping physics session ${packetPhysicsSessionId} !== ${this.physicsSessionId}`)
            }
            return // it's from the previous session. Ignore it.
        }

        // 1st packet of a physics session
        if (this.physicsSessionState <= PHYSICS_SESSION_STATE.WAITING_FIRST_PACKET) {
            this.physicsSessionState = PHYSICS_SESSION_STATE.ONGOING
            this.baseTime = buf.getFloat()
            if (this.baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS) {
                this.player.terminate('this.baseTime > now + MAX_PACKET_AHEAD_OF_TIME_MS')
                return
            }
            // ensure the server doesn't freeze on calculations
            if (this.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000) {
                this.player.terminate('this.baseTime < now - MAX_PACKET_LAG_SECONDS * 1000')
                return
            }

            // If the client sent us base time that is too far behind, we mustn't accept a large batch of outdated of commands afterwards
            this.doLaggingServerTicks(false)
        }

        if (this.player.status !== PLAYER_STATUS.ALIVE) {
            this.skipClientData(dc)
            // It's from the current session, but this session will end when the player is resurrected and/or teleported.
            return
        }

        const clientData = this.clientData
        const newData = this.newData

        let clientStateAccepted = false
        let hasNewData = false // if it's the 1st tick, it might have no data other than the initial time
        this.applyPlayerStateToControl()
        while (buf.remaining > 1) { // read one or more packets
            hasNewData = true
            clientData.readInput(dc)
            clientData.readContextAndOutput(dc)
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control ${this.username}: received ${clientData.toStr(this.clientPhysicsTicks)}`)
            }

            // validate time
            let prevClientPhysicsTicks = this.clientPhysicsTicks
            this.clientPhysicsTicks += clientData.physicsTicks
            const clientStateTime = this.baseTime + this.clientPhysicsTicks * PHYSICS_INTERVAL_MS
            if (clientStateTime > now + MAX_PACKET_AHEAD_OF_TIME_MS) {
                this.skipClientData(dc)
                // The client sends us a state too ahead of time. Maybe ask the client to adjust its clock.
                this.player.terminate('clientStateTime > now + MAX_PACKET_AHEAD_OF_TIME_MS')
                return
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
            if (this.knownPhysicsTicks > this.maxUnvalidatedPhysicsTick) {
                simulatedSuccessfully = this.simulate(this.lastData, newData)
            } else {
                simulatedSuccessfully = false
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
        dc.checkHash() // if the hash doesn't match, it'll throw an exception, and the connection will be terminated
        if (hasNewData) {
            this.onNewData()
            if (clientStateAccepted) {
                if (this.lastCmdSentTime < performance.now() - SERVER_SEND_CMD_MAX_INTERVAL) {
                    this.player.sendPackets([{
                        name: ServerClient.CMD_PLAYER_STATE_ACCEPTED,
                        data: this.knownPhysicsTicks
                    }])
                    this.lastCmdSentTime = performance.now()
                }
            } else {
                this.sendCorrection()
            }
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

    /** Sends {@link lastData} (physics tick, context and output) as the correction to the client */
    private sendCorrection(): void {
        const data = this.lastData
        if (DEBUG_LOG_PLAYER_CONTROL) {
            console.log(`Control ${this.username}: sending correction ${this.knownPhysicsTicks}`)
        }
        const buf = tmpOutPacketBuffer
        const dc = this.outDeltaCompressor.start(buf)
        buf.putInt(this.knownPhysicsTicks)
        data.writeContextAndOutput(dc)
        this.player.sendPackets([{
            name: ServerClient.CMD_PLAYER_STATE_CORRECTION,
            data: dc.putHash().buf.exportAndReset()
        }])
        this.lastCmdSentTime = performance.now()
    }

    /**
     * It reads the client data until then end of the buffer, but doesn't process it.
     * It's needed for the delta compressor correctness.
     */
    private skipClientData(dc: InDeltaCompressor) {
        const clientData = this.clientData
        while (dc.buf.remaining > 1) { // read one or more packets
            clientData.readInput(dc)
            clientData.readContextAndOutput(dc)
        }
        dc.checkHash()
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