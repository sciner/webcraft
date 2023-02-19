import { getChunkAddr, unixTime, Vector, VectorCollector } from "../../../www/src/helpers.js";
import { Transaction } from "../db_helpers.js";
import { ChunkDBActor, BLOCK_DIRTY } from "./ChunkDBActor.js";
import { WORLD_TRANSACTION_PERIOD, CLEANUP_WORLD_MODIFY_PER_TRANSACTION, 
    WORLD_MODIFY_CHUNKS_PER_TRANSACTION } from "../../server_constant.js";
import { WorldTickStat } from "../../world/tick_stat.js";

const RECOVERY_BLOB_VERSION = 1001;

/** It manages DB queries of all things in the world that must be saved in one trascaction as a "world state". */
export class WorldDBActor {

    /** It fullfills when the next (scheduled) world-saving transaction finishes. */
    worldSavingPromise;
    world: any;
    db: any;
    dirtyActors: Set<unknown>;
    chunklessActors: VectorCollector;
    _transactionPromise: Promise<void>;
    savingWorldNow: any;
    underConstruction: any;
    lastWorldTransactionStartTime: number;
    totalDirtyBlocks: number;
    cleanupAddrByRowId: Map<any, any>;
    cleanupWorldModifyPerTransaction: number;
    asyncStats: WorldTickStat;
    _worldSavingResolve: any;

    constructor(world) {
        this.world = world;
        this.db = world.db;

        // ChunkDBActor that have any changes to be saved. It's managed by ChunkDBActor.
        this.dirtyActors = new Set();

        this.chunklessActors = new VectorCollector();

        // It fullfills when the last ongoing transaction commits or rolls back.
        // (it includes any transactions, not only world-saving)
        this._transactionPromise = Promise.resolve();

        this._createWorldSavingPromise();
        /**
         * If it's not null, it's a promise that fullfills when the world is saved.
         * Don't confuse it with {@link worldSavingPromise}
         */
        this.savingWorldNow = null;

        // When it's not null, it's the data of the world-saving transaction currntly being built
        this.underConstruction = null;

        // To determine when to start a new transaction
        this.lastWorldTransactionStartTime = performance.now();
        this.totalDirtyBlocks = 0;

        // Chunk addresses that are queued for deleting old records from world_modify.
        // The Map is used as a FIFO queue, becuase elements of a Map are iterated in the insertion order.
        this.cleanupAddrByRowId = new Map();

        this.cleanupWorldModifyPerTransaction = 0;
        this.asyncStats = new WorldTickStat(['world_transaction']);
    }

