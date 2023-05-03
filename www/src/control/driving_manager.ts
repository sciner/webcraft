import type {World} from "../world.js";
import {ServerClient} from "../server_client.js";
import type {MobModel} from "../mob_model.js";
import {ClientDriving, TDrivingConfig, TDrivingState} from "./driving.js";
import type {PlayerModel} from "../player_model.js";
import {Lang} from "../lang.js";
import type {TPrismarinePlayerStatePOJO} from "../prismarine-physics/index.js";

/**
 * 3-й параметр используется только при создании вождения, только для водителя.
 * Для карткости команды создания и обновления вождения объединены в одну.
 */
export type TCmdDrivingAddOrUpdate = [TDrivingConfig, TDrivingState, TPrismarinePlayerStatePOJO | null]

/**
 * Менеджер езды - создет, удаляет, обновляет сохраняет экземпляры {@link Driving}
 * Имеет клиентский и серверный подклассы.
 */
export abstract class DrivingManager<TWorld extends IWorld> {

    readonly world      : TWorld

    constructor(world: TWorld) {
        this.world = world
    }
}

/** @see DrivingManager */
export class ClientDrivingManager extends DrivingManager<World> {

    private drivingById = new Map<int, ClientDriving>()

    onCmd(cmd: INetworkMessage): void {
        switch (cmd.name) {
            case ServerClient.CMD_DRIVING_ADD_OR_UPDATE: {
                const [config, state, physicsState] = cmd.data as TCmdDrivingAddOrUpdate
                let driving = this.drivingById.get(state.id)
                if (driving) {
                    driving.onNewState(state)
                } else {
                    driving = new ClientDriving(this, config, state)
                    this.drivingById.set(state.id, driving)
                    if (driving.getMyPlayerPlace() != null) {
                        this.world.game.hotbar.strings.setText(1, Lang.press_lshift_for_dismount, 4000)
                        if (physicsState) {
                            driving.combinedPhysicsState.importPOJO(physicsState)
                        }
                    }
                }
                break
            }
            case ServerClient.CMD_DRIVING_DELETE: {
                const id: int = cmd.data
                const driving = this.drivingById.get(id)
                if (driving) {
                    driving.onDelete()
                    this.drivingById.delete(id)
                }
                break
            }
            default: throw new Error()
        }
    }

    /** Вызывается после того, как модель игрока добавлена в мир - для всех моделей */
    onPlayerModelAdded(playerModel: PlayerModel): void {
        for(const driving of this.drivingById.values()) {
            driving.onPlayerModelAdded(playerModel)
        }
    }

    /** Вызывается после того, как модель моба добавлена в мир - для всех моделей */
    onMobModelAdded(mobModel: MobModel): void {
        for(const driving of this.drivingById.values()) {
            driving.onMobModelAdded(mobModel)
        }
    }

}