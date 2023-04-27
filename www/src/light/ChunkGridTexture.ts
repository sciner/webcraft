import {Vector} from "../helpers/vector";
import type {BaseTexture3D} from "../renders/BaseTexture3D.js";
import type {ChunkLight} from "./ChunkLight";

const SIZE_X = 32;
const SIZE_Y = 16;
const SIZE_X_SHIFT = 5;
const LEN = SIZE_X * SIZE_Y * SIZE_X;
const SIZE_X_1 = SIZE_X - 1;
const SIZE_Y_1 = SIZE_Y - 1;

export class ChunkGridTexture {
    tex: BaseTexture3D = null;
    data = new Int32Array(LEN);
    spiralMoveID: number = -1;

    constructor() {
    }

    getTexture(render) {
        if (this.tex) {
            return this.tex;
        }
        this.tex = render.createTexture({
            type: 'rgba32sint',
            source: this.data,
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
        this.tex.dirty = true;
    }
}