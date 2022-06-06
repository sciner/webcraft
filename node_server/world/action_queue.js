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
            await this.world.applyActions(item.actor, item.actions);
        }
    }

}