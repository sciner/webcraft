import { unixTime, Vector, VectorCollector } from "../../../www/js/helpers.js";
import { BLOCK_DIRTY } from "./ChunkDBActor.js";

export const KNOWN_CHUNK_FLAGS = {
    WORLD_MODIFY_CHUNKS:    0x1, // has a record in world_modify_chunks
    MODIFIED_BLOCKS:        0x2, // has any modified blocks (in DB or in memory)
    MODIFIED_FLUID:         0x4
};
KNOWN_CHUNK_FLAGS.ANY_MODIFIERS_MASK = KNOWN_CHUNK_FLAGS.MODIFIED_BLOCKS | KNOWN_CHUNK_FLAGS.MODIFIED_FLUID;

const WORLD_TRANSACTION_PERIOD = 3000;  // the normal time (in ms) betwen world-saving transactions
const MAX_BLOCK_DIRTYS = 10000;         // if there are more dirty blocks than this, world world transaction starts immediately

const RECOVERY_BLOB_VERSION = 1001;

/** A handler to complete a transaction, and to resolve a promise at the same time. */
class Transaction {

    constructor(db, resolve) {
        this._db = db;
        this._resolve = resolve;
    }

    async commit() {
        await this._db.TransactionCommit();
        this._resolve();
    }

    async rollback() {
        await this._db.TransactionRollback();
        this._resolve();
    }
}

export class WorldDBActor {

    // It fullfills when the next (scheduled) world-saving transaction finishes.
    worldSavingPromise;

    constructor(world) {
        this.world = world;
        this.db = world.db;

        // Chunks that must be saved to world_modify in the next ransaction. It's managed by ChunkDBActor.
        this.dirtyChunks = new Set();

        // for each known chunk, contains WORLD_RECOVERY_REBUILD_ALL
        this.knownChunkFlags = new VectorCollector();

        // It fullfills when the last ongoing transaction commits or rolls back.
        // (it includes any transactions, not only world-saving)
        this._transactionPromise = Promise.resolve();

        this._createWorldSavingPromise();

        // When it's not null, it's the data of the world-saving transaction currntly being built
        this.underConstruction = null;

        // To determine when to start a new transaction
        this._lastWorldTransactionTime = performance.now();
        this.totalDirtyBlocks = 0;
    }

    addKnownChunkFlags(addr, flags) {
        this.knownChunkFlags.update(addr, it => (it ?? 0) | flags );
    }

    knownChunkHasFlags(addr, flags) {
        return (this.knownChunkFlags.get(addr) & flags) != 0;
    }

    async flushLoadChunks() {
        return Promise.all([
            this.world.db.chunks.bulkGetWorldModifyChunk.flush(),
            this.world.db.fluid.bulkSelect.flush()
        ]);
    }

    /**
     * Begins a new transaction.
     * Completes after the previous transaction has completed.
     * Multiple requests for a transaction can be waiting. They'll be completed in their creation order.
     * @return {Transaction} a handler to the transaction that must be used to complete it.
     */
    async beginTransaction() {
        const prevTransactionPromise = this._transactionPromise;
        let transaction;
        this._transactionPromise = new Promise( resolve => {
            transaction = new Transaction(this.db, resolve);
        });
        // Wait for the completion of the previous transaction (successful or not).
        // Rollback of a failed transaction is responsibility of the caller.
        try {
            await prevTransactionPromise;
        } finally {
            this.db.TransactionBegin();
            return transaction;
        }
    }

    pushPromise(promise = null) {
        if (promise != null) {
            this.underConstruction.promises.push(promise);
        }
    }

    async saveWorldIfNecessary() {
        if (this._lastWorldTransactionTime + WORLD_TRANSACTION_PERIOD < performance.now() ||
            this.totalDirtyBlocks > MAX_BLOCK_DIRTYS
        ) {
            this.totalDirtyBlocks = 0;
            return this.saveWorld();
        }
    }

