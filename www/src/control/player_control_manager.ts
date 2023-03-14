"use strict";

import {Vector} from "../helpers/vector.js";
import type {Player} from "../player.js";
import type {PacketBuffer} from "../packet_compressor.js";
import {PrismarinePlayerControl} from "../prismarine-physics/using.js";
import {SpectatorPlayerControl} from "./spectator-physics.js";
import {
    MAX_CLIENT_STATE_INTERVAL, PHYSICS_INTERVAL_MS, DEBUG_LOG_PLAYER_CONTROL,
    PHYSICS_POS_DECIMALS, PHYSICS_VELOCITY_DECIMALS, PHYSICS_MAX_MS_PROCESS
} from "../constant.js";
import {SimpleQueue} from "../helpers/simple_queue.js";
import type {PlayerControl} from "./player_control.js";
import {GameMode} from "../game_mode.js";
import {MonotonicUTCDate} from "../helpers.js";
import {ClientPlayerTickData, PLAYER_TICK_DATA_STATUS, PlayerTickData} from "./player_tick_data.js";
import {ServerClient} from "../server_client.js";
import {PlayerControlCorrectionPacket, PlayerControlPacketWriter, PlayerControlSessionPacket} from "./player_control_packets.js";

/**
 * It contains multiple controllers (subclasses of {@link PlayerControl}), switches between them,
 * calls the controllers to update the player state based on the input, and synchronizes the state
 * between the server and the client.
 */
export abstract class PlayerControlManager {
    player: Player

    // the different controllers
    spectator: SpectatorPlayerControl
    prismarine: PrismarinePlayerControl
    protected controlByType: PlayerControl[]
    /** The controller selected at the moment. */
    current: PlayerControl

    /**
     * Each session starts uninitialzied. To become initialized, {@link baseTime} must be set.
     * (a client sets it when in the first physics tick of the session, and the server receives this
     * value from the client).
     * @see startNewPhysicsSession
     * @see ClientPlayerControlManager.initializePhysicsSession
     */
    protected physicsSessionInitialized: boolean
    /** If of the current physics session. They are numbered consecutively. The 1st session will start from 0. */
    protected physicsSessionId: int = -1

    /** The time {@link MonotonicUTCDate.now} at which the physics session started. */
    protected baseTime: number
    /** The number of physics session (see {@link PHYSICS_INTERVAL_MS}) from the start of the current physics session. */
    protected knownPhysicsTicks: int

    private tmpPos = new Vector()

    constructor(player: Player) {
        this.player = player
        const pos = new Vector(player.sharedProps.pos)
        this.prismarine = new PrismarinePlayerControl(player.world, pos, {effects: player.effects})
        this.spectator = new SpectatorPlayerControl(player.world, pos)
        this.controlByType = [this.prismarine, this.spectator]
        this.current = this.prismarine // it doesn't matter what we choose here, it'll be corrected in the next line
        this.updateCurrentControlType(false)
        this.startNewPhysicsSession(pos)
    }

    protected get knownTime(): float {
        return this.baseTime + this.knownPhysicsTicks * PHYSICS_INTERVAL_MS
    }

    /**
     * Checks if the {@link current} controller must be changed based on the user state.
     * Switches the controller and resets its state if necessary.
     */
    updateCurrentControlType(notifyClient: boolean): boolean {
        const pc_previous = this.current
        let pc: PlayerControl
        if(this.player.game_mode.isSpectator()) {
            pc = this.spectator
        } else {
            pc = this.prismarine
        }
        if (pc_previous === pc) {
            return false
        }
        this.current = pc
        pc.resetState()
        pc.setPos(pc_previous.player_state.pos)
        return true
    }

    /**
     * A "physics session" is a continuous span of time during which all control ticks are numbered.
     * When a major game event, such as teleport occurs, and it's hard to keep the hosts synchronized,
     * the controls are reset and a new physics session begins.
     */
    startNewPhysicsSession(pos: IVector) {
        const pc = this.current
        pc.resetState()
        pc.setPos(pos)
        this.physicsSessionId++
        this.physicsSessionInitialized = false
        this.knownPhysicsTicks = 0
    }

