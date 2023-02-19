import {ServerClient} from "../../../www/src/server_client.js";
import { PLAYER_STATUS_DEAD } from "../www/src/constant.js";

export class CMD_DIE {

    constructor(player, packet) {
        player.state.stats.death++;
        player.status = PLAYER_STATUS_DEAD;
        const packets = [{
            name: ServerClient.CMD_DIE,
            data: {}
        }];
        player.world.sendSelected(packets, player);
    }

}