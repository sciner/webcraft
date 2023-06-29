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
        if (packet?.data) {
            world.rules.setValue('public', packet.data.public.toString())
        }
        const info    = world.info
        const creater = world.players.get(info.user_id)
        const age = world.getTime()
        const packets = [{
            name: ServerClient.CMD_WORLD_STATS,
            data: {
                "title": info.title,
                "username": creater.session.username,
                "time": info.dt,
                "age": packet_reader.ageToDate(age.day, age.hours),
                "public": world.rules.getValue('public'),
                "official": true,
            }
        }];

        player.world.sendSelected(packets, player)

        return true
    }

    static ageToDate(day: number, hours: number) {
        let month = Math.floor(day / 30)
        let year = Math.floor(month / 12)
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
        resp.push(hours + ' h')
        return resp.join(' ')
    }

}