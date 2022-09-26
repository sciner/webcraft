export const FLUID_LEVEL_MASK = 15;
export const FLUID_SOURCE_MASK = 8;
export const FLUID_WATER_ID = 16;
export const FLUID_LAVA_ID = 32;
export const FLUID_TYPE_MASK = 48;
export const FLUID_TYPE_SHIFT = 4;

export const FLUID_UPDATE_FLAG = 64;
export const FLUID_GENERATED_FLAG = 128;

export const FLUID_BLOCK_RESTRICT = 128;
export const FLUID_SOLID16 = FLUID_BLOCK_RESTRICT << 8;
export const FLUID_BLOCK_INTERACT = 64;

export const OFFSET_FLUID = 0;
export const OFFSET_BLOCK_PROPS = 1;
export const FLUID_STRIDE = 2;

export function isFluidId(blockId) {
    return blockId == 200 || blockId == 202 || blockId == 170 || blockId == 171;
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

    const blockMat = block.material;
    if (blockMat.is_solid) {
        res |= FLUID_BLOCK_RESTRICT;
    }

    return res;
}