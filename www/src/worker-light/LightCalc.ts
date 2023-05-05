import {
    MASK_SRC_AO,
    MASK_SRC_BLOCK, OFFSET_DAY, OFFSET_LIGHT, OFFSET_NORMAL,
    OFFSET_SOURCE
} from "./LightConst.js";

const tempDx = [0, 0, 0, 0, 0, 0, 0, 0];

export class LightCalc {
    [key: string]: any;
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
                    // adjustLight inlined
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
        const {outerSize, uint8View, strideBytes, cx, cy, cz} = lightChunk;
        // Light + AO
        const elemPerBlock = 1;
        const depthMul = hasNormals ? 2 : 1;
        const len = this.resultLen * elemPerBlock;
        if (!this.lightTexData || this.lightTexData.length !== len * depthMul) {
            this.lightTexData = new Uint16Array(len * depthMul);
        }
        const result = this.lightTexData;
        const lightData = this.lightData;

        for (let i = 0; i < 8; i++) {
            tempDx[i] = (i & 1) * cx + ((i >> 1) & 1) * cz + ((i >> 2) & 1) * cy;
        }

        this.texID++;
        let ind = 0;
        const toChannel = ~~(255 / 15); //17 , number
        for (let y = 0; y < outerSize.y; y += 2)
            for (let z = 0; z < outerSize.z; z += 2) {
                for (let x = 0; x < outerSize.x; x += 2) {
                    let ind0 = cx * x + cy * y + cz * z;
                    for (let i = 0; i < 8; i++) {
                        const ind1 = ind0 + tempDx[i];
                        const data = lightData[ind1];
                        const src = uint8View[ind1 * strideBytes + OFFSET_SOURCE];
                        const block = (src & MASK_SRC_BLOCK) === MASK_SRC_BLOCK ? 1 : 0;
                        const ao = (src & MASK_SRC_AO) > 0 ? 2 : 0;
                        result[ind++] = data | ((block | ao) << 8);
                    }
                }
            }
        if (!hasNormals) {
            return;
        }
        ind = 0;
        for (let y = 0; y < outerSize.y; y += 2)
            for (let z = 0; z < outerSize.z; z += 2) {
                for (let x = 0; x < outerSize.x; x += 2) {
                    let ind0 = cx * x + cy * y + cz * z;
                    for (let i = 0; i < 8; i++) {
                        const ind1 = ind0 + tempDx[i];
                        let dx = uint8View[ind1 * strideBytes + OFFSET_NORMAL];
                        let dz = uint8View[ind1 * strideBytes + OFFSET_NORMAL + 1];
                        let dy = uint8View[ind1 * strideBytes + OFFSET_NORMAL + 2];
                        result[len + ind] = (dx >> 3)
                            | (dz >> 3) << 5
                            | (dy >> 3) << 10;
                        ind++;
                    }
                }
            }
    }
}