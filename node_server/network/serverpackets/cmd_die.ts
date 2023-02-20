import { PLAYER_STATUS } from "../../../www/src/constant.js";
import {ServerClient} from "../../../www/src/server_client.js";

export class CMD_DIE {

    constructor(player, packet) {
        player.state.stats.death++;
        player.status = PLAYER_STATUS.DEAD;
        const packets = [{
            name: ServerClient.CMD_DIE,
            data: {}
        }];
        player.world.sendSelected(packets, player);
    }

}