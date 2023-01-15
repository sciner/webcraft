export const CHUNK_SIZE_X                   = 16;
export const CHUNK_SIZE_Y                   = 40;
export const CHUNK_SIZE_Z                   = 16;
export const CHUNK_SIZE                     = CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z;
export const CHUNK_GENERATE_MARGIN_Y        = 3;
export const CHUNK_SIZE_Y_MAX               = 4096;
export const MAX_CAVES_LEVEL                = 256;
export const ALLOW_NEGATIVE_Y               = true;

// See also BaseChunk.initSize(), Vector.fromChunkIndex(), BlockAccessor
export const CHUNK_PADING = 1;
export const CHUNK_OUTER_SIZE_X = CHUNK_SIZE_X + 2 * CHUNK_PADING;
export const CHUNK_OUTER_SIZE_Z = CHUNK_SIZE_Z + 2 * CHUNK_PADING;
export const CHUNK_CX = 1;
export const CHUNK_CY = CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z;
export const CHUNK_CZ = CHUNK_OUTER_SIZE_X;
export const CHUNK_CW = CHUNK_PADING * (CHUNK_CX + CHUNK_CY + CHUNK_CZ);

export const INVENTORY_ICON_COUNT_PER_TEX   = 32;
export const INVENTORY_ICON_TEX_WIDTH       = 3200
export const INVENTORY_ICON_TEX_HEIGHT      = 3200

// For different sizes of ServerChunkManager.unloading_chunks, TTL of unloaded chunks in that queue. See Mth.lerpLUT().
export const UNLOADED_QUEUE_SIZE_TTL_SECONDS_LUT = [1000,600, 10000,60, 100000,0];

export const CHUNK_STATE = {
    NEW: 0,
    LOADING_DATA: 1,
    LOADING_BLOCKS: 2,
    LOADING_MOBS: 3,
    READY: 4,
    UNLOADING: 5,
    UNLOADED: 6,    // it's in ServerChunkManager.unloading_chunks, waiting for its TTL to end, and can be restored or disposed
    DISPOSED: 7
}