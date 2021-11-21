import {Helpers} from "./helpers.js";
import {PlayerModel} from "./player_model.js";

export class PlayerManager {
	
    constructor(world) {
        this.world = world;
        this.list = new Map();
    }

    // addPlayer
    add(data) {
        let player = new PlayerModel({
            id:             data.id,
            pos:            data.pos,
            pitch:          data.rotate.x,
            yaw:            data.rotate.z,
            skin_id:        data.skin,
            username:       data.username
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
        if(player) {
            if(Helpers.distance(data.pos, player.pos) > 0.001) {
                player.moving = true;
            }
            player.pos      = data.pos;
            player.pitch    = data.rotate.x;
            player.yaw      = data.rotate.z;
            if(player.moving_timeout) {
                clearTimeout(player.moving_timeout);
            }
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
            skin_id:        Game.skin.id,
            username:       Game.App.session.username + ' Ghost'
        }));
    };

}