import { SimpleQueue } from "@client/helpers.js";

// Queue for actions
export class WorldActionQueue {
    world: any;
    list: SimpleQueue;

    constructor(world) {
        this.world = world;
        this.list = new SimpleQueue();
    }

    get length() { return this.list.length }

    add(actor, actions) {
        this.list.push({actor, actions});
    }

    addFirst(actor, actions) {
        this.list.unshift({actor, actions});
    }

    async run() {
        const MAX_ACTIONS_TIME_MS = 200;
        let pn_start = performance.now();
        while(this.list.length > 0) {
            const item = this.list.shift();
            // Check player is connected
            const player_session = item.actor?.session;
            if(player_session) {
                const player = this.world.players.get(player_session.user_id);
                if(!player) {
                    continue;
                }
                // if the action was postponed until a chunk loads, and the player reconnected - update it
                item.actor = player;
            }
            // Apply actions
            // let pn = performance.now();
            let pn_apply = performance.now();
            await this.world.applyActions(item.actor, item.actions);
            // if(!globalThis.applyActionsCount) globalThis.applyActionsCount = 0
            // console.log(globalThis.applyActionsCount++, performance.now() - pn_apply)
            /*
            const blocks_count = item.actions?.blocks?.list?.length ?? 0;
            if(blocks_count > 27 || this.list.length == 0) {
                pn = Math.round((performance.now() - pn) * 10) / 10;
                const time_from_start = new String(Math.round(performance.now() / 1000)).padStart(8, ' ');
                // console.info(`${time_from_start}: WorldActionsQueue: ${blocks_count} block per ${pn}ms; Queue length: ${this.list.length}`)
            }
            */
            if(item.actions.notify) {
                const notify = item.actions.notify;
                if(('user_id' in notify) && ('user_id' in notify)) {
                    if(notify.total_actions_count == 1) {
                        notify.pn = pn_apply;
                    }
                    if('pn' in notify) {
                        const elapsed = Math.round(performance.now() - notify.pn) / 1000;
                        const message = `${notify.message} for ... ${elapsed} sec`;
                        this.world.chat.sendSystemChatMessageToSelectedPlayers(message, [notify.user_id]);
                    } else {
                        notify.pn = performance.now();
                    }
                }
            }
            if(performance.now() - pn_start >= MAX_ACTIONS_TIME_MS) {
                break;
            }
        }
    }

}