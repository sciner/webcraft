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

        const world   = player.world
        const info    = world.info
        const creater = world.players.get(info.user_id)

        const packets = [{
            name: ServerClient.CMD_WORLD_STATS,
            data: {
                "title": info.title,
                "username": creater.session.username,
                "time": info.dt,
                "time_formatted": new Date(info.dt * 1000).toString(),
                "age": packet_reader.ageToDate(world.getTime().time * 60)
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    }

    static ageToDate(time) {
        let minute = Math.floor(time / 60)
        let hours = Math.floor(minute / 60)
        let day = Math.floor(hours / 24)
        let month = Math.floor(day / 30)
        let year = Math.floor(month / 12)
        minute %= 60
        hours %= 24
        day %= 30
        month %= 12
        const resp = []
        if(year > 0) {
            resp.push(year + ' y')
        }
        if(month > 0) {
            resp.push(month + ' m')
        }
        if(day > 0) {
            resp.push(day + ' d')
        }
        if(hours > 0) {
            resp.push(hours + ' h')
        }
        return resp.join(' ')
    }

    static secToStr(time) {
        let minute = Math.floor(time / 60)
        let hours = Math.floor(minute / 60)
        let day = Math.floor(hours / 24)
        minute %= 60
        hours %= 24
        const resp = [];
        if(day > 0) {
            resp.push(day + ' days')
        }
        if(hours > 0) {
            resp.push(hours + ' hours')
        }
        resp.push(minute + ' minutes')
        return resp.join(' ')
    }

}