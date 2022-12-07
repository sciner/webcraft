import { Vector } from "../../../www/js/helpers.js";
import { BLOCK } from "../../../www/js/blocks.js";
import { TBlock } from "../../../www/js/typed_blocks3.js";
import { ServerClient } from "../../../www/js/server_client.js";
import { DelayedBlockListener } from "../ticker_helpers.js"

export const CAN_SUPPORT_BUBBLES = [BLOCK.SOUL_SAND.id, BLOCK.BUBBLE_COLUMN.id];
export const BUBBLES_PROPAGATION_DELAY = 1000;

// adds a block of bubbles above, if the newly added block supports it
export default class Listener extends DelayedBlockListener {
    get calleeId() { return "addBubAbo"; }
    
    func(chunk, block, oldMaterial, firstRun) {
        if (CAN_SUPPORT_BUBBLES.indexOf(block.id) < 0) {
            return;
        }
        const posAbove = tmp_pos.copyFrom(block.posworld);
        posAbove.y++;
        const blockAbove = chunk.getBlock(posAbove, tmp_block, true);
        if (blockAbove.id || !blockAbove.isWater) {
            return;
        }
        if (firstRun) {
            return BUBBLES_PROPAGATION_DELAY;
        }
        return {
            pos: posAbove.clone(),
            item: BLOCK.BUBBLE_COLUMN,
            action_id: ServerClient.BLOCK_ACTION_CREATE
        };
    }
}

const tmp_pos = new Vector();
const tmp_block = new TBlock();