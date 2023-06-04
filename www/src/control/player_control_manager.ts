"use strict";

import {Vector} from "../helpers/vector.js";
import type {Player} from "../player.js";
import type {PacketBuffer} from "../packet_compressor.js";
import {PrismarinePlayerControl, TPrismarineOptions} from "../prismarine-physics/using.js";
import {SPECTATOR_SPEED_CHANGE_MAX, SPECTATOR_SPEED_CHANGE_MIN, SPECTATOR_SPEED_CHANGE_MULTIPLIER, SpectatorPlayerControl} from "./spectator-physics.js";
import {DEBUG_LOG_PLAYER_CONTROL, DEBUG_LOG_PLAYER_CONTROL_DETAIL, MAX_CLIENT_STATE_INTERVAL, PHYSICS_INTERVAL_MS, PHYSICS_MAX_TICKS_PROCESSED, PHYSICS_POS_DECIMALS, PHYSICS_VELOCITY_DECIMALS} from "../constant.js";
import {SimpleQueue} from "../helpers/simple_queue.js";
import type {PlayerControl} from "./player_control.js";
import {GameMode} from "../game_mode.js";
import {Helpers, MonotonicUTCDate, Mth} from "../helpers.js";
import {ClientPlayerTickData, PLAYER_TICK_DATA_STATUS, PLAYER_TICK_MODE, PlayerTickData} from "./player_tick_data.js";
import {ServerClient} from "../server_client.js";
import {PlayerControlCorrectionPacket, PlayerControlPacketWriter, PlayerControlSessionPacket} from "./player_control_packets.js";
import {PlayerSpeedLogger, PlayerSpeedLoggerMode} from "./player_speed_logger.js";
import {LimitedLogger} from "../helpers/limited_logger.js";
import {DrivingPlace} from "./driving.js";
import type {PrismarinePlayerState} from "../prismarine-physics/index.js";
import type {ICmdPickatData} from "../pickat.js";
import type {WorldAction} from "../world_action.js";

const DEBUG_LOG_SPEED = false
const DEBUG_LOG_SPEED_MODE = PlayerSpeedLoggerMode.COORD_XYZ

/**
 * It contains multiple controllers (subclasses of {@link PlayerControl}), switches between them,
 * calls the controllers to update the player state based on the input, and synchronizes the state
 * between the server and the client.
 */
export abstract class PlayerControlManager<TPlayer extends Player> {
    player: TPlayer

    // the different controllers
    spectator: SpectatorPlayerControl
    prismarine?: PrismarinePlayerControl // на фейковом клиенте undefined для spectator_bot
    protected controlByType: PlayerControl[]
    /** The controller selected at the moment. */
    current: PlayerControl

    /**
     * Each session starts uninitialized. To become initialized, {@link baseTime} must be set.
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
    /**
     * Число физических тиков (см. {@link PHYSICS_INTERVAL_MS}) от начала физической сессии, выходные данные в которых
     * известны. Оно обычно только увеличивается, но может уменьшаться на клиенте при получении коррекции.
     * Тики нумеруются с 0. Например, knownPhysicsTicks == 2 означает что известны тики 0 и 1, а тик 2 - не известен.
     */
    protected knownPhysicsTicks: int

    private tmpPos = new Vector()

    constructor(player: TPlayer) {
        const is_spectator_bot = player.options?.is_spectator_bot
        this.player = player
        const pos = new Vector(player.sharedProps.pos)
        const options: TPrismarineOptions = {
            effects                 : player.effects,
            airborneInertia         : 0.76, // 0.91 in Minecraft (default), 0.546 in typical old bugged jumps
            airborneAcceleration    : 0.05  // 0.02 in Minecraft (default), 0.1 in typical old bugged jumps
        }
        if (!is_spectator_bot) {
            this.prismarine = new PrismarinePlayerControl(player.world, pos, options)
        }
        const useOldSpectator = Qubatch.settings?.old_spectator_controls ?? false
        this.spectator = new SpectatorPlayerControl(player.world, pos, useOldSpectator)
        this.controlByType = [this.prismarine, this.spectator]
        this.current = this.spectator // it doesn't matter what we choose here, it'll be corrected in the next line
        this.updateCurrentControlType(false)
        this.startNewPhysicsSession(pos)
    }

