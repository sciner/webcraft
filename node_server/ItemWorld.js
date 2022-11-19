import {CHUNK_STATE_BLOCKS_GENERATED} from "./server_chunk.js";

import {ServerClient} from "../www/js/server_client.js";

const MAX_MERGE_DISTANCE = 0.5;

export class ItemWorld {

    constructor(chunkManager) {
        this.chunkManager = chunkManager;
        this.world = chunkManager.world;
        // temporary collections
        this.mergeableItems = [];
    }

    /**
     * Deletes dropItem from the data structures.
     * It doesn't notify the players.
     * Providing chunkOptional increases performance.
     */
    delete(dropItem, chunkOptional) {
        let chunk = chunkOptional || dropItem.getChunk();
        // delete from chunk
        chunk.drop_items.delete(dropItem.entity_id);
        // unload drop item
        dropItem.onUnload();
        // deactive drop item in database
        this.world.db.deleteDropItem(dropItem.entity_id);
    }

    tick(delta) {
        for(let [_, drop_item] of this.world.all_drop_items) {
            drop_item.tick(delta);
        }
        for(let chunk of this.world.chunks.all) {
            if (chunk.load_state === CHUNK_STATE_BLOCKS_GENERATED)
                this.mergeItemsInChunk(chunk);
        }
    }

    mergeItemsInChunk(chunk) {
        if (!chunk.pendingItemsMerge)
            return;
        chunk.pendingItemsMerge = false;

        this.mergeableItems.length = 0;
        // at the beginning of mergeableItems are items from the current chunk
        for(let [entity_id, item] of chunk.drop_items.entries()) {
            if(!item.moved) {
                this.mergeableItems.push(item);
            }
        }
        var chunkLength = this.mergeableItems.length;
        // at the end of mergeableItems are items from the neighboring chunks
        for(let portal of chunk.dataChunk.portals) {
            // I'm not sure if it can be null, but check it just in case
            if(!portal.toRegion)
                continue;
            const otherChunk = portal.toRegion.rev;
            if(!otherChunk || otherChunk.load_state !== CHUNK_STATE_BLOCKS_GENERATED)
                continue;
            for(let [entity_id, item] of otherChunk.drop_items.entries()) {
                if(!item.moved) {
                    this.mergeableItems.push(item);
                }
            }
        }

        var dropItemI = 0;
        while (dropItemI < chunkLength) {
            var dropItemA = this.mergeableItems[dropItemI];

            var dropItemJ = dropItemI + 1;
            while (dropItemJ < this.mergeableItems.length) {
                var dropItemB = this.mergeableItems[dropItemJ];
                // DropItems can be merged if at least one of them has items.length == 1.
                // If both have items.length > 1, it seems complicated and rare, not worth implementing.
                if(dropItemA.items.length !== 1) {
                    if (dropItemB.items.length === 1) {
                        var t = dropItemA; dropItemA = dropItemB; dropItemB = t;
                    } else {
                        ++dropItemJ;
                        continue;
                    }
                }
                // here we know that dropItemA.items.length == 1
                let itemId = dropItemA.items[0].id;

                var indexB = -1;
                for(let i=0; i<dropItemB.items.length; ++i) {
                    if(dropItemB.items[i].id === itemId) {
                        indexB = i;
                        break;
                    }
                }
                if(indexB < 0 ||
                    Math.floor(dropItemA.pos.distance(dropItemB.pos)) > MAX_MERGE_DISTANCE
                ) {
                    ++dropItemJ;
                    continue;
                }
                /* Merge dropItemA.items[0] with dropItemB.items[indexB].
                Rules of which dropItem remains:
                1. If one item has items.length > 1, it remains.
                2. If both items have items.length == 1, the one with the bigger count remains. */
                if(dropItemB.items.length === 1 && dropItemB.items[0].count < dropItemA.items[0].count) {
                    var t = dropItemA; dropItemA = dropItemB; dropItemB = t;
                }

                // delete dropItemA
                const chunkA = dropItemA.getChunk();
                this.delete(dropItemA, chunkA);
                const packetsA = [{
                    name: ServerClient.CMD_DROP_ITEM_DELETED,
                    data: [dropItemA.entity_id]
                }];
                chunkA.sendAll(packetsA, []);
                
                // increment dropItemB count
                dropItemB.items[indexB].count += dropItemA.items[0].count;        
                const packetsB = [{
                    name: ServerClient.CMD_DROP_ITEM_UPDATE,
                    data: {
                        entity_id:  dropItemB.entity_id,
                        pos:        dropItemB.pos
                    }
                }];
                dropItemB.getChunk().sendAll(packetsB, []);

                if(dropItemA === this.mergeableItems[dropItemI]) {
                    // We removed the outer loop item. It's from the current chunk.
                    // Stop the inner loop, and repeat the outer loop with the same index.
                    --chunkLength;
                    this.mergeableItems[dropItemI] = this.mergeableItems[chunkLength];
                    this.mergeableItems[chunkLength] = this.mergeableItems[this.mergeableItems.length - 1];
                    --this.mergeableItems.length;
                    --dropItemI; // compensate for ++dropItemI after the inner loop
                    break;
                } else {
                    // We removed the inner loop item. Repeat the inner loop with the same index.
                    if (dropItemJ < chunkLength) {
                        // It's from the current chunk.
                        --chunkLength;
                        this.mergeableItems[dropItemJ] = this.mergeableItems[chunkLength];
                        this.mergeableItems[chunkLength] = this.mergeableItems[this.mergeableItems.length - 1];
                    } else {
                        // It's from a neighboring chunk.
                        this.mergeableItems[dropItemJ] = this.mergeableItems[this.mergeableItems.length - 1];
                    }
                    --this.mergeableItems.length;
                }
            }
            ++dropItemI;
        }
    }
}