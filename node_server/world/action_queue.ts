import { SimpleQueue } from "@client/helpers.js";
import type {WorldAction} from "@client/world_action.js";
import type {ServerWorld} from "../server_world.js";
import type {ServerPlayer} from "../server_player.js";
import type {TQueuedNetworkMessage} from "../network/packet_reader.js";
import {PacketReader} from "../network/packet_reader.js";
import type {Mob} from "../mob.js";

const MAX_ACTIONS_QUEUE_PROCESSING_TIME_MS = 200

type TQueuedAction = {
    actor: ServerPlayer | Mob | null
    actions: WorldAction
}

/**
 * Содердит 2 раздельных очереди:
 * - для команд и действий игроков (она выполняется в каждом тике полностью)
 * - для других действий (выполняется если остается время)
 * Действия, создаваемфе в момент обработки других действий или команд, добавляются в начало очереди с
 * сохранением порядка содания.
 */
export class WorldActionQueue {
    world: ServerWorld;
    /** Команды и действия игроков */
    private queuePlayers    = new SimpleQueue<TQueuedAction | TQueuedNetworkMessage>()
    /** Действия не-игроков */
    private queueOther      = new SimpleQueue<TQueuedAction | TQueuedNetworkMessage>()
    /** Очердь, выполняющаяся в настояий момент */
    private queueRunningNow : SimpleQueue<TQueuedAction | TQueuedNetworkMessage> | null = null

    /**
     * Действия, порожденные во время обработки элемента этой очереди.
     * После окончания обработки этого элемента, они добавятся в начало очереди - в порядке создания.
     * Этот масив нужен для соранения порядка: если добавлять действия в начало по одному с помощью unshift,
     * порядок изменится на обратный.
     */
    private childActions: TQueuedAction[]
    private prevTimedOut    = false // для вывода отладочных сообщений

    constructor(world: ServerWorld) {
        this.world = world
    }

    get length() { return this.queuePlayers.length + this.queueOther.length }

    add(actor: ServerPlayer | Mob | null, actions: WorldAction): void {
        if (this.queueRunningNow) {
            this.childActions.push({actor, actions})
        } else {
            const queue = (actor as ServerPlayer)?.session ? this.queuePlayers : this.queueOther
            queue.push({actor, actions})
        }
    }

    addFirst(actor: ServerPlayer | Mob | null, actions: WorldAction): void {
        const queue = this.queueRunningNow ??
            (actor as ServerPlayer)?.session ? this.queuePlayers : this.queueOther
        queue.unshift({actor, actions})
    }

    addNetworkMessage(item: TQueuedNetworkMessage): void {
        this.queuePlayers.push(item)
    }

    async run() {
        const world = this.world
        const childActions = this.childActions = [] // пересоздаем масссив ради сборки мусора
        const pn_start = performance.now()
        let firstReQueuedMsg: TQueuedNetworkMessage | null = null // чтобы остановиться если встретили то же сообщене повторно

        // Сначала выполняем все действия игроков без лимита времени. Потом - действия не игроков, если успеем.
        for(const queue of [this.queuePlayers, this.queueOther]) {
            this.queueRunningNow = queue
            const pn_stop = queue === this.queuePlayers
                ? Infinity
                : pn_start + MAX_ACTIONS_QUEUE_PROCESSING_TIME_MS

            while(queue.length > 0 && performance.now() <= pn_stop) {
                const actionOrMessage = queue.shift()

                // если это сетевое сообщение
                if ((actionOrMessage as TQueuedNetworkMessage).reader) {
                    const msg = actionOrMessage as TQueuedNetworkMessage
                    if (!PacketReader.canProcess(msg.player, msg.packet)) {
                        continue // может, игрок умер или был удален пока команда лежала в очереди, и ее выполнение стало невозможным
                    }
                    if (msg === firstReQueuedMsg) {
                        // мы уже помещали его в очередь в этом вызове; вернем его в очередь и прервем выполнение
                        queue.unshift(msg)
                        break
                    }
                    try {
                        const resp = await msg.reader.read(msg.player, msg.packet)
                        if (!resp) {
                            firstReQueuedMsg ??= msg
                            queue.push(msg)
                        }
                    } catch(e) {
                        world.packet_reader.onError(msg.player, msg.reader, e.message ?? e)
                        // если эта команда породила дочерние действия - не добавлять их (высокий шанс что они некорректны)
                        childActions.length = 0
                        continue // не бросать исключение, продолжать выполнять очередь
                    }

                } else { // это не сетевое сообщение, значит действие
                    const item = actionOrMessage as TQueuedAction

                    // Check player is connected
                    const player_session = (item.actor as ServerPlayer)?.session;
                    if (player_session) { // если нет сессии - значит моб
                        const player = world.players.get(player_session.user_id);
                        if(!player) {
                            continue;
                        }
                        // if the action was postponed until a chunk loads, and the player reconnected - update it
                        item.actor = player;
                    }
                    // Apply actions
                    let pn_apply = performance.now();
                    const {actions} = item
                    try {
                        await world.applyActions(item.actor, actions);
                    } catch (e) {
                        console.error('world.applyActions exception ', e)
                        // если это действие породило дочерние - не добавлять их (высокий шанс что они некорректны)
                        childActions.length = 0
                        continue // не бросать исключение, продолжать выполнять очередь
                    } finally {
                        // действия, кторые должны выполниться даже если при обработке WorldAction возникло исключение

                        // синхронизировать управление с действием, если нужно (независимо от успешности действия)
                        (item.actor as ServerPlayer)?.controlManager?.syncWithEvent(actions)

                        if (actions.callback) {
                            actions.callback(actions)
                        }
                    }

                    if(actions.notify) {
                        const notify = item.actions.notify;
                        if(('user_id' in notify) && ('user_id' in notify)) {
                            if(notify.total_actions_count == 1) {
                                notify.pn = pn_apply;
                            }
                            if('pn' in notify) {
                                const elapsed = Math.round(performance.now() - notify.pn) / 1000;
                                const message = `${notify.message} for ... ${elapsed} sec`;
                                world.chat.sendSystemChatMessageToSelectedPlayers(message, [notify.user_id]);
                            } else {
                                notify.pn = performance.now();
                            }
                        }
                    }
                }

                // если были порождены новые действия - добавить их в начало очереди в том же порядке
                if (childActions.length) {
                    for(let i = childActions.length - 1; i >= 0; i--) {
                        queue.unshift(childActions[i])
                    }
                    childActions.length = 0
                }
            }
        }
        this.queueRunningNow = null
        /*
        // отладочное сообщение если не успевает обработать
        const timedOut = this.queueOther.length > 0
        if (timedOut !== this.prevTimedOut) {
            console.log(timedOut ? 'WorldActionQueue timed out' : 'WorldActionQueue is free again')
        }
        this.prevTimedOut = timedOut
        */
    }

}