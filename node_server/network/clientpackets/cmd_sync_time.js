import {ServerClient} from "../../../www/js/server_client.js";

export class CMD_SYNC_TIME {
    constructor(player, data){
        if (player.state) {
           // player.state.stats.time += 5;
        }
        
        player.sendPackets([{
            name: ServerClient.CMD_SYNC_TIME,
            data: { clientTime: data.clientTime },
        }]);
    }
}