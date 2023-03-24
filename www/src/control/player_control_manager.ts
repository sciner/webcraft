"use strict";

import {Vector} from "../helpers/vector.js";
import type {Player} from "../player.js";
import type {PacketBuffer} from "../packet_compressor.js";
import {PrismarinePlayerControl} from "../prismarine-physics/using.js";
import {SPECTATOR_SPEED_CHANGE_MAX, SPECTATOR_SPEED_CHANGE_MIN, SPECTATOR_SPEED_CHANGE_MULTIPLIER, SpectatorPlayerControl} from "./spectator-physics.js";
import {
    MAX_CLIENT_STATE_INTERVAL, PHYSICS_INTERVAL_MS, DEBUG_LOG_PLAYER_CONTROL,
    PHYSICS_POS_DECIMALS, PHYSICS_VELOCITY_DECIMALS, PHYSICS_MAX_MS_PROCESS, DEBUG_LOG_PLAYER_CONTROL_DETAIL
} from "../constant.js";
import {SimpleQueue} from "../helpers/simple_queue.js";
import type {PlayerControl} from "./player_control.js";
import {GameMode} from "../game_mode.js";
import {MonotonicUTCDate} from "../helpers.js";
import {ClientPlayerTickData, PLAYER_TICK_DATA_STATUS, PlayerTickData} from "./player_tick_data.js";
import {ServerClient} from "../server_client.js";
import {PlayerControlCorrectionPacket, PlayerControlPacketWriter, PlayerControlSessionPacket} from "./player_control_packets.js";
import {PlayerSpeedLogger} from "./player_speed_logger.js";

