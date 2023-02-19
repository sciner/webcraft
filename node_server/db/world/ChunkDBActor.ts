import { Vector } from "../../../www/src/helpers.js";
import { CHUNK_STATE } from "../../../www/src/chunk_const.js";
import { ServerClient } from "../../../www/src/server_client.js";
import { WorldChunkFlags } from "./WorldChunkFlags.js";
import { STABLE_WORLD_MODIFY_CHUNKS_TTL, STABLE_WORLD_MODIFY_CHUNKLESS_TTL, CLEANUP_WORLD_MODIFY_PER_TRANSACTION
    } from "../../server_constant.js";
import { DBWorldChunk } from "./chunk.js";
import { decompressModifiresList } from "../../../www/src/compress/world_modify_chunk.js";
import type { ServerWorld } from "../../server_world.js";
import type { ServerChunk } from "../../server_chunk.js";

export const BLOCK_DIRTY = {
    CLEAR:              0, // used to keep rowIDs of blocks that are frequently modified
    INSERT:             1,
    UPDATE:             2,
    UPDATE_EXTRA_DATA:  3
};

// It manages DB queries of one chunk.
export class ChunkDBActor {
    world: ServerWorld;
    addr: Vector;
    chunk: ServerChunk | null;
    dirtyBlocks: Map<any, any>;
    unsavedBlocks: Map<any, any>;
    lastUnsavedChangeTime: number;
    world_modify_chunk_hasRowId: any;
    savingUnsavedBlocksPromise: any;

    constructor(world : ServerWorld, addr : Vector, chunk : ServerChunk = null) {
        this.world = world;
        this.addr = addr;
        this.chunk = chunk;

        /**
         * Which blocks must be commited in the next transaction to world_modify
         * The keys are block indexes (not flat).
         * The values are objects. They contain fields of world_modify:
         *  - user_id   ?Int    => world_modify.user_id
         *  - pos       Vector  => world_modify.(x, y, z)
         *  - item      Object  => world_modify.params
         *     In addition, some of its fields are saved separatley:
         *     - item.id            Int     => world_modify.block_id
         *     - item.entity_id     ?String => world_modify.entity_id
         *     - item.extra_data    ?Object => world_modify.extra_data
         *     - item.rotate, ... - other fields may be present, but they are not processed in any special way
         * Additonal fields:
         *  - state     Int  - one of {@link BLOCK_DIRTY}
         *  - rowId     ?Int - if it's not null, it's the known rowID of the last record of this block.
         * Additional fields are used for entries that need to select rowId, and then be inserted or updated:
         *  - newEntry      Object - the entry to which the found rowId will be set
         *  - chunk_addr    Vector
         */
        this.dirtyBlocks    = new Map();

        // The keys are block indexes (not flat).
        // The values are blocks that must be saved to world_modify_chunks.
        this.unsavedBlocks  = new Map();

        // The time of last change not saved in world_modify_chunks
        // It's also an indicator of whether the actor should be in dbActor.dirtyActors
        this.lastUnsavedChangeTime = Infinity;

        // It can be true, false or a Number (a known rowId). It can be true only before the chunk is ready.
        this.world_modify_chunk_hasRowId = this.world.worldChunkFlags.has(addr, WorldChunkFlags.DB_WORLD_MODIFY_CHUNKS);

        /**
         * If it's not null, it resolves when unsavedBlocks finish saving, so reading them
         * have a predictable result.
         * 
         * If we try to load the chunk while the chunkless actor is saving its modifiers,
         * it ensures the chunk won't start loading befre the actor finishes writing.
         */
        this.savingUnsavedBlocksPromise = null;
    }

