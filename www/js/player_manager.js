import {Helpers} from "./helpers.js";
import {PlayerModel} from "./player_model.js";
import {ServerClient} from "./server_client.js";

export class PlayerManager {
	
    constructor(world) {
        this.world = world;
        this.list = new Map();
        // On server message
        this.world.server.AddCmdListener([ServerClient.CMD_PLAYER_JOIN, ServerClient.CMD_PLAYER_LEAVE, ServerClient.CMD_PLAYER_STATE], (cmd) => {
            switch(cmd.name) {
                case ServerClient.CMD_PLAYER_JOIN: {
                    this.add(cmd.data);
                    break;
                }
                case ServerClient.CMD_PLAYER_LEAVE: {
                    this.delete(cmd.data.id);
                    break;
                }
                case ServerClient.CMD_PLAYER_STATE: {
                    this.setState(cmd.data);
                    break;
                }
            }
        });
    }

    // addPlayer
    add(data) {
        let player = new PlayerModel({
            id:             data.id,
            pos:            data.pos,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin:           data.skin,
            username:       data.username,
            type:           data.type || 'player',
        });

        this.list.set(data.id, player);
        this.setState(data);
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
    setState(data) {
        let player = this.get(data.id);

        if(!player) { 
            return;
        }
        
        player.moving = Helpers.distance(data.pos, player.pos) > 0.001;
        player.pos      = data.pos;
        player.pitch    = data.rotate.x;
        player.yaw      = data.rotate.z;

        if(player.moving_timeout) {
            clearTimeout(player.moving_timeout);
            player.moving_timeout = null;
        }

        if (player.moving) {
            player.moving_timeout = window.setTimeout(function() {
                player.moving = false
            }, 100);
        }
    
    }

    //
    drawGhost(player) {
        this.list.set('itsme', new PlayerModel({
            id:             'itsme',
            itsme:          false,
            rotate:         player.rotate.clone(),
            pos:            player.pos.clone(),
            pitch:          player.rotate.x,
            yaw:            player.rotate.z,
            skin:           Game.skin.id,
            username:       Game.App.session.username + ' Ghost'
        }));
    };

}