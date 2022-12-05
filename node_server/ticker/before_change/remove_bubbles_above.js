import { Vector } from "../../../www/js/helpers.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { ServerClient } from "../../../www/js/server_client.js";
import { DelayedChangeListener } from "../ticker_helpers.js"
import { CAN_SUPPORT_BUBBLES, BUBBLES_PROPAGATION_DELAY } from "../after_change/add_bubbles_above.js"

// removes a block of bubbles above, if the to-be-set block doesn't supported it
export default class Listener extends DelayedChangeListener {
    get calleeId() { return "remBubAbo"; }
    
    func(world, chunk, block, newMaterial, firstRun) {
        if (CAN_SUPPORT_BUBBLES.indexOf(newMaterial.id) >= 0) {
            return;
        }
        const posAbove = tmp_pos.copyFrom(block.posworld);
        posAbove.y++;
        const materialAbove = chunk.getMaterial(posAbove, true);
        if (materialAbove.id !== BLOCK.BUBBLE_COLUMN.id) {
            return;
        }
        if (firstRun) {
            return BUBBLES_PROPAGATION_DELAY;
        }
        return {
            pos: posAbove.clone(),
            item: BLOCK.AIR,
            destroy_block_id: BLOCK.BUBBLE_COLUMN.id, 
            action_id: ServerClient.BLOCK_ACTION_DESTROY
        };
    }
}

const tmp_pos = new Vector();