import {ServerClient} from "../../../www/js/server_client.js";

export class CMD_ENTITY_INDICATORS {
    constructor(player, data) {
        let packets = [{
            name: ServerClient.CMD_ENTITY_INDICATORS,
            data: {
                indicators: player.state.indicators
            }
        }];
        player.world.sendSelected(packets, [player.session.user_id], []);
    }
}