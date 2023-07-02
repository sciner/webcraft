import {BLOCK} from "../blocks.js";
import {DIRECTION, IndexedColor, QUAD_FLAGS} from "../helpers.js";
import { FLUID_SOLID16, FLUID_OPAQUE16, FLUID_TYPE_MASK, FLUID_TYPE_SHIFT, PACKED_CELL_LENGTH, PACKET_CELL_WATER_COLOR_R, PACKET_CELL_WATER_COLOR_G, FLUID_LEVEL_MASK } from "./FluidConst.js";
import type {FluidChunk} from "./FluidChunk.js";

export const fluidMaterials = [];

const tmpNeib = [0, 0, 0, 0, 0, 0];

class FluidMaterial {
    [key: string]: any;
    constructor(block) {
        this.block = block;
        this.upTex = BLOCK.calcTexture(block.texture, DIRECTION.UP);
        this.sideTex = BLOCK.calcTexture(block.texture, DIRECTION.WEST);

        this.flags = 0;
        if (block.texture_animations) {
            this.flags |= QUAD_FLAGS.FLAG_ANIMATED;
        }
        if(block.tags.includes('multiply_color')) {
            this.flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
        }
        if (block.light_power) {
            this.flags |= QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT;
        }

        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }

        this.material_key = block.resource_pack.id + '/'
            + 'fluid_' + block.group + '/fluid/' + texture_id;
    }
}

function initFluidMaterials() {
    const waterMat = new FluidMaterial(BLOCK.BLOCK_BY_ID[200]);
    const lavaMat = new FluidMaterial(BLOCK.BLOCK_BY_ID[170]);
    fluidMaterials.push(waterMat, lavaMat);
}

export const SIMPLE_DIRECTION = {
    UP: 0,
    DOWN: 1,
    SOUTH: 2,
    NORTH: 3,
    EAST: 4,
    WEST: 5,
}

