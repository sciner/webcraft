"use strict";

import {Vector} from "../helpers/vector.js";
import type {Player} from "../player.js";
import {InDeltaCompressor, InPacketBuffer, OutDeltaCompressor, OutPacketBuffer,
    packBooleans, unpackBooleans
} from "../packet_compressor.js";
import type {PacketBuffer} from "../packet_compressor.js";
import {PrismarinePlayerControl} from "../vendors/prismarine-physics/using.js";
import {SpectatorPlayerControl} from "./spectator-physics.js";
import {
    MAX_CLIENT_STATE_INTERVAL, PHYSICS_INTERVAL_MS, DEBUG_LOG_PLAYER_CONTROL,
    PHYSICS_POS_DECIMALS, PHYSICS_VELOCITY_DECIMALS, PHYSICS_ROTATION_DECIMALS, PHYSICS_MAX_MS_PROCESS
} from "../constant.js";
import {SimpleQueue} from "../helpers/simple_queue.js";
import {monotonicUTCMillis} from "../helpers.js";
import type {PlayerControl} from "./player_control.js";
import {GameMode} from "../game_mode.js";

const tmpInBuffer = new InPacketBuffer()

enum PLAYER_TICK_DATA_STATUS {
    NEW,
    PROCESSED_SEND_ASAP,
    PROCESSED_SENDING_DELAYED,
    SENT
}

/** Ids of subsets of fields used by the delta compressor */
export enum PLAYER_TICK_DATA_SEQUENCE {
    INPUT,
    CONTEXT_OUTPUT
}

/** It represents input and output of player controls & physics in one several consecutive physics ticks. */
export abstract class PlayerTickData {
    static INPUT_FLAGS_COUNT = 8
    static OUT_FLAGS_COUNT = 2

    // input data
    inputFlags: int
    inputRotation = new Vector()
    // it's not a direct user input, but it's initialized/transferred along with input, because it fulfills a similar role
    physicsTicks: int // how many simulated physics ticks are contained in this data
    // context data - needed to repeat ticks correctly (acts somewhat like input, but from the game rather than the user)
    contextGameModeIndex: int
    contextControlType: int
    // output data
    outFlags: int
    outPos = new Vector()
    outVelocity = new Vector()

    /** Returns true if every serializable field is equal except {@link physicsTicks} */
    equal(other: PlayerTickData): boolean {
        return this.outEqual(other) && this.contextEqual(other) &&
            this.inputFlags === other.inputFlags &&
            this.inputRotation.equal(other.inputRotation)
    }

    initInputEmpty(prev: PlayerTickData | null, physicsTicks: int) {
        this.physicsTicks = physicsTicks
        this.inputFlags = 0
        if (prev) {
            this.inputRotation.copyFrom(prev.inputRotation)
        } else {
            this.inputRotation.set(0, 0, 0)
        }
    }

    copyInputFrom(src: PlayerTickData) {
        this.physicsTicks = src.physicsTicks
        this.inputFlags = src.inputFlags
        this.inputRotation.copyFrom(src.inputRotation)
    }

    applyInputTo(controlManager: PlayerControlManager, pc: PlayerControl) {
        const controls = pc.controls
        const player_state = pc.player_state
        // TODO rewrite it into a single destructing assignment when IntellijIDEA starts understanding it
        const [back, forward, right, left, jump, sneak, sprint, switchFlying] = unpackBooleans(
            this.inputFlags, PlayerTickData.INPUT_FLAGS_COUNT)
        controls.back       = back
        controls.forward    = forward
        controls.right      = right
        controls.left       = left
        controls.jump       = jump
        controls.sneak      = sneak
        controls.sprint     = sprint
        player_state.yaw = this.inputRotation.z

        const game_mode = GameMode.byIndex[this.contextGameModeIndex]
        if (switchFlying && game_mode.can_fly) {
            player_state.flying = !player_state.flying
        }
    }

    initContextFrom(player: Player) {
        const controlManager = player.controlManager
        this.contextGameModeIndex  = player.game_mode.getCurrent().index
        this.contextControlType   = controlManager.current.type
    }

