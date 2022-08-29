// Queue for actions
export class WorldActionQueue {

    constructor(world) {
        this.world = world;
        this.list = [];
    }

    add(actor, actions) {
        this.list.push({actor, actions});
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
            }
            // Apply actions
            let pn = performance.now();
            await this.world.applyActions(item.actor, item.actions);
            const blocks_count = item.actions?.blocks?.list?.length ?? 0;
            if(blocks_count > 27) {
                pn = Math.round((performance.now() - pn) * 10) / 10;
                const time_from_start = new String(Math.round(performance.now() / 1000)).padStart(8, ' ');
                console.log(`${time_from_start}: WorldActionsQueue: ${blocks_count} block per ${pn}ms; Queue length: ${this.list.length}`)
            }
            if(performance.now() - pn_start >= MAX_ACTIONS_TIME_MS) {
                break;
            }
        }
    }

}