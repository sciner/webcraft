import { Vector, VectorCollector } from "../../../www/src/helpers.js";
import type { ServerWorld } from "../../server_world.js";
import type { DBWorld } from "../world.js";

/**
 * Contains flags for every existing existing chunk in the world.
 * They indicate whether the chunk has some type of data in DB and/or memory.
 */
export class WorldChunkFlags {
    db: DBWorld;
    vc: VectorCollector;

    static DB_WORLD_MODIFY_CHUNKS   = 0x01; // has a record in world_modify_chunks
    static MODIFIED_BLOCKS          = 0x02; // has any modified blocks (in DB or in memory)
    static DB_CHUNK                 = 0x04; // has a record in "chunk" table
    static DB_MODIFIED_FLUID        = 0x08; // has a record in "world_chunks_fluid" table
    static MODIFIED_FLUID           = 0x10; // has any modified fluid (in DB or in memory)

    constructor(world : ServerWorld) {
        this.db = world.db;
        this.vc = new VectorCollector();
    }

    async restore() {
        return Promise.all([
            this.db.chunks.restoreModifiedChunks(),
            this.db.chunks.restoreChunks(),
            this.db.fluid.restoreFluidChunks()
        ]);
    }

    get size() : int { return this.vc.size }

    has(addr : Vector, flags : int) {
        return (this.vc.get(addr) & flags) != 0;
    }

    add(addr : Vector, flags : int) {
        this.vc.update(addr, it => (it ?? 0) | flags );
    }

    bulkAdd(addresses : Vector[], flags : int) {
        const cb = it => (it ?? 0) | flags;
        for(const addr of addresses) {
            this.vc.update(addr, cb);
        }
    }

    remove(addr : Vector, flags : int) {
        this.vc.update(addr, it => (it ?? 0) & ~flags );
    }

}