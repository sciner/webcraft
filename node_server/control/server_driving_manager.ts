import {DrivingManager} from "@client/control/driving_manager.js";
import type {ServerWorld} from "../server_world.js";
import type {ServerPlayer} from "../server_player.js";
import {Mob} from "../mob.js";
import {PrismarinePlayerControl} from "@client/prismarine-physics/using.js";
import type {TDrivingState} from "@client/control/driving.js";
import {ServerDriving} from "./server_driving.js";
import {ArrayHelpers} from "@client/helpers/array_helpers.js";
import type {WorldTransactionUnderConstruction} from "../db/world/WorldDBActor.js";
import {Player} from "@client/player.js";

/** @see DrivingManager */
export class ServerDrivingManager extends DrivingManager<ServerWorld> {

    private drivingById = new Map<int, ServerDriving>()

    /** Удаленные id, ждущие записи в БД. */
    private deletedDrivingIds: int[] = []

    /**
     * Тут находтся вождения не удаленные, но и не находящиеся в игре. Они чистые в БД.
     * Используется как кеш БД для ранее загружавшихся вождений.
     * Для простоты у них бесконечный TTL (их мало, не должны сколько-либо заметно кушать память).
     */
    private unloadedDrivingById = new Map<int, ServerDriving>()

    /**
     * Прикрепляет к только что загруженному мобу или игроку объект {@link ServerDriving} или null.
     * В некоторых случаях может не прикрепить существующий, объект, хотя он есть. Это ок, такой объект
     * сам соединится с участником в ближайшем тике.
     */
    onParticipantLoaded(participant: ServerPlayer | Mob, driving_data: string | null): void {
        const drivingId = participant.drivingId
        if (drivingId == null) {
            return // Похоже, он не участвует в вождении.
        }

        // Этот учатстник помечен в БД как участвующий в вождении. Попробуем найти/создать вождение и соединить ено с участником.
        // Вождения в памяти (если оно есть) имеют более высокий приоритет чем данные из БД.
        let driving = this.drivingById.get(drivingId)
            ?? this.restoreDriving(drivingId)
            ?? this.addFromRow(driving_data)

        // Пытаемся соединить участника с вождением
        if (driving && (
                participant instanceof Player
                    ? driving.onPlayerAddedOrRestored(participant)
                    : driving.onMobAddedOrRestored(participant)
            )
        ) {
            return // получилось
        }

        // Этот учатстник помечен в БД как участвующий в вождении, но не должен быть в вождении.
        // Возможно, в памяти более новая версия вождения, где этот участник удален. Или конфиг мобов/вождения поменялся.
        if (participant instanceof Mob) {
            driving?.removeMobId(participant.id)
        } else {
            driving?.removePlayerId(participant.userId)
            // driving.id игрока сохраняется в каждой транзакции
        }
        participant.drivingId = null
    }

    /** Выполняет просьбу игрока начать езду на указанном мобе, если это возможно. */
    tryJoinDriving(player: ServerPlayer, mob: Mob): void {
        const controlManager = player.controlManager
        const playerControl = controlManager.current
        if (!player.driving && playerControl instanceof PrismarinePlayerControl) {
            const driving = this.getOrCreate(mob)
            driving?._tryAddPlayer(player)
        }
    }

    /** Вызывается после того, как игрок добавлен в мир - для всех игроков */
    onPlayerAddedOrRestored(player: ServerPlayer): void {
        const drivingId = player.drivingId
        if (drivingId == null) {
            return // он не в вождении
        }
        // Мы не выгружаем вождяния из памяти. Если подходящее вождение есть - оно в памяти
        let driving = this.drivingById.get(drivingId) ?? this.restoreDriving(drivingId)
        if (driving && driving.onPlayerAddedOrRestored(player)) {
            return // успешно соединился с вождением
        }
        // Подходящего вождения нет. В мобе - устаревшие данные, исправим их.
        player.drivingId = null
    }

    /** Вызывается после того, как моб добавлен в мир - для всех мобов */
    onMobAddedOrRestored(mob: Mob): void {
        const drivingId = mob.drivingId
        if (drivingId == null) {
            return // он не в вождении
        }
        // Мы не выгружаем вождяния из памяти. Если подходящее вождение есть - оно в памяти
        let driving = this.drivingById.get(drivingId) ?? this.restoreDriving(drivingId)
        if (driving && driving.onMobAddedOrRestored(mob)) {
            return // успешно соединился с вождением
        }
        // Подходящего вождения нет. В мобе - устаревшие данные, исправим их.
        mob.drivingId = null
    }

