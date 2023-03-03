import {SimpleQueue} from "@client/helpers.js";
import {WorldChunkFlags} from "./WorldChunkFlags.js";
import {BulkSelectQuery, runBulkQuery} from "../db_helpers.js";
import { FluidWorld } from "@client/fluid/FluidWorld.js";
import type { ServerWorld } from "../../server_world.js";
import { WorldTickStat } from "../../world/tick_stat.js";

export class DBWorldFluid {
    conn: DBConnection;
    world: ServerWorld;
    dirtyChunks: SimpleQueue;
    savingDirtyChunksPromise: Promise<any>;
    bulkGetQuery: BulkSelectQuery<BLOB>;
    asyncStats = new WorldTickStat(['fluid']);

    constructor(conn: DBConnection, world: ServerWorld) {
        this.conn = conn;
        this.world = world;
        this.dirtyChunks = new SimpleQueue();
        this.savingDirtyChunksPromise = null;

        this.bulkGetQuery = new BulkSelectQuery(this.conn,
            `WITH cte AS (SELECT value FROM json_each(:jsonRows))
            SELECT data
            FROM cte LEFT JOIN world_chunks_fluid ON x = %0 AND y = %1 AND z = %2`
        );
    }

    async restoreFluidChunks() {
        const rows = await this.conn.all('SELECT x, y, z FROM world_chunks_fluid');
        this.world.worldChunkFlags.bulkAdd(rows, WorldChunkFlags.MODIFIED_FLUID | WorldChunkFlags.DB_MODIFIED_FLUID);
    }

    //
    async loadChunkFluid(chunk_addr) {
        if (!this.world.worldChunkFlags.has(chunk_addr, WorldChunkFlags.DB_MODIFIED_FLUID)) {
            return null;
        }

        const row = await this.conn.get('SELECT data FROM world_chunks_fluid WHERE x = :x AND y = :y AND z = :z', {
            ':x': chunk_addr.x,
            ':y': chunk_addr.y,
            ':z': chunk_addr.z
        });
        // console.log(`loaded fluid ${chunk_addr}`)
        return row ? row['data'] : null;
    }

    /**
     * Gets fluid in a chunk, backed by a bulk select query.
     * Warning: beware of potential deadlocks, see the comment to BulkSelectQuery. That's
     * why we also have a non-bulk version.
     */
    async queuedGetChunkFluid(chunk_addr) {
        if (!this.world.worldChunkFlags.has(chunk_addr, WorldChunkFlags.DB_MODIFIED_FLUID)) {
            return null;
        }
        const row = await this.bulkGetQuery.get(chunk_addr.toArray());
        // the row is always returned, but its fields might be empty
        return (row as any).data;
    }

    //
    async saveChunkFluid(chunk_addr, data) {
        this.world.worldChunkFlags.add(chunk_addr, WorldChunkFlags.DB_MODIFIED_FLUID);
        await this.conn.run('INSERT INTO world_chunks_fluid(x, y, z, data) VALUES (:x, :y, :z, :data)', {
            ':x': chunk_addr.x,
            ':y': chunk_addr.y,
            ':z': chunk_addr.z,
            ':data': data
        });
        // console.log(`saving fluid ${chunk_addr}`)
    }

    async bulkSaveChunkFluid(rows: {addr: IVector, data: BLOB}[]) {
        const worldChunkFlags = this.world.worldChunkFlags
        const insertRows = []
        const updateRows = []
        for(const row of rows) {
            const addr = row.addr
            const dstRow = [addr.x, addr.y, addr.z, row.data]
            if (worldChunkFlags.has(addr, WorldChunkFlags.DB_MODIFIED_FLUID)) {
                updateRows.push(dstRow)
            } else {
                worldChunkFlags.add(addr, WorldChunkFlags.DB_MODIFIED_FLUID)
                insertRows.push(dstRow)
            }
        }
        return Promise.all([
            insertRows.length && runBulkQuery(this.conn,
                'INSERT INTO world_chunks_fluid(x, y, z, data) VALUES ',
                '(?,?,?,?)',
                '',
                insertRows
            ),
            updateRows.length && runBulkQuery(this.conn,
                'WITH cte (x_, y_, z_, data_) AS (VALUES',
                '(?,?,?,?)',
                `)UPDATE world_chunks_fluid
                SET data = data_
                FROM cte
                WHERE x = x_ AND y = y_ AND z = z_`,
                updateRows
            )
        ])
    }

    saveFluids(maxSaveChunks= 10) {
        if (this.savingDirtyChunksPromise) {
            return; // it's being written now; skip saving in this tick
        }
        const saveRows = [];
        while (this.dirtyChunks.length > 0 && maxSaveChunks !== 0) {
            const elem = this.dirtyChunks.shift();
            if (!elem.world) {
                continue;
            }
            if (elem.databaseID === elem.updateID) {
                continue;
            }
            elem.databaseID = elem.updateID;
            saveRows.push({
                addr: elem.parentChunk.addr,
                data: elem.saveDbBuffer()
            });
            maxSaveChunks--;
        }
        if (saveRows.length) {
            this.asyncStats.start()
            this.savingDirtyChunksPromise = this.bulkSaveChunkFluid(saveRows).finally(() => {
                this.asyncStats.add('fluid').end()
                this.savingDirtyChunksPromise = null;
            });
        }
    }

    async flushAll() {
        await this.savingDirtyChunksPromise;
        this.savingDirtyChunksPromise = null;
        this.saveFluids(-1);
        return this.savingDirtyChunksPromise;
    }

    async flushChunk(fluidChunk) {
        if (fluidChunk.databaseID !== fluidChunk.updateID) {
            fluidChunk.databaseID = fluidChunk.updateID;
            await this.saveChunkFluid(fluidChunk.parentChunk.addr, fluidChunk.saveDbBuffer());
        }
    }

    async flushWorldFluidsList(fluids) {
        const chunkManager = this.world.chunks;
        const fluidWorld = chunkManager?.fluidWorld;
        const fluidByChunk = FluidWorld.separateWorldFluidByChunks(fluids);
        const saveRows = [];
        for (let [chunk_addr, fluids] of fluidByChunk) {
            const chunk = chunkManager?.getOrRestore(chunk_addr);
            let fluidChunk = null;
            if (chunk) {
                fluidWorld.applyChunkFluidList(chunk, fluids);
                fluidChunk = chunk.fluid;
                fluidChunk.databaseID = fluidChunk.updateID;
            } else {
                //TODO: bulk read
                fluidChunk = FluidWorld.getOfflineFluidChunk(chunkManager?.dataWorld?.grid, chunk_addr,
                    await this.loadChunkFluid(chunk_addr), fluids);
            }
            saveRows.push({
                addr: chunk_addr,
                data: fluidChunk.saveDbBuffer()
            });
        }
        if (saveRows.length) {
            await this.bulkSaveChunkFluid(saveRows);
        }
    }

}