import { Vector } from "../../../www/src/helpers.js";
import { BLOCK } from "../../../www/src/blocks.js";
import { TBlock } from "../../../www/src/typed_blocks3.js";
import { ServerClient } from "../../../www/src/server_client.js";

export const CAN_SUPPORT_BUBBLES = [88, 415]; // soul_sand, bubble_column
export const BUBBLES_PROPAGATION_DELAY = 800;

// Adds or removes a block of bubbles above, checking the conditions for its existence.
export class ManageBubblesAbove {

    onFluidAboveChange(chunk, block, fluidValue, firstRun) {
        return this.onAfterBlockChange(chunk, block, null, firstRun);    
    }

    // called before this block is removed
    onBeforeBlockChange(chunk, block, newMaterial, firstRun) {
        const posAbove = tmp_pos.copyFrom(block.posworld);
        posAbove.y++;
        const blockAbove = chunk.getBlock(posAbove, tmp_block, true);
        return manageBubbles(newMaterial, blockAbove, blockAbove.material, firstRun);
    }
    
    // called after this block is added
    onAfterBlockChange(chunk, block, oldMaterial, firstRun) {
        const posAbove = tmp_pos.copyFrom(block.posworld);
        posAbove.y++;
        const blockAbove = chunk.getBlock(posAbove, tmp_block, true);
        return manageBubbles(block.material, blockAbove, blockAbove.material, firstRun);
    }
}

// Restores bubbles in this block if they were removed, and the block below still supports them.
// Removes bubbles in this block if they shouldn't exist.
export class ManageBubbles {

    onFluidRemove(chunk, block, firstRun) {
        return this.onBeforeBlockChange(chunk, block, block.material, firstRun);    
    }
    
    onBeforeBlockChange(chunk, block, newMaterial, firstRun) {
        const posBelow = tmp_pos.copyFrom(block.posworld);
        posBelow.y--;
        const materialBelow = chunk.getMaterial(posBelow, true);
        return manageBubbles(materialBelow, block, newMaterial, firstRun);
    }
}

function manageBubbles(newMaterialBelow, block, newMaterial, firstRun) {
    const hasBubbles = newMaterial.id === BLOCK.BUBBLE_COLUMN.id;
    const shouldRemoveBubblesInstantly = !block.isWater;
    const shouldHaveBubbles =
        !shouldRemoveBubblesInstantly &&
        CAN_SUPPORT_BUBBLES.includes(newMaterialBelow.id) &&
        (newMaterial.id === 0 || hasBubbles);
    if (hasBubbles !== shouldHaveBubbles) {
        if (firstRun && !shouldRemoveBubblesInstantly) {
            return BUBBLES_PROPAGATION_DELAY;
        }
        return shouldHaveBubbles ? {
            pos: block.posworld.clone(),
            item: BLOCK.BUBBLE_COLUMN,
            action_id: ServerClient.BLOCK_ACTION_CREATE
        } : {
            pos: block.posworld.clone(),
            item: BLOCK.AIR,
            destroy_block: {id: BLOCK.BUBBLE_COLUMN.id},
            action_id: ServerClient.BLOCK_ACTION_DESTROY
        };
    }
}

const tmp_pos = new Vector();
const tmp_block = new TBlock();