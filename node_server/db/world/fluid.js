import {getChunkAddr, SimpleQueue, Vector} from "../../../www/js/helpers.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../../www/js/chunk_const.js";
import {FluidChunk} from "../../../www/js/fluid/FluidChunk.js";
import {BaseChunk} from "../../../www/js/core/BaseChunk.js";
import {WorldChunkFlags} from "./WorldChunkFlags.js";
import {BulkSelectQuery, runBulkQuery} from "../db_helpers.js"

export class DBWorldFluid {
    constructor(conn, world) {
        this.conn = conn;
        this.world = world;

        this.dirtyChunks = new SimpleQueue();

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
        return row.data;
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

    /** @param {Array of Objects} rows {addr, data} */
    async bulkSaveChunkFluid(rows) {
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

    async saveFluids(maxSaveChunks= 10) {
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
            await this.bulkSaveChunkFluid(saveRows);
        }
    }

    async flushAll() {
        await this.saveFluids(-1);
    }

    async flushChunk(fluidChunk) {
        if (fluidChunk.databaseID !== fluidChunk.updateID) {
            fluidChunk.databaseID = fluidChunk.updateID;
            await this.saveChunkFluid(fluidChunk.parentChunk.addr, fluidChunk.saveDbBuffer());
        }
    }

    async applyLoadedChunk(chunk, fluidList) {
        //FORCE
        chunk.fluid.databaseID = -1;
        this.world.chunkManager.fluidWorld.applyWorldFluidsList(fluidList);
        await this.flushChunk(chunk);
        chunk.sendFluid(chunk.fluid.saveDbBuffer());
    }

    async applyAnyChunk(fluidList) {
        let chunk_addr = getChunkAddr(fluidList[0], fluidList[1], fluidList[2]);
        let chunk = this.world.chunks?.get(chunk_addr);
        if (chunk) {
            await this.applyLoadedChunk(chunk, fluidList);
        } else {
            //TODO: GRID!
            let buf = await this.loadChunkFluid(chunk_addr);

            chunk = this.world.chunks?.get(chunk_addr);
            if (chunk) {
                //someone loaded chunk while we were loading this!
                await this.applyLoadedChunk(chunk, fluidList);
                return;
            }

            const sz = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
            const coord = chunk_addr.mul(sz);

            const fakeChunk = {
                tblocks: {
                }
            }
            const dataChunk = new BaseChunk({size: sz});
            const fluidChunk = new FluidChunk({
                parentChunk: fakeChunk,
                dataChunk,
            });
            if (buf) {
                fluidChunk.loadDbBuffer(buf);
            }

            const {cx, cy, cz, cw} = dataChunk;
            for (let i = 0; i < fluidList.length; i += 4) {
                const x = fluidList[i] - coord.x;
                const y = fluidList[i + 1] - coord.y;
                const z = fluidList[i + 2] - coord.z;
                const val = fluidList[i + 3];
                const ind = cx * x + cy * y + cz * z + cw;
                fluidChunk.uint16View[ind] = val;
            }

            await this.saveChunkFluid(chunk_addr, fluidChunk.saveDbBuffer());
        }
    }
}