export const PLANES = [
    { //up
        // axisX , axisY. axisY is flips sign!
        axes  : [[1, 0, 0], /**/ [0, 1, 0]],
        flip  : [1, 1],
        // origin offset relative center
        offset : [0.5, 0.5, 1.0],
    },
    { //down
        axes  : [[1, 0, 0], /**/ [0, -1, 0]],
        flip  : [-1, -1],
        offset: [0.5, 0.5, 0.0],
    },
    { //south
        axes  : [[1, 0, 0], /**/ [0, 0, 1]],
        flip  : [1, -1],
        offset: [0.5, 0.0, 0.5],
    },
    { //north
        axes  : [[1, 0, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [0.5, 1.0, 0.5],
    },
    { // east:
        axes  : [[0, 1, 0], /**/ [0, 0, 1]],
        flip  : [1, -1],
        offset: [1.0, 0.5, 0.5],
    },
    { // west:
        axes  : [[0, 1, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [-0.0, 0.5, 0.5],
    },
]

let ww = [0, 0];
function mc_addWeightedHeight(f) {
    if (f >= 0.8) {
        ww[0] += f * 10.0;
        ww[1] += 10.0;
    } else if (f >= 0.0) {
        ww[0] += f;
        ww[1] += 1.0;
    }
}

function mc_getHeight(fluidType, neib, neibAbove) {
    if (fluidType === (neib & FLUID_TYPE_MASK)) {
        return (fluidType === (neibAbove & FLUID_TYPE_MASK)) ? 1.0 : (8.0 - (neib & 7)) / 9.0;
    }
    return (neib & FLUID_SOLID16) > 0 ? -1.0 : 0.0;
}

function mc_calculateAverageHeight(fluidType, cellH, neib1h, neib2h, neib3, neib3Above) {
    if (neib1h >= 1.0 || neib2h >= 1.0) {
        return 1.0;
    }
    ww[0] = ww[1] = 0.0;
    if (neib1h > 0.0 || neib2h > 0.0) {
        let f = mc_getHeight(fluidType, neib3, neib3Above);
        if (f >= 1.0) {
            return 1.0;
        }

        mc_addWeightedHeight(f);
    }
    mc_addWeightedHeight(cellH);
    mc_addWeightedHeight(neib1h);
    mc_addWeightedHeight(neib2h);
    return ww[0] / ww[1];
}

/**
 * can be used for physics
 * @param relX from 0 to 1
 * @param relZ from 0 to 1
 * @returns from 0 to 1
 */
export function calcFluidLevel(fluidChunk: FluidChunk, index: int, relX: float, relZ: float): float {
    const { uint16View } = fluidChunk;
    const fluid16 = uint16View[index];
    const fluidType = fluid16 & FLUID_TYPE_MASK;
    const fluidId = (fluidType >> FLUID_TYPE_SHIFT) - 1;
    if (fluidId < 0) {
        return 0;
    }
    const fluidMask = fluid16 & FLUID_LEVEL_MASK
    if (fluidMask === 0 || fluidMask >= 8) {
        return 1;
    }
    const { cx, cy, cz, cw } = fluidChunk.parentChunk.tblocks.dataChunk;
    const neib = tmpNeib;
    neib[0] = uint16View[index + cy];
    neib[1] = uint16View[index - cy];
    neib[2] = uint16View[index - cz];
    neib[3] = uint16View[index + cz];
    neib[4] = uint16View[index + cx];
    neib[5] = uint16View[index - cx];
    let h00 = 1, h10 = 1, h11 = 1, h01 = 1;
    //TODO: optimize repeating code
    let mch0 = mc_getHeight(fluidType, fluid16, neib[0]);
    if (mch0 < 1.0) {
        let mch2 = mc_getHeight(fluidType, neib[2], uint16View[index - cz + cy]);
        let mch3 = mc_getHeight(fluidType, neib[3], uint16View[index + cz + cy]);
        let mch4 = mc_getHeight(fluidType, neib[4], uint16View[index + cx + cy]);
        let mch5 = mc_getHeight(fluidType, neib[5], uint16View[index - cx + cy]);

        h00 = mc_calculateAverageHeight(fluidType, mch0, mch5, mch2,
            uint16View[index - cx - cz], uint16View[index - cx - cz + cy]);
        h10 = mc_calculateAverageHeight(fluidType, mch0, mch4, mch2,
            uint16View[index + cx - cz], uint16View[index + cx - cz + cy]);
        h11 = mc_calculateAverageHeight(fluidType, mch0, mch4, mch3,
            uint16View[index + cx + cz], uint16View[index + cx + cz + cy]);
        h01 = mc_calculateAverageHeight(fluidType, mch0, mch5, mch3,
            uint16View[index - cx + cz], uint16View[index - cx + cz + cy]);
    }

    const val = h00 * (1 - relX) * (1 - relZ) + h01 * (1 - relX) * relZ
        + h10 * relX * (1 - relZ) + h11 * relX * relZ;

    return val;
}

export function getBlockByFluidVal(fluidVal) {
    if (fluidMaterials.length === 0) {
        initFluidMaterials();
    }
    const fluidType = fluidVal & FLUID_TYPE_MASK;
    const fluidId = (fluidType >> FLUID_TYPE_SHIFT) - 1;
    return fluidMaterials[fluidId] ? fluidMaterials[fluidId].block : null;
}

export function buildFluidVertices(mesher, fluidChunk) {
    const { cx, cy, cz, cw, size } = fluidChunk.parentChunk.tblocks.dataChunk;
    const { packedCells } = fluidChunk.parentChunk;
    const { uint16View } = fluidChunk;

    if (fluidMaterials.length === 0) {
        initFluidMaterials();
    }

    let buffers = [null, null];
    let quads = 0;
    const bounds = fluidChunk.getLocalBounds();
    //for map

    // we have fluids in chunk!
    const neib = [0, 0, 0, 0, 0, 0];
    const hasNeib = [false, false, false, false, false, false];
    const texAlter = [0, 0, 0, 0];
    const clrIndex = IndexedColor.WATER.clone();
    for (let y = bounds.y_min; y <= bounds.y_max; y++)
        for (let z = bounds.z_min; z <= bounds.z_max; z++)
            for (let x = bounds.x_min; x <= bounds.x_max; x++) {
                let index = (x * cx + y * cy + z * cz + cw);
                const fluid16 = uint16View[index];
                const fluidType = fluid16 & FLUID_TYPE_MASK;
                const fluidId = (fluidType >> FLUID_TYPE_SHIFT) - 1;
                if (fluidId < 0) {
                    continue;
                }
                neib[0] = uint16View[index + cy];
                neib[1] = uint16View[index - cy];
                neib[2] = uint16View[index - cz];
                neib[3] = uint16View[index + cz];
                neib[4] = uint16View[index + cx];
                neib[5] = uint16View[index - cx];
                hasNeib[0] = (neib[0] & FLUID_TYPE_MASK) !== fluidType;
                let foundNeib = hasNeib[0];
                for (let i = 1; i < 6; i++) {
                    hasNeib[i] = (neib[i] & FLUID_TYPE_MASK) !== fluidType && neib[i] < FLUID_OPAQUE16;
                    foundNeib = foundNeib || hasNeib[i];
                }
                if (!foundNeib) {
                    continue;
                }
                const mat = fluidMaterials[fluidId];
                if (!buffers[fluidId]) {
                    if (!mat) {
                        console.log('wtf');
                    }
                    buffers[fluidId] = mesher.getInstanceBuffer(fluidChunk, mat.material_key);
                    buffers[fluidId].touch();
                }
                let geom = buffers[fluidId].vertices;

                let clr = 0;
                let flags = mat.flags;
                if ((flags & QUAD_FLAGS.FLAG_MULTIPLY_COLOR) > 0) {
                    if (packedCells) {
                        const ind = z * size.x + x;
                        clrIndex.r = packedCells[ind * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_R];
                        clrIndex.g = packedCells[ind * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_G];
                    }
                    clr = clrIndex.pack();
                }

                let y0 = 0;

                let h00 = 1, h10 = 1, h11 = 1, h01 = 1;

                let mch0 = mc_getHeight(fluidType, fluid16, neib[0]);
                if (mch0 < 1.0) {
                    let mch2 = mc_getHeight(fluidType, neib[2], uint16View[index - cz + cy]);
                    let mch3 = mc_getHeight(fluidType, neib[3], uint16View[index + cz + cy]);
                    let mch4 = mc_getHeight(fluidType, neib[4], uint16View[index + cx + cy]);
                    let mch5 = mc_getHeight(fluidType, neib[5], uint16View[index - cx + cy]);

                    h00 = mc_calculateAverageHeight(fluidType, mch0, mch5, mch2,
                        uint16View[index - cx - cz], uint16View[index - cx - cz + cy]);
                    h10 = mc_calculateAverageHeight(fluidType, mch0, mch4, mch2,
                        uint16View[index + cx - cz], uint16View[index + cx - cz + cy]);
                    h11 = mc_calculateAverageHeight(fluidType, mch0, mch4, mch3,
                        uint16View[index + cx + cz], uint16View[index + cx + cz + cy]);
                    h01 = mc_calculateAverageHeight(fluidType, mch0, mch5, mch3,
                        uint16View[index - cx + cz], uint16View[index - cx + cz + cy]);
                }

                if (hasNeib[SIMPLE_DIRECTION.UP]) {
                    quads++;
                    //U=X, V=Z
                    geom.push(fluidId, SIMPLE_DIRECTION.UP, clr,
                        index, h01, h11, h10, h00
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.DOWN]) {
                    quads++;
                    //same as up
                    //U=X, V=Z
                    geom.push(fluidId, SIMPLE_DIRECTION.DOWN, clr,
                        index, y0, y0, y0, y0,
                    );
                }
                clr += (1 << 20); // flowing liquid, scroll
                if (hasNeib[SIMPLE_DIRECTION.SOUTH]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.SOUTH, clr,
                        index, h00, h10, y0, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.NORTH]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.NORTH, clr,
                        index, h11, h01, y0, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.EAST]) {
                    quads++;
                    //U=Z, V=Y
                    geom.push(fluidId, SIMPLE_DIRECTION.EAST, clr,
                        index, h10, h11, y0, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.WEST]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.WEST, clr,
                        index, h01, h00, y0, y0,
                    );
                }
            }
    return quads;
}