    async loadChunkModifiers() {
        // Prevent a situation like this: a chunk is created with an existing chunkless actor.
        // The actor was in the process of saving world_modify_chuunks.
        // (if it wasn't saving, it won't start until the chunk loads, see this.writeToWorldTransaction)
        // By the time the chunk load obsolete modifers, the actor flushes the new ones.
        await this.savingUnsavedBlocksPromise;

        let ml;
        if (this.world_modify_chunk_hasRowId) {
            const addr = this.addr;
            const row = await this.world.db.chunks.bulkGetWorldModifyChunkQuery.get(addr.toArray());
            if (!row) {
                // If there is no row, restoreModifiedChunks() told us that is exists: it's posible
                // if someone deleted the record while the game was running.
                // We don't handle it properly anywhere in code.
                throw new Error('Not found in world_modify_chunks ' + addr);
            }
            if (row.obj) {
                ml = {
                    obj: JSON.parse(row.obj)
                };
            } else if (row.compressed) {
                ml = {
                    compressed: row.compressed,
                    private_compressed: row.private_compressed
                };
                decompressModifiresList(ml);
            } else {
                // It shouldn't happen. But at least we can continue without crashing.
                ml = { obj: {} };
            }
            this.world_modify_chunk_hasRowId = row.rowId;
        } else {
            ml = { obj: {} }; // empty uncompressed modifiers, and no compressed modifiers
        }

        // if the actor was created before the chunk, and accumulated some changes, apply them to the loaded modifiers
        if (this.unsavedBlocks.size) {
            for(const [index, item] of this.unsavedBlocks) {
                const flatIndex = tmpVector.fromChunkIndex(index).relativePosToFlatIndexInChunk();
                ml.obj[flatIndex] = item;
            }
            // invalidate the compressed modifers
            ml.compressed = null;
            ml.private_compressed = null;
        }

        return ml;
    }

    /**
     * @param {object} data - a value stored in {@link dirtyBlocks}. The method may 
     *  remember the object and/or modify it. It shouldn't be used after passing to this method.
     * @param {?int} index - the block index, the same in TBlock.
     *  If it's not provided, it's deduced from params.pos
     * @param {?int} state - one of BLOCK_DIRTY.*** constants, except BLOCK_DIRTY.CLEAR.
     *  If it's not provided, it's deduced from params.action_id
     */
    markBlockDirty(data, index = null, state = null) {
        // validate data
        const item = data.item;
        if (data.pos == null) {
            throw "data.pos == null";
        }
        if (item == null) {
            throw "data.item == null";
        }
        // process params
        index = index ?? tmpVector.copyFrom(data.pos).worldPosToChunkIndex();
        state = state ?? (data.action_id === ServerClient.BLOCK_ACTION_MODIFY
            ? BLOCK_DIRTY.UPDATE : BLOCK_DIRTY.INSERT);

        const entry = this.dirtyBlocks.get(index);

        // if the block is modified for the 1st time since the last saving
        if (entry == null || entry.state === BLOCK_DIRTY.CLEAR) {
            // if the chunk becomes dirty (for the first time since the last trasaction)
            if (this.lastUnsavedChangeTime === Infinity) {
                this.world.dbActor.dirtyActors.add(this);
                this.world.worldChunkFlags.add(this.addr, WorldChunkFlags.MODIFIED_BLOCKS);
            }
            this.world.dbActor.totalDirtyBlocks++;
        }
        this.lastUnsavedChangeTime = performance.now();

        this.unsavedBlocks.set(index, item);

        // add or update the dirty entry for that block
        if (entry == null || state === BLOCK_DIRTY.INSERT) {
            // Overwrite the entry, forget rowId
            data.state = state;
            this.dirtyBlocks.set(index, data);
        } else { // (sate === BLOCK_DIRTY.UPDATE || sate === BLOCK_DIRTY.UPDATE_EXTRA_DATA)
            // kep the entry, but modify some of its fields
            entry.user_id = data.user_id;
            entry.item = item;
            switch (entry.state) {
                case BLOCK_DIRTY.CLEAR:
                    entry.pos = data.pos; // clear entries don't have pos
                    entry.state = state;  // CLEAR => UPDATE_EXTRA_DATA or UPDATE
                    break;
                case BLOCK_DIRTY.UPDATE_EXTRA_DATA:
                    entry.state = state;  // UPDATE_EXTRA_DATA => UPDATE
                    break;
                // case UPDATE, INSERT: do nothing
            }
        }
    }

