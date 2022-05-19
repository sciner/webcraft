import {ServerClient} from "../../../www/js/server_client.js";
import { CMD_DIE } from "../serverpackets/cmd_die.js";
import { CMD_ENTITY_INDICATORS } from "../serverpackets/cmd_entity_indicators.js";

export class CMD_MODIFY_INDICATOR_REQUEST {
    constructor(player, data){
        switch (data.indicator) {
            case 'live': {
                player.state.indicators.live.value += data.value;
                break;
            }
            case 'food': {
                player.state.indicators.food.value += data.value;
                break;
            }
            case 'oxygen': {
                player.state.indicators.oxygen.value += data.value;
                break;
            }
        }

        new CMD_ENTITY_INDICATORS(player);
        
        if (data.indicator == 'live' && player.state.indicators.live.value <= 0) {
            player.is_dead = true;
            new CMD_DIE(player);
        }

    }
}