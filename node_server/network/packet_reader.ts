import { PLAYER_STATUS } from "@client/constant.js";
import { SimpleQueue } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import type {ServerPlayer} from "../server_player.js";
import type {WorldActionQueue} from "../world/action_queue.js";

export type TQueuedNetworkMessage = {
    reader: ICommandReader
    player: ServerPlayer
    packet: INetworkMessage
}

// TODO если нет проблем с общей очередью пактов и команд, удалить этот класс
class PacketRequerQueue {
    packet_reader: PacketReader;
    private list = new SimpleQueue<TQueuedNetworkMessage>()

    constructor(packet_reader: PacketReader) {
        this.packet_reader = packet_reader
    }

    add(item: TQueuedNetworkMessage) {
        this.list.push(item);
    }

    async process() {
        let len = this.list.length;
        for(let i = 0; i < len; i++) {
            const item = this.list.shift();
            const {reader, player, packet} = item;
            if (!PacketReader.canProcess(player, packet)) {
                continue // может, игрок умер или был удален пока команда лежала в очереди, и ее выполнение стало невозможным
            }
            try {
                const resp = await reader.read(player, packet);
                if(!resp) {
                    this.list.push(item);
                }
            } catch(e) {
                this.packet_reader.onError(player, reader, e);
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
        ServerClient.CMD_PLAYER_CONTROL_SESSION,// this command must read every packet to ensure we don't miss when the player switches the session
        ServerClient.CMD_PLAYER_CONTROL_UPDATE, // this command must read every packet because of delta compressor
        ServerClient.CMD_QUEUED_PING    // чтобы лаг правильно измерялся даже когда игрок мертв
    ]

    actions_queue: WorldActionQueue | null  // если не null, то команды кладутся сюда
    queue: PacketRequerQueue;               // если actions_queue == null, то команды кладутся сюда
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

        if (!PacketReader.canProcess(player, packet)) {
            return;
        }

        const reader = this.registered_readers.get(packet?.name);
        if(reader) {
            if(reader.queue) {
                const queuedMessage: TQueuedNetworkMessage = {reader, player, packet}
                if (this.actions_queue) {
                    this.actions_queue.addNetworkMessage(queuedMessage)
                } else {
                    this.queue.add(queuedMessage)
                }
            } else {
                try {
                    await reader.read(player, packet);
                } catch(e) {
                    this.onError(player, reader, e);
                }
            }
        } else {
            console.log(`ERROR: Not found packet reader for command: ${packet.name}`);
        }

    }

    static canProcess(player: ServerPlayer, packet: INetworkMessage): boolean {
        switch (player.status) {
            case PLAYER_STATUS.DELETED:
                return false
            case PLAYER_STATUS.DEAD:
                return this.CMDS_POSSIBLE_IF_DEAD.includes(packet.name)
        }
        return true
    }

    //
    onError(player: ServerPlayer, commandReader: ICommandReader, err): void {
        console.log(err)
        player.sendError(err)
        if (commandReader.terminateOnException) {
            player.terminate(err)
        }
    }

}