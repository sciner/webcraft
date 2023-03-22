import { PLAYER_STATUS } from "@client/constant.js";
import { ServerClient } from "@client/server_client.js";
import type {ServerPlayer} from "../server_player.js";

class PacketRequerQueue {
    packet_reader: PacketReader;
    list: {reader: ICommandReader, player: ServerPlayer, packet: INetworkMessage}[];

    constructor(packet_reader: PacketReader) {
        this.packet_reader = packet_reader;
        this.list = [];
    }

    add(reader: ICommandReader, player: ServerPlayer, packet: INetworkMessage) {
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
                if (reader.terminateOnException) {
                    player.terminate(e)
                }
            }
        }
    }

}

export interface ICommandReader {
    get queue(): boolean | undefined
    get command(): int
    /**
     * If it's true, and processing the command has thrown an exception, the connection will be terminated
     * (because teh player is probably in a bugged state, and it's better not to continue this session).
     */
    get terminateOnException(): boolean | undefined
    read(player: ServerPlayer, packet: INetworkMessage): Promise<any>
}

//
export class PacketReader {
    static CMDS_POSSIBLE_IF_DEAD: int[] = [ServerClient.CMD_RESURRECTION, ServerClient.CMD_CHUNK_LOAD,
        ServerClient.CMD_PLAYER_STATE // this command must read every packet because of delta compressor
    ]

    queue: PacketRequerQueue;
    registered_readers: Map<int, ICommandReader>;

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
    async read(player: ServerPlayer, packet: INetworkMessage) {

        if (player.status === PLAYER_STATUS.DEAD && !PacketReader.CMDS_POSSIBLE_IF_DEAD.includes(packet.name)) {
            return;
        }

        const reader = this.registered_readers.get(packet?.name);
        if(reader) {
            if(reader.queue) {
                this.queue.add(reader, player, packet);
            } else {
                try {
                    await reader.read(player, packet);
                } catch(e) {
                    await this.sendErrorToPlayer(player, e);
                    if (reader.terminateOnException) {
                        player.terminate(e)
                    }
                }
            }
        } else {
            console.log(`ERROR: Not found packet reader for command: ${packet.name}`);
        }

    }

    //
    async sendErrorToPlayer(player: ServerPlayer, e) {
        console.log(e);
        player.sendError(e);
    }

}