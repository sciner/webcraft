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
				"time_formatted": this.secToStr(time),
                "pickat": pickat,
                "distance": distance,
				"distance_formatted": distance + " м"
            }
        }];
        
        player.world.sendSelected(packets, [player.session.user_id], []);
    }
	secToStr(time){
        let minute = Math.floor(time / 60);
        let hours = Math.floor(minute / 60);
        let day = Math.floor(hours / 24);
        minute %= 60;
        hours %= 24;
        return day + " д " + hours + " ч " + minute + " м";
    }
}