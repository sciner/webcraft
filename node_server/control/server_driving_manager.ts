import {DrivingManager} from "@client/control/driving_manager.js";
import type {ServerWorld} from "../server_world.js";
import type {ServerPlayer} from "../server_player.js";
import type {Mob} from "../mob.js";
import {PrismarinePlayerControl} from "@client/prismarine-physics/using.js";
import type {TDrivingState} from "@client/control/driving.js";
import {DrivingPlace} from "@client/control/driving.js";
import {ServerDriving} from "./server_driving.js";
import {ArrayHelpers} from "@client/helpers/array_helpers.js";

/** @see DrivingManager */
export class ServerDrivingManager extends DrivingManager<ServerWorld> {

    private drivingById = new Map<int, ServerDriving>()
    private nextId = 0  // TODO remove it, use DB id

    /**
     * Выполняет просьбу игрока начать езду на указанном мобе, если это возможно.
     * @param pickatEventId - id события pickat, являщегося попыткой посадки. Оно нужно потому что
     *   {@link ClientPlayerControlManager} заблокировал инпут до окончания посадки на сервере.
     *   Это id передается в {@link ServerPlayerControlManager}, который разешит клиенту опять двигаться.
     */
    tryJoinDriving(player: ServerPlayer, mob: Mob, pickatEventId: int): void {
        const controlManager = player.controlManager
        const playerControl = controlManager.current
        if (player.driving || !(playerControl instanceof PrismarinePlayerControl)) {
            controlManager.syncWithActionId(pickatEventId)
            return
        }
        const driving = this.getOrCreate(mob)
        const place = driving?._tryAddPlayer(player)
        if (place == null) {
            controlManager.syncWithActionId(pickatEventId)
            return
        }

        // update the player's control
        if (place === DrivingPlace.DRIVER) {
            driving.applyToParticipantControl(playerControl, DrivingPlace.DRIVER, true)
            controlManager.updatePlayerStateFromControl()
        } else {
            driving.applyToDependentParticipants()
        }
        controlManager.syncWithActionId(pickatEventId)
    }

    /** Вызывается после того, как игрок добавлен в мир - для всех игроков */
    onPlayerAdded(player: ServerPlayer): void {
        for(const driving of this.drivingById.values()) {
            driving.onPlayerAdded(player)
        }
    }

    /** Вызывается после того, как моб добавлен в мир - для всех мобов */
    onMobAdded(mob: Mob): void {
        for(const driving of this.drivingById.values()) {
            driving.onMobAdded(mob)
        }
    }

    tick(): void {
        for (const driving of this.drivingById.values()) {
            if (driving.isTerminated()) {
                this.delete(driving)
            } else {
                driving.awarePlayers.sendUpdate(false)
            }
        }
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
            const id = this.nextId++
            
            // создать DrivingState
            let physicsOptions = vehicleConfig.physics 
            if (drivingConfig.speed) {
                physicsOptions = {...physicsOptions, baseSpeed: drivingConfig.speed}
            }
            const drivingState: TDrivingState = {
                id,
                physicsOptions,
                mobType         : vehicleMob.type,
                mobIds          : ArrayHelpers.create(places, null),
                playerIds       : ArrayHelpers.create(places, null),
                combinedSize    : {}
            }
            drivingState.mobIds[0] = vehicleMob.id
            
            driving = new ServerDriving(this, drivingConfig, drivingState)
            driving.resolve()
            this.drivingById.set(id, driving)
            driving.initFromVehicle()
        }
        return driving
    }

    delete(driving: ServerDriving): void {
        driving.onDelete()
        this.drivingById.delete(driving.state.id)
        driving.awarePlayers.sendDelete()
    }
}