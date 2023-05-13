import {Driving, DrivingPlace, TDrivingState, TDrivingConfig} from "@client/control/driving.js";
import type {Mob} from "../mob.js";
import type {ServerPlayer} from "../server_player.js";
import type {ServerWorld} from "../server_world.js";
import {PHYSICS_ROTATION_DECIMALS, PLAYER_HEIGHT} from "@client/constant.js";
import {Vector} from "@client/helpers/vector.js";
import type {IAwarenessObject} from "../helpers/aware_players.js";
import {AwarePlayers, ObjectUpdateType} from "../helpers/aware_players.js";
import {ServerClient} from "@client/server_client.js";
import type {ServerDrivingManager} from "./server_driving_manager.js";
import {Mth} from "@client/helpers/mth.js";
import type {WorldTransactionUnderConstruction} from "../db/world/WorldDBActor.js";
import {DRIVING_ABSENT_MOB_TTL_SECONDS, DRIVING_ABSENT_PLAYER_DISTANCE, DRIVING_ABSENT_PLAYER_MOB_BRAIN_DELAY_SECONDS} from "../server_constant.js";

/** См. {@link Driving} */
export class ServerDriving extends Driving<ServerDrivingManager> implements IAwarenessObject {

    /**
     * Мобы - участники этого двиения. Индексы - {@link DrivingPlace}.
     * Допустимо что this.state.mobIds[i] не null, но mobs[i] пока еще null.
     * Не может быть такого, что (mobs[i] !== null && mobs[i].id !== state.mobIds[i])
     */
    private mobs    : (Mob | null | undefined)[]

    /**
     * Игроки - участники этого двиения. Индексы - {@link DrivingPlace}
     * Семантика null такая же как у {@link mobs}
     */
    private players : (ServerPlayer | null | undefined)[]

    /**
     * Для участников, числящихся в вождении по id, но отсутвующих в игре (возможно временно),
     * хранит время performance.now, когда их отсутствие было замечено.
     * Для учтасников которые либо полностью отсутвуют, либо полностью присутсвуют, значение null или undefined.
     */
    private missingParticipantTime: (number | null | undefined)[]

    /**
     * Для участников, числящихся в вождении по id, но отсутвующих в игре (возможно временно),
     * хранит координаты водения, когда их отсутствие было замечено.
     * В других случаях значение может содержать мусор.
     */
    private missingParticipantPos: (Vector | undefined)[]

    private _deleted = false
    private dbDirty = false // true если есть важные изменения, которые надо записать в БД
    inDB: boolean // true если запись есть в БД

    /** @see AwarePlayers */
    awarePlayers = new AwarePlayers(this)

    constructor(manager: ServerDrivingManager, config: TDrivingConfig, state: TDrivingState, inDB: boolean) {
        super(manager, config, state)
        this.inDB = inDB
        this.updateCombinedSize()
        const places    = state.mobIds.length
        this.mobs       = new Array(places)
        this.players    = new Array(places)
        this.missingParticipantTime = new Array(places)
        this.missingParticipantPos  = new Array(places)
    }

    get world(): ServerWorld                { return this.manager.world }
    get pos(): IVector                      { return this.combinedPhysicsState.pos }

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

    /**
     * Обязательное условие -  не несохраненных изменений в БД.
     * Далее возможны :
     * Должен быть выгружен (но не удален) в 2 случаях:
     * 1. Если этот тип моба выгружается вместе с игроком. {@link TDrivingConfig.unloads} == true
     *   и числится как минимум 1 игрок, но все игроки-участники отсутствуют.
     * 2. Если выгрузились все участники (видимо выгрузился чанк)
     * Тогда оно будет загружено снова при появлении любого из этих игроков.
     * Есть ли мобы - не важно. Если они есть, деактивировать их.
     */
    shouldUnload(): boolean {
        if (this.dbDirty || this.players.some(it => it != null)) {
            return false
        }
        return this.config.unloads && this.state.playerIds.some(it => it != null) // выгружается вместе с ушедшимими игроками
            || this.mobs.every(it => it == null) // выгружается потому что выгрузились все мобы (и наверное весь чанк)
    }
    
