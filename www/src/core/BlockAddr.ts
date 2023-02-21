/**
 * Chunk address is a vector that also holds a link to ChunkGrid
 */
import {Vector} from "../helpers";
import type {ChunkGrid} from "./ChunkGrid.js";

export class BlockAddr extends Vector {
    grid: ChunkGrid = null;
    constructor(grid: ChunkGrid, x, y, z) {
        super(x, y, z);
        this.grid = grid;
    }
}