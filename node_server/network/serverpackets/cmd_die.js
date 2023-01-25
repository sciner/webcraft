import {ServerClient} from "../../../www/js/server_client.js";
import { PLAYER_STATUS_DEAD } from "../www/js/constant.js";

export class CMD_DIE {

    constructor(player, packet) {
        player.state.stats.death++;
        player.status = PLAYER_STATUS_DEAD;
        const packets = [{
            name: ServerClient.CMD_DIE,
            data: {}
        }];
        player.world.sendSelected(packets, [player.session.user_id], []);
    }

}