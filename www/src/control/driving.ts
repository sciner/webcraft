import {PlayerModel} from "../player_model.js";
import type {MobModel} from "../mob_model.js";
import {Vector} from "../helpers/vector.js";
import type {TPrismarineOptions, TPrismarinePlayerSize} from "../prismarine-physics/using.js";
import type {Player} from "../player.js";
import {PrismarinePlayerState} from "../prismarine-physics/index.js";
import type {DrivingManager, ClientDrivingManager} from "./driving_manager.js";
import {ArrayHelpers} from "../helpers/array_helpers.js";
import {PHYSICS_POS_DECIMALS, PHYSICS_ROTATION_DECIMALS} from "../constant.js";
import {Mth} from "../helpers/mth.js";
import type {PrismarinePlayerControl} from "../prismarine-physics/using.js";

const DEFAULT_MAX_DRIVER_YAW_DELTA = 1.6 // макс. разница между углом водителя и трансп. средства по умолчанию

/** Номер места (или роль) участника езды - транспортное средство, водитель, пассажир */
export enum DrivingPlace { VEHICLE = 0, DRIVER = 1, PASSENGER = 2 }

/** Параметры того, как на мобе можно ездить */
export type TDrivingConfig = {
    /**
     * Для каждого места (не считая самого моба), т.е. водитель, пассажир 1, пассажир 2, и т.п.
     * это смещение относительно транспортного средства.
     * Должно быть как минимум одно место.
     */
    offsets         : (IVector | Vector)[]

    /** Если оно задано, то при езде используется эта скорость, а не обычная скорость моба. */
    speed ?         : float

    /**
     * Если значение не определено, используется DEFAULT_DRIVING_SOUND (см. на сервере)
     * Если null - то без звука.
     */
    sound ?         : {tag: string, action: string} | null

    driverAnimation?: string

    /**
     * Если true, то то угол поворота контролируется стрелками с заданной скоростью/ускорением.
     * Иначе - свободно задается поворотом мыши.
     */
    useAngularSpeed?: boolean

    // максимальная разница между углом поворота транспортного средства и пасажиров/водителя
    maxYawDelta ?   : float

    /**
     * Если угол поворота контролируется стрелками, то парметры ниже - макс. угловая скорость,
     * ускорение и инерция. Есди не заданы - исползьзуются значения по умолчанию прописанные в физике.
     */
    maxAngularSpeed     ? : float
    angularAcceleration ? : float
    angularInertia      ? : float
}

/**
 * POJO, описывающий редко меняющиеся параметры состояния езды (кто едет на ком),
 * общий для клиента и сервера
 */
export type TDrivingState = {
    // ===================== неизменные начальные данные ======================
    id              : int
    physicsOptions  : TPrismarineOptions    // скопировано из траспортного средства
    mobType         : string    // тип моба-транспортного средства

    // ================= данные, меняющиеся на протяжении игры =================
    // (кроме mobIds[0] и playerIds[0] - они не могут меняться, это транспортное средство)
    /**
     * id мобов, участвующих в движении.
     * Число элементо = число мест. Индекс - DrivingPlace.
     */
    mobIds          : (int | null)[]
    playerIds       : (int | null)[]
    // Общий размер текущих участников
    combinedSize    : TPrismarinePlayerSize
}

const tmpVec = new Vector()

/**
 * Представляет собой логическую связь между участниками совместного движения (игроками и/или мобами).
 * Имеет клиентский и серверный подклассы.
 * Участники имеют различные роли, см. {@link DrivingPlace}
 * Функции:
 * - хранит кто участвует в движении (по их id). Не все эти объекты могут присутсвовать
 * - может добавлять и удалять учатстников движения
 * - подклассы могут связываться ссылками с объектами - учатсниками движения (Mob, MobModel, PlayerModel, Player, ServerPlayer)
 * - хранит состояние физического объекта, образованного всеми участниками движения
 * - может вычислять позиции индивидуальных учатсников движения по позиции обзего объекта
 * Этот класс сам не получает апдейты координат. Он только обновляет позиции одних участников когда другие
 * получают апдейты.
 */
export abstract class Driving<TManager extends DrivingManager<any>> {

    readonly config                 : TDrivingConfig
    state                           : TDrivingState
    protected manager               : TManager
    /** Состояние физического объекта, состоящего из всех участников движения */
    combinedPhysicsState            : PrismarinePlayerState

