import {PlayerModel} from "./player_model.js";
import {ServerClient} from "./server_client.js";
import {AbstractPlayerManager} from "./abstract_player_manager.js";
import type { PlayerStateUpdate } from "./player.js";
import type { World } from "./world.js";

export class PlayerManager extends AbstractPlayerManager<World, PlayerModel> {

    constructor(world: World) {
        super(world)
    }

    init() {
        // On server message
        this.world.server.AddCmdListener([ServerClient.CMD_PLAYER_JOIN, ServerClient.CMD_PLAYER_LEAVE, ServerClient.CMD_PLAYER_STATE], (cmd) => {
            switch(cmd.name) {
                case ServerClient.CMD_PLAYER_JOIN: {
                    this.add(cmd);
                    break;
                }
                case ServerClient.CMD_PLAYER_LEAVE: {
                    this.delete(cmd.data.id);
                    break;
                }
                case ServerClient.CMD_PLAYER_STATE: {
                    this.setState(cmd);
                    break;
                }
            }
        });
    }

    // addPlayer
    add(cmd: {data: PlayerStateUpdate, time: number}) {
        const data = cmd.data;
        const player = new PlayerModel({
            id:             data.id,
            pos:            data.pos,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin:           data.skin,
            username:       data.username,
            type:           data.type || 'player',
            health:         data.health
        }, this.world);

        this.list.set(data.id, player);
        this.setState(cmd);
        player.netBuffer.length = 0;
        this.world.drivingManager.onPlayerModelAdded(player)
    }

    delete(user_id: int): boolean {
        const playerModel = this.list.get(user_id)
        playerModel?.driving?.onModelDeleted(playerModel)
        return super.delete(user_id)
    }

    /**
     * Sets the state of {@link PlayerModel} of another player
     * (or possibly also of this player?)
     */
    setState(cmd: {data: PlayerStateUpdate, time: number}) {

        const {
            data, time,
        } = cmd;

        const player = this.get(data.id);

        if(!player) {
            return;
        }

        player.distance = data.dist;
        player.armor = data.armor;
        player.health = data.health;
        player.sleep = data.sleep
        if(data.pos) {
            player.sitting = data.sitting;
            player.lies = data.lies;
            player.applyNetState({
                pos: data.pos,
                sneak: !!data.sneak,
                rotate: data.rotate,
                time: time,
                hands: data.hands
            });
        }

    }

    getMyself(): PlayerModel | null {
        return this.get(Qubatch.App.session.user_id);
    }
}
