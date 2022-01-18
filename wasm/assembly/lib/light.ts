/**
 * light worker sends messages periodically, separating light waves
 */

import { World } from "./world";


/**
 * max time spent in light loop
 */
let globalStepMs: f32 = 1000.0 / 120.0;

/**
 * settings
 */
 const maxLight: u32 = 32;
 const MASK_BLOCK: u32 = 127;
 const MASK_AO: u32 = 128;
 
 const OFFSET_SOURCE: u32 = 0;
 const OFFSET_LIGHT: u32 = 1;
 const OFFSET_PREV: u32 = 2;
 const OFFSET_AO: u32 = 3;
 const OFFSET_SOURCE_PREV: u32 = 3;
 const OFFSET_DAY: u32 = 4;
 const DIR_COUNT: u32 = 26; //26 // 26 is full 3d light approx
 const DIR_DOWN: u32 = 5;
 const DIR_MAX_MASK: u32 = (1<<26) - (1<<6);
 const DEFAULT_LIGHT_DAY_DISPERSE: u32 = ceil(maxLight / 11);
 
 
 const dx: StaticArray<i32> = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
 const dy: StaticArray<i32> = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
 const dz: StaticArray<i32> = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
 const dlen: StaticArray<i32> = new StaticArray<i32>(DIR_COUNT);
 const dmask: StaticArray<i32> = new StaticArray<i32>(DIR_COUNT);
 
 
 function initMasks(): void {
    for (let i: u32 = 0; i < DIR_COUNT; i++) {
        let mask: u32 = 1 << i;
        
        for (let j: u32 = i + 1; j < DIR_COUNT; j++) {
            if ((dx[i] === 0 || dx[i] === dx[j])
                && (dy[i] === 0 || dy[i] === dy[j])
                && (dz[i] === 0 || dz[i] === dz[j])) {
                mask |= 1 << j;
            }
        }
        
        dlen[i] = (1 + abs(dx[i]) + abs(dy[i]) + abs(dz[i]));
        dmask[i] = mask;
    }

}

function adjustSrc(srcLight: u32): f32 {
    srcLight = srcLight & MASK_BLOCK;
    
    if (srcLight * 2 < MASK_BLOCK && srcLight > 0) {
        srcLight = srcLight * 2 + 2;
    }

    return f32(srcLight);
}

function adjustLight(dstLight: u32): f32 {
    return max(f32(dstLight - 2) / 2.0, 0);
}

// ---- 
initMasks();

const world = new World();
world.defDayLight = adjustSrc(15);

export function debug(): void {
    trace('len:' + dlen.toString());
    trace('mask:' + dmask.toString());
}