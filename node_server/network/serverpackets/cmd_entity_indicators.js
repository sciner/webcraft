import {ServerClient} from "../../../www/js/server_client.js";
import { CMD_DIE } from "./cmd_die.js";

export class CMD_ENTITY_INDICATORS {
    constructor(player, data) {
        let packets = [{
            name: ServerClient.CMD_ENTITY_INDICATORS,
            data: {
                indicators: player.state.indicators
            }
        }];
        player.world.sendSelected(packets, [player.session.user_id], []);

        if (player.state.indicators.live.value <= 0) {
            player.is_dead = true;
            new CMD_DIE(player);
        }
    }
}