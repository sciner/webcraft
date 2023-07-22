import { SERVER_WORLD_WORKER_MESSAGE } from "@client/constant.js"
import { ServerWorkerPlayer } from "./worker_player.js"

export class ServerWorkerWorld {
    worker: any
    shuttingDown: any = null
    players: Map<string, ServerWorkerPlayer> = new Map()

    async init(world_row: IWorldDBRow) {
        this.worker = new Worker(globalThis.__dirname + '/world/worker.js')

        const that = this

        const onmessage = (data) => {
            data = data.data ?? data
            const cmd = data[0]
            const args = data[1]
            switch(cmd) {
                case SERVER_WORLD_WORKER_MESSAGE.player_terminate_connection: {
                    const player_item = that.players.get(args.session.session_id)
                    if(player_item) {
                        player_item.conn.close(1000, args.message)
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.player_send_json_string: {
                    const player_item = that.players.get(args.session.session_id)
                    if(player_item) {
                        player_item.conn.send(args.json_string)
                    } else {
                        debugger
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.add_building_schema: {
                    for(const world of Qubatch.worlds.values() as ServerWorkerWorld[]) {
                        world.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.add_building_schema, args])
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.need_to_unload: {
                    // TODO: unload after time and if no any active saving tasks
                    break
                }
            }
        }

        if('onmessage' in this.worker) {
            this.worker.onmessage = onmessage;
            // this.worker.onerror = onerror;
        } else {
            this.worker.on('message', onmessage);
            // this.worker.on('error', onerror);
        }
        
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.init, world_row, performance.now()])
    }

    broadcastSystemChatMessage(msg: string) {
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.broadcast_chat_message, msg])
    }

    async addPlayer(conn, session_id: string, skin_id: string) {
        const session = await Qubatch.db.GetPlayerSession(session_id)
        const skin = await Qubatch.db.skins.getUserSkin(session.user_id, skin_id)
        const player_item = new ServerWorkerPlayer(this, conn, session)
        this.players.set(session_id, player_item)
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.on_player, {session, skin}])
    }

    onLeave(player_item: ServerWorkerPlayer) {
        const session = player_item.session
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_leave, {session}])
    }

    onPlayerCommand(player_item: ServerWorkerPlayer, cmd: any) {
        const session = player_item.session
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_command, {session, cmd}])
    }

}