    tick(): void {
        let changed = false // используется чтобы послать ровно 1 апдейт, что бы ни произошло
        const state = this.state
        const mobIds = state.mobIds
        const playerIds = state.playerIds

        for (let place = 0; place < mobIds.length; place++) {
            if (mobIds[place] != null && this.mobs[place] == null) {
                const missingTime = this.missingParticipantTime[place] ??= performance.now()
                // удалить моба, который числятся в вождении, но давно отсутствует в игре
                if (missingTime < performance.now() - DRIVING_ABSENT_MOB_TTL_SECONDS * 1000) {
                    this.removeMobId(mobIds[place], false)
                    if (this._deleted) {
                        return
                    }
                    changed = true
                }
            } else if (playerIds[place] != null && this.players[place] == null) {
                const missingPos = this.missingParticipantPos[place] ??= this.combinedPhysicsState.pos.clone()
                // удалить игрока, который числятся в вождении, но отсутствуют в игре и транспорт сместился слишком далеко от его последнего положения
                if (this.combinedPhysicsState.pos.distanceSqr(missingPos) > DRIVING_ABSENT_PLAYER_DISTANCE * DRIVING_ABSENT_PLAYER_DISTANCE) {
                    this.removePlayerId(playerIds[place], false)
                    if (this._deleted) {
                        return
                    }
                    changed = true
                }
            }
        }

        // моб-транспорт действовать самостоятельно если водитель-игрок либо не числится, либо числится, но давно не в игре
        const mobVehicle = this.mobs[DrivingPlace.VEHICLE]
        if (mobVehicle) {
            mobVehicle.getBrain().enabled =
                state.playerIds[DrivingPlace.DRIVER] == null ||
                this.players[DrivingPlace.DRIVER] == null &&
                performance.now() - this.missingParticipantTime[DrivingPlace.DRIVER] > DRIVING_ABSENT_PLAYER_MOB_BRAIN_DELAY_SECONDS * 1000
        }

        if (this.isTerminated()) {
            this.manager.delete(this)
        } else {
            this.awarePlayers.sendUpdate(changed)
        }
    }

    /** Обновляет физическое состояния всех участников движения (кроме того, кто задает общею позицию), на основе общего состояния. */
    applyToDependentParticipants(includeVehicle: boolean = true): void {
        for(let place = 0; place < this.mobs.length; place++) {
            const mob = this.mobs[place]
            if (mob && (includeVehicle || place !== DrivingPlace.VEHICLE)) {
                this.applyToMob(place, mob)
                continue
            }
            const player = this.players[place]
            if (player && place !== DrivingPlace.DRIVER) {
                this.applyToPlayer(place, player, false)
            }
        }
    }

    /**
     * Инициализирует/обновляет состояние общего физического объекта на основе состояния траснсортного средства.
     * @param vehicleMob - транспотртное средство. Может быть использовано до того, как добавлено в вождение
     *   (и должно быть до того - чтобы когда оно добавлялось, в вождении уже было корректное физическое состояние,
     *   и оно не испортило бы состояние мобу)
     */
    updateFromVehicle(vehicleMob: Mob): void {
        const vehicleState = vehicleMob.playerControl.player_state
        vehicleState.pos.copyFrom(vehicleMob.pos)
        vehicleState.yaw = Mth.round(vehicleMob.rotate.z, PHYSICS_ROTATION_DECIMALS)

        const cs = this.combinedPhysicsState
        cs.pos.copyFrom(vehicleState.pos)
        cs.yaw = vehicleState.yaw
        cs.copyAdditionalDynamicFieldsFrom(vehicleState)
    }