    /** Приводит углы поворота игрока к нормальным значениям для камеры */
    static fixRotation(rotation: IVector): IVector {
        rotation.z = Mth.radians_to_0_2PI_range(rotation.z)
        rotation.x = Mth.clampModule(rotation.x, Mth.PI_DIV2)
        return rotation
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
        this.resetState(pc_previous.getPos())
        return true
    }

    /**
     * A "physics session" is a continuous span of time during which all control ticks are numbered.
     * When a major game event, such as teleport occurs, and it's hard to keep the hosts synchronized,
     * the controls are reset and a new physics session begins.
     */
    startNewPhysicsSession(pos: IVector): void {
        this.resetState(pos)
        this.physicsSessionId++
        this.physicsSessionInitialized = false
        this.knownPhysicsTicks = 0
    }

    protected resetState(pos: IVector): void {
        this.current.resetState()
        this.setPos(pos)
    }

    /**
     * The result is read-only. It's valid only until the next change.
     * Do not modify it directly or store a reference to it.
     */
    getPos(): Vector {
        return this.current.player_state.pos
    }

    /**
     * @param worldActionId - id of the associated WorldAction. If it's not null, has the following effect:
     * - on the client: data for this physics tick is created that is based on external change, not simulation.
     *   It's sent to the server, and the server's physics will have to wait for this action to complete on the server.
     * - on the server: the controller is notified that the action completed, so if the physics was waiting for it,
     *   it may continue
     */
    setPos(pos: IVector): this {
        this.current.setPos(pos)
        return this
    }

    setVelocity(x: IVector | number[] | number, y?: number, z?: number): this {
        this.current.player_state.vel.set(x, y, z)
        return this
    }

    /**
     * Simulates all the physics ticks described by {@link data}
     * If the simulation is successful, sets output of {@link data}.
     * If the simulation is unsuccessful, sets output of {@link data} only on the client.
     * @param outPosBeforeLastTick - the position before the last simulated tick.
     * @param repeated - true если это повтор симуляции (на клиенте из-за коррекции)
     * @return true if the simulation was successful, i.e. the {@link PlayerControl.simulatePhysicsTick}.
     *   It may be unsuccessful if the chunk is not ready.
     *   If the simulation fails, all the important properties of {@link PlayerControl} remain unchanged
     *     (assuming {@link PlayerControl.copyPartialStateFromTo} is correct).
     */
    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData, repeated: boolean): boolean {
        const pc = this.controlByType[data.contextControlType]
        const gameMode = GameMode.byIndex[data.contextGameModeIndex]
        const player_state = pc.player_state
        const driving = this.player.driving

        // this prevents, e.g. huge jumps after switching to/from spectator
        if (prevData && pc.type !== prevData.contextControlType) {
            pc.resetState()
        }

        // apply input
        data.applyInputTo(this, pc)

        if (!driving) {
            // special state adjustments
            player_state.flying &&= gameMode.can_fly // a hack-fix to ensure the player isn't flying when it shouldn't
            // if a player was running before sitting, remove that speed, so it doesn't move after sitting
            if (data.contextTickMode === PLAYER_TICK_MODE.SITTING_OR_LYING) {
                player_state.vel.zero()
            }
        }

        const prevPos = this.tmpPos.copyFrom(player_state.pos)

        // подготовить симуляцию вождения (если оно есть)
        pc.drivingCombinedState = driving?.getSimulatedState(player_state as PrismarinePlayerState)

        // remember the state before the simulation
        pc.copyPartialStateFromTo(pc.simulatedState, pc.backupState)

        // simulate the steps
        for(let i = 0; i < data.physicsTicks; i++) {
            const pos = player_state.pos
            if (pc.requiresChunk) {
                const chunk = this.player.world.chunkManager.getByPos(pos)
                if (!chunk?.isReady()) {
                    pc.copyPartialStateFromTo(pc.backupState, pc.simulatedState)
                    return false
                }
            }
            this.onBeforeSimulatingTick(pc)
            if (!pc.simulatePhysicsTick(repeated)) {
                pc.copyPartialStateFromTo(pc.backupState, pc.simulatedState)
                return false
            }
            // round the results between each step
            // It's necessary in case combined steps will be split (I'm not sure if it happens, but it's better be safe)
            player_state.pos.roundSelf(PHYSICS_POS_DECIMALS)
            player_state.vel.roundSelf(PHYSICS_VELOCITY_DECIMALS)
        }
        // обновить состояние водиеля, если это было вождение
        driving?.applyToParticipantControl(pc as PrismarinePlayerControl, DrivingPlace.DRIVER, false)

        data.initOutputFrom(pc)
        this.onSimulation(prevPos, data)
        return true
    }

    protected onSimulation(prevPos: Vector, data: PlayerTickData): void {
        // nothing, override it subclasses
    }

    protected get username(): string { return this.player.session.username }

    protected onBeforeSimulatingTick(pc: PlayerControl): void {
        // ничего; переопределено в субклассах
    }
}

