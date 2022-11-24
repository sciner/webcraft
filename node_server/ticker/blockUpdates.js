import { BLOCK } from '../../www/js/blocks.js';
import { ServerClient } from '../../www/js/server_client.js';

// constructors for frequently used block updates
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