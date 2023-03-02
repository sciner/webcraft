export const FLUID_SOURCE_MASK = 8;
/**
 * 0 - источник
 * 1,2,3,4,5,6,7 - разные степени уменьшения
 * 8 - это "стекла сверху", типа уровень 0 но странноватый.
 */
export const FLUID_LEVEL_MASK = 15;
export const FLUID_WATER_ID = 16;
export const FLUID_LAVA_ID = 32;
export const FLUID_TYPE_MASK = 48;
export const FLUID_TYPE_SHIFT = 4;

export const FLUID_FLOOD_FLAG = 64;
export const FLUID_GENERATED_FLAG = 128;

// these flags should be returned by fluidBlockProps()
export const FLUID_BLOCK_RESTRICT = 128;
export const FLUID_BLOCK_OPAQUE = 192;
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
export const PACKET_CELL_DIRT_COLOR_R   = 0;
export const PACKET_CELL_DIRT_COLOR_G   = 1;
export const PACKET_CELL_WATER_COLOR_R  = 2;
export const PACKET_CELL_WATER_COLOR_G  = 3;
export const PACKET_CELL_BIOME_ID       = 4;
export const PACKET_CELL_IS_SNOWY       = 5;

/**
 * @returns fluid id or 0.
 * If you only to check whether it's fluid or not, ckecking (BLOCK.flags[id] & BLOCK.FLAG_FLUID) is much faster.
 * See also BLOCK.addHardcodedFlags
 */
export function isFluidId(blockId: number): number {
    if (blockId == 200 || blockId == 202) {
        return FLUID_WATER_ID;
    }
    if (blockId == 170 || blockId == 171) {
        return FLUID_LAVA_ID;
    }
    if (blockId === 218) {
        return FLUID_WATER_ID | FLUID_FLOOD_FLAG;
    }
    if (blockId === 219) {
        return FLUID_LAVA_ID | FLUID_FLOOD_FLAG;
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
        if (block.transparent && !block.is_opaque_for_fluid) {
            res |= FLUID_BLOCK_RESTRICT;
        } else {
            res |= FLUID_BLOCK_OPAQUE;
        }
    }

    return res;
}