    copyContextFrom(src: PlayerTickData) {
        this.contextControlType = src.contextControlType
        this.contextGameModeIndex = src.contextGameModeIndex
    }

    contextEqual(other: PlayerTickData): boolean {
        return this.contextControlType === other.contextControlType &&
            this.contextGameModeIndex === other.contextGameModeIndex
    }

    initOutputFrom(pc: PlayerControl) {
        this.outFlags = packBooleans(pc.sneak, pc.player_state.flying)
        this.outPos.copyFrom(pc.player_state.pos)
        this.outVelocity.copyFrom(pc.player_state.vel)
    }

    copyOutputFrom(src: PlayerTickData) {
        this.outFlags = src.outFlags
        this.outPos.copyFrom(src.outPos)
        this.outVelocity.copyFrom(src.outVelocity)
    }

    applyOutputToControl(pc: PlayerControl) {
        const [sneak, flying] = unpackBooleans(this.outFlags, PlayerTickData.OUT_FLAGS_COUNT)
        const player_state = pc.player_state
        player_state.flying = flying
        player_state.pos.copyFrom(this.outPos)
        player_state.vel.copyFrom(this.outVelocity)
    }

    outEqual(other: PlayerTickData): boolean {
        return this.outFlags === other.outFlags &&
            this.outPos.equal(other.outPos) &&
            this.outVelocity.equal(other.outVelocity)
    }

    writeInput(dc: OutDeltaCompressor) {
        dc.startSequence(PLAYER_TICK_DATA_SEQUENCE.INPUT)
            .putInt(this.physicsTicks)
            .putInt(this.inputFlags)
            .putFloatVector(this.inputRotation)
    }

    writeContextAndOutput(dc: OutDeltaCompressor) {
        dc.startSequence(PLAYER_TICK_DATA_SEQUENCE.CONTEXT_OUTPUT)
            // context
            .putInt(this.contextControlType)
            .putInt(this.contextGameModeIndex)
            // output
            .putInt(this.outFlags)
            .putFloatVector(this.outPos)
            .putFloatVector(this.outVelocity)
    }

    readInput(dc: InDeltaCompressor): void {
        dc.startSequence(PLAYER_TICK_DATA_SEQUENCE.INPUT)
        this.physicsTicks = dc.getInt()
        InPacketBuffer.checkMinMax(this.physicsTicks, 1)
        this.inputFlags = dc.getInt()
        dc.getFloatVector(this.inputRotation)
    }

    readContextAndOutput(dc: InDeltaCompressor): void {
        dc.startSequence(PLAYER_TICK_DATA_SEQUENCE.CONTEXT_OUTPUT)
        // context
        this.contextControlType = dc.getInt()
        this.contextGameModeIndex = dc.getInt()
        // output
        this.outFlags = dc.getInt()
        dc.getFloatVector(this.outPos)
        dc.getFloatVector(this.outVelocity)
    }

    toStr(startingPhysicsTick: int): string {
        return `t${startingPhysicsTick}+${this.physicsTicks}=t${startingPhysicsTick+this.physicsTicks} ${this.outPos}`
    }
}

class ClientPlayerTickData extends PlayerTickData {
    // local data, not serialized
    startingPhysicsTick?: int
    status = PLAYER_TICK_DATA_STATUS.NEW
    /**
     * It means the following:
     * - results of the previous physics ticks have been corrected, so this result is likely incorrect
     * - it must be processed again
     * - it shouldn't be sent again, because it was already sent
     */
    invalidated?: boolean
    
    constructor(startingPhysicsTick: int) {
        super()
        this.startingPhysicsTick = startingPhysicsTick
    }

    initInputFrom(player: Player, physicsTicks: int) {
        const state = player.state
        const controls = player.controls
        const controlManager = player.controlManager
        const applyControl = controls.enabled && !state.sleep && !state.sitting && !state.lies

        this.inputFlags = applyControl
            ? packBooleans(controls.back,
                controls.forward,
                controls.right,
                controls.left,
                controls.jump,
                controls.sneak,
                controls.sprint,
                controlManager.instantControls.switchFlying
            ) : 0
        player.controlManager.instantControls.switchFlying = false
        this.inputRotation.copyFrom(player.rotate).roundSelf(PHYSICS_ROTATION_DECIMALS)
        this.physicsTicks = physicsTicks
    }