export class ClientPlayerControlManager extends PlayerControlManager<Player> {

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

    private knownInputTime: float
    private prevPhysicsTickPos = new Vector() // used to interpolate pos within the tick
    private freeCamPos = new Vector()
    private freeCamRotation = new Vector()
    private speedLogger = DEBUG_LOG_SPEED ? new PlayerSpeedLogger(DEBUG_LOG_SPEED_MODE) : null
    private logger = new LimitedLogger({
        prefix: 'Control: ',
        minInterval: 1000,
        debugValueEnabled: 'DEBUG_LOG_PLAYER_CONTROL',
        debugValueShowSkipped: 'SHOW_SKIPPED',
        enabled: DEBUG_LOG_PLAYER_CONTROL
    })
    private fineLogger = new LimitedLogger({
        ...this.logger.options,
        minInterval: 0,
        debugValueEnabled: 'DEBUG_LOG_PLAYER_CONTROL_DETAIL',
        enabled: DEBUG_LOG_PLAYER_CONTROL_DETAIL
    })
    private alwaysLogger = new LimitedLogger({
        ...this.logger.options,
        enabled: true
    })
    /**
     * It contains data for all recent physics ticks (at least, those that are possibly not known to the server).
     * If a server sends a correction to an earlier tick, it's used to repeat the movement in the later ticks.
     */
    private dataQueue = new SimpleQueue<ClientPlayerTickData>()

    // =================== связанное с внешними изменениями ===================

    /**
     * Если true, было какое-то воздействие на состояние игрока или управления извне (не из этого класса).
     * Например: изменение позиции, угла поворота, {@link externalChangeEventIds}, {@link externalChangeDisableControls}.
     */
    private hasExternalChange: boolean
    /**
     * Используется только при {@link hasExternalChange}.
     * Содержит id действий, с которым надо синхронизироваться, см. {@link syncWithEventId}
     */
    private externalChangeEventIds: int[] = []
    /**
     * Используется только если ({@link hasExternalChange} && {@link externalChangeEventIds}.length).
     * Если true, то управление должно быть отключено до прихода ответа на пакет, содержащий {@link externalChangeEventIds}.
     */
    private externalChangeDisableControls: boolean

    /**
     * Если не null, то любые упарвление (и вообще симуляция физики) отключена
     * пока с скрвера не придет коррекция или подтверждение на это число тиков.
     * Это не номер тика, а их число (так же как {@link knownPhysicsTicks}).
     */
    private controlsDisabledUntilServerTicks: int | null
    /**
     * Если не null, то коррекции до этого числа тиков (не включительно) игнорируются
     * (из-за того, что в последнем из этих тиков были внешние изменения которые невозможно повторить).
     */
    private correctionsDisabledUntilServerTicks: int | null
    /** Если true, то при следующей симуляции будет считаться что игрок не нажимал на клавиши, потом этот флаг сбросится */
    private ignorePlayerControlsUntilNextSimulation: boolean

