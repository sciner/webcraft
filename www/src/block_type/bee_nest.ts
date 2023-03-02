import { WorldAction } from "../world_action.js";
import { ServerClient } from "../server_client.js";

export class BeeNest {
    [key: string]: any;

    constructor(tblock) {
        this.tblock = tblock;
    }

    // Move mob into block and deactivate mob in world
    appendMob(mob) {
        const tblock = this.tblock;
        const world = mob.getWorld();
        // 1. Add mob into block
        tblock.extra_data.bees.push({
            entity_id: mob.entity_id
        });
        // 2. Move pollen from bee to nest
        tblock.extra_data.pollen += mob.extra_data.pollen;
        mob.extra_data.pollen = 0;
        // 3. Modify block
        const actions = new WorldAction(null, world, false, false);
        const updated_blocks = {pos: tblock.posworld, item: tblock.convertToDBItem(), action_id: ServerClient.BLOCK_ACTION_MODIFY};
        actions.addBlocks([updated_blocks]);
        world.actions_queue.add(null, actions);
        // 4. Deactivate mob and remove from world
        mob.deactivate();
    }

}