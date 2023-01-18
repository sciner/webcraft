import {MOTION_MOVED, MOTION_JUST_STOPPED, MOTION_STAYED, DropItem} from "./drop_item.js";
import {CHUNK_STATE} from "../www/js/chunk_const.js"

import {ServerClient} from "../www/js/server_client.js";

const ITEM_MERGE_RADIUS = 0.5; // set it negative to disable merging

export class ItemWorld {

    // temporary collections
    #mergeableItems = [];
    #nonPendingItems = [];

    constructor(chunkManager) {
        this.chunkManager = chunkManager;
        this.world = chunkManager.world;
        this.chunksItemMergingQueue = new Set();
        this.all_drop_items = new Map();
        this.deletedEntityIds = [];
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
        this.all_drop_items.delete(dropItem.entity_id);
        // deactive drop item in database
        dropItem.markDirty(DropItem.DIRTY_DELETE);
        if (dropItem.dirty === DropItem.DIRTY_DELETE) {
            this.deletedEntityIds.push(dropItem.entity_id);
        }
    }

    tick(delta) {
        for(let [_, drop_item] of this.all_drop_items) {
            drop_item.tick(delta);
        }
        if (ITEM_MERGE_RADIUS >= 0) {
            for(let chunk of this.chunksItemMergingQueue) {
                if (chunk.isReady()) {
                    this.#mergeItems(chunk);
                }
            }
        }
        this.chunksItemMergingQueue.clear();
    }

    #mergeItems(chunk) {
        this.#mergeableItems.length = 0;
        this.#nonPendingItems.length = 0;
        /* The first pendingLength items of mergeableItems are from the current chunk
        and just stopped. They must be checked for posible merging with all nearby items.
        At the end of mergeableItems are other stationary items from the this and
        neighboring chunks. They can be checked for merging with the items from the 1st group. */
        for(let [_, item] of chunk.drop_items) {
            if(item.motion === MOTION_JUST_STOPPED) {
                this.#mergeableItems.push(item);
            } else if (item.motion === MOTION_STAYED) {
                this.#nonPendingItems.push(item);
            }
        }
        var pendingLength = this.#mergeableItems.length;
        for(let item of this.#nonPendingItems) {
            this.#mergeableItems.push(item);
        }
        for(let portal of chunk.dataChunk.portals) {
            // I'm not sure if it can be null, but check it just in case
            if(!portal.toRegion)
                continue;
            const otherChunk = portal.toRegion.rev;
            if(!otherChunk || otherChunk.load_state !== CHUNK_STATE.READY)
                continue;
            for(let [_, item] of otherChunk.drop_items) {
                if(item.motion !== MOTION_MOVED) {
                    this.#mergeableItems.push(item);
                }
            }
        }

        var dropItemI = 0;
        while (dropItemI < pendingLength) {
            var dropItemA = this.#mergeableItems[dropItemI];

            var dropItemJ = dropItemI + 1;
            while (dropItemJ < this.#mergeableItems.length) {
                var dropItemB = this.#mergeableItems[dropItemJ];
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
                    Math.floor(dropItemA.pos.distance(dropItemB.pos)) > ITEM_MERGE_RADIUS
                ) {
                    ++dropItemJ;
                    continue;
                }
                /* Merge dropItemA.items[0] with dropItemB.items[indexB].
                Rules of which dropItem remains (by decreasing priority):
                1. If one item has items.length > 1, it remains.
                2. The one with the greater count remains.
                3. The item without a pending check remains (it happens by default because that item has
                    a greater index in #mergeableItems). */
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
                dropItemB.markDirty(DropItem.DIRTY_UPDATE);
                dropItemB.dirty = true;
                const packetsB = [{
                    name: ServerClient.CMD_DROP_ITEM_UPDATE,
                    data: {
                        entity_id:  dropItemB.entity_id,
                        pos:        dropItemB.pos
                    }
                }];
                dropItemB.getChunk().sendAll(packetsB, []);

                if(dropItemA === this.#mergeableItems[dropItemI]) {
                    // We removed the outer loop item. It's an item with the pending merging check.
                    // Stop the inner loop, and repeat the outer loop with the same index.
                    --pendingLength;
                    this.#mergeableItems[dropItemI] = this.#mergeableItems[pendingLength];
                    this.#mergeableItems[pendingLength] = this.#mergeableItems[this.#mergeableItems.length - 1];
                    --this.#mergeableItems.length;
                    --dropItemI; // compensate for ++dropItemI after the inner loop
                    break;
                } else {
                    // We removed the inner loop item. Repeat the inner loop with the same index.
                    if (dropItemJ < pendingLength) {
                        // It's an item with the pending merging check.
                        --pendingLength;
                        this.#mergeableItems[dropItemJ] = this.#mergeableItems[pendingLength];
                        this.#mergeableItems[pendingLength] = this.#mergeableItems[this.#mergeableItems.length - 1];
                    } else {
                        // It's an item without the pending merging check.
                        this.#mergeableItems[dropItemJ] = this.#mergeableItems[this.#mergeableItems.length - 1];
                    }
                    --this.#mergeableItems.length;
                }
            }
            ++dropItemI;
        }
    }

    writeAllDirty() {
        const uc = this.world.dbActor.underConstruction;
        for(const item of this.all_drop_items.values()) {
            if (item.dirty !== DropItem.DIRTY_CLEAR) {
                uc.insertOrUpdateDropItems.push(item);
            }
        }
        uc.deleteDropItemEntityIds = this.deletedEntityIds;
        this.deletedEntityIds = [];
    }
}