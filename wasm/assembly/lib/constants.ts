/**
 * max time spent in light loop
 */
let globalStepMs: f32 = 1000.0 / 120.0;

 /**
  * settings
  */
export const maxLight: u32 = 32;
export const MASK_BLOCK: u32 = 127;
export const MASK_AO: u32 = 128;

export const OFFSET_SOURCE: u32 = 0;
export const OFFSET_LIGHT: u32 = 1;
export const OFFSET_PREV: u32 = 2;
export const OFFSET_AO: u32 = 3;
export const OFFSET_SOURCE_PREV: u32 = 3;
export const OFFSET_DAY: u32 = 4;
export const DIR_COUNT: u32 = 26; //26 // 26 is full 3d light approx
export const DIR_DOWN: u32 = 5;
export const DIR_MAX_MASK: u32 = (1<<26) - (1<<6);
export const DEFAULT_LIGHT_DAY_DISPERSE: u32 = ceil(maxLight / 11);
export const DX: StaticArray<i32> = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
export const DY: StaticArray<i32> = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
export const DZ: StaticArray<i32> = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
export const DLEN: StaticArray<i32> = new StaticArray<i32>(DIR_COUNT);
export const DMASK: StaticArray<i32> = new StaticArray<i32>(DIR_COUNT);

function initMasks(): void {
    for (let i: u32 = 0; i < DIR_COUNT; i++) {
        let mask: u32 = 1 << i;
        
        for (let j: u32 = i + 1; j < DIR_COUNT; j++) {
            if ((DX[i] === 0 || DX[i] === DX[j])
                && (DY[i] === 0 || DY[i] === DY[j])
                && (DZ[i] === 0 || DZ[i] === DZ[j])) {
                mask |= 1 << j;
            }
        }
        
        DLEN[i] = (1 + abs(DX[i]) + abs(DY[i]) + abs(DZ[i]));
        DMASK[i] = mask;
    }

}

export function adjustSrc(srcLight: u32): f32 {
    srcLight = srcLight & MASK_BLOCK;
    
    if (srcLight * 2 < MASK_BLOCK && srcLight > 0) {
        srcLight = srcLight * 2 + 2;
    }

    return f32(srcLight);
}

export function adjustLight(dstLight: u32): f32 {
    return max(f32(dstLight - 2) / 2.0, 0);
}

// ---- 
initMasks();

export function debug(): void {
    trace('len:' + DLEN.toString());
    trace('mask:' + DMASK.toString());
}