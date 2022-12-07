import {getChunkAddr, SimpleQueue, Vector, VectorCollector} from "../../../www/js/helpers.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../../www/js/chunk_const.js";
import {FluidChunk} from "../../../www/js/fluid/FluidChunk.js";
import {BaseChunk} from "../../../www/js/core/BaseChunk.js";

export class DBWorldFluid {
    constructor(conn, world) {
        this.conn = conn;
        this.world = world;

        this.knownFluidChunks = new VectorCollector();

        this.dirtyChunks = new SimpleQueue();
    }

    async restoreFluidChunks() {
        this.knownFluidChunks.clear();
        const rows = await this.conn.all(`SELECT DISTINCT x chunk_x, y chunk_y, z chunk_z FROM world_chunks_fluid`);
        for(let row of rows) {
            let addr = new Vector(row.chunk_x, row.chunk_y, row.chunk_z);
            this.knownFluidChunks.add(addr, 1);
        }
    }

    //
    async loadChunkFluid(chunk_addr) {
        if (!this.knownFluidChunks.has(chunk_addr)) {
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

    //
    async saveChunkFluid(chunk_addr, data) {
        this.knownFluidChunks.add(chunk_addr, 1);
        await this.conn.run('INSERT INTO world_chunks_fluid(x, y, z, data) VALUES (:x, :y, :z, :data)', {
            ':x': chunk_addr.x,
            ':y': chunk_addr.y,
            ':z': chunk_addr.z,
            ':data': data
        });
        // console.log(`saving fluid ${chunk_addr}`)
    }

    async saveFluids(maxSaveChunks= 10) {
        while (this.dirtyChunks.length > 0 && maxSaveChunks !== 0) {
            const elem = this.dirtyChunks.shift();
            if (!elem.world) {
                continue;
            }
            if (elem.databaseID === elem.updateID) {
                continue;
            }
            elem.databaseID = elem.updateID;
            await this.saveChunkFluid(elem.parentChunk.addr, elem.saveDbBuffer());
            maxSaveChunks--;
        }
    }

    async flushAll() {
        await this.saveFluids(-1);
    }

    async flushChunk(chunk) {
        if (chunk.fluid.databaseID !== chunk.fluid.updateID) {
            chunk.fluid.databaseID = chunk.fluid.updateID;
            await this.saveChunkFluid(chunk.addr, chunk.fluid.saveDbBuffer());
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
        let chunk = this.world.chunks.get(chunk_addr);
        if (chunk) {
            await this.applyLoadedChunk(chunk, fluidList);
        } else {
            //TODO: GRID!
            let buf = await this.loadChunkFluid(chunk_addr);

            chunk = this.world.chunks.get(chunk_addr);
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