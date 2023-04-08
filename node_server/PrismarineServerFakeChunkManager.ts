import type { ChunkGrid } from "@client/core/ChunkGrid";
import { Vector } from "@client/helpers.js";
import type { ServerWorld } from "server_world";

export class PrismarineServerFakeChunkManager {
    world: ServerWorld;
    chunk_addr: Vector;
    grid: ChunkGrid

    constructor(world : ServerWorld) {
        this.world = world
        this.grid = world.chunkManager.grid
        this.chunk_addr = new Vector();
    }

    getChunk(chunk_addr : Vector) {
        const chunk = this.world.chunks.get(chunk_addr);
        if (chunk && chunk.isReady()) {
            return chunk;
        } else {
            return null;
        }
    }

    getBlock(x  : int, y : int, z : int) {
        let pos = new Vector(x, y, z).floored();
        this.chunk_addr = this.grid.toChunkAddr(pos, this.chunk_addr);
        let chunk = this.getChunk(this.chunk_addr);
        if (chunk) {
            return chunk.getBlock(pos);
        } else {
            return this.world.chunks.DUMMY;
        }
    }

}