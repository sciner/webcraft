import type {ChunkGrid} from "./ChunkGrid.js";
import {SimplePool} from "../helpers/simple_pool.js";

export class PooledUint8Array {
    arr: Uint8Array;
    refCounter: number = 0;
    constructor(len: number) {
        this.arr = new Uint8Array(len);
    }
    reset() {
        this.refCounter = 0;
    }
}
/**
 * Stores pool of typed arrays to be used for chunks of particular grid size
 * suppose it has zeroes after its used
 */
export class ChunkGridPool {
    grid: ChunkGrid;
    innerPool: SimplePool<PooledUint8Array>;

    constructor(grid: ChunkGrid) {
        this.grid = grid;
        this.innerPool = new SimplePool<PooledUint8Array>(PooledUint8Array, grid.math.CHUNK_SIZE_OUTER);
    }

    allocUint8() {
        return this.innerPool.alloc();
    }

    freeUint8(elem: PooledUint8Array) {
        this.innerPool.free(elem);
    }
}
