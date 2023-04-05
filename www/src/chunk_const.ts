import { FAST } from "./constant.js";

export const MAX_CHUNK_SQUARE               = 32 * 32
export const CH_SZ_X                        = 16;
export const CH_SZ_Y                        = 40;
export const CH_SZ_Z                        = 16;
export const CHUNK_GENERATE_MARGIN_Y        = FAST ? 1 : 3;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;
export const ALLOW_NEGATIVE_Y               = true;

export const INVENTORY_ICON_COUNT_PER_TEX   = 32;
export const INVENTORY_ICON_TEX_WIDTH       = 3200
export const INVENTORY_ICON_TEX_HEIGHT      = 3200

// For different sizes of ServerChunkManager.unloading_chunks, TTL of unloaded chunks in that queue. See Mth.lerpLUT().
export const UNLOADED_QUEUE_SIZE_TTL_SECONDS_LUT = [1000,600, 10000,60, 100000,0];

export enum CHUNK_STATE {
    NEW             = 0,
    LOADING_DATA    = 1,
    LOADING_BLOCKS  = 2,
    LOADING_MOBS    = 3,
    READY           = 4,
    UNLOADING       = 5,
    UNLOADED        = 6,    // it's in ServerChunkManager.unloading_chunks, waiting for its TTL to end, and can be restored or disposed
    DISPOSED        = 7,
}