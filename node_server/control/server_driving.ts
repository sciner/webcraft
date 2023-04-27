import {Driving, DrivingPlace, TDrivingState, TDrivingConfig} from "@client/control/driving.js";
import type {Mob} from "../mob.js";
import type {ServerPlayer} from "../server_player.js";
import type {ServerWorld} from "../server_world.js";
import {PHYSICS_ROTATION_DECIMALS, PLAYER_HEIGHT, PLAYER_PHYSICS_HALF_WIDTH} from "@client/constant.js";
import {Vector} from "@client/helpers/vector.js";
import type {IAwarenessObject} from "../helpers/aware_players.js";
import {AwarePlayers, ObjectUpdateType} from "../helpers/aware_players.js";
import {ServerClient} from "@client/server_client.js";
import type {ServerDrivingManager} from "./server_driving_manager.js";
import {Mth} from "@client/helpers/mth.js";

/** Если учстник движения отсутсвует на сервере (может не загружен?) - через сколько секунд его выкидывать. */
const DRIVING_ABSENT_PARTICIPANT_TTL_SECONDS = 30

/** См. {@link Driving} */
export class ServerDriving extends Driving<ServerDrivingManager> implements IAwarenessObject {

    /** Мобы - участники этого двиения. Индексы - {@link DrivingPlace} */
    private mobs    : (Mob | null | undefined)[]

    /** Игроки - участники этого двиения. Индексы - {@link DrivingPlace} */
    private players : (ServerPlayer | null | undefined)[]

    /**
     * Для участников, числящихся в вождении по id, но отсутвующих в игре (возможно временно),
     * показывает время performance.now, когда их отсутствие было замечено. Через
     * {@link DRIVING_ABSENT_PARTICIPANT_TTL_SECONDS} Они удаляются из вождения по id.
     * Для учтасников которые либо полностью отсутвуют, либо полностью присутсвуют, значение null или undefined.
     */
    private missingParticipantTime: (number | null | undefined)[]

    private deleted = false

    /** @see AwarePlayers */
    awarePlayers = new AwarePlayers(this)

    constructor(manager: ServerDrivingManager, config: TDrivingConfig, state: TDrivingState) {
        super(manager, config, state)
        this.updateCombinedSize()
        const places    = state.mobIds.length
        this.mobs       = new Array(places)
        this.players    = new Array(places)
        this.missingParticipantTime = new Array(places)
    }

    get world(): ServerWorld                { return this.manager.world }
    get pos(): IVector                      { return this.combinedPhysicsState.pos }

    get vehicleMob(): Mob | null | undefined    { return this.mobs[DrivingPlace.VEHICLE] }
    get hasPlayerDriver(): boolean          { return this.state.playerIds[DrivingPlace.DRIVER] != null }

    /**
     * @return true если эта езда логически не может продолжаться или не имеет смылса (удалено средство
     *  передвижения или все водители/пассажиры).
     *  Результат зависит только от того, какие участники езды числятся по id, а не от того, какие загружены
     *  на сервере в данный момент.
     * */
    isTerminated(): boolean {
        const state = this.state
        if (state.mobIds[DrivingPlace.VEHICLE] == null) {
            return true // нет транспортного средства
        }
        for(let place = DrivingPlace.DRIVER; place <= state.playerIds.length; place++) {
            if (state.playerIds[place] != null || state.mobIds[place] != null) {
                return false // есть хотя бы 1 водитель или пассажир
            }
        }
        return true
    }
    
    tick(): void {
        let changed = false

        // удалить участников, которые числятся в вождении, но давно отсутствуют в игре
        const missingParticipantTime = this.missingParticipantTime
        for (let place = 0; place < missingParticipantTime.length; place++) {
            const time = missingParticipantTime[place]
            if (time != null && time < performance.now() - DRIVING_ABSENT_PARTICIPANT_TTL_SECONDS * 1000) {
                const playerId = this.state.playerIds[place]
                if (playerId != null) {
                    this.removePlayerId(playerId, false)
                }
                const mobId = this.state.mobIds[place]
                if (mobId != null) {
                    this.removeMobId(mobId, false)
                }
                if (this.deleted) {
                    return
                }
                changed = true
            }
        }

        if (this.isTerminated()) {
            this.manager.delete(this)
        } else {
            this.awarePlayers.sendUpdate(changed)
        }
    }

