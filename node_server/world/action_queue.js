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
            await this.world.applyActions(item.actor, item.actions);
        }
    }

}