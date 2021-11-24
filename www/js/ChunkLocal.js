import { CubeSym } from './CubeSym.js';
import { Vector } from './helpers.js';

export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 40;
export const CHUNK_SIZE_Z                   = 16;

export let PHYS_TYPE = {

}

export class AABB {
    cosntructor() {
        this.x_min = 0;
        this.y_min = 0;
        this.z_min = 0;
        this.x_max = 0;
        this.y_max = 0;
        this.z_max = 0;
    }

    get width() {
        return this.x_max - this.x_min;
    }

    get height() {
        return this.y_max - this.y_min;
    }

    get depth() {
        return this.z_max - this.z_min;
    }

    set(xMin, yMin, zMin, xMax, yMax, zMax) {
        // this.x_min = cx - w / 2;
        // this.x_max = cx + w / 2;
        // this.y_min = cy - h / 2;
        // this.y_max = cy + h / 2;
        // this.z_min = cz - d / 2;
        // this.z_max = cz + d / 2;
        this.x_min = xMin;
        this.y_min = yMin;
        this.z_min = zMin;
        this.x_max = xMax;
        this.y_max = yMax;
        this.z_max = zMax;
        return this;
    }

    /**
     * rotated around 0
     * @param sym
     */
    rotate(sym, pivot) {
        if (sym === 0) {
            return this;
        }
        const symMat = CubeSym.matrices[sym];

        if (pivot) {
            this.x_min -= pivot.x;
            this.y_min -= pivot.y;
            this.z_min -= pivot.z;
            this.x_max -= pivot.x;
            this.y_max -= pivot.y;
            this.z_max -= pivot.z;
        }

        const x0 = this.x_min * symMat[0] + this.y_min * symMat[1] + this.z_min * symMat[2];
        const x1 = this.x_max * symMat[0] + this.y_max * symMat[1] + this.z_max * symMat[2];
        const y0 = this.x_min * symMat[3] + this.y_min * symMat[4] + this.z_min * symMat[5];
        const y1 = this.x_max * symMat[3] + this.y_max * symMat[4] + this.z_max * symMat[5];
        const z0 = this.x_min * symMat[6] + this.y_min * symMat[7] + this.z_min * symMat[8];
        const z1 = this.x_max * symMat[6] + this.y_max * symMat[7] + this.z_max * symMat[8];

        this.x_min = Math.min(x0, x1);
        this.x_max = Math.max(x0, x1);
        this.y_min = Math.min(y0, y1);
        this.y_max = Math.max(y0, y1);
        this.z_min = Math.min(z0, z1);
        this.z_max = Math.max(z0, z1);

        if (pivot) {
            this.x_min += pivot.x;
            this.y_min += pivot.y;
            this.z_min += pivot.z;
            this.x_max += pivot.x;
            this.y_max += pivot.y;
            this.z_max += pivot.z;
        }

        return this;
    }

    toArray() {
        return [this.x_min, this.y_min, this.z_min, this.x_max, this.y_max, this.z_max];
    }

    translate(x, y, z) {
        this.x_min += x;
        this.x_max += x;
        this.y_min += y;
        this.y_max += y;
        this.z_min += z;
        this.z_max += z;
        return this;
    }
}

export class AABBPool {
    constructor() {
        this._list = [];
    }

    release(elem) {
        this._list.push(elem);
    }

    alloc() {
        return this._list.pop() || new AABB();
    }

    static instance = new AABBPool();
}

const chunkPos = new Vector();

export class ChunkLocal {
    constructor(w, h, d) {
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
