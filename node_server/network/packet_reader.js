import { ServerClient } from "../../www/js/server_client.js";
import { PLAYER_STATUS_DEAD } from "../../www/js/constant.js";

class PacketRequerQueue {

    constructor(packet_reader) {
        this.packet_reader = packet_reader;
        this.list = [];
    }

    add(reader, player, packet) {
        this.list.push({reader, player, packet});
    }

    async process() {
        let len = this.list.length;
        for(let i = 0; i < len; i++) {
            const item = this.list.shift();
            const {reader, player, packet} = item;
            try {
                const resp = await reader.read(player, packet);
                if(!resp) {
                    this.list.push(item);
                }
            } catch(e) {
                await this.packet_reader.sendErrorToPlayer(player, e);
            }
        }
    }

}

//
export class PacketReader {

    constructor() {

        // packet queue
        this.queue = new PacketRequerQueue(this);

        // Load all packet readers from directory
        this.registered_readers = new Map();

        for(let filename of config.clientpackets) {
            import(`./clientpackets/${filename}.js`).then(module => {
                this.registered_readers.set(module.default.command, module.default);
                console.debug(`Registered client packet reader: ${module.default.command}`)
            });
        }

    }

    // Read packet
    async read(player, packet) {

        if (player.status === PLAYER_STATUS_DEAD && ![ServerClient.CMD_RESURRECTION, ServerClient.CMD_CHUNK_LOAD].includes(packet.name)) {
            return;
        }

        try {
            const reader = this.registered_readers.get(packet?.name);
            if(reader) {
                if(reader.queue) {
                    this.queue.add(reader, player, packet);
                } else {
                    await reader.read(player, packet);
                }
            } else {
                console.log(`ERROR: Not found packet reader for command: ${packet.name}`);
            }
        } catch(e) {
            await this.sendErrorToPlayer(player, e);
        }

    }

    //
    async sendErrorToPlayer(player, e) {
        console.log(e);
        player.sendError(e);
    }

}