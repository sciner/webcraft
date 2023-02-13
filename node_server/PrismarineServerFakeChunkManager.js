import { getChunkAddr, Vector } from '../www/js/helpers.js';

export class PrismarineServerFakeChunkManager {
    constructor(world) {
        this.world = world;
        this.chunk_addr = new Vector();
    }
    getChunk(chunk_addr) {
        let chunk = this.world.chunks.get(chunk_addr);
        if (chunk && chunk.isReady()) {
            return chunk;
        } else {
            return null;
        }
    }
    getBlock(x, y, z) {
        let pos = new Vector(x, y, z).floored();
        this.chunk_addr = getChunkAddr(pos, this.chunk_addr);
        let chunk = this.getChunk(this.chunk_addr);
        if (chunk) {
            return chunk.getBlock(pos);
        } else {
            return this.world.chunks.DUMMY;
        }
    }
}