    // ========================================================================

    private sedASAP = false // if it's true, the next physics tick data should be sent ASAP (not merged with previous)
    private controlPacketWriter = new PlayerControlPacketWriter()
    private hasCorrection = false
    private correctionPacket = new PlayerControlCorrectionPacket()
    triedDriving = false // true если игрок хоть раз попытался начать вождение

    constructor(player: Player) {
        super(player)
        const pos = new Vector(player.sharedProps.pos)
        const useOldSpectator = Qubatch.settings?.old_spectator_controls ?? false
        this.freeCamSpectator = new SpectatorPlayerControl(player.world, pos, useOldSpectator, true)
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
        if (this.dataQueue) { // if the subclass constructor finished
            this.prevPhysicsTickPos.copyFrom(pos) // it's null in the constructor
            this.dataQueue.length = 0
            // очистить связанное с внешними изменениями
            this.externalChangeEventIds.length = 0
        }
        this.hasCorrection = false
        // очистить связанное с внешними изменениями
        this.hasExternalChange = false
        this.externalChangeDisableControls = false
        this.controlsDisabledUntilServerTicks = null
        this.correctionsDisabledUntilServerTicks = null
        this.ignorePlayerControlsUntilNextSimulation = true
    }

    protected resetState(pos: IVector): void {
        super.resetState(pos)
        this.speedLogger?.reset()
    }

    setPos(pos: IVector): this {
        super.setPos(pos)
        this.hasExternalChange = true
        return this
    }

    /**
     * См. общее описание синхронизации в doc/player_control.md
     *
     * Запоминает что состояние игрока изменено извне.
     * Можно вызывать как сразу до так и сразу после изменений состояния игрока.
     * Сервер при выполнении аналогичных действий должен вызывать аналогичный метод syncWithEventId с тем же {@link controlEventId}
     * @param disableControls - если true, то управление блокируется до тех пор, пока сервер не ответит на это
     *   изменение (коррекцийе или подтверждением)
     *
     * См. также {@link PickAt.getNextId}
     */
    syncWithEventId(controlEventId: int | null, disableControls: boolean): this {
        if (controlEventId != null) {
            this.hasExternalChange = true
            this.externalChangeEventIds.push(controlEventId)
            this.externalChangeDisableControls ||= disableControls
        }
        return this
    }

    /**
     * То же что {@link syncWithEventId}, но берет id события из {@link pickAtData} и помечает в
     * {@link pickAtData} что нужно синхронизироваться с управлением по этому id.
     */
    syncWithPickatEvent(pickAtData: ICmdPickatData, disableControls: boolean): void {
        pickAtData.controlEventId = pickAtData.id
        this.syncWithEventId(pickAtData.id, disableControls)
    }

    /**
     * То же что {@link syncWithPickatEvent}, но выполняется только если действие {@link action} требует
     * синхронизации.
     */
    syncWithWorldActionIfNeeded(pickAtData: ICmdPickatData, action: WorldAction): void {
        if (action.sitting || action.sleep) {
            this.syncWithPickatEvent(pickAtData, false)
            action.controlEventId = pickAtData.id // это не обязательно на клиенте для сидения и лежания
        }
    }

    /** Call it after changing the position if you want the change to be instant, e.g. placing the player on the bed. */
    suppressLerpPos(): void {
        this.prevPhysicsTickPos.copyFrom(this.current.player_state.pos)
    }

