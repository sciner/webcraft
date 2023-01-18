import { Vector } from "../../../www/js/helpers.js";
import { CHUNK_STATE } from "../../../www/js/chunk_const.js";
import { KNOWN_CHUNK_FLAGS } from "./WorldDBActor.js"

export const BLOCK_DIRTY = {
    CLEAR:              0, // used to keep rowIDs of blocks that are frequently modified
    INSERT:             1,
    UPDATE:             2,
    UPDATE_EXTRA_DATA:  3
};

// Don't confuse it with global WORLD_TRANSACTION_PERIOD: it's bigger, and only affects updating world_modify_chunks
const WORLD_MODIFY_CHUNKS_TTL   = 60 * 1000;

// It manages DB queries of one chunk.
export class ChunkDBActor {

    constructor(chunk) {
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

        // The time of earliest change not saved in world_modify_chunks
        // It's also an indicator of whether the chunk should be in dbActor.dirtyChunks
        this.earliestUnsavedChangeTime = Infinity;

        // It can be true, false or a Number (a known rowId)
        this.world_modify_chunk_hasRowId = this.world.dbActor.knownChunkHasFlags(chunk.addr, KNOWN_CHUNK_FLAGS.IN_WORLD_MODIFY_CHUNKS);
    }

    get world() {
        return this.chunk.world;
    }

    async loadChunkModifiers() {
        if (!this.world_modify_chunk_hasRowId) {
            return Promise.resolve({
                obj: {} // empty uncompressed modifiers, and no compressed modifiers
            });
        }
        return this.world.db.chunks.bulkGetWorldModifyChunkQuery.get(
            this.chunk.addr.toArray()
        ).then( row => {
            if (row) {
                row.obj = row.obj && JSON.parse(row.obj);
            } else {
                // If there is no row, restoreModifiedChunks() told us that is exists: it's posible
                // if someone deleted the record while the game was running.
                // Don't crash, but don't try to rebuild the data.
                row = { obj: {} };
                this.world.dbActor.knownChunkFlags.update(this.chunk.addr, it => 
                    (it ?? 0) & ~KNOWN_CHUNK_FLAGS.IN_WORLD_MODIFY_CHUNKS
                );
            }
            this.world_modify_chunk_hasRowId = row.rowId ?? false;
            return row;
        });
    }

    /**
     * @param {Int} index - the block index, the same in TBlock.
     * @param {Object} data - a value stored in {@link dirtyBlocks}. The method may 
     *  remember the object and/or modify it. It shouldn't be used after passing to this method.
     * @param {Int} state - one of BLOCK_DIRTY.*** constants, except BLOCK_DIRTY.CLEAR
     */
    markIndexDirty(index, data, state) {
        // validate data
        const item = data.item;
        if (data.pos == null) {
            throw "data.pos == null";
        }
        if (item == null) {
            throw "data.item == null";
        }

        const entry = this.dirtyBlocks.get(index);

        // if the block is modified for the 1st time since the last saving
        if (entry == null || entry.state === BLOCK_DIRTY.CLEAR) {
            // if the chunk becomes dirty (for the first time since the last trasaction)
            if (this.earliestUnsavedChangeTime === Infinity) {
                this.earliestUnsavedChangeTime = performance.now();
                this.world.dbActor.dirtyChunks.add(this.chunk);
                this.world.dbActor.addKnownChunkFlags(this.chunk.addr, KNOWN_CHUNK_FLAGS.MODIFIED_BLOCKS);
            }
            this.world.dbActor.totalDirtyBlocks++;
        }

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

    writeDirtyBlocks() {
        const world = this.world;
        const chunk_addr = this.chunk.addr;
        const uc = world.dbActor.underConstruction;

        // save changes to world_modify
        const newDirtyBlocks = new Map();
        for(const [index, e] of this.dirtyBlocks) {
            switch (e.state) {
                case BLOCK_DIRTY.INSERT: {
                    e.chunk_addr = chunk_addr;
                    uc.insertBlocks.push(e);
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
                    e.chunk_addr = chunk_addr;
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
        // replace the map, so the entries of the old map remain immutable
        this.dirtyBlocks = newDirtyBlocks;
    }

    writeWorldModifyChunk() {
        const world = this.world;
        const chunk_addr = this.chunk.addr;

        // build a JSON patch
        const patch = {};
        for(const [index, item] of this.unsavedBlocks.entries()) {
            const flatIndex = tmpVector.fromChunkIndex(index).relativePosToFlatIndexInChunk();
            patch[flatIndex] = item;
        }

        // save to DB
        const ml = this.chunk.modify_list;
        const promise = world.db.chunks.updateOrInsertChunkModifiers(chunk_addr, 
            JSON.stringify(patch), ml.compressed, ml.private_compressed,
            this.world_modify_chunk_hasRowId // because the chunk is already loaded, it's false or a Number
        ).then( rowId => {
            this.world_modify_chunk_hasRowId = rowId;
            this.world.dbActor.addKnownChunkFlags(this.chunk.addr, KNOWN_CHUNK_FLAGS.IN_WORLD_MODIFY_CHUNKS);
        });
        world.dbActor.pushPromise(promise);

        // it's no longer dirty
        this.earliestUnsavedChangeTime = Infinity;
        this.unsavedBlocks.clear();
        world.dbActor.dirtyChunks.delete(this.chunk);
    }

    _mustWriteWorldModifyChunk() {
        return this.unsavedBlocks.size && (
            this.chunk.load_state === CHUNK_STATE.UNLOADING ||
            this.earliestUnsavedChangeTime < performance.now() - WORLD_MODIFY_CHUNKS_TTL
        )
    }

    /**
     * Writes all chunk elements that need to be saved now.
     * Adds promises to {@link WorldDBActor.promises}
     */
    write() {
        const uc = this.world.dbActor.underConstruction;
        if (this.dirtyBlocks.size) {
            this.writeDirtyBlocks();
        }
        const chunkRecord = this.chunk.chunkRecord;
        if (chunkRecord.dirty || this.chunk.delayedCalls.dirty) {
            chunkRecord.delayed_calls = this.chunk.delayed_calls.serialize();
            uc.insertOrUpdateChunk.push(chunkRecord);
            chunkRecord.dirty = false;
            this.chunk.delayedCalls.dirty = false;
        }



        // TODO unloaded items from chunk (after merging with unloading improvements)

        

        if (this.unsavedBlocks.size) {
            if (this._mustWriteWorldModifyChunk()) {
                this.writeWorldModifyChunk();
            } else {
                this.world.dbActor.addUnsavedChunk(this.chunk);
            }
        }
    }

    /** @return a promise of saving everything that needs to be saved in this chunk, or null. */
    getSavePromise() {
        const mustSave = this.dirtyBlocks.size || this._mustWriteWorldModifyChunk() ||
            this.chunk.chunkRecord.dirty || this.chunk.delayedCalls.dirty;
        return mustSave ? this.world.dbActor.worldSavingPromise : null;
    }
}

const tmpVector = new Vector();