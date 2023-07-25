import { SERVER_WORLD_WORKER_MESSAGE } from "@client/constant.js"
import { ServerWorkerPlayer } from "./worker_player.js"
import type {ServerGame} from "../server_game.js";

const REMOVED_PLAYER_TTL = 60 * 1000    // Только для обнаружения ошибок, не влияет на игру.

/** Существует в главном потоке. Общается с одним воркером мира. */
export class ServerWorkerWorld {
    worker:                 Worker // может быть тип другой (или не может?), но объявим тип Worker чтобы работала проверка синтаксиса, например, postMessage
    players:                Map<string, ServerWorkerPlayer> = new Map()
    // Время удаления недавно удаленных игроков. Нужно только для отладки. Можно убрать.
    removed_players_time:   Map<string, number> = new Map<string, number>()
    game:                   ServerGame
    guid:                   string
    world_admins:           string[] = []
    world_row:              IWorldDBRow

    private last_message_received_time: number
    private kill_timeout: any = null

    constructor(game: ServerGame) {
        this.game = game
    }

    async init(world_row: IWorldDBRow) {
        this.world_row = world_row
        this.guid = world_row.guid
        this.worker = new Worker(globalThis.__dirname + '/world/worker.js')

        const that = this

        const onmessage = (data) => {
            this.last_message_received_time = performance.now()
            data = data.data ?? data
            const cmd = data[0]
            const args = data[1]
            switch(cmd) {
                case SERVER_WORLD_WORKER_MESSAGE.player_terminate_connection: {
                    const worker_player = that.players.get(args.session.session_id)
                    if(worker_player) {
                        worker_player.conn.close(1000, args.message)
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.player_send_json_string: {
                    const worker_player = that.players.get(args.session.session_id)
                    if(worker_player) {
                        worker_player.conn.send(args.json_string)
                    } else {
                        // Недавно удаленным игрокам еще приходят сообщения. Может, так не должно быть.
                        // Но пока игнорируем такие сообщения, считаем что ок.
                        const time = this.removed_players_time.get(args.session.session_id)
                        if (time == null || time < performance.now() - REMOVED_PLAYER_TTL) {
                            debugger
                        }
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.add_building_schema: {
                    for(const world of this.game.worlds.values()) {
                        world.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.add_building_schema, args])
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.need_to_unload: {
                    // Сейчас мир находится в ожидании что его убьют. Если за это время не появилось новых игроков, так и сделаем.
                    if (this.players.size === 0) {
                        this.game.deleteWorld(this)
                    } else {
                        // За это время появились игроки, говорим миру опять ожить
                        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.no_need_to_unload])
                    }
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.admin_list_updated: {
                    this.world_admins = args.list as string[]
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.shutdown: {
                    this.game.shutdown(args)
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.shutdown_complete: {
                    this.game.deleteWorld(this)
                    break
                }
                case SERVER_WORLD_WORKER_MESSAGE.change_world_is_public: {
                    this.game.db.setWorldPublic(args.user_id, args.world_guid, args.is_public)
                    break
                }
            }
        }

        this.last_message_received_time = performance.now()

        this.kill_timeout = setInterval(() => {
            if (this.last_message_received_time < performance.now() - this.game.config.world.kill_timeout_seconds * 1000) {
                console.error(`World ${this.guid} is terminated by timeout`)
                this.game.deleteWorld(this)
            }
        }, this.game.config.world.kill_timeout_seconds * 1000 / 10)

        const onerror = (e) => {
            console.error(`World ${this.guid} is terminated due to error: `, e)
            this.game.deleteWorld(this)
        }

        const worker_any = this.worker as any
        if('onmessage' in worker_any) {
            this.worker.onmessage = onmessage;
            this.worker.onerror = onerror;
        } else {
            worker_any.on('message', onmessage);
            worker_any.on('error', onerror);
        }

        const skin_list = this.game.db.skins.list
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.init, {world_row, skin_list}, performance.now()])
    }

    onDelete(): void {
        this.worker.terminate()
        clearInterval(this.kill_timeout)
        // При нормальном закрытии игроков не должно быть. TODO: посылать им команду, переводящую их в главное меню.
        for(const player of this.players.values()) {
            player.conn.close(1000)
        }
    }

    broadcastSystemChatMessage(msg: string) {
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.broadcast_chat_message, msg])
    }

    async addPlayer(conn, session_id: string, skin_id: string) {
        const session = await this.game.db.GetPlayerSession(session_id)
        const skin = await this.game.db.skins.getUserSkin(session.user_id, skin_id)
        const worker_player = new ServerWorkerPlayer(this, conn, session)
        this.players.set(session_id, worker_player)
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.on_player, {session, skin}])
    }

    onLeave(worker_player: ServerWorkerPlayer) {
        const session = worker_player.session
        this.players.delete(session.session_id)
        this.removed_players_time.set(session.session_id, performance.now()) // запомним что его удалили - сообщения ему в течение некоторого времени не считаются ошибкой
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_leave, {session}])
        // периодически забываем удаленных игроков
        const min_time = performance.now() - REMOVED_PLAYER_TTL
        for(const [key, time] of this.removed_players_time) {
            if (time < min_time) {
                this.removed_players_time.delete(key)
            }
        }
    }

    onPlayerCommand(worker_player: ServerWorkerPlayer, cmd: any) {
        const session = worker_player.session
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.player_command, {session, cmd}])
    }

    isWorldAdmin(session: PlayerSession): boolean {
        return this.world_admins.includes(session.username) ||
            (session.user_id == this.world_row.user_id)
    }

    changeCover(filename: string) {
        this.worker.postMessage([SERVER_WORLD_WORKER_MESSAGE.change_cover, {filename}])
    }

}