    /**
     * It saves all the changes the world state in one transaction.
     * 
     * @return {Promise} - it fullfills when the game data can be safely modified
     *  by the next game loop iteration, while writing to DB may till be going.
     */
    async saveWorld() {
        const that = this;
        const world = this.world;
        const db = world.db;
        
        // await for the previous ongoing transaction, then start a new one
        const transaction = await this.beginTransaction(true);
        this._lastWorldTransactionTime = performance.now(); // remember the actual time when it begins
        const dt = unixTime(); // used for all inserted/updated records

        // from now on, others must wait for the next world-saving transaction
        const worldSavingResolve = this._worldSavingResolve;
        this._createWorldSavingPromise();

        // temporary data used during this transaction
        this.underConstruction = {
            promises: [], // all the pomises of async actions in this transaction

            insertBlocks: [],
            updateBlocksWithUnknownRowId: [],
            updateBlocks: [],
            updateBlocksExtraData: [],

            // the data to be saved in world.recovery as a BLOB
            unsavedChunkRowIds: [], // if we know rowId of a chunk - put it here, it reduces the BLOB size
            unsavedChunkXYZs: [],    // if we don't know rowId of a chunk - put its (x, y, z) here
        };
        const uc = this.underConstruction; // accessible in closure after this.underConstruction is cleared

        // execute all independent queires and gather their promises
        try {
            // chunks write everything they need. Updated blocks with unknown rowIds are queued.
            for(const chunk of this.dirtyChunks) {
                chunk.dbActor.write();
            }

            // For updated blocks with unknown rowIds:
            // 1. Bulk select their rowIds.
            // 2. For those that have rowId: remember the rowIds and do bulk update.
            // 3. For those that have no rowId: do bulk insert.
            const slectBlocksRowIdPromise =
                this.db.chunks.bulkSelectWorldModifyRowId(
                    uc.updateBlocksWithUnknownRowId.map(
                        e => [e.chunk_addr.x, e.chunk_addr.y, e.chunk_addr.z, tmpVector.copyFrom(e.pos).getFlatIndexInChunk()]
                    )
                ).then( correspondingRows => {
                    // the returned rows have the same indices as underConstruction.updateBlocksWithUnknownRowId
                    for(const [i, e] of uc.updateBlocksWithUnknownRowId.entries()) {
                        const row = correspondingRows[i];
                        let list; // to which bulk query the row is queued
                        if (row.rowId) {
                            e.newEntry.rowId = row.rowId; // remember for the future queries
                            e.rowId = row.rowId; // use it for the curent update
                            list = (e.state === BLOCK_DIRTY.UPDATE_EXTRA_DATA)
                                ? uc.updateBlocksExtraData
                                : uc.updateBlocks;
                        } else {
                            list = uc.insertBlocks;
                        }
                        list.push(e);
                    }
                });

            const blocksBulkQueriesPromise = slectBlocksRowIdPromise.then(() =>
                    // it could be don in slectBlocksRowIdPromise.then(), but separated for clarity
                    Promise.all([
                        db.chunks.bulkInsertWorldModify(uc.insertBlocks, dt),
                        db.chunks.bulkUpdateWorldModify(uc.updateBlocks, dt),
                        db.chunks.bulkUpdateWorldModifyExtraData(uc.updateBlocksExtraData, dt)
                    ])
                );
            this.pushPromise(blocksBulkQueriesPromise);
            
            // TODO items, delayed calls, ?mobs?

            this.pushPromise(this.writeRecoveryBlob());
        } catch(e) {
            // The game can't continue. The DB transcation will rollback automatically.
            await this.world.terminate("Error while building world-saving transaction", e);
        }

        // no one should be able to add anything to this ransaction after that
        this.underConstruction = null;

        // now we can safely return
        Promise.all(uc.promises).then(
            () => {
                transaction.commit();
                worldSavingResolve();
            },
            async err => {
                // The game can't continue. The DB transcation will rollback automatically.
                await that.world.terminate("Error in world-saving transaction promise", err);
            }
        );
    }

    addUnsavedChunk(chunk) {
        const rowId = chunk.dbActor.world_modify_chunk_hasRowId;
        if (typeof rowId === 'number') {
            this.underConstruction.unsavedChunkRowIds.push(rowId);
        } else {
            const addr = chunk.addr;
            this.underConstruction.unsavedChunkXYZs.push(addr.x, addr.y, addr.z);
        }
    }