    protected constructor(manager: TManager, config: TDrivingConfig, state: TDrivingState) {
        this.manager    = manager
        this.config     = config
        this.state      = state
        this.combinedPhysicsState = new PrismarinePlayerState(new Vector(), state.physicsOptions, {})
        this.combinedPhysicsState.driving = config
    }

    /**
     * Подготавливает к симуляции и возвращает состоянии общего физического объекта,
     * состоящего из участников движения, обновляя его на основе параметров состояния водителя.
     */
    getSimulatedState(driverState: PrismarinePlayerState): PrismarinePlayerState {
        const ps = this.combinedPhysicsState
        this.updateFromDriverState(driverState)
        ps.copyControlsFrom(driverState)
        return ps
    }

    /** Обновляет общее физическое состояние на основе позиции и угла водителя */
    updateFromDriver(pos: IVector, yaw: float): void {
        const ps = this.combinedPhysicsState
        if (!this.config.useAngularSpeed) {
            ps.yaw = Mth.round(yaw, PHYSICS_ROTATION_DECIMALS)
        }
        this.copyPosWithOffset(ps.pos, DrivingPlace.DRIVER, pos, -1)
    }

    /** Обновляет общее физическое состояние на основе физического состояния водителя */
    updateFromDriverState(driverState: PrismarinePlayerState): void {
        this.updateFromDriver(driverState.pos, driverState.yaw)
        this.combinedPhysicsState.copyAdditionalDynamicFieldsFrom(driverState)
    }

    /**
     * Обновляет физическое состояние участника движения на основе общего состояния
     * @param forceYaw - если true, то устанавливает yaw участка. Если false, то это происходит только для
     *   транспортного средства.
     */
    applyToParticipantControl(control: PrismarinePlayerControl, place: DrivingPlace, forceYaw: boolean): void {
        const combinedPhysicsState = this.combinedPhysicsState
        const participantState = control.player_state
        this.copyPosWithOffset(participantState.pos, place)
        const yaw = combinedPhysicsState.yaw
        if (place === DrivingPlace.VEHICLE || forceYaw) {
            participantState.yaw = yaw
        }
        participantState.copyAdditionalDynamicFieldsFrom(combinedPhysicsState)
    }

    /** Обновляет состояния всех участников движения (кроме того, кто задает общею позицию), на основе общего состояния. */
    abstract applyToDependentParticipants(): void

    /**
     * Устанавливают позицию участника на основе позиции общего объекта (или наоборот)
     * dst = src + sign * смещение_повернутое_на_yaw
     * Смещение - это driverOffset, passengerOffset, или ZERO (для транспотртного средства)
     * @param dst - итоговая позиция
     * @param place - место участника вожения
     * @param src - известная позиция
     * @param sign - 1 или -1, см. формулу выше
     * */
    protected copyPosWithOffset(dst: IVector, place: DrivingPlace, src: IVector = this.combinedPhysicsState.pos, sign: float = 1): void {
        if (place === DrivingPlace.VEHICLE) {
            dst.x = src.x
            dst.y = src.y
            dst.z = src.z
        } else {
            const offset = this.config.offsets[place - 1]
            tmpVec.copyFrom(offset)
            tmpVec.rotateYawSelf(this.combinedPhysicsState.yaw)
            dst.x = Mth.round(src.x + sign * tmpVec.x, PHYSICS_POS_DECIMALS)
            dst.y = Mth.round(src.y + sign * tmpVec.y, PHYSICS_POS_DECIMALS)
            dst.z = Mth.round(src.z + sign * tmpVec.z, PHYSICS_POS_DECIMALS)
        }
    }
}

/** @see Driving */
export class ClientDriving extends Driving<ClientDrivingManager> {

    /** Модели участников этого двиения (игроков и мобов). Индексы - {@link DrivingPlace} */
    private models              : (MobModel | null)[]

    /** Сслыка на своего игрока - просто для удобства, даже он не участвует в этом движении */
    private myPlayer            : Player

    /** Место своего игрока в этом движении */
    private myPlayerPlace       : DrivingPlace | null = null

