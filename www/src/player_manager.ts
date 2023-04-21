import {PlayerModel} from "./player_model.js";
import {ServerClient} from "./server_client.js";
import {AbstractPlayerManager} from "./abstract_player_manager.js";
import type { PlayerStateUpdate } from "./player.js";
import type { World } from "./world.js";
import type { TMobProps } from "./mob_manager.js";

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
    add(cmd: {data: PlayerStateUpdate, time: number}) : PlayerModel {
        const data = cmd.data;
        const player = new PlayerModel({
            id:             data.id,
            pos:            data.pos,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            username:       data.username,
            // type:           data.type || data.skin?.model_name,
            skin:           data.skin,
            health:         data.health
        } as TMobProps, this.world);

        this.list.set(data.id, player);
        this.setState(cmd);
        player.netBuffer.length = 0;
        return player
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
        player.anim = data.anim
        player.sitting = data.sitting
        player.ground = data.ground
        player.running = data.running
        if(data.pos) {
            player.applyNetState({
                pos: data.pos,
                sneak: !!data.sneak,
                rotate: data.rotate,
                time: time,
                hands: data.hands
            });
        }

    }

    getMyself() {
        return this.get(Qubatch.App.session.user_id);
    }
}