    async writeRecoveryBlob() {
        const {unsavedChunkRowIds, unsavedChunkXYZs} = this.underConstruction;
        const blob = new Int32Array(1 + (1 + unsavedChunkRowIds.length) + (1 + unsavedChunkXYZs.length));
        let ind = 0;
        blob[0] = RECOVERY_BLOB_VERSION;

        blob[++ind] = unsavedChunkRowIds.length;
        for(let i = 0; i < unsavedChunkRowIds.length; i++) {
            blob[++ind] = unsavedChunkRowIds[i];
        }

        blob[++ind] = unsavedChunkXYZs.length / 3;
        for(let i = 0; i < unsavedChunkXYZs.length; i++) {
            blob[++ind] = unsavedChunkXYZs[i];
        }

        return this.db.saveRecoveryBlob(blob);
    }

    async crashRecovery() {

        function logElapsed(sqlResult) {
            let s = '    elapsed: ' + (performance.now() - startTime | 0) + ' ms';
            if (sqlResult?.changes != null) {
                s += ', changes: ' + sqlResult.changes;
            }
            console.log(s);
            startTime = performance.now();
        }

        const wmCount   = await this.db.chunks.getWorldModifyCount();
        const wmcCount  = await this.db.chunks.getWorldModifyChunksCount();
        // Guess special modes of recovery - when one of the tables has been manualy cleared
        const needRebuildChunkModifiers = wmcCount === 0 && wmCount > 0;
        const needUnpackBlockModifiers  = wmcCount > 0 && wmCount === 0;
        const specialRecovery = needRebuildChunkModifiers || needUnpackBlockModifiers;

        const recovery = this.world.info.recovery;
        if (!(recovery || specialRecovery)) {
            return; // probably 1st time after migration, nothing to do
        }

        let startTime = performance.now();
        try {
            if (needRebuildChunkModifiers) {
                console.warn('Special recovey mode: rebuilding ALL world_modify_chunks...');
                const result = await this.db.chunks.insertRebuildModifiers();
                logElapsed(result);
            } else if (needUnpackBlockModifiers) {
                console.warn('Special recovey mode: unpacking ALL world_modify_chunks into world_modify...');
                await this.db.chunks.unpackAllChunkModifiers();
                logElapsed();
            }

            const blob = new Int32Array(recovery.buffer);
            let ind = 0;
            if (blob[0] !== RECOVERY_BLOB_VERSION) {
                throw new Error('blob[0] !== RECOVERY_BLOB_VERSION');
            }

            const unsavedChunkRowIdsLength = blob[++ind];
            if (unsavedChunkRowIdsLength && !specialRecovery) {
                console.log(`Crash recovey: ${unsavedChunkRowIdsLength} unsaved chunks by rowId...`);
                const rows = [];
                for(let i = 0; i < unsavedChunkRowIdsLength; i++) {
                    rows.push(blob[++ind]);
                }
                const result = await this.db.chunks.updateRebuildModifiersByRowIds(rows);
                logElapsed(result);
            } else {
                ind += unsavedChunkRowIdsLength; // skip this part
            }

            const unsavedChunkAddressesLength = blob[++ind];
            if (unsavedChunkAddressesLength && !specialRecovery) {
                console.log(`Crash recovey: ${unsavedChunkAddressesLength} unsaved chunks by (x, y, z)...`);
                const rows = [];
                for(let i = 0; i < unsavedChunkAddressesLength; i++) {
                    rows.push([blob[++ind], blob[++ind], blob[++ind]]);
                }
                const result = await this.db.chunks.updateRebuildModifiersByXYZ(rows);
                logElapsed(result.changes);
            } // add skip when/if more info is added to the blob
        } catch (e) {
            // The game can't continue. The DB transcation will rollback automatically.
            await this.world.terminate("Error in crashRecovery", e);
        }

        delete this.world.info.unsaved; // no need to rember it
    }

    /** Fullfills the previous world-saving promise, and creates a new one. */
    _createWorldSavingPromise() {
        this.worldSavingPromise = new Promise(resolve => {
            this._worldSavingResolve = resolve;
        });
    }
}

const tmpVector = new Vector();