import {PlayerModel} from "../player_model.js";
import type {MobModel} from "../mob_model.js";
import {Vector} from "../helpers/vector.js";
import type {TPrismarineOptions} from "../prismarine-physics/using.js";
import type {Player} from "../player.js";
import {PrismarinePlayerState} from "../prismarine-physics/index.js";
import type {DrivingManager, ClientDrivingManager} from "./driving_manager.js";
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

    /** Содержит переопределенные настройки физики, используемые когда мобом управляет игрок */
    physics ?       : TPrismarineOptions

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
    physicsOptions  : TPrismarineOptions    // скопировано из траспортного средства. Не меняется.
    mobType         : string    // тип моба-транспортного средства

    // ================= данные, меняющиеся на протяжении игры =================
    // (кроме mobIds[0] и playerIds[0] - они не могут меняться, это транспортное средство)
    /**
     * id мобов, участвующих в движении.
     * Число элементо = число мест. Индекс - DrivingPlace.
     */
    mobIds          : (int | null)[]
    playerIds       : (int | null)[]
    /**
     * Общая высота текущих участников.
     *
     * Ширина всегда равна ширине транспортного средства. Почему ширина не меняется: физика реализована
     * так, что если увеличится ширина возле стенки, то объект сможет пройти сквозь стенку.
     */
    combinedHeight  : float
}

const tmpVec_copyPosWithOffset = new Vector()
const tmpVec_applyInterpolatedStateToDependentParticipants = new Vector()

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
        // создаем копию physicsOptions потому что playerHeight может меняться
        this.combinedPhysicsState = new PrismarinePlayerState(new Vector(), {...state.physicsOptions}, {}, config)
    }

    /**
     * Подготавливает к симуляции и возвращает состоянии общего физического объекта,
     * состоящего из участников движения, обновляя его на основе параметров состояния водителя.
     */
    getSimulatedState(driverState: PrismarinePlayerState): PrismarinePlayerState {
        const ps = this.combinedPhysicsState
        ps.options.playerHeight = this.state.combinedHeight
        this.updateFromDriverState(driverState)
        ps.copyControlsFrom(driverState)
        return ps
    }

    /** Обновляет общее физическое состояние на основе физического состояния водителя */
    updateFromDriverState(driverState: PrismarinePlayerState): void {
        if (!this.config.useAngularSpeed) {
            this.combinedPhysicsState.yaw = Mth.round(driverState.yaw, PHYSICS_ROTATION_DECIMALS)
        }
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

    /**
     * Устанавливают позицию участника на основе позиции общего объекта (или наоборот)
     * dst = src + sign * смещение_повернутое_на_yaw
     * Смещение - это driverOffset, passengerOffset, или ZERO (для транспотртного средства)
     * @param dst - итоговая позиция
     * @param place - место участника вожения
     * @param yaw - угол транспортного средства. По умолчанию берется из физического состояния.
     * @param src - известная позиция
     * @param sign - 1 или -1, см. формулу выше
     */
    copyPosWithOffset(dst: IVector, place: DrivingPlace, yaw: float | null = null,
        src: IVector = this.combinedPhysicsState.pos, sign: float = 1
    ): void {
        dst.x = Mth.round(src.x, PHYSICS_POS_DECIMALS)
        dst.y = Mth.round(src.y, PHYSICS_POS_DECIMALS)
        dst.z = Mth.round(src.z, PHYSICS_POS_DECIMALS)
        if (place !== DrivingPlace.VEHICLE) {
            yaw ??= Mth.round(this.combinedPhysicsState.yaw, PHYSICS_ROTATION_DECIMALS)
            const offset = this.config.offsets[place - 1]
            const tmpVec = tmpVec_copyPosWithOffset.copyFrom(offset)
                .rotateYawSelf(yaw)
                .roundSelf(PHYSICS_POS_DECIMALS)
            dst.x += sign * tmpVec.x
            dst.y += sign * tmpVec.y
            dst.z += sign * tmpVec.z
        }
    }
}

