import { BLOCK } from '../../www/js/blocks.js';
import { TBlock } from "../../www/js/typed_blocks3.js";
import { ArrayHelpers, Vector } from '../../www/js/helpers.js';
import { ServerClient } from '../../www/js/server_client.js';

export class TickerHelpers {

    // Pushes the result of a ticker into an array of updated blocks.
    // The result can be a single item, or an array of items, posibly containing nulls.
    static pushBlockUpdates(all_upd_blocks, new_upd_blocks) {
        if (new_upd_blocks) {
            if (Array.isArray(new_upd_blocks)) {
                // Sometimes it's covenient to add nulls, e.g. BlockUpdates.updateTNT(). Revome them here.
                ArrayHelpers.filterSelf(new_upd_blocks, v => v != null);
                if (new_upd_blocks.length > 0) {
                    all_upd_blocks.push(...new_upd_blocks);
                }
            } else { // a single change was returned
                all_upd_blocks.push(new_upd_blocks);
            }
        }
    }
}

// A base class for all before- and after- change listeners that can be used in DelayedCalls
export class DelayedBlockListener {
    
    // "After change" listners are called with newMaterial == block.material
    delayedCall(chunk, pos, newBlockId = null) {
        const block = chunk.getBlock(pos, tmp_DelayedBlockListener_block);
        const otherMaterial = newBlockId != null
            ? BLOCK.BLOCK_BY_ID[newBlockId]
            : block.material;
        const upd_blocks = this.func(chunk, block, otherMaterial, false);
        TickerHelpers.pushBlockUpdates(chunk.blocksUpdatedByDelayedCalls, upd_blocks);
    }

    func(chunk, block, material, firstRun) {
        // override it
    }
}

const tmp_DelayedBlockListener_block = new TBlock();

// helper methods and constructors for frequently used block updates
export class BlockUpdates {
    
    static igniteTNT(pos, block) {
        if (block.extra_data?.explode) {
            // If it's already burning, don't overwrite the counter.
            // It may cause TNT to never explode.
            return null;
        }
        return {
            pos: pos,
            item: {id: BLOCK.TNT.id, extra_data: {explode: true, fuse: 0}},
            action_id: ServerClient.BLOCK_ACTION_MODIFY
        };
    }
}