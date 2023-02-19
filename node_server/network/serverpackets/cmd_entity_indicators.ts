import {ServerClient} from "../../../www/src/server_client.js";

export class CMD_ENTITY_INDICATORS {

    constructor(player, packet) {
        const packets = [{
            name: ServerClient.CMD_ENTITY_INDICATORS,
            data: {
                indicators: player.state.indicators
            }
        }];
        player.world.sendSelected(packets, player);
    }

}