/** @see Driving */
export class ClientDriving extends Driving<ClientDrivingManager> {

    /** Модели участников этого двиения (игроков и мобов). Индексы - {@link DrivingPlace} */
    private models              : (MobModel | null | undefined)[]

    /** Сслыка на своего игрока - просто для удобства, даже он не участвует в этом движении */
    private myPlayer            : Player

    /** Место своего игрока в этом движении */
    private myPlayerPlace       : DrivingPlace | null = null

    private prevInterpolatedYaw : float | null
    interpolatedYaw             : float
    /** Значение yaw транспортного средства при вождении в предыдущем физическом тике */
    prevPhysicsTickVehicleYaw ? : float | null

    interpolatedPos             = new Vector()

    constructor(manager: ClientDrivingManager, config: TDrivingConfig, state: TDrivingState) {
        super(manager, config, state)
        this.models = new Array(state.mobIds.length)
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

    /** Обновляет позицию и угол в кажде зависимых учатников движения */
    applyInterpolatedStateToDependentParticipants(): void {
        const positionProvider = this.getPositionProvider()
        if (positionProvider == null) {
            return // неоткуда брать достоверные данные
        }
        for(let place = 0; place < this.models.length; place++) {
            const model = this.models[place]
            if (model && model !== positionProvider) {
                const tmpVec = tmpVec_applyInterpolatedStateToDependentParticipants
                this.copyPosWithOffset(tmpVec, place, this.interpolatedYaw, this.interpolatedPos)
                // Определить угол модели. Если это модель моего игрока, то взять угол из моего игрока.
                let yaw = place === this.myPlayerPlace
                    ? this.myPlayer.rotate.z
                    : this.interpolatedYaw
                model.forceLocalUpdate(tmpVec, yaw)
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
    updateInterpolatedStateFromVehicle(model: MobModel): void {
        this.interpolatedPos.copyFrom(model.pos) // это транспортное средство, смещение равно нулю
        this.interpolatedYaw = model.yaw
    }

    /**
     * Обновляет:
     * 1. Сссылки этого класса на игроков и мобов-участников, которые присутвуют в игре
     * 2. Ссылки игроков и мобов-участников на этот объект.
     */
    private resolve(): void {
        const state = this.state
        const myPlayer = this.myPlayer
        const myPlayerId = myPlayer.session.user_id
        const world = this.manager.world

        this.myPlayerPlace = null
        for(let place = 0; place < state.mobIds.length; place++) {
            const mobId = state.mobIds[place]
            const playerId = state.playerIds[place]

            if (playerId === myPlayerId) {
                this.myPlayerPlace = place
            }

            // проврить: если корректная модель игрока/моба уже используется, ничего не делать
            const oldModel = this.models[place]
            if (oldModel != null) {
                const compareToId = oldModel instanceof PlayerModel ? playerId : mobId
                if (oldModel.id === compareToId) {
                    continue // модель та, что нужно; ничего не делаем
                }
                // эта модель не подходит, надо ее заменить (в коде ниже)
                this.models[place] = null
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
            // на всякий случай проверим - может, модель относится к старому вождению, и оно еще не обновилось, тогда не связываться с этой моделью
            if (newModel.driving == null) {
                this.models[place] = newModel
                if (newModel) {
                    newModel.driving = this
                }
            }
        }

        // обновить моего игрока (не его модель), после того как его место в этом
        if (this.myPlayerPlace !== null) {
            myPlayer.driving = this
            myPlayer.controlManager.prismarine.drivingCombinedState = this.combinedPhysicsState
        } else if (myPlayer.driving === this) { // если мой игрок был в этом вождении, но выбыл
            myPlayer.driving = null
            myPlayer.controlManager.prismarine.drivingCombinedState = null
        }
    }

}