    getOrCreateChunkActor(chunk) {
        const addr = chunk.addr;
        const actor = this.chunklessActors.get(addr);
        if (actor) {
            actor.chunk = chunk;
            this.chunklessActors.delete(addr);
            return actor;
        }
        return new ChunkDBActor(this.world, addr, chunk);
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
            await this.db.TransactionBegin();
            return transaction;
        }
    }

    pushPromises(args) {
        for(const promise of arguments) {
            if (promise != null) {
                this.underConstruction.promises.push(promise);
            }
        }
    }

    async saveWorldIfNecessary() {
        // if the previous transaction hasn't ended, don't start the new one, so the game loop isn't paused wait
        if (!this.savingWorldNow &&
            this.lastWorldTransactionStartTime + WORLD_TRANSACTION_PERIOD < performance.now()
        ) {
            this.totalDirtyBlocks = 0;
            await this.saveWorld();
            return true;
        }
        return false;
    }

    async forceSaveWorld() {
        await this.savingWorldNow // wait for the current (not forced) saving to finish writing, if it is happening now
        await this.saveWorld(true)
        await this.savingWorldNow // wait for the forced saving to finish writing
    }

    /**
     * It saves all the changes the world state in one transaction.
     * @param { boolean } shutdown - if it's true, all changes must be written, and
     *   the game will stop after that.
     *   It's different from world.shuttingDown. When world.shuttingDown is not null,
     *   the game may continue for some time:
     *   - we can't apply and flush pending actions in loading chunks, it'd cause bugs
     *   - it doesn't make sense to force all mobs to be saved right now
     * @return {Promise} - it fullfills when the game data can be safely modified
     *  by the next game loop iteration, while writing to DB may till be going.
     */
    async saveWorld(shutdown = false) {
        const that = this;
        const world = this.world;
        const db = world.db;
        // It may be different from shutdown. Its main effect is to cause chunkless changes to be saved ASAP.
        const speedup = shutdown || world.shuttingDown;
        
        // await for the previous ongoing transaction, then start a new one
        const transaction = await this.beginTransaction();

        let resolveSavingWorldNow;
        this.savingWorldNow = new Promise(resolve => {
            resolveSavingWorldNow = resolve;
        });

        this.lastWorldTransactionStartTime = performance.now(); // remember the actual time when it begins
        const dt = unixTime(); // used for most inserted/updated records (except where individual times are important, e.g. drop items)
        this.asyncStats.start();

        // From now on, others must wait for the next world-saving transaction.
        // When this transaction completes, it'll resolve the previous promise.
        const worldSavingResolve = this._worldSavingResolve;
        this._createWorldSavingPromise();

        // temporary data used during this transaction
        this.underConstruction = {
            dt,
            promises: [], // all the pomises of async actions in this transaction
            shutdown,
            speedup,

            // world_modify
            insertBlocks: [],
            updateBlocksWithUnknownRowId: [],
            updateBlocks: [],
            updateBlocksExtraData: [],
            cleanupWorldModifyCandidates: [],
            // world_modify_chunk, part 1: determine who's saved
            // These are not FIFO queues, but it doesn't matter: just save as much as we can. Eventually, we'll save
            // everything. And if we crash before that, the crash recovery will fix it regardless of save order.
            worldModifyChunksHighPriority: [],  // for chunks that are being unloaded
            worldModifyChunksMidPriority: [],   // for chunless changes
            worldModifyChunksLowPriority: [],   // periodicaly for all ready chunks
            // world_modify_chunk, part 2: the actual data to be saved
            updateWorldModifyChunkById: [],
            updateWorldModifyChunkByAddr: [],
            updateWorldModifyChunksWithBLOBs: [],
            // world_modify_chunk, part 3: after the transaction
            chunklessActorsWritingWorldModifyChunks: [],
            // chunk
            insertOrUpdateChunk: [],
            // drop_item
            insertDropItemRows: [],
            updateDropItemRows: [],
            // entity (mobs)
            insertMobRows: [],
            fullUpdateMobRows: [], // these have more data than regular updates, that's why they are separated
            updateMobRows: [],
            deleteMobIds: [],
            // player
            // ender chests are saved with non-bulk queries and added to promises (they can be made bulk too)
            updatePlayerState: [],
            updatePlayerInventory: [],
            // player quests
            insertQuests: [],
            updateQuests: [],
            // the data to be saved in world.recovery as a BLOB
            recoveryUpdateUnsavedChunkRowIds: [],   // if we know rowId of a chunk - put it here, it reduces the BLOB size
            recoveryInsertUnsavedChunkXYZs: [],     // if we don't know rowId of a chunk - put its (x, y, z) here
            recoveryUpdateUnsavedChunkXYZs: []      // for chunkless changes - the chunks exist, but we don't know their rowIds
        };
        const uc = this.underConstruction; // accessible in closure after this.underConstruction is cleared

        // execute all independent queires and gather their promises
        try {
            // Here chunks write everything they need to write in every trasaction (i.e. except world_modify_chunks).
            // Updated blocks with unknown rowIds are queued.
            // If chunks have unsaved modifiers, such chunks are queued with different priorities.
            for(const dbActor of this.dirtyActors) {
                (dbActor as any).writeToWorldTransaction(uc);
            }

            // Write some of the chunks modifiers, and remeber the rest in the recovery blob
            const unloadingCount = uc.worldModifyChunksHighPriority.length + uc.worldModifyChunksMidPriority.length
            let remainingCanSave = speedup
                ? unloadingCount // save everything that wants to unload, and nothing else
                : WORLD_MODIFY_CHUNKS_PER_TRANSACTION +
                // to help in situations where the queue grows faster than we can write it,
                // e.g. when teleporting a lot and tickers modify many of the chunks
                    0.02 * unloadingCount | 0;
            for(const list of [uc.worldModifyChunksHighPriority, uc.worldModifyChunksMidPriority, uc.worldModifyChunksLowPriority]) {
                for(const dbActor of list) {
                    if (--remainingCanSave >= 0) {
                        dbActor.writeToWorldTransaction_world_modify_chunks(uc);
                    } else {
                        this.addUnsavedActor(dbActor);
                    }
                }
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
                            if (e.newEntry) { // it's null for chunkless updates
                                e.newEntry.rowId = row.rowId; // remember for the future queries
                            }
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

            const blocksQueriesPromise = slectBlocksRowIdPromise.then(() =>
                    // it could be don in slectBlocksRowIdPromise.then(), but separated for clarity
                    Promise.all([
                        db.chunks.bulkInsertWorldModify(uc.insertBlocks, dt),
                        db.chunks.bulkUpdateWorldModify(uc.updateBlocks, dt),
                        db.chunks.bulkUpdateWorldModifyExtraData(uc.updateBlocksExtraData, dt)
                    ]).then(async () => {
                        // delete some old modifiers after the new ones have been inserted
                        if (!speedup) {
                            await this.cleanupWorldModify()
                        }
                    })
                );
            this.pushPromises(blocksQueriesPromise);

            // world_modify_chunk (inserts are performed by ChunkDBActor and writeChunklessModifiers)
            this.pushPromises(
                db.chunks.bulkUpdateWorldModifyChunksById(uc.updateWorldModifyChunkById),
                db.chunks.bulkUpdateWorldModifyChunksByAddr(uc.updateWorldModifyChunkByAddr),
                db.chunks.bulkUpdateChunkModifiersWithBLOBs(uc.updateWorldModifyChunksWithBLOBs)
            );

            // rows of "chunk" table
            this.pushPromises(
                db.chunks.bulkInsertOrUpdateChunk(uc.insertOrUpdateChunk, dt)
            );

            // some unloaded items have been already added from chunks
            this.world.chunkManager.itemWorld.writeToWorldTransaction(uc);
            this.pushPromises(
                db.bulkInsertDropItems(uc.insertDropItemRows),
                db.bulkUpdateDropItems(uc.updateDropItemRows),
            );

            // some unloaded mobs have been already added from chunks
            this.world.mobs.writeToWorldTransaction(uc);
            this.pushPromises(
                db.mobs.bulkInsert(uc.insertMobRows, dt),
                db.mobs.bulkFullUpdate(uc.fullUpdateMobRows),
                db.mobs.bulkUpdate(uc.updateMobRows),
                db.mobs.bulkDelete(uc.deleteMobIds)
            );

            // players, player quests
            this.world.players.writeToWorldTransaction(uc);
            this.pushPromises(
                // players
                db.bulkUpdateInventory(uc.updatePlayerInventory),
                db.bulkUpdatePlayerState(uc.updatePlayerState, dt),
                // player quests
                db.quests.bulkInsertPlayerQuests(uc.insertQuests, dt),
                db.quests.bulkUpdatePlayerQuests(uc.updateQuests)
            );

            this.writeRecoveryBlob();
        } catch(e) {
            // The game can't continue. The DB transcation will rollback automatically.
            await this.world.terminate("Error while building world-saving transaction", e);
        }

        // no one should be able to add anything to this ransaction after that
        this.underConstruction = null;

        // now we can safely return
        Promise.all(uc.promises).then(
            async () => {
                await transaction.commit()
                if (!shutdown) {
                    this.world.mobs.onWorldTransactionCommit()
                    this.db.mobs.onWorldTransactionCommit()
                    this.world.players.onWorldTransactionCommit()
                    for(const actor of uc.chunklessActorsWritingWorldModifyChunks) {
                        actor.onChunklessFlushed()
                    }
                    this.savingWorldNow = null
                    this.asyncStats.add('world_transaction')
                    this.asyncStats.end()
                    worldSavingResolve()
                }
                resolveSavingWorldNow()
            },
            async err => {
                // The game can't continue. The DB transcation will rollback automatically.
                await that.world.terminate("Error in world-saving transaction promise", err);
            }
        );
    }

    /**
     * Selects up to {@link CLEANUP_WORLD_MODIFY_PER_TRANSACTION} chunk addresses from the queue and 
     * some and deletes old records from world_modify in those chunks.
     */
    async cleanupWorldModify() {
        const promises = [];
        this.cleanupWorldModifyPerTransaction = Math.min(
            this.cleanupWorldModifyPerTransaction + CLEANUP_WORLD_MODIFY_PER_TRANSACTION,
            Math.ceil(CLEANUP_WORLD_MODIFY_PER_TRANSACTION)
        );
        const cleanupAddrByRowId = this.cleanupAddrByRowId;
        for(const [rowId, addr] of cleanupAddrByRowId) {
            if (cleanupAddrByRowId.size > 10000) {
                // if the queue size gets insane, just drop elements, it's unimportant
                cleanupAddrByRowId.delete(rowId);
            } else if (this.cleanupWorldModifyPerTransaction >= 1) {
                this.cleanupWorldModifyPerTransaction--;
                promises.push(
                    this.db.chunks.cleanupWorldModify(addr)
                );
            } else {
                break;
            }
        }
        return Promise.all(promises);
    }

    addChunklessBlockChange(chunk_addr, params) {
        const pos = Vector.vectorify(params.pos);
        params.pos = pos;

        const actor = this.chunklessActors.getOrSet(chunk_addr, () => new ChunkDBActor(this.world, chunk_addr));
        actor.markBlockDirty(params);
    }

    addUnsavedActor(chunkDBActor) {
        const rowId = chunkDBActor.world_modify_chunk_hasRowId;
        const addr = chunkDBActor.addr;
        if (rowId === false) {
            this.underConstruction.recoveryInsertUnsavedChunkXYZs.push(addr.x, addr.y, addr.z);
        } else if (rowId === true) {
            this.underConstruction.recoveryUpdateUnsavedChunkXYZs.push(addr.x, addr.y, addr.z);
        } else { // it's a number
            this.underConstruction.recoveryUpdateUnsavedChunkRowIds.push(rowId);
        }
    }

    writeRecoveryBlob() {

        function push(values) {
            if (Array.isArray(values)) {
                for(const v of values) {
                    blob[++ind] = v;
                }
            } else {
                blob[++ind] = values;
            }
        }

        const { recoveryUpdateUnsavedChunkRowIds, recoveryUpdateUnsavedChunkXYZs,
            recoveryInsertUnsavedChunkXYZs } = this.underConstruction;
        const blob = new Int32Array(4 + recoveryUpdateUnsavedChunkRowIds.length 
            + recoveryUpdateUnsavedChunkXYZs.length + recoveryInsertUnsavedChunkXYZs.length);
        let ind = 0;
        blob[0] = RECOVERY_BLOB_VERSION;

        push(recoveryUpdateUnsavedChunkRowIds.length);
        push(recoveryUpdateUnsavedChunkRowIds);

        push(recoveryUpdateUnsavedChunkXYZs.length / 3);
        push(recoveryUpdateUnsavedChunkXYZs);

        push(recoveryInsertUnsavedChunkXYZs.length / 3);
        push(recoveryInsertUnsavedChunkXYZs);

        this.pushPromises(this.db.saveRecoveryBlob(new Uint8Array(blob.buffer)));
    }

    async crashRecovery() {

        function logElapsed(sqlResult? : any) {
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

        const recovery = this.world.info.recovery;
        if (!(recovery || needRebuildChunkModifiers || needUnpackBlockModifiers)) {
            return; // probably 1st time after migration, nothing to do
        }

        let startTime = performance.now();
        try {
            await this.db.TransactionBegin();

            if (needRebuildChunkModifiers) {
                console.warn('Special recovery mode: rebuilding ALL world_modify_chunks...');
                const result = await this.db.chunks.insertRebuildModifiers();
                logElapsed(result);
            } else if (needUnpackBlockModifiers) {
                console.warn('Special recovery mode: unpacking ALL world_modify_chunks into world_modify...');
                await this.db.chunks.unpackAllChunkModifiers();
                logElapsed();
            } else {
                const blob = new Int32Array(recovery.buffer);
                if (blob[0] !== RECOVERY_BLOB_VERSION) {
                    throw new Error('blob[0] !== RECOVERY_BLOB_VERSION');
                }    
                let ind = 0;

                // We know rowIds of these chunks, so they exist. Update them.
                const updateRowIdLength = blob[++ind];
                if (updateRowIdLength) {
                    const rows = [];
                    for(let i = 0; i < updateRowIdLength; i++) {
                        rows.push(blob[++ind]);
                    }
                    console.log(`Crash recovery: update ${updateRowIdLength} chunks by rowId: ${JSON.stringify(rows)}`)
                    const result = await this.db.chunks.updateRebuildModifiersByRowIds(rows);
                    logElapsed(result);
                }

                // We don't know rowIds of these chunks, but we know they exist. Update them.
                const updateXYZLength = blob[++ind];
                if (updateXYZLength) {
                    const rows = [];
                    for(let i = 0; i < updateXYZLength; i++) {
                        rows.push([blob[++ind], blob[++ind], blob[++ind]]);
                    }
                    console.log(`Crash recovery: update ${updateXYZLength} chunks by addr: ${JSON.stringify(rows)}`);
                    const result = await this.db.chunks.updateRebuildModifiersByXYZ(rows);
                    logElapsed(result);
                }

                // We don't know rowIds of these chunks, so they don't exist. Insert them.
                const insertXYZLength = blob[++ind];
                if (insertXYZLength) {
                    const rows = [];
                    for(let i = 0; i < insertXYZLength; i++) {
                        rows.push([blob[++ind], blob[++ind], blob[++ind]]);
                    }
                    console.log(`Crash recovery: insert ${insertXYZLength} chunks: ${JSON.stringify(rows)}`);
                    const result = await this.db.chunks.insertRebuildModifiersXYZ(rows);
                    logElapsed(result);
                }
            }
            // to avoid repeating recovery if we crash again before the 1st world transaction
            await this.db.saveRecoveryBlob(null);
        } catch (e) {
            // The game can't continue. The DB transcation will rollback automatically.
            await this.world.terminate("Error in crashRecovery", e);
        }

        await this.db.TransactionCommit();

        delete this.world.info.recovery; // no need to rember it
    }

    _createWorldSavingPromise() {
        this.worldSavingPromise = new Promise(resolve => {
            this._worldSavingResolve = resolve;
        });
    }
}

const tmpVector = new Vector();