    /**
     * Simulates all the physics ticks described by {@link data}
     * @return true if the simulation was successful, i.e. the {@link PlayerControl.simulatePhysicsTick}.
     *   It may be unsuccessful if the chunk is not ready.
     *   If the simulation fails, all the important properties of {@link PlayerControl} remain unchanged
     *     (assuming {@link PlayerControl.restorePartialState} is correct).
     */
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData): boolean {
        const pc = this.controlByType[data.contextControlType]
        const gameMode = GameMode.byIndex[data.contextGameModeIndex]
        const player_state = pc.player_state

        // this prevents, e.g. huge jumps after switching to/from spectator
        if (prevData && pc.type !== prevData.contextControlType) {
            pc.resetState()
        }

        // apply input
        data.applyInputTo(this, pc)
        // special input adjustments
        this.spectator.scale = this.player.scale
        player_state.flying &&= gameMode.can_fly // a hack-fix to ensure the player isn't flying when it shouldn't

        // remember the state before the simulation
        const prevPos = this.tmpPos.copyFrom(player_state.pos)
        pc.backupPartialState()

        // simulate the steps
        for(let i = 0; i < data.physicsTicks; i++) {
            try {
                pc.simulatePhysicsTick()
            } catch (e) {
                pc.restorePartialState(prevPos)
                return false
            }
            // round the results between each step
            // It's necessary in case combined steps will be split (I'm not sure if it happens, but it's better be safe)
            player_state.pos.roundSelf(PHYSICS_POS_DECIMALS)
            player_state.vel.roundSelf(PHYSICS_VELOCITY_DECIMALS)
        }
        data.initOutputFrom(pc)

        if (!prevPos.equal(data.outPos)) {
            this.onSimulationMoved(prevPos, data)
        }
        return true
    }

    protected onSimulationMoved(prevPos: Vector, data: PlayerTickData): void {
        // If the player moved, then there is no more chair or bed under them.
        const ps = this.player.state
        ps.sitting = false
        ps.lies = false
        ps.sleep = false
    }

    protected get username(): string { return this.player.session.username }
}

export class ClientPlayerControlManager extends PlayerControlManager {

    /**
     * These input values are set by the game.
     * They correspond to instant events (e.g. clicks and double clicks), not to continuous pressing of a button.
     * When the controls are processed, they are used once (cause some chagne to the player state), then reset.
     */
    instantControls = {
        switchFlying: false
    }

    private knownInputTime: float = 0
    /**
     * It contains data for all recent physics ticks (at least, those that are possibly not known to the server).
     * If a server sends a correction to an earlier tick, it's used to repeat the movement in the later ticks.
     */
    private dataQueue = new SimpleQueue<ClientPlayerTickData>()

    private controlPacketWriter = new PlayerControlPacketWriter()
    private hasCorrection = false
    private correctionPacket = new PlayerControlCorrectionPacket()

    getCurrentTickFraction(): float {
        if (!this.physicsSessionInitialized) {
            return 0
        }
        // we can't use this.knownTime here, because it may be rolled back by the server updates
        const physicsTicksFloat = (this.knownInputTime - this.baseTime) / PHYSICS_INTERVAL_MS
        return physicsTicksFloat - Math.floor(physicsTicksFloat)
    }

    startNewPhysicsSession(pos: IVector) {
        super.startNewPhysicsSession(pos)
        if (this.dataQueue) { // if the subclass constructor finished
            this.dataQueue.length = 0
        }
        this.hasCorrection = false
    }

