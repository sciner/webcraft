import {BLOCK} from "../blocks.js";
import {DIRECTION, IndexedColor, QUAD_FLAGS} from "../helpers.js";
import {
    FLUID_BLOCK_RESTRICT,
    FLUID_TYPE_MASK, FLUID_TYPE_SHIFT,
} from "./FluidConst.js";

const fluidMaterials = [];

class FluidMaterial {
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

        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }

        this.material_key = block.resource_pack.id + '/'
            + (block.transparent ? 'doubleface_transparent': 'doubleface') + '/fluid/'
            + texture_id;
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

const solid16 = FLUID_BLOCK_RESTRICT << 8;
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
    return (neib & solid16) > 0 ? -1.0 : 0.0;
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
 * @param fluidChunk
 * @param index
 * @param relX
 * @param relZ
 * @returns {number}
 */
export function calcFluidLevel(fluidChunk, index, relX, relZ) {
    const { cx, cy, cz, cw } = fluidChunk.parentChunk.tblocks.dataChunk;
    const { uint16View } = fluidChunk;
    const fluid16 = uint16View[index];
    const fluidType = fluid16 & FLUID_TYPE_MASK;
    const fluidId = (fluidType >> FLUID_TYPE_SHIFT) - 1;
    if (fluidId < 0) {
        return 0;
    }
    const neib = [0, 0, 0, 0, 0, 0];
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

export function buildFluidVertices(fluidChunk) {
    const { cx, cy, cz, cw } = fluidChunk.parentChunk.tblocks.dataChunk;
    const { uint16View } = fluidChunk;

    if (fluidMaterials.length === 0) {
        initFluidMaterials();
    }

    let buffers = [null, null];
    let quads = 0;
    const bounds = fluidChunk.getLocalBounds();

    // we have fluids in chunk!
    const neib = [0, 0, 0, 0, 0, 0];
    const hasNeib = [0, 0, 0, 0, 0, 0];
    const texAlter = [0, 0, 0, 0];
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
                    hasNeib[i] = (neib[i] & FLUID_TYPE_MASK) !== fluidType && neib[i] < solid16;
                    foundNeib = foundNeib || hasNeib[i];
                }
                if (!foundNeib) {
                    continue;
                }
                const mat = fluidMaterials[fluidId];
                if (!buffers[fluidId]) {
                    buffers[fluidId] = fluidChunk.getInstanceBuffer(mat.material_key);
                    buffers[fluidId].touch();
                }
                let geom = buffers[fluidId].vertices;

                let clr = 0;
                let flags = mat.flags;
                if ((flags & QUAD_FLAGS.FLAG_MULTIPLY_COLOR) > 0) {
                    //const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                    /*const resp = processBlock(block, neighbours,
                        cell.biome, cell.dirt_color,*/
                    clr = IndexedColor.WATER.packed;
                }

                let x0 = 0, x1 = 1, z0 = 0, z1 = 1;
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
                        x, z, y,
                        x0, z1, h01, x0, z1,
                        x1, z1, h11, x1, z1,
                        x1, z0, h10, x1, z0,
                        x0, z0, h00, x0, z0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.DOWN]) {
                    quads++;
                    //same as up
                    //U=X, V=Z
                    geom.push(fluidId, SIMPLE_DIRECTION.DOWN, clr,
                        x, z, y,
                        x0, z1, y0, x0, z1,
                        x1, z1, y0, x1, z1,
                        x1, z0, y0, x1, z0,
                        x0, z0, y0, x0, z0,
                    );
                }
                clr += (1 << 20); // flowing liquid, scroll
                if (hasNeib[SIMPLE_DIRECTION.WEST]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.WEST, clr,
                        x, z, y,
                        x0, z1, h01, z1, h01,
                        x0, z0, h00, z0, h00,
                        x0, z0, y0, z0, y0,
                        x0, z1, y0, z1, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.EAST]) {
                    quads++;
                    //U=Z, V=Y
                    geom.push(fluidId, SIMPLE_DIRECTION.EAST, clr,
                        x, z, y,
                        x1, z0, h10, z0, h10,
                        x1, z1, h11, z1, h11,
                        x1, z1, y0, z1, y0,
                        x1, z0, y0, z0, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.SOUTH]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.SOUTH, clr,
                        x, z, y,
                        x0, z0, h00, x0, h00,
                        x1, z0, h10, x1, h10,
                        x1, z0, y0, x1, y0,
                        x0, z0, y0, x0, y0,
                    );
                }
                if (hasNeib[SIMPLE_DIRECTION.NORTH]) {
                    //U=Z, V=Y
                    quads++;
                    geom.push(fluidId, SIMPLE_DIRECTION.NORTH, clr,
                        x, z, y,
                        x1, z1, h11, x1, h11,
                        x0, z1, h01, x0, h01,
                        x0, z1, y0, x0, y0,
                        x1, z1, y0, x1, y0,
                    );
                }
            }
    return quads;
}