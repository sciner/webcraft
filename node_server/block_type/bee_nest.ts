import { WorldAction } from "@client/world_action.js";
import { ServerClient } from "@client/server_client.js";
import type {TBlock} from "@client/typed_blocks3.js";
import type {Mob} from "../mob.js";

export class BeeNest {
    tblock: TBlock

    constructor(tblock: TBlock) {
        this.tblock = tblock;
    }

    // Move mob into block and deactivate mob in world
    appendMob(mob: Mob) {
        const tblock = this.tblock;
        const world = mob.getWorld();
        // 1. Add mob into block
        const extra_data = tblock.extra_data
        extra_data.bees.push({
            id: mob.id
        });
        // 2. Move pollen from bee to nest
        extra_data.pollen += mob.extra_data.pollen;
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