    writeDirtyBlocks(underConstruction) {
        const uc = underConstruction;
        let inserted = false;

        // save changes to world_modify
        const newDirtyBlocks = new Map();
        for(const [index, e] of this.dirtyBlocks) {
            switch (e.state) {
                case BLOCK_DIRTY.INSERT: {
                    e.chunk_addr = this.addr;
                    uc.insertBlocks.push(e);
                    inserted = true;
                    break;
                }
                case BLOCK_DIRTY.UPDATE:
                case BLOCK_DIRTY.UPDATE_EXTRA_DATA: {
                    const newEntry = {
                        state: BLOCK_DIRTY.CLEAR,
                        // Even if don't know rowId now, it'll be assigned when processing updateBlocksWithUnknownRowId
                        rowId: e.rowId
                    };
                    newDirtyBlocks.set(index, newEntry);

                    let list; // to which bulk query the row is queued
                    if (e.rowId) {
                        list = (e.state === BLOCK_DIRTY.UPDATE_EXTRA_DATA)
                            ? uc.updateBlocksExtraData
                            : uc.updateBlocks;
                    } else {
                        // the selected rowId will be remembered in the new entry
                        e.newEntry  = newEntry;
                        list = uc.updateBlocksWithUnknownRowId;
                    }
                    e.chunk_addr = this.addr;
                    list.push(e);
                    break;
                }
                default: { // case BLOCK_DIRTY.CLEAR:
                    // We can get clear entries with null rowId, e.g. when we inserted a block that should have been updated
                    // because its rowId was unknown. Now it has rowId, but we don't know it so no need to keep its entry.
                    if (e.rowId) {
                        newDirtyBlocks.set(index, e);
                    }
                    break;
                }
            }
        }

        const rowId = this.world_modify_chunk_hasRowId;
        if (inserted && 
            CLEANUP_WORLD_MODIFY_PER_TRANSACTION > 0 &&
            typeof rowId === 'number'
        ) {
            this.world.dbActor.cleanupAddrByRowId.set(rowId, this.addr);
        }
        // replace the map, so the entries of the old map remain immutable
        this.dirtyBlocks = newDirtyBlocks;
    }

    writeToWorldTransaction_world_modify_chunks(underConstruction) {
        const world = this.world;

        // build a JSON patch
        const patch = {};
        for(const [index, item] of this.unsavedBlocks.entries()) {
            const flatIndex = tmpVector.fromChunkIndex(index).relativePosToFlatIndexInChunk();
            patch[flatIndex] = item;
        }

        const ml = this.chunk?.modify_list as any;
        const rowId = this.world_modify_chunk_hasRowId;
        if (rowId === true) {
            // the chunk reacord exists, but we haven't loaded it. It must be a chunkless actor.
            const row = DBWorldChunk.toUpdateWorldModifyChunksRowByAddr(patch, this.addr);
            underConstruction.updateWorldModifyChunkByAddr.push(row);
        } else if (rowId === false) {
            const promise = world.db.chunks.insertChunkModifiers(
                this.addr, patch, ml?.compressed, ml?.private_compressed
            ).then( rowId => {
                this.world_modify_chunk_hasRowId = rowId;
                // set the flag only after the records are written
                this.world.worldChunkFlags.add(this.addr, WorldChunkFlags.DB_WORLD_MODIFY_CHUNKS);
            });
            world.dbActor.pushPromises(promise);
        } else {
            // we know the rowId, so the chunk was loaded and ml exist
            if (ml.compressed) {
                const row = DBWorldChunk.toUpdateWorldModifyChunksWithBLOBs(patch, rowId, ml);
                underConstruction.updateWorldModifyChunksWithBLOBs.push(row);
            } else {
                const row = DBWorldChunk.toUpdateWorldModifyChunksRowById(patch, rowId);
                underConstruction.updateWorldModifyChunkById.push(row);
            }
        }

        // see the comment to this.savingUnsavedBlocksPromise
        if (this.chunk == null) {
            this.savingUnsavedBlocksPromise = world.dbActor.worldSavingPromise;
            underConstruction.chunklessActorsWritingWorldModifyChunks.push(this);
        }

        // it's no longer dirty
        this.lastUnsavedChangeTime = Infinity;
        this.unsavedBlocks.clear();
        this.onUnsavedBlocksClean();
    }

    /**
     * It applies block actions to dirty blocks and unsaved blocks.
     * It does not apply them to the chunk or its modifiers!
     */
    applyBlockActions(actions) {
        for(const action of actions) {
            for(const data of action.blocks.list) {
                this.markBlockDirty(data)
            }
        }
    }