    doClientTicks(): boolean {
        // if the initial step of the current physics session
        if (!this.physicsSessionInitialized) {
            this.initializePhysicsSession()
            return true
        }

        this.knownInputTime = MonotonicUTCDate.now()

        // prepare the simulation
        const dataQueue = this.dataQueue

        // apply the correction, simulate (repeat) invalidated ticks
        if (this.hasCorrection) {
            this.hasCorrection = false
            let ind = dataQueue.length - 1
            // We expect that there is at least one SENT element in the queue.
            // The SENT element before the 1st INVALIDATED has corrected data from the server.
            while(dataQueue.get(ind).invalidated) {
                ind--
            }
            let prevData = dataQueue.get(ind)

            if (DEBUG_LOG_PLAYER_CONTROL) {
                if (prevData?.endPhysicsTick !== this.knownPhysicsTicks) {
                    console.log(`control: prevData?.endPhysicsTick !== this.knownPhysicsTicks`, prevData.endPhysicsTick)
                }
                console.log(`control: applied at ${this.knownPhysicsTicks}`, this.current.player_state.pos)
            }

            while (++ind < dataQueue.length) {
                const data = dataQueue.get(ind)
                this.simulate(prevData, data)
                this.knownPhysicsTicks += data.physicsTicks
                data.invalidated = false
                prevData = data
            }
        }

        // the number of new ticks to be simulated
        let physicsTicks = Math.floor((this.knownInputTime - this.knownTime) / PHYSICS_INTERVAL_MS)
        // simulate the new tick(s)
        if (physicsTicks) {
            if (physicsTicks < 0) {
                throw new Error('physicsTicks < 0') // this should not happen
            }

            // Don't process more than PHYSICS_MAX_MS_PROCESS. The server will correct us if we're wrong.
            const maxPhysicsTicksProcess = Math.floor(PHYSICS_MAX_MS_PROCESS / PHYSICS_INTERVAL_MS)
            const skipPhysicsTicks = physicsTicks - maxPhysicsTicksProcess
            if (skipPhysicsTicks > 0) {
                const skippedTicksData = new ClientPlayerTickData(this.knownPhysicsTicks)
                skippedTicksData.initInputFrom(this.player, skipPhysicsTicks)
                skippedTicksData.initContextFrom(this.player)
                skippedTicksData.initOutputFrom(this.current)
                dataQueue.push(skippedTicksData)
                this.knownPhysicsTicks += skipPhysicsTicks
                physicsTicks = maxPhysicsTicksProcess
            }

            const data = new ClientPlayerTickData(this.knownPhysicsTicks)
            data.initInputFrom(this.player, physicsTicks)
            data.initContextFrom(this.player)
            this.knownPhysicsTicks += physicsTicks

            const prevData = dataQueue.getLast()
            this.simulate(prevData, data)

            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`control: simulated t${this.knownPhysicsTicks} ${data.outPos} ${data.outVelocity}`)
            }

