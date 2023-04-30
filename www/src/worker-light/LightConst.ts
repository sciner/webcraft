export let globalStepMs = 1000.0 / 120.0;

export const maxLight = 31;
export const maxPotential = 400;
export const defPageSize = 1 << 12;

export const MASK_SRC_AMOUNT = 31;
export const MASK_SRC_FILTER_BIT = 6;
export const MASK_SRC_FILTER = 64;
export const MASK_SRC_BLOCK = 96;
export const MASK_SRC_AO = 128;
export const MASK_SRC_REST = 224;

export const OFFSET_SOURCE = 0;
export const OFFSET_LIGHT = 1;
export const OFFSET_WAVE = 2;
export const OFFSET_DAY = 3;
export const LIGHT_STRIDE_BYTES = 5;
export const OFFSET_NORMAL = 5;
export const LIGHT_STRIDE_BYTES_NORMAL = 9;

export const NORMAL_CX = 32;
export const NORMAL_SCALE = 8;
export const NORMAL_DEF = 0x808080;
export const NORMAL_MASK = 0xffffff;

export const OFFSET_COLUMN_TOP = 0;
export const OFFSET_COLUMN_BOTTOM = 1;
export const OFFSET_COLUMN_DAY = 2;

export const BITS_QUEUE_BLOCK_INDEX = 16;
export const BITS_QUEUE_CHUNK_ID = 15;
export const MASK_QUEUE_BLOCK_INDEX = (1 << BITS_QUEUE_BLOCK_INDEX) - 1;
export const MASK_QUEUE_CHUNK_ID = ((1 << BITS_QUEUE_CHUNK_ID) - 1) << BITS_QUEUE_BLOCK_INDEX;
export const MASK_QUEUE_FORCE = (1 << 31);
export const MASK_WAVE_FORCE = 128;

export const dx = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
export const dy = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
export const dz = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
export const dlen = [];
export const dmask = [];
export const DIR_COUNT = 26; //26 // 26 is full 3d light approx
export const DIR_DOWN = 5;
export const DIR_MAX_MASK = (1 << 26) - (1 << 6);

export const DEFAULT_LIGHT_DAY_DISPERSE = Math.ceil(maxLight / 11);
export const DISPERSE_MIN = 9;

export function adjustSrc(srcLight) {
    const amount = srcLight & MASK_SRC_AMOUNT;
    if (amount > 0) {
        return (Math.min(31, amount * 2 + 1)) | (srcLight & MASK_SRC_REST);
    }
    return srcLight;
}

export function adjustLight(dstLight) {
    return Math.max((dstLight - 1) / 2, 0);
}

export const NORMAL_DX = [];
export function calcNormalDx() {
    for (let i = 0; i < 26; i++) {
        NORMAL_DX.push(((dx[i] + (dz[i] << 8) + (dy[i] << 16)) * NORMAL_SCALE) & NORMAL_MASK);
    }
}

calcNormalDx();

export function initMasks() {
    for (let i = 0; i < DIR_COUNT; i++) {
        let mask = 1 << i;
        for (let j = i + 1; j < DIR_COUNT; j++) {
            if ((dx[i] === 0 || dx[i] === dx[j])
                && (dy[i] === 0 || dy[i] === dy[j])
                && (dz[i] === 0 || dz[i] === dz[j])) {
                mask |= 1 << j;
            }
        }
        dlen.push(1 + Math.abs(dx[i]) + Math.abs(dy[i]) + Math.abs(dz[i]));
        dmask.push(mask);
    }
}

initMasks();