    /** Обновляет физическое состояния всех участников движения (кроме того, кто задает общею позицию), на основе общего состояния. */
    applyToDependentParticipants(): void {
        for(let place = 0; place < this.mobs.length; place++) {
            const mob = this.mobs[place]
            if (mob) {
                this.applyToParticipantControl(mob.playerControl, place, false)
                mob.updateStateFromControl()
                mob.getBrain().sendState()
                continue
            }
            const player = this.players[place]
            if (player && place !== DrivingPlace.DRIVER) {

                // TODO implement passengers

                throw 'not_implemented'
            }
        }
    }

    /** Инициализирует состояние общего физического объекта на основе состояния траснсортного средства */
    initFromVehicle(): void {
        const vehicleMob = this.vehicleMob
        const vehicleState = vehicleMob.playerControl.player_state
        vehicleState.pos.copyFrom(vehicleMob.pos)
        vehicleState.yaw = Mth.round(vehicleMob.rotate.z, PHYSICS_ROTATION_DECIMALS)

        const cs = this.combinedPhysicsState
        cs.pos.copyFrom(vehicleState.pos)
        cs.yaw = vehicleState.yaw
        cs.copyAdditionalDynamicFieldsFrom(vehicleState)
    }

    onPlayerAdded(player: ServerPlayer): void {
        if (this.state.playerIds.includes(player.userId)) {
            this.resolve()
        }
    }

    onMobAdded(mob: Mob): void {
        if (this.state.mobIds.includes(mob.id)) {
            this.resolve()
        }
    }

    /**
     * Не вызывать этот метод напрямую! Использовать вместо него {@link ServerDrivingManager.tryJoinDriving}
     * 
     * Пытается добавить игрока к этой езде.
     * Производит только проверки, связанные конкретно с этой ездой. Проверки, осноанные на состоянии
     * игрока, должен выполнить вызывающий до этого метода (чтобы не создавать езду если игрок заведомо не может участвовать)
     * @returns место игроа, если получилось добавить, или null если не получилось
     */
    _tryAddPlayer(player: ServerPlayer): DrivingPlace | null {
        const state = this.state
        for(let place = DrivingPlace.DRIVER; place < state.playerIds.length; place++) {

            // TODO allow passengers
            if (place !== DrivingPlace.DRIVER) {
                continue
            }

            if (state.playerIds[place] == null && state.mobIds[place] == null) {
                state.playerIds[DrivingPlace.DRIVER] = player.userId
                this.onPlayerAdded(player)
                this.onStateChanged()
                this.sendSound()
                return place
            }
        }
        return null
    }

    /** Игрок добровольно покидает вождение */
    onStandUp(player: ServerPlayer, actionId: int | null): void {
        this.sendSound()
        this.removePlayerId(player.userId)
        player.controlManager.syncWithActionId(actionId)
    }

    /**
     * Удаляет участника езды - игрока (возможно заочно)
     * Если дальнейшая езда невозможна и/или не имеет смысла (см. {@link isTerminated}),
     * то и весь экземпляр ServerDriving удалется.
     * См. также и не путать с {@link onPlayerUnloadedOrRemoved}
     */
    removePlayerId(userId: int, sendUpdate: boolean = true): void {
        const place = this.state.playerIds.indexOf(userId)
        if (place >= 0) {
            this.state.playerIds[place] = null
            this.disconnectPlayer(place)
            this.onStateChanged(sendUpdate)
        }
    }

    /** Аналогично {@link removePlayerId}, но для мобов */
    removeMobId(mobId: int, sendUpdate: boolean = true): void {
        const place = this.state.mobIds.indexOf(mobId)
        if (place >= 0) {
            this.state.mobIds[place] = null
            this.disconnectMob(place)
            this.onStateChanged(sendUpdate)
        }
    }

    /**
     * Вызывается если экземпляр игрока участника езды выгружен или удален.
     * Id игрока по-прежнему считается участником, удаляется только ссылка на {@link ServerPlayer}.
     * Если {@link ServerPlayer} этого игрока опять появится, ссылка но него будет восстановлена.
     * Если игрок должен быть логически удален из этого движения (спрыгнул, умер) - см. {@link removePlayerId}
     */
    onPlayerUnloadedOrRemoved(player: ServerPlayer): void {
        const place = this.players.indexOf(player)
        if (place >= 0) {
            this.disconnectPlayer(place)
        }
    }

    /** Аналогично {@link onPlayerUnloadedOrRemoved}, но для мобов */
    onMobUnloadedOrRemoved(mob: Mob): void {
        const place = this.mobs.indexOf(mob)
        if (place >= 0) {
            this.disconnectMob(place)
        }
    }

    onDelete(): void {
        this.deleted = true
        for(let place = 0; place < this.mobs.length; place++) {
            this.disconnectPlayer(place)
            this.disconnectMob(place)
        }
    }

