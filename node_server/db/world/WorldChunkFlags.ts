import { VectorCollector } from "../../../www/src/helpers.js";

/**
 * Contains flags for every existing existing chunk in the world.
 * They indicate whether the chunk has some type of data in DB and/or memory.
 */
export class WorldChunkFlags {

    static DB_WORLD_MODIFY_CHUNKS   = 0x01; // has a record in world_modify_chunks
    static MODIFIED_BLOCKS          = 0x02; // has any modified blocks (in DB or in memory)
    static DB_CHUNK                 = 0x04; // has a record in "chunk" table
    static DB_MODIFIED_FLUID        = 0x08; // has a record in "world_chunks_fluid" table
    static MODIFIED_FLUID           = 0x10; // has any modified fluid (in DB or in memory)

    constructor(world) {
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

    get size() { return this.vc.size }

    has(addr, flags) {
        return (this.vc.get(addr) & flags) != 0;
    }

    add(addr, flags) {
        this.vc.update(addr, it => (it ?? 0) | flags );
    }

    bulkAdd(addresses, flags) {
        const cb = it => (it ?? 0) | flags;
        for(const addr of addresses) {
            this.vc.update(addr, cb);
        }
    }

    remove(addr, flags) {
        this.vc.update(addr, it => (it ?? 0) & ~flags );
    }
}