export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 40;
export const CHUNK_SIZE_Z                   = 16;
export const CHUNK_SIZE                     = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const CHUNK_GENERATE_MARGIN_Y        = 3;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;
export const ALLOW_NEGATIVE_Y               = true;

export const INVENTORY_ICON_COUNT_PER_TEX   = 32;
export const INVENTORY_ICON_TEX_WIDTH       = 3200
export const INVENTORY_ICON_TEX_HEIGHT      = 3200

export const CHUNK_STATE = {
    NEW: 0,
    LOADING_DATA: 1,
    LOADING_BLOCKS: 2,
    LOADING_MOBS: 3,
    READY: 4,
    UNLOADING: 5,
    DISPOSED: 6
}