    /**
     * Обновляет:
     * 1. Сссылки этого класса на игроков и мобов-участников, которые присутвуют в игре
     * 2. Ссылки игроков и мобов-участников на этот объект.
     *
     * Не меняет список id участников и состояние (только может пометить id для удаления при следующем вызове {@link tick}).
     */
    resolve(): void {
        const state = this.state
        const world = this.manager.world

        for(let place = 0; place < state.mobIds.length; place++) {
            const mobId = state.mobIds[place]
            const playerId = state.playerIds[place]

            let mob = this.mobs[place]
            if (mob) {
                if (mob.id === mobId) {
                    continue
                }
                this.disconnectMob(place)
            }

            let player = this.players[place]
            if (player) {
                if (player.userId === playerId) {
                    continue
                }
                this.disconnectPlayer(place)
            }

            if (mobId != null) {
                mob = world.mobs.get(mobId)
                if (mob) {
                    // присоединить моба
                    this.mobs[place] = mob
                    mob.driving = this
                }
                this.updateParticipantTime(place)
            } else if (playerId != null) {
                player = world.players.get(playerId)
                if (player) {
                    if (player.game_mode.isSurvival() || player.game_mode.isCreative()) {
                        this.connectPlayer(place, player)
                    } else {
                        // Игрок не в том режиме игры. Пометим его - он будет принудительно убран из этого виждения
                        this.missingParticipantTime[place] = -Infinity
                    }
                }
                this.updateParticipantTime(place)
            }
        }
    }

    private connectPlayer(place: DrivingPlace, player: ServerPlayer): void {
        const controlManager = player.controlManager
        this.players[place] = player
        player.driving = this
        controlManager.prismarine.drivingCombinedState = this.combinedPhysicsState
        // update the player's control
        if (place === DrivingPlace.DRIVER) {
            this.applyToParticipantControl(controlManager.prismarine, place, true)
            controlManager.updatePlayerStateFromControl()
        } else {
            this.applyToDependentParticipants()
        }
    }

    private disconnectMob(place: DrivingPlace): void {
        const mob = this.mobs[place]
        if (mob) {
            this.mobs[place] = null
            mob.driving = null
        }
        this.updateParticipantTime(place)
    }

    private disconnectPlayer(place: DrivingPlace): void {
        const player = this.players[place]
        if (player) {
            this.players[place] = null
            player.driving = null
            player.controlManager.prismarine.drivingCombinedState = null
        }
        this.updateParticipantTime(place)
    }

    private sendSound(): void {
        const sound = this.world.mobs.configs[this.state.mobType]?.driving?.sound
        if (sound) {
            for (const player of this.players) {
                player?.sendPackets([{ name: ServerClient.CMD_PLAY_SOUND, data: sound }])
            }
        }
    }

    private onStateChanged(sendUpdate: boolean = true): void {
        if (this.deleted) {
            return
        }
        if (this.isTerminated()) {
            this.manager.delete(this)
        } else {
            this.updateCombinedSize()
            if (sendUpdate) {
                this.awarePlayers.sendUpdate()
            }
        }
    }

    private updateCombinedSize(): void {
        const state = this.state
        const config = this.config
        state.combinedHeight = state.physicsOptions.playerHeight

        for (let place = DrivingPlace.DRIVER; place < state.mobIds.length; place++) {
            if (state.playerIds[place] ?? state.mobIds[place] != null) {
                const offset = config.offsets[place - 1] = Vector.vectorify(config.offsets[place - 1])

                // TODO use correct passenger mob size

                state.combinedHeight = Math.max(state.combinedHeight, offset.y + PLAYER_HEIGHT)
            }
        }
    }

    exportUpdateMessage(updateType: ObjectUpdateType): INetworkMessage {
        switch (updateType) {
            case ObjectUpdateType.ADD:
            case ObjectUpdateType.UPDATE:
                return {
                    name: ServerClient.CMD_DRIVING_ADD_OR_UPDATE,
                    data: [this.config, this.state]
                }
            case ObjectUpdateType.DELETE:
                return {
                    name: ServerClient.CMD_DRIVING_DELETE,
                    data: this.state.id
                }
        }
    }

    /** Обновляет {@link missingParticipantTime} для указанного места. */
    private updateParticipantTime(place: int): void {
        if (// если участник должен присутсвовать
            (this.state.mobIds[place] != null || this.state.playerIds[place] != null) &&
            // но отсутствует
            (this.mobs[place] == null && this.players[place] == null)
        ) {
            // запомнить время, когда обнаружено неосоответствие
            this.missingParticipantTime[place] ??= performance.now()
        } else {
            // нет несоответствий
            this.missingParticipantTime[place] = null
        }
    }
}