    /**
     * Writes all chunk elements that need to be saved in every transaction.
     * Queues the chunk if it needs to save modifiers (which may or may not be saved in this transaction).
     * Adds promises to {@link WorldDBActor.promises}
     */
    writeToWorldTransaction(underConstruction) {
        const chunk = this.chunk;
        const uc = underConstruction;

        if (this.dirtyBlocks.size) {
            this.writeDirtyBlocks(uc);
        }

        if (chunk && chunk.load_state >= CHUNK_STATE.READY) {
            if (chunk.unloadedStuffDirty) {
                for(const stuff of chunk.unloadedStuff) {
                    stuff.writeToWorldTransaction(uc, true);
                }
                chunk.unloadedStuffDirty = false;
            }

            const chunkRecord = chunk.chunkRecord;
            if (chunkRecord.dirty || chunk.delayedCalls.dirty) {
                uc.insertOrUpdateChunk.push(chunkRecord);
                chunkRecord.dirty = false;
                chunk.delayedCalls.dirty = false;
            }
        }

        if (this.unsavedBlocks.size) {
            if (chunk) {
                // If the chunk has pending actions (which means it hasn't loaded yet), turn those actions
                // into changes that can be saved.
                // After that, the chunk can't be loaded correctly anymore, because those actions won't be aplied to its modifiers.
                // That's why it can be done only during shuttdown.
                if (uc.shutdown && chunk.pendingWorldActions) {
                    this.applyBlockActions(chunk.pendingWorldActions)
                    chunk.pendingWorldActions = null
                }

                if (chunk.load_state === CHUNK_STATE.UNLOADING || uc.shutdown) {
                    // Save and allow the chunk to be disposed too free memory. It's high priority.
                    uc.worldModifyChunksHighPriority.push(this);
                } else if (
                    // Why we don't save chunks that are not ready: if this is the case, the actor was created before the chunk.
                    // Don't let it flush its unsaved blocks until the chunk is loaded, because they have to be included into the chunk modifiers.
                    chunk.load_state === CHUNK_STATE.READY &&
                    this.lastUnsavedChangeTime < performance.now() - STABLE_WORLD_MODIFY_CHUNKS_TTL
                ) {
                    // Periodically save for ready chunks. It's low priority.
                    // Nothing bad happens if we don't do it, except recover blob will be larger
                    uc.worldModifyChunksLowPriority.push(this);
                } else {
                    this.world.dbActor.addUnsavedActor(this);
                }
            } else {
                // Save the chunkless changes and free memory.
                // But don't do it immediately, in case more changes are incoming.
                // It frees not a lot of memory, so it has a mid priority.
                if (uc.speedup ||
                    this.lastUnsavedChangeTime < performance.now() - STABLE_WORLD_MODIFY_CHUNKLESS_TTL
                ) {
                    uc.worldModifyChunksMidPriority.push(this);
                } else {
                    this.world.dbActor.addUnsavedActor(this);
                }
            }
        } else {
            this.onUnsavedBlocksClean();
        }
    }

    onUnsavedBlocksClean() {
        const chunk = this.chunk;
        if (chunk?.waitingToUnloadWorldTransaction) {
            // the data was pushed to the transaction, but it's not saved to DB yet. Wait until it's saved.
            this.world.dbActor.worldSavingPromise.then( () => {
                // if it's still waiting for it. IDK how can it be otherwise, but let's be safe
                if (chunk.waitingToUnloadWorldTransaction) {
                    chunk.waitingToUnloadWorldTransaction = false;
                    chunk.checkUnloadingProgress();
                }
            });
        }

        // the only reason chunks remain in dirtyChunks is when they have unsaved changes in world_modify_chunks
        this.world.dbActor.dirtyActors.delete(this);
    }

    onChunklessFlushed() {
        // If it's still chunlkless and has no new changes, it can be forgotten
        if (this.chunk == null && this.lastUnsavedChangeTime === Infinity) {
            this.world.dbActor.chunklessActors.delete(this.addr);
        }
    }

    /** @return true if there are elemets of a chunk need to be saved in the world transaction. */
    mustSaveWhenUnloading() {
        const chunk = this.chunk;
        return this.unsavedBlocks.size || // it also accounts for this.dirtyBlocks
            chunk && (chunk.chunkRecord.dirty || chunk.delayedCalls.dirty || chunk.unloadedStuffDirty);
    }
}

const tmpVector = new Vector();