    // Not inclusive
    get endPhysicsTick() { return this.startingPhysicsTick + this.physicsTicks }
}

/** @see PlayerControlManager.startNewPhysicsSession */
export enum PHYSICS_SESSION_STATE {
    UNINITIALIZED,    // must send/receive the 1st packet
    WAITING_FIRST_PACKET,
    ONGOING,
    CLOSED  // a player is not moving, and is waiting for the data/portal to start a new session
}

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

    /** @see startNewPhysicsSession */
    protected physicsSessionState: PHYSICS_SESSION_STATE
    /** If of the current physics session. They are numbered consecutively. The 1st session will start from 0. */
    protected physicsSessionId = -1

    /** The time {@link monotonicUTCMillis} at which the physics session started. */
    protected baseTime: float
    /** The number of physics session (see {@link PHYSICS_INTERVAL_MS}) from the start of the current physics session. */
    protected knownPhysicsTicks: int

    protected outDeltaCompressor = new OutDeltaCompressor()
    protected inDeltaCompressor = new InDeltaCompressor()
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
        this.physicsSessionState = PHYSICS_SESSION_STATE.UNINITIALIZED
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

    private hasCorrection = false
    private tmpCorrectedData = new ClientPlayerTickData(0)
    private outPacketBuffer = new OutPacketBuffer()

    getCurrentTickFraction(): float {
        if (this.physicsSessionState === PHYSICS_SESSION_STATE.UNINITIALIZED) {
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
        const now = monotonicUTCMillis()

        // the initial step
        if (this.physicsSessionState === PHYSICS_SESSION_STATE.UNINITIALIZED) {
            this.physicsSessionState = PHYSICS_SESSION_STATE.WAITING_FIRST_PACKET
            this.baseTime = now
            this.knownPhysicsTicks = 0
            return true
        }

        this.knownInputTime = now

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

        // simulate the new tick(s)
        let physicsTicks = Math.floor((this.knownInputTime - this.knownTime) / PHYSICS_INTERVAL_MS)

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

        return true
    }

    applyCorrection(packetData: PacketBuffer) {
        tmpInBuffer.import(packetData)
        const dc = this.inDeltaCompressor.start(tmpInBuffer)
        const debPrevKnownPhysicsTicks = this.knownPhysicsTicks
        const correctedPhysicsTick = tmpInBuffer.getInt()
        const correctedData = this.tmpCorrectedData
        correctedData.readContextAndOutput(dc)
        dc.checkHash()

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

    /** @returns a pakced data if there is an update to server ready, or null if there isn't */
    exportUpdate(): PacketBuffer | null {
        const buf = this.outPacketBuffer
        const dc = this.outDeltaCompressor.start(buf)

        // 1st packet of a physics session
        if (this.physicsSessionState === PHYSICS_SESSION_STATE.WAITING_FIRST_PACKET) {
            this.physicsSessionState = PHYSICS_SESSION_STATE.ONGOING
            this.writePacketHeader(dc)
            buf.putFloat(this.baseTime)
        }

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
        if (lastMustBeSentIndex !== null) {
            if (buf.length === 0) { // if we haven't written anything yet
                this.writePacketHeader(dc)
            }
            // export all the data that must be sent now
            for(let i = firstUnsentIndex; i <= lastMustBeSentIndex; i++) {
                const data = dataQueue.get(i)
                data.writeInput(dc)
                data.writeContextAndOutput(dc)
                data.status = PLAYER_TICK_DATA_STATUS.SENT
            }
        }
        return buf.length ? dc.putHash().buf.exportAndReset() : null
    }
    
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData): boolean {
        const pc = this.controlByType[data.contextControlType]
        prevData?.applyOutputToControl(pc)
        return super.simulate(prevData, data)
    }

    private writePacketHeader(dc: OutDeltaCompressor) {
        dc.putInt(this.physicsSessionId)
    }

}