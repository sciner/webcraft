export const FLUID_LEVEL_MASK = 15;
export const FLUID_SOURCE_MASK = 8;
export const FLUID_WATER_ID = 16;
export const FLUID_LAVA_ID = 32;
export const FLUID_TYPE_MASK = 48;
export const FLUID_TYPE_SHIFT = 4;

export const FLUID_UPDATE_FLAG = 64;
export const FLUID_GENERATED_FLAG = 128;

// these flags should be returned by fluidBlockProps()
export const FLUID_BLOCK_RESTRICT = 128;
export const FLUID_BLOCK_OPAQUE = 196;
export const FLUID_WATER_INTERACT = 32;
export const FLUID_WATER_REMOVE = 16;
export const FLUID_WATER_ABOVE_INTERACT = 8;
export const FLUID_WATER_ABOVE_REMOVE = 4;

// these flags should be checked when interacting with fluid
export const FLUID_WATER_INTERACT16 = FLUID_WATER_INTERACT << 8;
export const FLUID_WATER_REMOVE16 = FLUID_WATER_REMOVE << 8;
export const FLUID_WATER_ABOVE_INTERACT16 = FLUID_WATER_ABOVE_INTERACT << 8;
export const FLUID_WATER_ABOVE_REMOVE16 = FLUID_WATER_ABOVE_REMOVE << 8;
export const FLUID_SOLID16 = FLUID_BLOCK_RESTRICT << 8;
export const FLUID_OPAQUE16 = FLUID_BLOCK_OPAQUE << 8;

// If it's present in "index" of the event, then it means the fuild in the block
// above has changed.
export const FLUID_EVENT_FLAG_ABOVE = 0x10000000;

export const OFFSET_FLUID = 0;
export const OFFSET_BLOCK_PROPS = 1;
export const FLUID_STRIDE = 2;

export const PACKED_CELL_LENGTH = 5;

export function isFluidId(blockId) {
    if (blockId == 200 || blockId == 202) {
        return FLUID_WATER_ID;
    }
    if (blockId == 170 || blockId == 171) {
        return FLUID_LAVA_ID;
    }
    return 0;
}

export function fluidLightPower(fluidVal) {
    const fluidId = ((fluidVal & FLUID_TYPE_MASK) >> FLUID_TYPE_SHIFT) - 1;
    if (fluidId < 0) {
        return 0;
    }
    if (fluidId === 1) {
        // lava
        return 15;
    }
    // water is not transparent for daylight columns
    return 64;
}

/**
 * returns one byte of block-fluid interaction props
 * @param block
 */
export function fluidBlockProps(block) {
    let res = 0;

    if (!block) {
        return res;
    }
    const blockMat = block.material;
    if (block.interact_water) {
        res |= FLUID_WATER_INTERACT;
    }
    if (block.is_solid || block.is_solid_for_fluid) {
        if (block.transparent) {
            res |= FLUID_BLOCK_RESTRICT;
        } else {
            res |= FLUID_BLOCK_OPAQUE;
        }
    }

    return res;
}