import {Driving, DrivingPlace, TDrivingState} from "@client/control/driving.js";
import type {Mob} from "../mob.js";
import type {ServerPlayer} from "../server_player.js";
import type {ServerWorld} from "../server_world.js";
import {PLAYER_HEIGHT, PLAYER_PHYSICS_HALF_WIDTH} from "@client/constant.js";
import {Vector} from "@client/helpers/vector.js";
import type {IAwarenessObject} from "../helpers/aware_players.js";
import {AwarePlayers, ObjectUpdateType} from "../helpers/aware_players.js";
import {ServerClient} from "@client/server_client.js";
import type {ServerDrivingManager} from "./server_driving_manager.js";
import {ArrayHelpers} from "@client/helpers/array_helpers.js";
import type {TPrismarinePlayerSize} from "@client/prismarine-physics/using.js";

/** См. {@link Driving} */
export class ServerDriving extends Driving<ServerDrivingManager> implements IAwarenessObject {

    /** Мобы - участники этого двиения. Индексы - {@link DrivingPlace} */
    private mobs    : (Mob | null)[]

    /** Игроки - участники этого двиения. Индексы - {@link DrivingPlace} */
    private players : (ServerPlayer | null)[]

    /** @see AwarePlayers */
    awarePlayers = new AwarePlayers(this)

    constructor(manager: ServerDrivingManager, state: TDrivingState) {
        super(manager, state)
        this.updateCombinedSize()
        const places    = state.mobIds.length
        this.mobs       = ArrayHelpers.create(places, null)
        this.players    = ArrayHelpers.create(places, null)
    }

    get world(): ServerWorld                { return this.manager.world }
    get pos(): IVector                      { return this.combinedPhysicsState.pos }

    get vehicleMob(): Mob | null            { return this.mobs[DrivingPlace.VEHICLE] }
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

    /** @see Driving.applyToDependentParticipants */
    applyToDependentParticipants(): void {
        for(let place = 0; place < this.mobs.length; place++) {
            const mob = this.mobs[place]
            if (mob) {
                this.applyToParticipantControl(mob.playerControl, place)
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
        vehicleState.yaw = vehicleMob.rotate.z

        const cs = this.combinedPhysicsState
        cs.copydyncamiFieldsExceptPosFrom(vehicleState)
        cs.pos.copyFrom(vehicleState.pos)
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
    removePlayerId(userId: int): void {
        const place = this.state.playerIds.indexOf(userId)
        if (place >= 0) {
            this.state.playerIds[place] = null
            const player =  this.players[place]
            if (player) {
                this.onPlayerUnloadedOrRemoved(player)
            }
            this.onStateChanged()
        }
    }

    /** Аналогично {@link removePlayerId}, но для мобов */
    removeMobId(mobId: int): void {
        const place = this.state.mobIds.indexOf(mobId)
        if (place >= 0) {
            this.state.mobIds[place] = null
            const mob = this.mobs[place]
            if (mob) {
                this.onMobUnloadedOrRemoved(mob)
            }
            this.onStateChanged()
        }
    }

    /**
     * Вызывается если экземпляр игрока участника езды выгружен или удален.
     * Id игрока по-прежнему считается участником, удаляется только ссылка на {@link ServerPlayer}.
     * Если {@link ServerPlayer} этого игрока опять появится, ссылка но него будет восстановлена.
     * Если игрок должен быть логически удален из этого движения (спрыгнул, умер) - см. {@link removePlayerId}
     */
    onPlayerUnloadedOrRemoved(player: ServerPlayer): void {
        const players = this.players
        for(let place = 0; place < players.length; place++) {
            if (players[place] === player) {
                players[place] = null
                player.driving = null
                return
            }
        }
    }

    /** Аналогично {@link onPlayerUnloadedOrRemoved}, но для мобов */
    onMobUnloadedOrRemoved(mob: Mob): void {
        const mobs = this.mobs
        for(let place = 0; place < mobs.length; place++) {
            if (mobs[place] === mob) {
                mobs[place] = null
                mob.driving = null
                return
            }
        }
    }

    onDelete(): void {
        const mobs = this.mobs
        const players = this.players
        for(let place = 0; place < mobs.length; place++) {
            const mob = mobs[place]
            if (mob) {
                mob.driving = null
            }
            const player = players[place]
            if (player) {
                player.driving = null
            }
        }
    }

    /**
     * Обновляет:
     * 1. Сссылки этого класса на игроков и мобов-участников, которые присутвуют в игре
     * 2. Ссылки игроков и мобов-участников на этот объект.
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
                mob.driving = null
                this.mobs[place] = null
            }

            let player = this.players[place]
            if (player) {
                if (player.userId === playerId) {
                    continue
                }
                player.driving = null
                this.players[place] = null
            }

            if (mobId != null) {
                mob = world.mobs.get(mobId)
                if (mob) {
                    this.mobs[place] = mob
                    mob.driving = this
                }
            } else if (playerId != null) {
                player = world.players.get(playerId)
                if (player) {
                    this.players[place] = player
                    player.driving = this
                }
            }
        }
    }

    private sendSound(): void {
        const sound = this.world.mobs.configs[this.state.mobType]?.driving?.sound
        if (sound) {
            for (const player of this.players) {
                player?.sendPackets([{ name: ServerClient.CMD_PLAY_SOUND, data: sound }])
            }
        }
    }

    private onStateChanged(): void {
        if (this.isTerminated()) {
            this.manager.delete(this)
        } else {
            this.updateCombinedSize()
            this.awarePlayers.sendUpdate()
        }
    }

    private updateCombinedSize(): void {
        const state = this.state
        const vehiclePhysicsOptions = state.physicsOptions
        let playerHeight = vehiclePhysicsOptions.playerHeight
        let playerHalfWidth = vehiclePhysicsOptions.playerHalfWidth

        for (let place = DrivingPlace.DRIVER; place < this.state.mobIds.length; place++) {
            if (state.playerIds[place] ?? this.state.mobIds[DrivingPlace.DRIVER] != null) {
                const offset = state.offsets[place - 1] = Vector.vectorify(state.offsets[place - 1])

                // TODO use correct passenger mob size

                playerHeight = Math.max(playerHeight, offset.y + PLAYER_HEIGHT)
                playerHalfWidth = Math.max(playerHalfWidth, offset.horizontalLength() + PLAYER_PHYSICS_HALF_WIDTH)
            }
        }

        const cs: TPrismarinePlayerSize = state.combinedSize
        cs.playerHeight = playerHeight
        cs.playerHalfWidth = playerHalfWidth
    }

    exportUpdateMessage(updateType: ObjectUpdateType): INetworkMessage {
        switch (updateType) {
            case ObjectUpdateType.ADD:
            case ObjectUpdateType.UPDATE:
                return {
                    name: ServerClient.CMD_DRIVING_ADD_OR_UPDATE,
                    data: this.state
                }
            case ObjectUpdateType.DELETE:
                return {
                    name: ServerClient.CMD_DRIVING_DELETE,
                    data: this.state.id
                }
        }
    }
}