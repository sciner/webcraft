import {ServerClient} from "../../../www/js/server_client.js";

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
        
        if (data.indicator == 'live' && player.state.indicators.live.value <= 0) {
            player.state.stats.death++;
            player.state.indicators.live.value = 20;
            player.world.teleportPlayer(player, {
                place_id: 'spawn',
            })
        }
        
        let packets = [{
            name: ServerClient.CMD_ENTITY_INDICATORS,
            data: {
                indicators: player.state.indicators
            }
        }];
        player.world.sendSelected(packets, [player.session.user_id], []);
    }
}