import {ObjectHelpers, unixTime, Vector, VectorCollector} from "@client/helpers.js";
import { TransactionMutex } from "../db_helpers.js";
import { ChunkDBActor, BLOCK_DIRTY, DirtyBlock } from "./ChunkDBActor.js";
import { WORLD_TRANSACTION_PERIOD, CLEANUP_WORLD_MODIFY_PER_TRANSACTION,
    WORLD_MODIFY_CHUNKS_PER_TRANSACTION } from "../../server_constant.js";
import { WorldTickStat } from "../../world/tick_stat.js";
import type { ServerWorld } from "../../server_world";
import type { DBWorld, PlayerUpdateRow } from "../world";
import type { BulkDropItemsRow } from "../world"
import type { ChunkRecord } from "../../server_chunk"
import type { MobFullUpdateRow, MobInsertRow, MobUpdateRow } from "./mob.js";
import type {DrivingUpdateRow} from "./driving.js";

const RECOVERY_BLOB_VERSION = 1001;

export class WorldTransactionUnderConstruction {
    dt          : number
    promises    : Promise<any>[] = [] // all the pomises of async actions in this transaction
    shutdown    : boolean
    speedup     : boolean
    // world_modify
    insertBlocks                    : DirtyBlock[] = []
    updateBlocksWithUnknownRowId    : DirtyBlock[] = []
    updateBlocks                    : DirtyBlock[] = []
    updateBlocksExtraData           : DirtyBlock[] = []
    // world_modify_chunk, part 1: determine who's saved
    // These are not FIFO queues, but it doesn't matter: just save as much as we can. Eventually, we'll save
    // everything. And if we crash before that, the crash recovery will fix it regardless of save order.
    worldModifyChunksHighPriority   : ChunkDBActor[] = []   // for chunks that are being unloaded
    worldModifyChunksMidPriority    : ChunkDBActor[] = []   // for chunless changes
    worldModifyChunksLowPriority    : ChunkDBActor[] = []   // periodicaly for all ready chunks
    // world_modify_chunk, part 2: the actual data to be saved
    updateWorldModifyChunkById      : [string, string, int][] = []
    updateWorldModifyChunkByAddr    : [string, string, int, int, int][] = []
    updateWorldModifyChunksWithBLOBs: [int, string, string, BLOB, BLOB][] = []
    // world_modify_chunk, part 3: after the transaction
    chunklessActorsWritingWorldModifyChunks: ChunkDBActor[] = []
    // chunk
    insertOrUpdateChunk : ChunkRecord[] = []
    // drop_item
    insertDropItemRows  : BulkDropItemsRow[] = []
    updateDropItemRows  : BulkDropItemsRow[] = []
    // entity (mobs)
    insertMobRows       : MobInsertRow[] = []
    fullUpdateMobRows   : MobFullUpdateRow[] = []
    updateMobRows       : MobUpdateRow[] = []
    deleteMobIds        : int[] = []
    // player
    // ender chests are saved with non-bulk queries and added to promises (they can be made bulk too)
    updatePlayerState   : PlayerUpdateRow[] = []
    updatePlayerInventory : [int, string][] = []
    updatePlayerWorldData : [int, string][] = []
    // player quests
    insertQuests        = []
    updateQuests        = []
    // Вождение
    insertDriving       : DrivingUpdateRow[] = []
    updateDriving       : DrivingUpdateRow[] = []
    deleteDriving       : int[]
    // the data to be saved in world.recovery as a BLOB
    recoveryUpdateUnsavedChunkRowIds: int[] = []    // if we know rowId of a chunk - put it here, it reduces the BLOB size
    recoveryInsertUnsavedChunkXYZs  : int[] = []    // if we don't know rowId of a chunk - put its (x, y, z) here
    recoveryUpdateUnsavedChunkXYZs  : int[] = []    // for chunkless changes - the chunks exist, but we don't know their rowIds

    constructor(dt: number, shutdown: boolean, speedup: boolean) {
        this.dt = dt
        this.shutdown = shutdown
        this.speedup = speedup
    }

    pushPromises(...args : (Promise<any> | null | 0)[]): void {
        for(const promise of args) {
            if (promise) {
                this.promises.push(promise);
            }
        }
    }
}