const DEBUG_LOG_SPECTATOR_SPEED = false

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
    startNewPhysicsSession(pos: IVector): void {
        const pc = this.current
        pc.resetState()
        pc.setPos(pos)
        this.physicsSessionId++
        this.physicsSessionInitialized = false
        this.knownPhysicsTicks = 0
    }

    /**
     * Simulates all the physics ticks described by {@link data}
     * If the simulation is successful, sets output of {@link data}.
     * If the simulation is unsuccessful, sets output of {@link data} only on the client.
     * @param outPosBeforeLastTick - the position before the last simulated tick.
     * @return true if the simulation was successful, i.e. the {@link PlayerControl.simulatePhysicsTick}.
     *   It may be unsuccessful if the chunk is not ready.
     *   If the simulation fails, all the important properties of {@link PlayerControl} remain unchanged
     *     (assuming {@link PlayerControl.restorePartialState} is correct).
     */
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData,
                       outPosBeforeLastTick?: Vector): boolean {
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
        player_state.flying &&= gameMode.can_fly // a hack-fix to ensure the player isn't flying when it shouldn't

        // remember the state before the simulation
        const prevPos = this.tmpPos.copyFrom(player_state.pos)
        pc.backupPartialState()

        // simulate the steps
        for(let i = 0; i < data.physicsTicks; i++) {
            outPosBeforeLastTick?.copyFrom(player_state.pos)
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
     * A separate {@link SpectatorPlayerControl} used only for free cam.
     * Unlike using {@link this.spectator}, the actual control isn't switched.
     * It's a client-only feature, the server doesn't know about it.
     */
    private freeCamSpectator: SpectatorPlayerControl
    #isFreeCam = false

    /**
     * These input values are set by the game.
     * They correspond to instant events (e.g. clicks and double clicks), not to continuous pressing of a button.
     * When the controls are processed, they are used once (cause some chagne to the player state), then reset.
     */
    instantControls = {
        switchFlying: false
    }

    private knownInputTime: float = 0
    private prevPhysicsTickPos = new Vector() // used to interpolate pos within the tick
    private prevPhysicsTickFreeCamPos = new Vector()
    private skipFreeCamSneakInput = false // used to skip pressing SHIFT after switching to freeCamp
    private freeCamPos = new Vector()
    private speedLogger = DEBUG_LOG_SPECTATOR_SPEED ? new PlayerSpeedLogger() : null
    /**
     * It contains data for all recent physics ticks (at least, those that are possibly not known to the server).
     * If a server sends a correction to an earlier tick, it's used to repeat the movement in the later ticks.
     */
    private dataQueue = new SimpleQueue<ClientPlayerTickData>()

    private sedASAP = false // if it's true, the next physics tick data should be sent ASAP (not merged with previous)
    private controlPacketWriter = new PlayerControlPacketWriter()
    private hasCorrection = false
    private correctionPacket = new PlayerControlCorrectionPacket()

    constructor(player: Player) {
        super(player)
        const pos = new Vector(player.sharedProps.pos)
        this.freeCamSpectator = new SpectatorPlayerControl(player.world, pos)
        this.prevPhysicsTickPos.copyFrom(player.sharedProps.pos)
    }

    private getCurrentTickFraction(): float {
        if (!this.physicsSessionInitialized) {
            return 0
        }
        // we can't use this.knownTime here, because it may be rolled back by the server updates
        const physicsTicksFloat = (this.knownInputTime - this.baseTime) / PHYSICS_INTERVAL_MS
        return physicsTicksFloat - Math.floor(physicsTicksFloat)
    }

    startNewPhysicsSession(pos: IVector): void {
        super.startNewPhysicsSession(pos)
        this.prevPhysicsTickPos?.copyFrom(pos) // it's null in the constructor
        if (this.dataQueue) { // if the subclass constructor finished
            this.dataQueue.length = 0
        }
        this.hasCorrection = false
        this.speedLogger?.reset()
    }

    updateCurrentControlType(notifyClient: boolean): boolean {
        const res = super.updateCurrentControlType(notifyClient)
        if (res) {
            this.speedLogger?.reset()
        }
        return res
    }

    lerpPos(dst: Vector, prevPos: Vector = this.prevPhysicsTickPos, pc: PlayerControl = this.current): void {
        const pos = pc.player_state.pos
        if (pos.distance(prevPos) > 10.0) {
            dst.copyFrom(pos)
        } else {
            dst.lerpFrom(prevPos, pos, this.getCurrentTickFraction())
        }
        dst.roundSelf(8)
        if (this.current === this.spectator) {
            this.speedLogger?.add(dst)
        }
    }

    get isFreeCam(): boolean { return this.#isFreeCam }

    set isFreeCam(v: boolean) {
        this.#isFreeCam = v
        if (v) {
            const pos = this.player.getEyePos()
            this.freeCamSpectator.resetState()
            this.freeCamSpectator.setPos(pos)
            this.prevPhysicsTickFreeCamPos.copyFrom(pos)
            this.skipFreeCamSneakInput = true
        }
        this.speedLogger?.reset()
    }

    getFreeCampPos(): Vector {
        this.lerpPos(this.freeCamPos, this.prevPhysicsTickFreeCamPos, this.freeCamSpectator)
        this.speedLogger?.add(this.freeCamPos)
        return this.freeCamPos
    }

    changeSpectatorSpeed(value: number): boolean {
        let pc: SpectatorPlayerControl
        if (this.#isFreeCam) {
            pc = this.freeCamSpectator
        } else if (this.current === this.spectator) {
            pc = this.spectator
        } else {
            return false
        }
        const mul = pc.speedMultiplier ?? 1
        pc.speedMultiplier = value > 0
            ? Math.min(mul * SPECTATOR_SPEED_CHANGE_MULTIPLIER, SPECTATOR_SPEED_CHANGE_MAX)
            : Math.max(mul / SPECTATOR_SPEED_CHANGE_MULTIPLIER, SPECTATOR_SPEED_CHANGE_MIN)
        return true
    }

    doClientTicks(): void {
        // if the initial step of the current physics session
        if (!this.physicsSessionInitialized) {
            this.initializePhysicsSession()
            this.sendUpdate()
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

            if (prevData?.endPhysicsTick !== this.knownPhysicsTicks) {
                console.error(`Control: prevData?.endPhysicsTick !== this.knownPhysicsTicks`, prevData.endPhysicsTick)
            }
            if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                console.log(`Control: correction applied at ${this.knownPhysicsTicks}`, this.current.player_state.pos)
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
                console.error(`Control: skipping ${skipPhysicsTicks} ticks`)
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

            // Simulate freeCam in addition to the normal simulation. Clear the input to the normal simulation
            if (this.#isFreeCam) {
                this.simulateFreeCam(data)
                data.initInputEmpty(data, data.physicsTicks)
            }

            const prevData = dataQueue.getLast()
            this.simulate(prevData, data, this.prevPhysicsTickPos)

            if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                console.log(`control: simulated t${this.knownPhysicsTicks} ${data.outPos} ${data.outVelocity}`)
            }

            // Save the tick data to be sent to the server.
            // Possibly postpone its sending, and/or merge it with the previously unsent data.
            if (prevData?.equal(data) && !this.sedASAP) {
                if (prevData.status === PLAYER_TICK_DATA_STATUS.SENT) {
                    // it can't be merged with the data already sent, but it contains no new data, so it can be delayed
                    data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SENDING_DELAYED
                    dataQueue.push(data)
                    if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                        console.log(`  control: pushed same`)
                    }
                } else {
                    // merge with the previous unsent data
                    prevData.physicsTicks += data.physicsTicks
                    if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                        console.log(`  control: merged s${prevData.status} #->${prevData.physicsTicks}`)
                    }
                }
            } else {
                // it differs (or we had to send it ASAP because we're far behind the server), send it ASAP
                this.sedASAP = false
                data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SEND_ASAP
                dataQueue.push(data)
                if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                    console.log(`  control: pushed different or ASAP`)
                }
            }
        }

        if (physicsTicks !== 0) {
            this.sendUpdate()
        }
    }

    applyCorrection(packetData: PacketBuffer) {
        const packet = this.correctionPacket
        packet.read(packetData)
        if (packet.physicsSessionId !== this.physicsSessionId) {
            return
        }

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
            // It happens e.g. when the browser window was closed. The client is severely behind the server.
            console.warn('Control: applying correction without existing data')
            const data = new ClientPlayerTickData(correctedPhysicsTick - 1)
            data.status = PLAYER_TICK_DATA_STATUS.SENT
            data.initInputEmpty(null, 1)
            data.copyContextFrom(correctedData)
            data.copyOutputFrom(correctedData)
            dataQueue.push(data)
            this.hasCorrection = true
            this.knownPhysicsTicks = correctedPhysicsTick
            this.sedASAP = true // because the client is severely behind the server, notify the server ASAP
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
            if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
                console.log(`Control: correction ${debPrevKnownPhysicsTicks}->${correctedPhysicsTick} skipped`)
            }
            // It's possible that we have sent several packets and received several corrections,
            // so the current data might be already corrected. Do nothing then.
            return
        }
        if (DEBUG_LOG_PLAYER_CONTROL_DETAIL) {
            console.log(`Control: correction ${debPrevKnownPhysicsTicks} -> ..+${exData.physicsTicks}=${correctedPhysicsTick}`, exData.outPos, correctedData.outPos)
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
    private sendUpdate(): void {
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
            writer.startPutHeader({
                physicsSessionId: this.physicsSessionId,
                physicsTick: dataQueue.get(firstUnsentIndex).startingPhysicsTick
            })
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
    
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData,
                       outPosBeforeLastTick?: Vector): boolean {
        const pc = this.controlByType[data.contextControlType]
        prevData?.applyOutputToControl(pc)
        if (super.simulate(prevData, data, outPosBeforeLastTick)) {
            return true
        }
        data.initOutputFrom(pc)
        return false
    }

    private simulateFreeCam(data: PlayerTickData) {
        const pc = this.freeCamSpectator
        data.applyInputTo(this, pc)
        // skip pressing SHIFT after switching to freeCamp
        if (this.skipFreeCamSneakInput) {
            this.skipFreeCamSneakInput &&= pc.controls.sneak
            pc.controls.sneak = false
        }
        // simulate the steps
        for(let i = 0; i < data.physicsTicks; i++) {
            this.prevPhysicsTickFreeCamPos.copyFrom(pc.getPos())
            pc.simulatePhysicsTick()
        }
    }
}