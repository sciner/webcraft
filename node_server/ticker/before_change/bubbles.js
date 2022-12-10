import { Vector } from "../../../www/js/helpers.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { ServerClient } from "../../../www/js/server_client.js";
import { DelayedBlockListener } from "../ticker_helpers.js"
import { CAN_SUPPORT_BUBBLES, BUBBLES_PROPAGATION_DELAY } from "../after_change/bubbles.js"

// restores bubbles in this block if they were removed, and the block below still supports them
export class RemoveBubblesAbove extends DelayedBlockListener {
    
    func(chunk, block, newMaterial, firstRun) {
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

// restores bubbles in this block if they were removed, and the block below still supports them
export class RestoreBubbles extends DelayedBlockListener {
    
    func(chunk, block, newMaterial, firstRun) {
        if (!block.isWater || newMaterial.id) {
            return;
        }
        const posBelow = tmp_pos.copyFrom(block.posworld);
        posBelow.y--;
        const materialBelow = chunk.getMaterial(posBelow, true);
        if (CAN_SUPPORT_BUBBLES.indexOf(materialBelow.id) < 0) {
            return;
        }
        if (firstRun) {
            return BUBBLES_PROPAGATION_DELAY;
        }
        return {
            pos: block.posworld.clone(),
            item: BLOCK.BUBBLE_COLUMN,
            action_id: ServerClient.BLOCK_ACTION_CREATE
        };
    }
}

const tmp_pos = new Vector();