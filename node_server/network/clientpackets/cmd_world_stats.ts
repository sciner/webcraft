import { ServerClient } from "@client/server_client.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return false;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_WORLD_STATS;
    }

    static async read(player, packet) {

        const world = player.world 
        const title     = world.info.title
        const time      = player.state.stats.time;
        const pickat    = player.state.stats.pickat;
        const distance  = player.state.stats.distance;

        let packets = [{
            name: ServerClient.CMD_WORLD_STATS,
            data: {
                "title":                title,
                "time":                 time,
				"time_formatted":       packet_reader.secToStr(time),
                "pickat":               pickat,
                "pickat_formated":      pickat.toLocaleString('en-EN'),
                "distance":             distance,
				"distance_formatted":   distance.toLocaleString('en-EN') + ' m'
            }
        }];

        player.world.sendSelected(packets, player);

        return true;
    
    }

	static secToStr(time) {
        let minute = Math.floor(time / 60);
        let hours = Math.floor(minute / 60);
        let day = Math.floor(hours / 24);
        minute %= 60;
        hours %= 24;
        const resp = [];
        if(day > 0) resp.push(day + ' days');
        if(hours > 0) resp.push(hours + ' hours');
        resp.push(minute + ' minutes');
        return resp.join(' ');
    }

}