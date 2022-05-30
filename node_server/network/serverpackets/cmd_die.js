import {ServerClient} from "../../../www/js/server_client.js";

export class CMD_DIE {

    constructor(player, packet) {
        player.state.stats.death++;
        player.is_dead = true;
        const packets = [{
            name: ServerClient.CMD_DIE,
            data: {}
        }];
        player.world.sendSelected(packets, [player.session.user_id], []);
    }

}