            // Save the tick data to be sent to the server.
            // Possibly postpone its sending, and/or merge it with the previously unsent data.
            if (prevData?.equal(data)) {
                if (prevData.status === PLAYER_TICK_DATA_STATUS.SENT) {
                    // it can't be merged with the data already sent, but it contains no new data, so it can be delayed
                    data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SENDING_DELAYED
                    dataQueue.push(data)
                    if (DEBUG_LOG_PLAYER_CONTROL) {
                        console.log(`  control: pushed same`)
                    }
                } else {
                    // merge with the previous unsent data
                    prevData.physicsTicks += data.physicsTicks
                    if (DEBUG_LOG_PLAYER_CONTROL) {
                        console.log(`  control: merged s${prevData.status} #->${prevData.physicsTicks}`)
                    }
                }
            } else {
                // it differs, send it ASAP
                data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SEND_ASAP
                dataQueue.push(data)
                if (DEBUG_LOG_PLAYER_CONTROL) {
                    console.log(`  control: pushed different`)
                }
            }
        }

        return physicsTicks !== 0
    }

    applyCorrection(packetData: PacketBuffer) {
        const packet = this.correctionPacket
        packet.read(packetData)

        const debPrevKnownPhysicsTicks = this.knownPhysicsTicks
        const correctedPhysicsTick = packet.knownPhysicsTicks
        const correctedData = packet.data

        // remove all old data before the correction; we won't need it ever
        const dataQueue = this.dataQueue
        while(dataQueue.length && dataQueue.getFirst().endPhysicsTick < correctedPhysicsTick) {
            dataQueue.shift()
        }
        let exData = dataQueue.getFirst()
        if (exData == null) {
            // This is unexpected, but let's try to recover from this situation
            // TODO this is untested and probably buggy
            console.error('Control: applying correction: exData == null')
            const data = new ClientPlayerTickData(correctedPhysicsTick - 1)
            data.status = PLAYER_TICK_DATA_STATUS.SENT
            data.initInputEmpty(null, 1)
            data.copyContextFrom(correctedData)
            data.copyOutputFrom(correctedData)
            dataQueue.push(data)
            this.hasCorrection = true
            this.knownPhysicsTicks = correctedPhysicsTick
            return
        }

        // If the correction isn't aligned with the data end, e.g. because of ServerPlayerControlManager.doLaggingServerTicks
        if (exData.endPhysicsTick > correctedPhysicsTick) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log('Control: applying correction, end tick is not aligned')
            }
            // Split exData into corrected and uncorrected parts
            exData.physicsTicks = exData.endPhysicsTick - correctedPhysicsTick
            exData.startingPhysicsTick = correctedPhysicsTick
            // Insert fake data to be corrected
            exData = new ClientPlayerTickData(correctedPhysicsTick - 1)
            exData.status = PLAYER_TICK_DATA_STATUS.SENT
            exData.initInputEmpty(null, 1)
            dataQueue.unshift(exData)
        }

        exData.invalidated = false // if it was invalidated previously - now it's valid

        if (correctedPhysicsTick <= this.knownPhysicsTicks &&
            exData.contextEqual(correctedData) && exData.outEqual(correctedData)
        ) {
            if (DEBUG_LOG_PLAYER_CONTROL) {
                console.log(`Control: correction ${debPrevKnownPhysicsTicks}->${correctedPhysicsTick} skipped`)
            }
            // It's possible that we have sent several packets and received several corrections,
            // so the current data might be already corrected. Do nothing then.
            return
        }
        if (DEBUG_LOG_PLAYER_CONTROL) {
            console.log(`correction ${debPrevKnownPhysicsTicks} -> ..+${exData.physicsTicks}=${correctedPhysicsTick}`, exData.outPos, correctedData.outPos)
        }

        // The data differs. Set the result at that tick, and invalidate the results in later ticks
        this.hasCorrection = true
        this.knownPhysicsTicks = correctedPhysicsTick
        exData.copyContextFrom(correctedData)
        exData.copyOutputFrom(correctedData)
        for(let i = 1; i < dataQueue.length; i++) {
            const invalidatedData = dataQueue.get(i)
            invalidatedData.invalidated = true
            invalidatedData.copyContextFrom(correctedData)
        }
    }

    onServerAccepted(knownPhysicsTicks: int) {
        const dataQueue = this.dataQueue
        while(dataQueue.length && dataQueue.getFirst().endPhysicsTick <= knownPhysicsTicks) {
            dataQueue.shift()
        }
    }

    /** Sends an update, if there is anything that must be sent now */
    sendUpdate(): void {
        // find unsent data
        const dataQueue = this.dataQueue
        let firstUnsentIndex = dataQueue.length
        while(firstUnsentIndex > 0 && dataQueue.get(firstUnsentIndex - 1).status !== PLAYER_TICK_DATA_STATUS.SENT) {
            firstUnsentIndex--
        }
        // find which unsent data must be sent now
        let lastMustBeSentIndex: int | null = null
        const minPhysicsTick = this.knownPhysicsTicks - Math.floor(MAX_CLIENT_STATE_INTERVAL / PHYSICS_INTERVAL_MS)
        for(let i = firstUnsentIndex; i < dataQueue.length; i++) {
            const data = dataQueue.get(i)
            if (data.status === PLAYER_TICK_DATA_STATUS.PROCESSED_SEND_ASAP ||
                data.startingPhysicsTick <= minPhysicsTick
            ) {
                lastMustBeSentIndex = i
            }
        }
        // send all the data that must be sent now
        if (lastMustBeSentIndex !== null) {
            const writer = this.controlPacketWriter
            writer.startPutSessionId(this.physicsSessionId)
            for(let i = firstUnsentIndex; i <= lastMustBeSentIndex; i++) {
                const data = dataQueue.get(i)
                writer.putTickData(data)
                data.status = PLAYER_TICK_DATA_STATUS.SENT
            }
            this.player.world.server.Send({
                name: ServerClient.CMD_PLAYER_CONTROL_UPDATE,
                data: writer.finish()
            })
        }
    }

    private initializePhysicsSession(): void {
        // initialize the session
        this.physicsSessionInitialized = true
        this.baseTime = MonotonicUTCDate.now()
        this.knownPhysicsTicks = 0
        // notify the server
        const data: PlayerControlSessionPacket = {
            sessionId: this.physicsSessionId,
            baseTime: this.baseTime
        }
        this.player.world.server.Send({name: ServerClient.CMD_PLAYER_CONTROL_SESSION, data})
    }
    
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData): boolean {
        const pc = this.controlByType[data.contextControlType]
        prevData?.applyOutputToControl(pc)
        return super.simulate(prevData, data)
    }

}