    onPlayerAddedOrRestored(player: ServerPlayer): boolean {
        const place = this.state.playerIds.indexOf(player.userId)
        if (place >= 0 && this.tryConnectPlayer(place, player)) {
            return true
        }
        // если в игроке устаревшая информация - он уже не принадлежит этому вождению
        if (player.drivingId === this.id) {
            player.drivingId = null
        }
        return false
    }

    onMobAddedOrRestored(mob: Mob): boolean {
        const place = this.state.mobIds.indexOf(mob.id)
        // Моб, всегда может быть пассажиром, но транспортом - только если его конфиг позволяет.
        // Мы это проверяем потому что после загрузки из БД конфиг у моба может буть другой.
        if (place > DrivingPlace.VEHICLE || place >= 0 && mob.config.driving) {
            this.connectMob(place, mob)
            return true
        }
        // если в мобе устаревшая информация - он уже не принадлежит этому вождению
        if (mob.drivingId === this.id) {
            mob.drivingId = null
        }
        return false
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
        let place: int | null = null
        // высший приоритет - сесть на место водителя, даже если игрок-водитель числится
        if (this.canJoinPlace(DrivingPlace.DRIVER, true)) {
            place = DrivingPlace.DRIVER
        } else {

            // TODO allow passengers

            /*
            // попробуем найти место пассажира. Сачала где никто не числится, потом - где числится отсутствующий игрок
outerLop:   for(let canReplacePlayerId = 0; canReplacePlayerId <= 1; canReplacePlayerId++) {
                for(let i = DrivingPlace.PASSENGER; i < state.playerIds.length; i++) {
                    if (this.canJoinPlace(i, !!canReplacePlayerId)) {
                        place = i
                        break outerLop
                    }
                }
            }
            */
        }
        if (place != null) {
            state.playerIds[DrivingPlace.DRIVER] = player.userId
            this.onPlayerAddedOrRestored(player)
            this.onStateChanged()
            this.sendSound()
        }
        return place
    }

    private canJoinPlace(place: int, canReplacePlayerId: boolean): boolean {
        const state = this.state
        // Не можем заменять мобов. Плотому что даже если они отсутствуют, то наверное грузятся и вот-вот загрузятся.
        return state.mobIds[place] == null &&
            this.players[place] == null &&
            (canReplacePlayerId || state.playerIds[place] == null)
    }

    /** Игрок добровольно покидает вождение */
    onStandUp(player: ServerPlayer): void {
        this.sendSound()
        this.removePlayerId(player.userId)
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
            if (this.shouldUnload()) {
                this.manager.unload(this)
            }
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
        this._deleted = true
        this.disconnectAll()
        this.awarePlayers.sendDelete()
    }

    onUnload(): void {
        const mobs = this.mobs
        for(let place = 0; place < mobs.length; place++) {
            mobs[place]?.deactivate()
            this.missingParticipantTime[place] = null // если мы потом восстановим driving - чтобы участники сразу не удалились из-за времени отсутствия
        }
        this.disconnectAll()
        this.awarePlayers.sendDelete()
    }

    private disconnectAll(): void {
        for(let place = 0; place < this.mobs.length; place++) {
            this.disconnectPlayer(place)
            this.disconnectMob(place)
        }
    }

