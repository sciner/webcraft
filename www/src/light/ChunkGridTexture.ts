import {Vector} from "../helpers/vector.js";
import type {ChunkLight} from "./ChunkLight";
import {BufferBaseTexture3D} from "../renders/BufferBaseTexture.js";

const SIZE_X = 32;
const SIZE_Y = 8;
const SIZE_X_SHIFT = 5;
const LEN = SIZE_X * SIZE_Y * SIZE_X;
const SIZE_X_1 = SIZE_X - 1;
const SIZE_Y_1 = SIZE_Y - 1;

export class ChunkGridTexture {
    tex: BufferBaseTexture3D = null;
    data = new Int32Array(LEN);
    spiralMoveID: number = -1;
    size = new Vector(SIZE_X, SIZE_Y, SIZE_X);

    constructor() {
    }

    getTexture() {
        if (this.tex) {
            return this.tex;
        }
        this.tex = new BufferBaseTexture3D({
            format: 'r32sint',
            data: this.data,
            width: SIZE_X,
            height: SIZE_X,
            depth: SIZE_Y,
            magFilter: 'nearest',
            minFilter: 'nearest',
        });
        return this.tex;
    }

    writeChunkData(chunkLight: ChunkLight) {
        if (chunkLight.gridPos < 0) {
            const parentAddr = chunkLight.parentAddr;
            chunkLight.gridPos = (parentAddr.x & SIZE_X_1)
                + ((parentAddr.z & SIZE_X_1) << SIZE_X_SHIFT)
                + ((parentAddr.y & SIZE_Y_1) << (2 * SIZE_X_SHIFT));
        }
        if (this.data[chunkLight.gridPos] === chunkLight.packedLightCoord) {
            return;
        }
        this.data[chunkLight.gridPos] = chunkLight.packedLightCoord;
        this.tex.update();
    }
}