    lerpPos(dst: Vector, prevPos: Vector = this.prevPhysicsTickPos, pc: PlayerControl = this.current): void {
        const pos = pc.player_state.pos
        if (pc === this.spectator) {
            this.spectator.getCurrentPos(dst)
        } else {
            const tickFraction = this.getCurrentTickFraction()
            if (pos.distance(prevPos) > 10.0) {
                dst.copyFrom(pos)
            } else {
                dst.lerpFrom(prevPos, pos, tickFraction)
            }

            const driving = this.player.driving
            if (driving?.physicsInitialized) {
                // обновить интерполированное состояние общего объекта вождения по водителю
                driving.updateDriverInterpolatedYaw(tickFraction, this.player, this.triedDriving)
                driving.copyPosWithOffset(driving.interpolatedPos, DrivingPlace.DRIVER, driving.interpolatedYaw, dst,-1)
                // обновить интерполированное состояние других участников вождения
                driving.applyInterpolatedStateToDependentParticipants()
            }
        }
        dst.roundSelf(8)
        this.speedLogger?.add(pos, dst)
    }

    toggleFreeCam() {
        this.isFreeCam = !this.isFreeCam
    }

    get isFreeCam(): boolean { return this.#isFreeCam }

    set isFreeCam(v: boolean) {
        this.#isFreeCam = v
        if (v) {
            const pos = this.player.getEyePos()
            this.freeCamSpectator.resetState()
            this.freeCamSpectator.setPos(pos)
            this.freeCamRotation.copyFrom(this.player.rotate)
        }
        this.speedLogger?.reset()
    }

    /** Возвращает позицию камеры: либо свободной камеры, либо глаз игрока */
    getCampPos(): Vector {
        if (!this.#isFreeCam) {
            return this.player.getEyePos()
        }
        this.freeCamSpectator.getCurrentPos(this.freeCamPos)
        this.speedLogger?.add(this.freeCamSpectator.player_state.pos, this.freeCamPos)
        return this.freeCamPos
    }

    /** Возвращает угол камеры: либо свободной камеры, либо угол поворота игрока */
    getCamRotation(): Vector {
        return this.#isFreeCam ? this.freeCamRotation : this.player.rotate
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

    update(): void {
        // if the initial step of the current physics session
        if (!this.physicsSessionInitialized) {
            this.initializePhysicsSession()
            return
        }

        if (this.controlsDisabledUntilServerTicks != null) {
            return
        }

        this.current.updateFrame(this)
        if (this.#isFreeCam) {
            this.updateFreeCamFrame()
        }

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
                this.logger.log('prevData?.endPhysicsTick !==', () => `prevData?.endPhysicsTick !== this.knownPhysicsTicks ${prevData.endPhysicsTick}`)
            }
            if (this.fineLogger.enabled) {
                this.logger.log('correction applied', () => `correction applied at ${this.knownPhysicsTicks} ${this.current.player_state.pos}`)
            }

            while (++ind < dataQueue.length) {
                const data = dataQueue.get(ind)
                this.simulate(prevData, data, true)
                this.knownPhysicsTicks += data.physicsTicks
                data.invalidated = false
                prevData = data
            }
        }

        // the number of new ticks to be simulated
        this.knownInputTime = MonotonicUTCDate.now()
        let addTicks = Math.floor((this.knownInputTime - this.knownTime) / PHYSICS_INTERVAL_MS)
        if (!addTicks) {
            return // новых тиков не добавилось, нечего делать
        }
        if (addTicks < 0) {
            throw new Error('physicsTicks < 0') // this should not happen
        }

        if (this.hasExternalChange) {
            // Не симулируем тик, вместо этого создадим данные, содержащие внешние изменения
            this.knownPhysicsTicks++
            addTicks--
            this.fineLogger.log(() => `changed externally t${this.knownPhysicsTicks} ${this.externalChangeEventIds.join()}`)
            // Очистим очередь чтобы не было дыр в нумерации тиков, и потому что старые данные нам уженикогда
            // не понадобятся (даже если коррекция к ним придет, тик со внешними изменниями невозможно повторить)
            dataQueue.clear()
            // Создать данные для одного тика. Они не могут быть объединены, и должны быть высланы сразу
            const data = new ClientPlayerTickData(PLAYER_TICK_DATA_STATUS.PROCESSED_SEND_ASAP)
            data.initInputFrom(this, this.knownPhysicsTicks - 1, 1)
            if (this.externalChangeEventIds.length) {
                data.inputEventIds = this.externalChangeEventIds
                this.externalChangeEventIds = []
            }
            data.initContextFrom(this)
            data.initOutputFrom(this.current)
            dataQueue.push(data)
            // забыть внешнее изменение, чтобы не обрабатывать его повторно
            this.hasExternalChange = false
            this.correctionsDisabledUntilServerTicks = this.knownPhysicsTicks
            if (this.externalChangeDisableControls) {
                this.externalChangeDisableControls = false
                this.controlsDisabledUntilServerTicks = this.knownPhysicsTicks
                addTicks = 0 // т.к. управление заблокировано, больше не cимулируем тиков в этом вызове
            }
        }

        // симулируем тики по-обычному
        if (addTicks) {
            // пропустить все нажатия клавиш до этого тика, если нужно
            const controlsEnabledBackup = this.player.controls.enabled
            this.player.controls.enabled &&= !this.ignorePlayerControlsUntilNextSimulation
            this.ignorePlayerControlsUntilNextSimulation = false

            // Don't process more than PHYSICS_MAX_TICKS_PROCESSED. The server will correct us if we're wrong.
            const skipPhysicsTicks = addTicks - PHYSICS_MAX_TICKS_PROCESSED
            if (skipPhysicsTicks > 0) {
                this.fineLogger.log('skipp_ticks', `skipping ${skipPhysicsTicks} ticks`)
                // мы не будем это отсылать, поэтому пометим как отосланное
                const skippedTicksData = new ClientPlayerTickData(PLAYER_TICK_DATA_STATUS.SENT)
                skippedTicksData.initInputFrom(this, this.knownPhysicsTicks, skipPhysicsTicks, null)
                skippedTicksData.initContextFrom(this)
                skippedTicksData.initOutputFrom(this.current)
                dataQueue.push(skippedTicksData)
                this.knownPhysicsTicks += skipPhysicsTicks
                addTicks = PHYSICS_MAX_TICKS_PROCESSED
            }

            const data = new ClientPlayerTickData(PLAYER_TICK_DATA_STATUS.UNKNOWN) // status устанавливается ниже
            data.initInputFrom(this, this.knownPhysicsTicks, addTicks, null)
            data.initContextFrom(this)
            this.knownPhysicsTicks += addTicks

            if (this.#isFreeCam) {
                data.initInputEmpty(data, data.startingPhysicsTick, data.physicsTicks)
            }

            const prevData = dataQueue.getLast()
            this.simulate(prevData, data, false)

            this.fineLogger.log(() => `simulated t${this.knownPhysicsTicks} ${data.outPos} ${data.outVelocity}`)

            // Save the tick data to be sent to the server.
            // Possibly postpone its sending, and/or merge it with the previously unsent data.
            if (prevData?.equal(data) && !this.sedASAP) {
                if (prevData.status !== PLAYER_TICK_DATA_STATUS.PROCESSED_SENDING_DELAYED) {
                    // it can't be merged with the previous data, but it contains no new data, so it can be delayed
                    data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SENDING_DELAYED
                    dataQueue.push(data)
                    this.fineLogger.log(() => `  pushed same`)
                } else {
                    // merge with the previous unsent data
                    prevData.physicsTicks += data.physicsTicks
                    this.fineLogger.log(() => `  merged s${prevData.status} #->${prevData.physicsTicks}`)
                }
            } else {
                // it differs (or we had to send it ASAP because we're far behind the server), send it ASAP
                this.sedASAP = false
                data.status = PLAYER_TICK_DATA_STATUS.PROCESSED_SEND_ASAP
                dataQueue.push(data)
                this.fineLogger.log(() => `  pushed different or ASAP`)
            }

            this.player.controls.enabled = controlsEnabledBackup
        }

        this.sendUpdate()
    }