    private prevInterpolatedYaw : float | null
    interpolatedYaw             : float
    /** Значение yaw транспортного средства при вождении в предыдущем физическом тике */
    prevPhysicsTickVehicleYaw?: float | null

    constructor(manager: ClientDrivingManager, config: TDrivingConfig, state: TDrivingState) {
        super(manager, config, state)
        this.models = ArrayHelpers.create(state.mobIds.length, null)
        this.myPlayer = manager.world.game.player
        if (this.myPlayer == null) {
            throw new Error()
        }
        this.onNewState(state)
    }

    getVehicleModel(): MobModel | null { return this.models[DrivingPlace.VEHICLE] }
    getMyPlayerPlace(): DrivingPlace | null { return this.myPlayerPlace }

    /** @return объект, который задает позицию всех остальных участников, а не зависит от других */
    getPositionProvider(): MobModel | Player | null {
        return this.myPlayerPlace === DrivingPlace.DRIVER
            ? this.myPlayer
            : this.models[DrivingPlace.VEHICLE]
    }

    /** @returns true если все места заняты */
    isFull(): boolean {
        const state = this.state
        for(let place = DrivingPlace.DRIVER; place < state.mobIds.length; place++) {
            if (state.mobIds[place] ?? state.playerIds[place] == null) {
                return false
            }
        }
        return false
    }

    /** Обрабатывает новое состояние езды, пришедшее с сервера */
    onNewState(newState: TDrivingState): void {
        const oldState = this.state
        this.state = newState
        if (oldState.mobIds[DrivingPlace.VEHICLE] !== newState.mobIds[DrivingPlace.VEHICLE] ||
            oldState.playerIds[DrivingPlace.VEHICLE] !== newState.playerIds[DrivingPlace.VEHICLE]
        ) {
            throw new Error('oldState.vehicle != newState.vehicle')
        }
        this.resolve()
    }

    /** Пытается встать, возвращает id действия. */
    standUpGetId(): int {
        const actionId = this.myPlayer.pickAt.getNextId()
        this.myPlayer.controlManager.syncWithActionId(actionId, true)
        return actionId
    }

    updateFromVehicleModel(model: MobModel): void {
        const ps = this.combinedPhysicsState
        ps.pos.copyFrom(model.pos)  // это транспортное средство, смещение равно нулю
        ps.yaw = model.yaw
        this.interpolatedYaw = model.yaw
    }

    /** @see Driving.applyToDependentParticipants */
    applyToDependentParticipants(): void {
        const positionProvider = this.getPositionProvider()
        for(let place = 0; place < this.models.length; place++) {
            const model = this.models[place]
            if (model && model !== positionProvider) {
                this.copyPosWithOffset(model.pos, place)
                // Определить угол модели. Если это модель моего игрока, то взять угол из моего игрока.
                let yaw = place === this.myPlayerPlace
                    ? this.myPlayer.rotate.z
                    : this.interpolatedYaw
                model.forceLocalUpdate(model.pos, yaw)
            }
        }
        if (this.myPlayerPlace != null && this.myPlayerPlace !== DrivingPlace.DRIVER) {

            // TODO implement passengers

            throw 'not_implemented'
        }
    }

    /** Обновляет угол в текущем кадре у этоого вождения и/или моего игрока-водителя (в зависимости от {@link TDrivingConfig.useAngularSpeed}). */
    updateDriverInterpolatedYaw(tickFraction: float, player: Player): void {
        const config = this.config
        if (!config.useAngularSpeed) {
            // Установить угол общего объекта по углу водителя (который непосредственно управляется мышью)
            this.interpolatedYaw = player.rotate.z
            return
        }
        // Интерполировать угол транспортного средства в кадре
        const combinedPhysicsState = this.combinedPhysicsState
        this.prevInterpolatedYaw = this.interpolatedYaw
        this.interpolatedYaw = this.prevPhysicsTickVehicleYaw != null
            ? Mth.lerpRadians(tickFraction, this.prevPhysicsTickVehicleYaw, combinedPhysicsState.yaw)
            : combinedPhysicsState.yaw

        // Обновить угол водителя в кадре
        let playerFrameYaw = this.prevInterpolatedYaw != null
            // изменить угол поворота водителя водителя на столько же, на сколько изменился угол транспортного средства
            ? player.rotate.z + this.interpolatedYaw - this.prevInterpolatedYaw
            // игрок только что сел - установить угол принудительно как у транспортного средства
            : this.interpolatedYaw
        // угол водителя не должен слишликом отличаться от угла тр. средства
        const maxYawDelta = config.maxYawDelta ?? DEFAULT_MAX_DRIVER_YAW_DELTA
        if (maxYawDelta < Math.PI) {
            const relativeToVehicle = Mth.clampModule(
                Mth.radians_to_minus_PI_PI_range(playerFrameYaw - this.interpolatedYaw),
                maxYawDelta
            )
            playerFrameYaw = Mth.radians_to_0_2PI_range(this.interpolatedYaw + relativeToVehicle)
        }
        // установить угол водителя в кадре
        player.rotate.z = playerFrameYaw
    }