    tick(): void {
        for (const driving of this.drivingById.values()) {
            driving.tick()
        }
        // Периодически убирать из основного списка неиспользуемые вождения.
        // Это также проверяется при исчезновении игрока, но на всякий случай (вдруг чего-то учли) пусть проверяется и периодически.
        if ((this.world.ticks_stat.number + 234) % 373 === 0) {
            for (const driving of this.drivingById.values()) {
                if (driving.shouldUnload()) {
                    this.unload(driving)
                }
            }
        }
    }

    unload(driving: ServerDriving): void {
        driving.onUnload()
        this.drivingById.delete(driving.id)
        this.unloadedDrivingById.set(driving.id, driving)
    }

    /** Логически удаляет вождение (навсегда, из БД). */
    delete(driving: ServerDriving): void {
        driving.onDelete()
        this.drivingById.delete(driving.id)
        if (driving.inDB) { // удаляем из БД если оно есть в БД
            this.deletedDrivingIds.push(driving.id)
        }
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction): void {
        for(const driving of this.drivingById.values()) {
            driving.writeToWorldTransaction(underConstruction)
        }
        underConstruction.deleteDriving = this.deletedDrivingIds
        this.deletedDrivingIds = []
    }

    private getOrCreate(vehicleMob: Mob): ServerDriving | null {
        let driving = vehicleMob.driving
        if (driving == null) {
            const vehicleConfig = vehicleMob.config
            const drivingConfig = vehicleConfig.driving
            if (!drivingConfig) {
                return null
            }
            const places = drivingConfig.offsets.length + 1
            const id = this.world.db.driving.getNextId()
            
            // создать DrivingState
            let physicsOptions = vehicleConfig.physics
            if (drivingConfig.physics) {
                physicsOptions = {...physicsOptions, ...drivingConfig.physics}
            }
            const drivingState: TDrivingState = {
                id,
                physicsOptions,
                mobType         : vehicleMob.type,
                mobIds          : ArrayHelpers.create(places, null),
                playerIds       : ArrayHelpers.create(places, null),
                combinedHeight  : physicsOptions.playerHeight
            }
            drivingState.mobIds[0] = vehicleMob.id
            
            driving = new ServerDriving(this, drivingConfig, drivingState, false)
            driving.updateFromVehicle(vehicleMob)
            driving.resolve()
            this.drivingById.set(id, driving)
        }
        return driving
    }

    private addFromRow(driving_data: string | null): ServerDriving | null {
        if (driving_data == null) {
            return null
        }
        // попробовать распаковать state
        let state: TDrivingState
        let physics
        try {
            let parsed = JSON.parse(driving_data)

            // TODO remove old format compatibility
            if (Array.isArray(parsed)) {
                parsed = { state: parsed[0], physics: parsed[1] }
            }

            ({ state, physics } = parsed)
        } catch (e) {
            return null
        }

        if (this.drivingById.has(state.id) || this.unloadedDrivingById.has(state.id)) {
            throw new Error() // если оно уже есть - мы не должны были вызывать этот метод
        }

        // найти конфиг
        const config = this.world.mobs.configs[state.mobType]?.driving
        if (!config) {
            return null
        }

        // если в конфиге изменилось число мест
        const places = config.offsets.length + 1
        if (state.mobIds.length != places) {
            while (state.mobIds.length < places) {
                state.mobIds.push(null)
                state.playerIds.push(null)
            }
            state.mobIds    = state.mobIds.slice(0, places)
            state.playerIds = state.playerIds.slice(0, places)
        }

        const driving = new ServerDriving(this, config, state, true)
        driving.combinedPhysicsState.importPOJO(physics)
        this.onDrivingLoadedOrRestored(driving)
        return driving
    }

    private restoreDriving(id: int): ServerDriving | undefined {
        const driving = this.unloadedDrivingById.get(id)
        if (driving) {
            this.unloadedDrivingById.delete(id)
            this.onDrivingLoadedOrRestored(driving)
        }
        return driving
    }

    private onDrivingLoadedOrRestored(driving: ServerDriving): void {
        this.drivingById.set(driving.id, driving)
        driving.resolve() // соединиться с участниками которые уже в памяти

        // активировать мобов, которые возможно были выгружены вместе с этим вождением
        for(const mobId of driving.state.mobIds) {
            if (mobId != null) {
                this.world.mobs.activate(mobId).then( (mob?: Mob) => {
                    if (mob == null) {
                        driving.removeMobId(mobId)
                    }
                })
            }
        }
    }
}