import {Vector} from '../helpers.js';
import {
    adjustLight,
    adjustSrc,
    BITS_QUEUE_BLOCK_INDEX,
    DIR_COUNT,
    DISPERSE_MIN, dx, dy, dz, LIGHT_STRIDE_BYTES, LIGHT_STRIDE_BYTES_NORMAL, MASK_SRC_AMOUNT, MASK_SRC_AO,
    MASK_SRC_BLOCK, OFFSET_DAY, OFFSET_LIGHT, OFFSET_NORMAL,
    OFFSET_SOURCE
} from "./LightConst.js";

export class LightCalc {
    constructor(chunk) {
        this.chunk = chunk;
        this.resultLen = chunk.outerLen;
        this.lightData = null;
        this.lightTexData = null;

        this.watchLast = 0;
        this.watchData = 0;
        this.watchAO = 0;

        this.dayID = 0;
        this.dataID = 0;

        this.texID = 0;
    }

    checkAll(hasTexture, hasNormals) {
        const { chunk } = this;
        if (this.watchLast !== chunk.lastID) {
            this.watchLast = chunk.lastID;
            this.calcData();
        }
        if (!hasTexture) {
            return;
        }
        if (this.watchData !== this.dataID
            || this.watchAO !== chunk.lastAO) {
            this.watchData = this.dataID;
            this.watchAO = chunk.lastAO;
            this.calcTex(hasNormals);
        }
    }

    calcData() {
        const {lightChunk} = this.chunk;
        const {outerSize, uint8View, strideBytes} = lightChunk;
        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;
        let changed = false;
        let changedDay = false;
        const lightData = this.lightData = this.lightData || new Uint8Array(this.resultLen);
        let ind = 0;
        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++) {
                let coord0 = sy * y + sz * z;
                for (let x = 0; x < outerSize.x; x++) {
                    const cave = Math.max((uint8View[coord0 + OFFSET_LIGHT] - 1) >> 1, 0);
                    const day = Math.max((uint8View[coord0 + OFFSET_DAY] - 1) >> 1, 0);
                    const newValue = cave + (day << 4);
                    const oldValue = lightData[ind];
                    lightData[ind++] = newValue;
                    changed = changed || newValue !== oldValue;
                    changedDay = changedDay || (newValue & 0xf0) !== (oldValue & 0xf0);
                    coord0 += sx;
                }
            }
        if (changedDay) {
            this.dayID++;
        }
        if (changed) {
            this.dataID++;
        }
    }

    calcTex(hasNormals) {
        const {lightChunk} = this.chunk;
        const {outerSize, uint8View, strideBytes} = lightChunk;
        // Light + AO
        const elemPerBlock = 4;
        const depthMul = hasNormals ? 2 : 1;
        const len = this.resultLen * elemPerBlock;
        if (!this.lightTexData || this.lightTexData.length !== len * depthMul) {
            this.lightTexData = new Uint8Array(len * depthMul);
        }
        const result = this.lightTexData;
        const lightData = this.lightData;

        this.texID++;
        let ind = 0;
        const toChannel = ~~(255 / 15); //17 , number
        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++) {
                for (let x = 0; x < outerSize.x; x++) {
                    const data = lightData[ind];
                    const src = uint8View[ind * strideBytes + OFFSET_SOURCE];
                    const block = (src & MASK_SRC_BLOCK) === MASK_SRC_BLOCK ? 1 : 0;
                    const ao = (src & MASK_SRC_AO) > 0 ? 1 : 0;
                    result[ind * 4] = (data & 0x0f) * toChannel;
                    result[ind * 4 + 1] = 255 - ((data & 0xf0) >> 4) * toChannel;
                    result[ind * 4 + 2] = block * 255;
                    result[ind * 4 + 3] = ao * (128 + 127 * block);
                    ind++;
                }
            }
        if (!hasNormals) {
            return;
        }
        ind = 0;
        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++) {
                for (let x = 0; x < outerSize.x; x++) {
                    let dx = uint8View[ind * strideBytes + OFFSET_NORMAL];
                    let dz = uint8View[ind * strideBytes + OFFSET_NORMAL + 1];
                    let dy = uint8View[ind * strideBytes + OFFSET_NORMAL + 2];
                    let light = uint8View[ind * strideBytes + OFFSET_LIGHT] > 0 ? 1 : 0;
                    result[len + ind * 4] = light * dx;
                    result[len + ind * 4 + 1] = light * dz;
                    result[len + ind * 4 + 2] = light * dy;
                    result[len + ind * 4 + 3] = light * 255;
                    ind++;
                }
            }
    }
}