    /**
     * Вызывается если модель игрока/моба добавлена или получила апдейт.
     * В зависимости от места этой модели и других участников, делает одно из двух:
     * - синхронизирует позицию всех участников езды с этой моделью
     * - синхронизирует позицию этой модели с остальными участниками
     */
    onModelAddedOrChanged(model: MobModel): void {
        const place = this.models.indexOf(model)
        if (place < 0) {
            return
        }
        if (model === this.getPositionProvider()) {
            this.updateCombinedStateFromVehicle(model)
        }
        this.applyToDependentParticipants()
    }

    onMobModelAdded(mobModel: MobModel): void {
        if (this.state.mobIds.includes(mobModel.id)) {
            this.resolve()
        }
    }

    onPlayerModelAdded(playerModel: PlayerModel): void {
        if (this.state.playerIds.includes(playerModel.id)) {
            this.resolve()
        }
    }

    onModelDeleted(model: MobModel): void {
        const models = this.models
        for(let place = 0; place < models.length; place++) {
            if (models[place] === model) {
                model.driving = null
                models[place] = null
                return
            }
        }
    }

    onDelete(): void {
        const models = this.models
        for(let place = 0; place < models.length; place++) {
            const model = models[place]
            if (model) {
                model.driving = null
            }
        }
        if (this.myPlayer.driving === this) {
            this.myPlayer.driving = null
            this.myPlayer.controlManager.prismarine.drivingCombinedState = null
        }
    }

    /** Обновляет позицию общего физ. объекта на основе позиции транспортного средства */
    private updateCombinedStateFromVehicle(model: MobModel): void {
        this.combinedPhysicsState.pos.copyFrom(model.pos)
        this.combinedPhysicsState.yaw = model.yaw
    }

    /**
     * Обновляет:
     * 1. Сссылки этого класса на игроков и мобов-участников, которые присутвуют в игре
     * 2. Ссылки игроков и мобов-участников на этот объект.
     */
    private resolve(): void {
        const state = this.state
        const myPlayerId = this.myPlayer.session.user_id
        const world = this.manager.world

        this.myPlayerPlace = null
        this.myPlayer.driving = null
        this.myPlayer.controlManager.prismarine.drivingCombinedState = null
        for(let place = 0; place < state.mobIds.length; place++) {
            const mobId = state.mobIds[place]
            const playerId = state.playerIds[place]

            // обновить моего игрока (не его модель)
            if (playerId === myPlayerId) {
                this.myPlayerPlace = place
                this.myPlayer.driving = this
                this.myPlayer.controlManager.prismarine.drivingCombinedState = this.combinedPhysicsState
            }

            // проврить: если корректная модель игрока/моба уже используется, ничего не делать
            const oldModel = this.models[place]
            if (oldModel != null) {
                const compareToId = oldModel instanceof PlayerModel ? playerId : mobId
                if (oldModel.id === compareToId) {
                    continue
                }
                // эта модель не подходит, надо ее заменить (в коде ниже)
                oldModel.driving = null
            } else {
                if (mobId == null && playerId == null) {
                    continue // модели нет и не должно быть, не надо искать другую
                }
            }

            // попытаться найти и установить корректную модель игрока/моба для этого места
            let newModel: MobModel | null = null
            if (mobId != null) {
                newModel = world.mobs.get(mobId)
            } else if (playerId != null) {
                newModel = world.players.get(playerId)
            }
            this.models[place] = newModel
            if (newModel) {
                newModel.driving = this
                this.onModelAddedOrChanged(newModel)
            }
        }
    }
}