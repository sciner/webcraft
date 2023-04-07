import { CubeSym } from './CubeSym.js';
import { Vector } from '../helpers.js';
import type { ChunkGrid } from "./ChunkGrid";

export let PHYS_TYPE = {

}

const chunkPos = new Vector();

export class ChunkLocal {
    [key: string]: any;
    grid: ChunkGrid;
    constructor(w, h, d) {
        this.grid = null;
        this.size = new Vector(w, h, d);
        this.offset = new Vector(w>>1, h>>1, d>>1);
        this.sym = 0;
        this.pos = new Vector();
        this.blockStart = new Vector();
        this.blockCenter = new Vector();
        this.blockFinish = new Vector();
        this.chunkManager = null;

        this.physData = new Int32Array(w * h * d);
    }

    /**
     * works only with scaled sym
     * @param pos
     * @param sym
     */
    beginWork(chunkManager, pos, sym) {
        this.pos.x = pos.x;
        this.pos.y = pos.y;
        this.pos.z = pos.z;
        this.sym = sym;
        this.grid = chunkManager.grid;
        const symMat = CubeSym.matrices[this.sym];

        const { blockStart, blockCenter, blockFinish, size, offset } = this;

        blockCenter.x = Math.floor(pos.x);
        blockCenter.y = Math.floor(pos.y);
        blockCenter.z = Math.floor(pos.z);
        blockStart.x = blockCenter.x - offset.x * symMat[0];
        blockStart.y = blockCenter.y - offset.y * symMat[4];
        blockStart.z = blockCenter.z - offset.z * symMat[8];
        blockFinish.x = blockStart.x + size.x;
        blockFinish.y = blockStart.y + size.y;
        blockFinish.z = blockStart.z + size.z;
        this.chunkManager = chunkManager;
    }

    readPhysData() {
        const CHUNK_SIZE_X = this.grid.chunkSize.x;
        const CHUNK_SIZE_Y = this.grid.chunkSize.y;
        const CHUNK_SIZE_Z = this.grid.chunkSize.z;

        const { blockStart, blockFinish, size, offset, physData, chunkManager } = this;
        const symMat = CubeSym.matrices[this.sym];
        const whd = size.x * size.y * size.z;
        for (let i = 0; i < whd; i++) {
            physData[i] = 0;
        }

        const cx1 = Math.floor(blockStart.x / CHUNK_SIZE_X);
        const cx2 = Math.floor(blockFinish.x / CHUNK_SIZE_X);
        const cy1 = Math.floor(blockStart.y / CHUNK_SIZE_Y);
        const cy2 = Math.floor(blockFinish.y / CHUNK_SIZE_Y);
        const cz1 = Math.floor(blockStart.z / CHUNK_SIZE_Z);
        const cz2 = Math.floor(blockFinish.z / CHUNK_SIZE_Z);

        for (let cy = cy1; cy <= cy2; cy++)
            for (let cx = cx1; cx <= cx2; cx++)
                for (let cz = cz1; cz <= cz2; cz++) {
                    chunkPos.x = cx;
                    chunkPos.y = cy;
                    chunkPos.z = cz;
                    const key = chunkManager.getChunkPos(chunkPos);
                    const chunk = chunkManager.chunks[key];
                    if (!chunk) {
                        continue;
                    }

                    const x1 = Math.max(cx * CHUNK_SIZE_X, blockStart.x);
                    const y1 = Math.max(cy * CHUNK_SIZE_Y, blockStart.y);
                    const z1 = Math.max(cz * CHUNK_SIZE_Z, blockStart.z);
                    const x2 = Math.min((cx + 1) * CHUNK_SIZE_X - 1, blockFinish.x);
                    const y2 = Math.min((cy + 1) * CHUNK_SIZE_Y - 1, blockFinish.y);
                    const z2 = Math.min((cz + 1) * CHUNK_SIZE_Z - 1, blockFinish.z);

                    //TODO: rotation symMat
                    let xt = (x1 - (offset.x + 0.5)) * symMat[8] + (offset.x + 0.5);
                    for (let x=x1; x<=x2; x++, xt += symMat[0]) {
                        let zt = (z1 - (offset.z + 0.5)) * symMat[8] + (offset.z + 0.5);
                        for (let z = z1; z <= z2; z++, zt += symMat[8]) {
                            let yt = (y1 - (offset.y + 0.5)) * symMat[4] + (offset.y + 0.5);
                            for (let y = y1; y <= y2; y++, yt += symMat[4]) {
                                const block = chunk.blocks[x][z][y];
                                const ind = (yt * size.z + zt) * size.x + xt;
                                physData[ind] = block.passable ? 0 : 1;
                            }
                        }
                    }
                }
    }

    getPhysData(x, y, z) {
        const {offset, size, physData} = this;
        x += offset.x;
        y += offset.y;
        z += offset.z;
        return physData[(y * size.z + z) * size.x + x];
    }

    endWork() {
        this.chunkManager = null;
    }
}
