import {ServerClient} from "../../../www/js/server_client.js";
export class CMD_STATS {
    constructor(player, data){
        let death = player.state.stats.death;
        let time = player.state.stats.time;
        let pickat = player.state.stats.pickat;
        let distance = player.state.stats.distance;
        
        let minute = Math.floor(time / 60);
        let hours = Math.floor(minute / 60);
        let day = Math.floor(hours / 24);
        minute %= 60;
        
        let packets = [{
            name: ServerClient.CMD_STATS,
            data: {
                "death": death,
                "time": day + " д " + hours + " ч " + minute + " м",
                "pickat": pickat,
                "distance": distance * 10 + " м" 
            }
        }];
        
        player.world.sendSelected(packets, [player.session.user_id], []);
    }
}