    onCorrection(packetData: PacketBuffer): void {
        const packet = this.correctionPacket
        packet.read(packetData)
        const correctedPhysicsTicks = packet.knownPhysicsTicks // число тиков (от начала сессии), на конец которых есть скорректированные данные
        const correctedData = packet.data

        if (packet.physicsSessionId !== this.physicsSessionId ||
            correctedPhysicsTicks < this.correctionsDisabledUntilServerTicks
        ) {
            return
        }

        if (this.controlsDisabledUntilServerTicks != null && this.controlsDisabledUntilServerTicks <= correctedPhysicsTicks) {
            this.controlsDisabledUntilServerTicks = null
            this.ignorePlayerControlsUntilNextSimulation = true
        }

        // remove all old data before the correction; we won't need it ever
        const dataQueue = this.dataQueue
        while(dataQueue.length && dataQueue.getFirst().endPhysicsTick < correctedPhysicsTicks) {
            dataQueue.shift()
        }
        let exData = dataQueue.getFirst()
        if (exData == null) {
            // It happens e.g. when the browser window was closed. The client is severely behind the server.
            // A server may also send a correction ahead of time when player's position is changed outside the control
            this.logger.log('without_existing', 'applying correction without existing data')
            // put the date into the data queue
            const data = new ClientPlayerTickData(PLAYER_TICK_DATA_STATUS.SENT)
            data.initInputEmpty(null, correctedPhysicsTicks - 1, 1)
            data.copyContextFrom(correctedData)
            data.copyOutputFrom(correctedData)
            dataQueue.push(data)
            // change the player position immediately. This position will remain util this.knownInputTime catches up
            data.applyOutputToControl(this.current)
            this.prevPhysicsTickPos.copyFrom(data.outPos)

            this.hasCorrection = true
            this.knownPhysicsTicks = correctedPhysicsTicks
            this.sedASAP = true // because the client is severely behind the server, notify the server ASAP
            this.ignorePlayerControlsUntilNextSimulation = true // на всякий случай, во избежание ненужных больших перемещений
            return
        }

        // If the correction isn't aligned with the data end, e.g. because of ServerPlayerControlManager.doLaggingServerTicks
        if (exData.endPhysicsTick > correctedPhysicsTicks) {
            if (exData.startingPhysicsTick >= correctedPhysicsTicks) {
                // Коррекция целиком до начала самых ранних данных. Неизвестно, бывает ли такое.
                // Если да - то баг. Непонятно как поступать. Пропустим (если нужно, сервер еще оррекции пришлет)
                return
            }
            this.fineLogger.log(() => 'applying correction, end tick is not aligned')
            // Удалить часть exData до коррекции
            exData.physicsTicks = exData.endPhysicsTick - correctedPhysicsTicks
            exData.startingPhysicsTick = correctedPhysicsTicks
            // Insert fake data to be corrected
            exData = new ClientPlayerTickData(PLAYER_TICK_DATA_STATUS.SENT)
            exData.initInputEmpty(null, correctedPhysicsTicks - 1, 1)
            dataQueue.unshift(exData)
        } else {
            // коррекция совпала с последним тиком одного из имеющих данных - это нормальный случай

            exData.invalidated = false // if it was invalidated previously - now it's valid
            exData.status = PLAYER_TICK_DATA_STATUS.SENT // если сервер прислал коррекцию к тику который мы еще не отсылали (такого не должно быть, но вдруг)

            // Если коррекция совпадает с имеющимися данными - не инвалидировать последующие тики
            if (correctedPhysicsTicks <= this.knownPhysicsTicks &&
                exData.contextEqual(correctedData) && exData.outEqual(correctedData)
            ) {
                this.fineLogger.log('skip_correction', `correction ${this.knownPhysicsTicks}->${correctedPhysicsTicks} ${packet.log} skipped`)
                // It's possible that we have sent several packets and received several corrections,
                // so the current data might be already corrected. Do nothing then.
                return
            }
        }

        const logger = ['simulation_differs inputWorldActionIds'].includes(packet.log) ? this.logger : this.alwaysLogger
        logger.debug(packet.log, `correction ${this.knownPhysicsTicks} -> ..+${exData.physicsTicks}=${correctedPhysicsTicks} ${packet.log} ${exData} ${correctedData}`)

        // The data differs. Set the result at that tick, and invalidate the results in later ticks
        this.hasCorrection = true
        this.knownPhysicsTicks = correctedPhysicsTicks
        exData.copyContextFrom(correctedData)
        exData.copyOutputFrom(correctedData)
        // if the data that determines the current player position was changed, update the player position immediately
        if (dataQueue.length === 1) {
            exData.applyOutputToControl(this.current)
            this.prevPhysicsTickPos.copyFrom(exData.outPos)
        }
        // инвалидировать и обновить данные в последующих тиках
        for(let i = 1; i < dataQueue.length; i++) {
            const invalidatedData = dataQueue.get(i)
            invalidatedData.invalidated = true


            // TODO если контекст отличатеся - возможно изменить локально состояние игрока (режим игры и т.п.) чтобы не отличался


            invalidatedData.copyContextFrom(correctedData)
        }
    }

