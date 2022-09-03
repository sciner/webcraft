import {PlayerModel} from "./player_model.js";
import {ServerClient} from "./server_client.js";

export class PlayerManager {
	
    constructor(world) {
        this.world = world;
        this.list = new Map();
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
    add(cmd) {
        const data = cmd.data;
        const player = new PlayerModel({
            id:             data.id,
            pos:            data.pos,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin:           data.skin,
            username:       data.username,
            type:           data.type || 'player',
        });

        player.world = this.world;

        this.list.set(data.id, player);
        this.setState(cmd);
        player.netBuffer.length = 0;
    }

    // getPlayer
    get(id) {
        if(!this.list.has(id)) {
            return null;
        }
        return this.list.get(id);
    }

    // deletePlayer
    delete(id) {
        this.list.delete(id);
    }

    // setPlayerState
    setState(cmd) {

        const {
            data, time, 
        } = cmd;

        const player = this.get(data.id);

        if(!player) { 
            return;
        }

        player.distance = data.dist;

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

}
