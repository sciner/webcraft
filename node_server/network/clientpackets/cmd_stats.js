import {ServerClient} from "../../../www/js/server_client.js";

export class CMD_STATS {
    constructor(player, data){
        let death = player.state.stats.death;
        let time = player.state.stats.time;
        let pickat = player.state.stats.pickat;
        let distance = player.state.stats.distance;
        
        let packets = [{
            name: ServerClient.CMD_STATS,
            data: {
                "death": death,
                "time": time,
                "pickat": pickat,
                "distance": distance 
            }
        }];
        
        player.world.sendSelected(packets, [player.session.user_id], []);
    }
}