/**
 * Управляет периодическим сохранением "состояния мира" в одной транзакции.
 * Реализует логику:
 *  - когда и как выполнять транзакцию
 *  - как восстановиться после сбоя
 * Управляет всеми {@link ChunkDBActor}, каждый из котрых реализует логику сохранения одного чанка.
 */
export class WorldDBActor {

    /** It fullfills when the next (scheduled) world-saving transaction finishes. */
    worldSavingPromise: Promise<any>;
    world: ServerWorld;
    db: DBWorld;
    /** Множесто {@link ChunkDBActor} в которых есть что сохранять. Оно меняется из {@link ChunkDBActor}. */
    dirtyActors = new Set<ChunkDBActor>()
    chunklessActors = new VectorCollector<ChunkDBActor>()
    transactionMutex: TransactionMutex
    /**
     * If it's not null, it's a promise that fullfills when the world is saved.
     * Don't confuse it with {@link worldSavingPromise}
     */
    savingWorldNow: Promise<any> | null = null
    /** When it's not null, it's the data of the world-saving transaction currently being built */
    underConstruction: WorldTransactionUnderConstruction | null = null
    lastWorldTransactionStartTime = performance.now() // To determine when to start a new transaction
    totalDirtyBlocks: int = 0
    /**
     * Chunk addresses that are queued for deleting old records from world_modify.
     * The Map is used as a FIFO queue, because elements of a Map are iterated in the insertion order.
     */
    cleanupAddrByRowId = new Map<int, Vector>()
    cleanupWorldModifyPerTransaction: int = 0
    asyncStats = new WorldTickStat(['world_transaction'])
    private _worldSavingResolve: Function;
    // флаги - что надо сохранить в мире
    worldGeneratorDirty = false
    private can_unload = false

    constructor(world : ServerWorld) {
        this.world = world;
        this.db = world.db;
        this.transactionMutex = new TransactionMutex(this.db.conn)
        this._createWorldSavingPromise();
    }

    get chunkActorsCount(): int {
        return this.chunklessActors.size + this.world.chunks.totalChunksCount
    }

    /**
     * @return true если безопасно прервать мир прямо сейчас.
     * Чтобы результат был коректный, этот метод нужно вызывать в каждом тике!
     *
     * В каких случаях мы НЕ можем завершиь мир:
     * - есть игроки сейчас, или были с момента старта прошлой транзакции
     * - пишется транзакция
     * - есть несохраненные чанки, на которые могли повляить игроки
     * Наличие несохраненных чанков сейчас не влияет. Почему: если все вышеперечисленные усливия выполнились,
     * то эти чанки изменены без участия игроков, и не страшно потерять эти изменения.
     * Исходя из этого, {@link can_unload} устанавливается в true или false в соответствующих местах.
     */
    canUnload(): boolean {
        // если есть игроки - сделать завершение невозможным (пока этот флаг не будет очищен)
        this.can_unload &&= this.world.players.list.size === 0
        return this.can_unload && !this.savingWorldNow
    }

