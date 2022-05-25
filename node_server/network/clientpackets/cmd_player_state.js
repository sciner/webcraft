import {ServerClient} from "../../../www/js/server_client.js";

export class CMD_PLAYER_STATE {
    constructor(player, data){
        let distance = Math.sqrt(Math.pow(data.pos.x, 2) + Math.pow(data.pos.y, 2) + Math.pow(data.pos.z, 2));
        if ((distance.toFixed(1) % 1) == 0) {
           // player.state.stats.distance++;
        }
    }
}