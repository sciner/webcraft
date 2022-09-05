import {BLOCK} from "../blocks.js";
import {DIRECTION, IndexedColor, QUAD_FLAGS} from "../helpers.js";
import {
    FLUID_BLOCK_RESTRICT,
    FLUID_LAVA_ID,
    FLUID_STRIDE,
    FLUID_TYPE_MASK,
    FLUID_WATER_ID,
    OFFSET_FLUID
} from "./FluidConst.js";
import {Worker05SubGeometry} from "../light/Worker05GeometryPool.js";

const fluidMaterials = [];

class FluidMaterial {
    constructor(block) {
        this.block = block;
        this.upTex = BLOCK.calcTexture(block.material.texture, DIRECTION.UP);
        this.sideTex = BLOCK.calcTexture(block.material.texture, DIRECTION.WEST);

        this.flags = 0;
        if (block.texture_animations) {
            this.flags |= QUAD_FLAGS.FLAG_ANIMATED;
        }
        if(block.hasTag('multiply_color')) {
            this.flags |= QUAD_FLAGS.MASK_BIOME;
        }
    }
}

function initFluidMaterials() {
    const waterMat = new FluidMaterial(BLOCK.BLOCK_BY_ID[200]);
    const lavaMat = new FluidMaterial(BLOCK.BLOCK_BY_ID[170]);
    for (let i = 0; i < 16; i++) {
        fluidMaterials.push(null);
    }
    for (let i = 0; i < 16; i++) {
        fluidMaterials.push(waterMat);
    }
    for (let i = 0; i < 16; i++) {
        fluidMaterials.push(lavaMat);
    }
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

    //check non-zero first
    let hasWater = false, hasLava = false;
    for (let y = 0; y < size.y; y++)
        for (let z = 0; z < size.z; z++)
            for (let x = 0; x < size.x; x++) {
                let index = (x * cx + y * cy + z * cz + cw) * FLUID_STRIDE;
                const fluidType = uint8View[index + OFFSET_FLUID] & FLUID_TYPE_MASK;
                if (fluidType === FLUID_WATER_ID) {
                    hasWater = true;
                }
                if (fluidType === FLUID_LAVA_ID) {
                    hasLava = true;
                }
            }
    if (hasWater !== !!fluidChunk.waterGeom) {
        if (!hasWater) {
            fluidChunk.waterGeom = new Worker05SubGeometry({
                pool: fluidChunk.world.geometryPool,
                chunkDataId: fluidChunk.dataId,
            });
        } else {
            fluidChunk.waterGeom.clear();
            fluidChunk.waterGeom = null;
        }
    }
    if (hasLava !== !!fluidChunk.lavaGeom) {
        if (!hasLava) {
            fluidChunk.lavaGeom = new Worker05SubGeometry({
                pool: fluidChunk.world.geometryPool,
                chunkDataId: fluidChunk.dataId,
            });
        } else {
            fluidChunk.lavaGeom.clear();
            fluidChunk.lavaGeom = null;
        }
    }

    if (!hasLava && !hasWater) {
        return;
    }

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
                if (fluidType === 0) {
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
                    hasNeib[i] = (neib[i] & FLUID_TYPE_MASK) && neib[i] < restrict16;
                    foundNeib = foundNeib || hasNeib[i];
                }
                if (!foundNeib) {
                    continue;
                }
                const mat = fluidMaterials[fluidType];
                const geom = fluidType === FLUID_WATER_ID ? this.waterGeom : this.lavaGeom;

                let clr = 0;
                let flags = mat.flags;
                if (fluidType === FLUID_WATER_ID) {
                    //const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                    /*const resp = processBlock(block, neighbours,
                        cell.biome, cell.dirt_color,*/
                    clr = IndexedColor.WATER.packed;
                }

                // height depends on power
                let height = 0.9;
                for (let dir = 0; dir < 6; dir++) {
                    if (!hasNeib[dir]) {
                        continue;
                    }
                    //check up
                    let tex = mat.upTex;
                    let texHeight = dir < 2 ? 1 : height;

                    const { axes, offset } = PLANES[SIMPLE_DIRECTION.UP];
                    geom.push(
                        // center
                        x + offset[0], z + offset[1], y + offset[2] * height,
                        // axisx
                        axes[0][0],
                        axes[0][1],
                        axes[0][2] * height,
                        // axisY
                        axes[1][0],
                        axes[1][1],
                        axes[1][2] * height,
                        // UV center
                        tex[0], tex[1], tex[2], tex[3] * texHeight,
                        clr,
                        // flags
                        flags);
                }
            }
}