    onServerAccepted(knownPhysicsTicks: int) {
        if (this.controlsDisabledUntilServerTicks != null && this.controlsDisabledUntilServerTicks <= knownPhysicsTicks) {
            this.controlsDisabledUntilServerTicks = null
            this.ignorePlayerControlsUntilNextSimulation = true
        }
        if (this.hasCorrection) {
            // Может быть такое: проверка физики на сервере отключена.
            // 1. Было внешне изменение координат на сервере.
            // 2. Сервер отослал коррекцию.
            // 3. Сервер принял клиентские данные, не основанные на этой коррекции.
            // 4. На клиенте есть эта еще не до концы обработанная боле ранняя коррекция, но уже пришло подтверждени более поздних данных.
            // Хотя последние отосланные тики и приняты сервером, клиент должен их повторить чтобы
            // отослать более новые с учетом предыдущей коррекции. Иначе серверное измение позици будет отменено клиентом.
            // Клиент не должен забывать старые тики пока не применит коррекцию.
            return
        }
        // Удалить все данные до подтвержденных не включительно. Они нам еще могут быть нужны как prevData
        const dataQueue = this.dataQueue
        while(dataQueue.length && dataQueue.getFirst().endPhysicsTick < knownPhysicsTicks) {
            dataQueue.shift()
        }
    }

