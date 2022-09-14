import {BLOCK} from "../blocks.js";
import {DIRECTION, IndexedColor, QUAD_FLAGS} from "../helpers.js";
import {
    FLUID_BLOCK_RESTRICT,
    FLUID_LAVA_ID,
    FLUID_STRIDE,
    FLUID_TYPE_MASK, FLUID_TYPE_SHIFT,
    FLUID_WATER_ID,
    OFFSET_FLUID
} from "./FluidConst.js";
import {FluidSubGeometry} from "./FluidSubGeometry.js";

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
            this.flags |= QUAD_FLAGS.MASK_BIOME;
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

export function buildFluidVertices(fluidChunk) {
    const { cx, cy, cz, cw, size } = fluidChunk.parentChunk.tblocks.dataChunk;
    const { uint8View, uint16View } = fluidChunk;

    if (fluidMaterials.length === 0) {
        initFluidMaterials();
    }

    let buffers = [null, null];
    let quads = 0;

    // we have fluids in chunk!
    const restrict16 = FLUID_BLOCK_RESTRICT << 8;
    const neib = [0, 0, 0, 0, 0, 0];
    const hasNeib = [0, 0, 0, 0, 0, 0];
    const texAlter = [0, 0, 0, 0];
    for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++)
            for (let x = 0; x < size.x; x++) {
                let index = (x * cx + y * cy + z * cz + cw);
                const fluidType = uint8View[index * FLUID_STRIDE + OFFSET_FLUID] & FLUID_TYPE_MASK;
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
                let foundNeib = false;
                for (let i = 0; i < 6; i++) {
                    hasNeib[i] = (neib[i] & FLUID_TYPE_MASK) !== fluidType  && neib[i] < restrict16;
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

                let x0 = 0, z0 = 0, x1 = 1, z1 = 0, x2 = 1, z2 = 1, x3 = 0, z3 = 1;
                let h0 = 0.9, h1 = 0.9, h2 = 0.0, h3 = 0.9;

                if (hasNeib[SIMPLE_DIRECTION.UP]) {
                    quads++;
                    geom.push(fluidId, clr,
                        x, z, y,
                        x0, z0, h0, x0, z0,
                        x1, z1, h1, x1, z1,
                        x2, z2, h2, x2, z2,
                        x3, z3, h3, x3, z3,
                    );
                }
            }
    return quads;
}