    getOrCreateChunkActor(chunk) {
        const addr = chunk.addr;
        const actor = this.chunklessActors.get(addr);
        if (actor) {
            // Из схематик могли прийти модификаторы, на которые ссылаются разные блоки.
            // WorldAction их при вставке клонирует, но без чанка они не клонировались.
            // На всякий случай склонировать их, чтобы в чанке разные блоки не указаывали на одну extra_data.
            for(const [key, value] of actor.dirtyBlocks) {
                actor.dirtyBlocks[key] = ObjectHelpers.deepClone(value)
            }
            for(const [key, value] of actor.unsavedBlocks) {
                actor.unsavedBlocks[key] = ObjectHelpers.deepClone(value)
            }

            actor.chunk = chunk;
            this.chunklessActors.delete(addr);
            return actor;
        }
        return new ChunkDBActor(this.world, addr, chunk);
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
        const { getFlatIndexInChunk } = world.chunks.grid.math;
        const db = world.db;
        // It may be different from shutdown. Its main effect is to cause chunkless changes to be saved ASAP.
        const speedup = shutdown || world.shuttingDown;

        // await for the previous ongoing transaction, then start a new one
        const transaction = await this.transactionMutex.beginTransaction()

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
        this.underConstruction = new WorldTransactionUnderConstruction(dt, shutdown, speedup)
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
                        e => [e.chunk_addr.x, e.chunk_addr.y, e.chunk_addr.z, getFlatIndexInChunk(tmpVector.copyFrom(e.pos))]
                    )
                ).then( correspondingRows => {
                    // the returned rows have the same indices as underConstruction.updateBlocksWithUnknownRowId
                    for(const [i, e] of uc.updateBlocksWithUnknownRowId.entries()) {
                        const row = correspondingRows[i];
                        let list: DirtyBlock[]; // to which bulk query the row is queued
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
            uc.pushPromises(blocksQueriesPromise);

            // world_modify_chunk (inserts are performed by ChunkDBActor and writeChunklessModifiers)
            uc.pushPromises(
                db.chunks.bulkUpdateWorldModifyChunksById(uc.updateWorldModifyChunkById),
                db.chunks.bulkUpdateWorldModifyChunksByAddr(uc.updateWorldModifyChunkByAddr),
                db.chunks.bulkUpdateChunkModifiersWithBLOBs(uc.updateWorldModifyChunksWithBLOBs)
            );

            // rows of "chunk" table
            uc.pushPromises(
                db.chunks.bulkInsertOrUpdateChunk(uc.insertOrUpdateChunk, dt)
            );

            // some unloaded items have been already added from chunks
            this.world.chunkManager.itemWorld.writeToWorldTransaction(uc);
            uc.pushPromises(
                db.bulkInsertDropItems(uc.insertDropItemRows),
                db.bulkUpdateDropItems(uc.updateDropItemRows),
            );

            // some unloaded mobs have been already added from chunks
            this.world.mobs.writeToWorldTransaction(uc);
            uc.pushPromises(
                db.mobs.bulkInsert(uc.insertMobRows, dt),
                db.mobs.bulkFullUpdate(uc.fullUpdateMobRows),
                db.mobs.bulkUpdate(uc.updateMobRows),
                db.mobs.bulkDelete(uc.deleteMobIds)
            );

            // players, player quests
            this.world.players.writeToWorldTransaction(uc);
            uc.pushPromises(
                // players
                db.bulkUpdateInventory(uc.updatePlayerInventory),
                db.bulkUpdatePlayerWorldData(uc.updatePlayerWorldData),
                db.bulkUpdatePlayerState(uc.updatePlayerState, dt),
                // player quests
                db.quests.bulkInsertPlayerQuests(uc.insertQuests, dt),
                db.quests.bulkUpdatePlayerQuests(uc.updateQuests)
            );

            // вождение
            this.world.drivingManager.writeToWorldTransaction(uc)
            uc.pushPromises(
                db.driving.bulkInsert(uc.insertDriving),
                db.driving.bulkUpdate(uc.updateDriving),
                db.driving.bulkDelete(uc.deleteDriving)
            )

            // прочее
            world.chat.world_edit?.schematic_job?.updateWorldState()

            // мир в целом
            if (this.worldGeneratorDirty) {
                this.worldGeneratorDirty = false
                uc.pushPromises(world.db.setWorldGenerator(world.info.guid, world.info.generator))
            }
            uc.pushPromises(world.db.setWorldState(world.info.guid, world.state)) // для простоты сораняем всегда, там мало информации

            this.writeRecoveryBlob(uc);
        } catch(e) {
            // The game can't continue. The DB transcation will rollback automatically.
            await this.world.terminate("Error while building world-saving transaction", e);
        }

        // no one should be able to add anything to this ransaction after that
        this.underConstruction = null;

        // если нет ни игрков, ни грязных чанков, то сразу после сохранения этой транзакции можно будет завершить мир
        this.can_unload ||= (this.dirtyActors.size === 0) && (world.players.list.size === 0)

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

    writeRecoveryBlob(uc: WorldTransactionUnderConstruction) {

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

        uc.pushPromises(this.db.saveRecoveryBlob(new Uint8Array(blob.buffer)));
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