    /**
     * Обновляет:
     * 1. Ссылки этого класса на игроков и мобов-участников, которые присутвуют в игре
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
                if (mob.id !== mobId) {
                    throw new Error()
                }
                continue
            }

            let player = this.players[place]
            if (player) {
                if (player.userId !== playerId) {
                    throw new Error()
                }
                continue
            }

            if (mobId != null) {
                mob = world.mobs.get(mobId)
                if (mob) {
                    this.connectMob(place, mob)
                }
            } else if (playerId != null) {
                player = world.players.get(playerId)
                if (player) {
                    this.tryConnectPlayer(place, player)
                }
            }
            this.updateParticipantTime(place)
        }
    }

    private connectMob(place: DrivingPlace, mob: Mob): void {
        if (this.mobs[place] === mob) {
            return
        }
        this.disconnectMob(place) // на всякий случай, но скорее всего не нужно
        this.mobs[place] = mob
        mob.driving = this
        mob.drivingId = this.id
        mob.getBrain().enabled = false // отключим сейчас без проверок. Если можно - в другом месте включится.
        this.applyToMob(place, mob)
        this.updateParticipantTime(place)
    }

    private tryConnectPlayer(place: DrivingPlace, player: ServerPlayer): boolean {
        if (this.players[place] === player) {
            return true
        }
        this.disconnectPlayer(place) // на всякий случай, но скорее всего не нужно

        if (!(player.game_mode.isSurvival() || player.game_mode.isCreative())) {
            // Игрок не в том режиме игры. Пометим его - он будет принудительно убран из этого виждения, см. tick()
            this.missingParticipantPos[place] = Vector.INFINITY
            return false
        }

        this.players[place] = player
        player.driving = this
        player.drivingId = this.id
        player.controlManager.prismarine.drivingCombinedState = this.combinedPhysicsState
        // update the player's control
        this.applyToPlayer(place, player, false)
        this.updateParticipantTime(place)
        return true
    }

    private applyToMob(place: DrivingPlace, mob: Mob): void {
        this.applyToParticipantControl(mob.playerControl, place, false)
        mob.updateStateFromControl()
        mob.getBrain().sendState()
    }

    private applyToPlayer(place: DrivingPlace, player: ServerPlayer, forceYaw: boolean): void {
        const controlManager = player.controlManager
        if (place === DrivingPlace.DRIVER) {
            this.applyToParticipantControl(controlManager.prismarine, place, forceYaw)
            controlManager.updatePlayerStateFromControl()
        } else {

            // TODO implement passengers

            throw 'not_implemented'
        }
    }

    private disconnectMob(place: DrivingPlace): void {
        const mob = this.mobs[place]
        if (mob) {
            this.mobs[place] = null
            mob.driving = null
            mob.getBrain().enabled = true
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
        if (this._deleted) {
            return
        }
        this.dbDirty = true
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
                return {
                    name: ServerClient.CMD_DRIVING_ADD_OR_UPDATE,
                    data: [this.config, this.state, this.combinedPhysicsState.exportPOJO()]
                }
            case ObjectUpdateType.UPDATE:
                return {
                    name: ServerClient.CMD_DRIVING_ADD_OR_UPDATE,
                    data: [this.config, this.state]
                }
            case ObjectUpdateType.DELETE:
                return {
                    name: ServerClient.CMD_DRIVING_DELETE,
                    data: this.id
                }
        }
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction): void {
        // Для простоты всегда сохраняем изменения. Это чтобы в БД было последнее состояние физики,
        // и при загрузке любого участника первым, он получил бы корректные координаты.
        this.dbDirty = false
        const list = this.inDB
            ? underConstruction.updateDriving
            : underConstruction.insertDriving
        const data = JSON.stringify({
            state:      this.state,
            physics:    this.combinedPhysicsState.exportPOJO()
        })
        list.push([this.id, data])
        this.inDB = true
    }

    /** Обновляет {@link missingParticipantTime} для указанного места. */
    private updateParticipantTime(place: int): void {
        if (// если участник должен присутсвовать
            (this.state.mobIds[place] != null || this.state.playerIds[place] != null) &&
            // но отсутствует
            (this.mobs[place] == null && this.players[place] == null)
        ) {
            // запомнить время и место, когда обнаружено неосоответствие
            this.missingParticipantTime[place]  ??= performance.now()
            this.missingParticipantPos[place]   ??= this.combinedPhysicsState.pos.clone()
        } else {
            // нет несоответствий
            this.missingParticipantTime[place]  = null
            this.missingParticipantPos[place]   = null
        }
    }
}