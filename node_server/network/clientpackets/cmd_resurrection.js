import { CMD_ENTITY_INDICATORS } from "../serverpackets/cmd_entity_indicators.js";

export class CMD_RESURRECTION {

    constructor(player, data){
        player.state.indicators.live.value = 20;
        player.is_dead = false;
        new CMD_ENTITY_INDICATORS(player);
        player.world.teleportPlayer(player, {
            place_id: 'spawn',
        });
    }

}