    /**
     * Sends an update, if there is anything that must be sent now
     */
    private sendUpdate(): void {
        // find unsent data
        const dataQueue = this.dataQueue
        let firstUnsentIndex = dataQueue.length
        while(firstUnsentIndex > 0 && dataQueue.get(firstUnsentIndex - 1).status !== PLAYER_TICK_DATA_STATUS.SENT) {
            firstUnsentIndex--
        }

        // find which unsent data must be sent now
        let lastMustBeSentIndex: int | null = null
        // достаточно старый тик, который уже пора слать, даже если его отслыка была задержана
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
        this.knownInputTime = this.baseTime
        this.knownPhysicsTicks = 0
        // notify the server
        const data: PlayerControlSessionPacket = {
            sessionId: this.physicsSessionId,
            baseTime: this.baseTime
        }
        this.player.world.server.Send({name: ServerClient.CMD_PLAYER_CONTROL_SESSION, data})
    }

    protected simulate(prevData: PlayerTickData | null | undefined, data: PlayerTickData, repeated: boolean): boolean {
        const pc = this.controlByType[data.contextControlType]
        prevData?.applyOutputToControl(pc)
        if (super.simulate(prevData, data, repeated)) {
            return true
        }
        data.initOutputFrom(pc)
        return false
    }

    private updateFreeCamFrame() {
        const pc = this.freeCamSpectator
        pc.updateFrame(this)
    }

    protected onBeforeSimulatingTick(pc: PlayerControl): void {
        this.prevPhysicsTickPos.copyFrom(pc.player_state.pos)
        const driving = this.player.driving
        if (driving?.physicsInitialized) {
            driving.prevPhysicsTickVehicleYaw = pc.drivingCombinedState?.yaw
        }
    }
}