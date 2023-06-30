import { PLAYER_FLAG } from "@client/constant.js";
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
        let t = false
        if (packet?.data) {
            t = packet.data.public
            console.log(packet.data.public)
        }
        const info    = world.info
        const creater = info.user_id
        const age     = world.getTime()
        const players = []
        for (const pl of player.world.players.values()) {
            players.push({id: pl.session.user_id, username: pl.session.username})
        }
        const packets = [{
            name: ServerClient.CMD_WORLD_STATS,
            data: {
                guid: info.guid,
                title: info.title,
                username: creater,
                time: info.dt,
                age: packet_reader.ageToDate(age.day, age.hours),
                public: t,
                official: true,
                players: players,
                cover: info.cover,
                is_admin: (player.session.flags & PLAYER_FLAG.SYSTEM_ADMIN) == PLAYER_FLAG.SYSTEM_ADMIN
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