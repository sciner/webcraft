"use strict";

import {DIRECTION, IndexedColor, QUAD_FLAGS, Vector, calcRotateMatrix, TX_CNT, FastRandom} from '../helpers.js';
import { MAX_CHUNK_SQUARE} from "../chunk_const.js";
import {CubeSym} from "../core/CubeSym.js";
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style, QuadPlane, TCalcSideParamsResult } from './default.js';
import { BLOCK_FLAG, GRASS_PALETTE_OFFSET, LEAVES_TYPE } from '../constant.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import { BLOCK, BlockManager, FakeTBlock, FakeVertices } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';
import {dxdydzIndex} from "../core/ChunkGrid.js";

const {mat4} = glMatrix;

// Leaves
const leaves_planes = [
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 2], "move": {"x": 0, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4, 0], "move": {"x": 0, "y": 0, "z": 0}},
    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4 * 3, 0], "move": {"x": 0, "y": 0, "z": 0}}
];
const matrix_leaves_2 = mat4.create();
mat4.scale(matrix_leaves_2, matrix_leaves_2, [2, 2, 2]);
const matrix_leaves_sqrt2 = mat4.create();
mat4.scale(matrix_leaves_sqrt2, matrix_leaves_sqrt2, [1.4, 1.4, 1.4]);
const leaves_matrices = [matrix_leaves_sqrt2, matrix_leaves_2, matrix_leaves_2];

// overlay texture temp objects
class OverlayTextureItem {
    list: boolean[] = [false, false, false, false]
    count: int
    material: IBlockMaterial
    constructor() {
        this.reset()
    }
    reset() {
        this.list[0] = false
        this.list[1] = false
        this.list[2] = false
        this.list[3] = false
        this.count = 0
        this.material = null
    }
}

const _overlay = {
    materials: new Map(),
    neightbours: [null, null, null, null] as TBlock[],
    items: [new OverlayTextureItem(), new OverlayTextureItem(), new OverlayTextureItem(), new OverlayTextureItem()] as OverlayTextureItem[],
    sides: {
        up: new AABBSideParams()
    }
}

export const LEAVES_COLORS = [
    new IndexedColor(28, 540, 0), // pink
    new IndexedColor(20, 524, 0), // orange
    new IndexedColor(28, 524, 0), // yellow
]

const _sides = {
    up: new AABBSideParams(),
    down: new AABBSideParams(),
    south: new AABBSideParams(),
    north: new AABBSideParams(),
    west: new AABBSideParams(),
    east: new AABBSideParams()
}

// @IMPORTANT!: No change order, because it very important for uvlock blocks
const UP_AXES = [
    [[0, 1, 0], [-1, 0, 0]],
    [[-1, 0, 0], [0, -1, 0]],
    [[0, -1, 0], [1, 0, 0]],
    [[1, 0, 0], [0, 1, 0]],
];

// Connected sides
const _connected_sides = [false, false, false, false]
const CONNECTED_SIDE_PARAMS = {}
CONNECTED_SIDE_PARAMS[DIRECTION.NORTH]  = {axes: [[0, 0, -1/2], [-1/2, 0, 0]], u_mul: 1, v_mul: -1, getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(x, z, y), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(x, z, y)}
CONNECTED_SIDE_PARAMS[DIRECTION.WEST]   = {axes: [[0, 1/2, 0], [0, 0, -1/2]], u_mul: -1, v_mul: -1, getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(y, x, z), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(0, x, z)}
CONNECTED_SIDE_PARAMS[DIRECTION.SOUTH]  = {axes: [[0, 0, -1/2], [1/2, 0, 0]], u_mul: 1, v_mul: 1,   getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(x, z, y), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(x, z, 0)}
CONNECTED_SIDE_PARAMS[DIRECTION.EAST]   = {axes: [[0, 1/2, 0], [0, 0, 1/2]], u_mul: -1, v_mul: 1,   getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(y, x, z), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(y, x, z)}
CONNECTED_SIDE_PARAMS[DIRECTION.UP]     = {axes: [[0, -1/2, 0], [1/2, 0, 0]], u_mul: 1, v_mul: 1,   getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(x, y, z), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(x, y, z)}
CONNECTED_SIDE_PARAMS[DIRECTION.DOWN]   = {axes: [[0, 1/2, 0], [1/2, 0, 0]], u_mul: -1, v_mul: 1,   getNeighbourIndex: (x : int, y : int, z : int, cb : Function) => cb(x, y, z), fixCoord: (x: number, y: number, z: number, cb : Function) => cb(x, y - 1, z)}

// Used for grass pseudo-random rotation
const randoms = new FastRandom('random_dirt_rotations', MAX_CHUNK_SQUARE, 100, true)
const OVERLAY_TEXTURE_MATERIAL_KEYS : string[] = []
const OVERLAY_TEXTURE_MATERIAL_KEYS_DOUBLEFACE : string[] = []

let _grass_block_edge_tex : tupleFloat4 | null = null
let _lever_part = null
let aabb_chunk = null

const DEFAULT_ROTATE    = new Vector(0, 1, 0)
const _lm_grass         = new IndexedColor(0, 0, 0)
const _lm_leaves        = new IndexedColor(0, 0, 0)
const _vec              = new Vector(0, 0, 0)
const _pl               = new QuadPlane()
const _sideParams       = new TCalcSideParamsResult()
const _lever_matrix     = mat4.create()
const _aabb             = new AABB();
const _leaves_rot       = new Vector(0, 0, 0)
const _center           = new Vector(0, 0, 0)
const aabb_xyz          = new Vector()
const pivotObj          = new Vector(.5, .5, .5)

export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        OVERLAY_TEXTURE_MATERIAL_KEYS.push(
            block_manager.DECAL1.material_key,
            block_manager.DECAL2.material_key,
        )
        OVERLAY_TEXTURE_MATERIAL_KEYS_DOUBLEFACE.push(
            block_manager.COBWEB.material_key
        )
        return new BlockStyleRegInfo(
            ['cube'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const material = tblock.material
        const mat_abbb = material.aabb

        // 1. if tblock has specific ABBB
        if(mat_abbb) {
            const aabb = new AABB(...mat_abbb).div(16)
            // mat4.identity(aabb_matrix)
            const grid = world.grid
            grid.math.worldPosToChunkPos(tblock.posworld, aabb_xyz)
            const {x, y, z} = aabb_xyz
            if(!aabb_chunk) {
                aabb_chunk = {size: grid.chunkSize}
            }
            const aabb_matrix = style.applyRotate(aabb_chunk as ChunkWorkerChunk, tblock, neighbours, undefined, x, y, z)
            if(aabb_matrix) {
                aabb.applyMat4(aabb_matrix, pivotObj)
            }
            return [aabb]
        }

        let width = material.width ? material.width : 1;
        let height = material.height ? material.height : 1;
        let depth = material.depth ? material.depth : width;

        if(for_physic && tblock.id == style.block_manager.SOUL_SAND.id) {
            height = 14/16
        }

        // Button
        if(material.is_button && material.name != 'LEVER') {
            if(tblock.extra_data?.powered) {
                height /= 2
            }
        }

        const x = 0
        let y = 0
        const z = 0

        // Высота наслаеваемых блоков хранится в extra_data
        if(material.is_layering) {
            if(tblock.extra_data) {
                height = tblock.extra_data?.height || height;
            }
            if(material.layering.slab) {
                if(style.isOnCeil(tblock)) {
                    y += material.layering.height;
                }
            }
        }

        // AABB
        const aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        //
        if(tblock.getCardinalDirection) {
            const cardinal_direction = tblock.getCardinalDirection();
            const matrix = CubeSym.matrices[cardinal_direction];
            // on the ceil
            if(tblock.rotate && tblock.rotate.y == -1) {
                if(tblock.material.tags.includes('rotate_by_pos_n')) {
                    aabb.translate(0, 1 - aabb.y_max, 0)
                }
            }
            aabb.applyMatrix(matrix, pivotObj);
        }

        //
        if(expanded) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture, neibIDs : int[] = []) {

        const material = block.material

        // Pot
        if(block.hasTag('into_pot')) {
            return style.putIntoPot(vertices, block.material, pivot, matrix, _center.set(x, y, z), biome, dirt_color)
        }

        // Beautiful leaves
        if(material.transparent && material.is_leaves == LEAVES_TYPE.BEAUTIFUL && !(block?.extra_data?.sheared ?? false)) {
            return style.makeLeaves(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex)
        }

        let width   = 1
        let height  = 1
        let depth   = 1

        if(!material.is_simple_qube && !material.is_solid) {
            const sz = style.calculateBlockSize(block, neighbours)
            width = sz.width
            height = sz.height
            depth = sz.depth
        }

        //
        const drawAllSides = (width != 1 || height != 1) && !material.is_water;
        let canDrawUP = height < 1 || style.canDrawFace(block, neighbours.UP, drawAllSides, DIRECTION.UP, width, height)
        let canDrawDOWN = style.canDrawFace(block, neighbours.DOWN, drawAllSides, DIRECTION.DOWN, width, height)
        let canDrawSOUTH = style.canDrawFace(block, neighbours.SOUTH, drawAllSides, DIRECTION.SOUTH, width, height)
        let canDrawNORTH = style.canDrawFace(block, neighbours.NORTH, drawAllSides, DIRECTION.NORTH, width, height)
        let canDrawWEST = style.canDrawFace(block, neighbours.WEST, drawAllSides, DIRECTION.WEST, width, height)
        let canDrawEAST = style.canDrawFace(block, neighbours.EAST, drawAllSides, DIRECTION.EAST, width, height)
        if(!canDrawUP && !canDrawDOWN && !canDrawSOUTH && !canDrawNORTH && !canDrawWEST && !canDrawEAST) {
            return;
        }

        const bm                    = style.block_manager
        const blockFlags            = material.flags
        const no_anim               = material.is_simple_qube || !material.texture_animations
        const cavity_id             = (material.is_log && !(block instanceof FakeTBlock)) ? block.extra_data?.cavity : null // for tree logs
        const sides                 = {} as IBlockSides

        let emmited_blocks:         any[] = undefined
        let autoUV                  = true
        let axes_up                 = null
        let axes_down               = null
        let lm                      = _lm_grass.copyFrom(IndexedColor.WHITE)
        let flags                   = material.light_power ? QUAD_FLAGS.FLAG_NO_AO : 0
        let sideFlags               = flags
        let upFlags                 = flags

        let DIRECTION_UP            = DIRECTION.UP
        let DIRECTION_DOWN          = DIRECTION.DOWN
        let DIRECTION_SOUTH         = DIRECTION.SOUTH
        let DIRECTION_EAST          = DIRECTION.EAST
        let DIRECTION_NORTH         = DIRECTION.NORTH
        let DIRECTION_WEST          = DIRECTION.WEST

        if(material.is_simple_qube) {

            force_tex = bm.calcTexture(material.texture, DIRECTION.UP);

        } else {

            // Glass
            if(material.transparent && material.is_glass) {
                if(neighbours.SOUTH.material.is_glass && neighbours.SOUTH.material.style_name == material.style_name) canDrawSOUTH = false;
                if(neighbours.NORTH.material.is_glass && neighbours.NORTH.material.style_name == material.style_name) canDrawNORTH = false;
                if(neighbours.WEST.material.is_glass && neighbours.WEST.material.style_name == material.style_name) canDrawWEST = false;
                if(neighbours.EAST.material.is_glass && neighbours.EAST.material.style_name == material.style_name) canDrawEAST = false;
                if(neighbours.UP.material.is_glass && neighbours.UP.material.style_name == material.style_name) canDrawUP = false;
                if(neighbours.DOWN.material.is_glass && neighbours.DOWN.material.style_name == material.style_name) canDrawDOWN = false;
            }

            if(material.draw_only_down) {
                canDrawUP = false;
                canDrawSOUTH = false;
                canDrawNORTH = false;
                canDrawWEST = false;
                canDrawEAST = false;
            }

            // Texture color multiplier
            if(blockFlags & BLOCK_FLAG.BIOME) {
                lm.copyFrom(dirt_color)
                if(block.id == bm.GRASS_BLOCK.id || block.id == bm.GRASS_BLOCK_SLAB.id) {
                    lm.r += GRASS_PALETTE_OFFSET.x
                    lm.g += GRASS_PALETTE_OFFSET.y
                }
                if(!material.is_dirt) {
                    flags = QUAD_FLAGS.FLAG_MASK_BIOME;
                }
                sideFlags = QUAD_FLAGS.FLAG_MASK_BIOME;
                upFlags = QUAD_FLAGS.FLAG_MASK_BIOME;
                if(block.extra_data && block.extra_data.v != undefined) {
                    const color = LEAVES_COLORS[block.extra_data.v % LEAVES_COLORS.length]
                    lm.r = color.r
                    lm.g = color.g
                }
            } else if(blockFlags & BLOCK_FLAG.COLOR) {
                lm = material.mask_color as IndexedColor;
                flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
                sideFlags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
                upFlags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            } else if(block.hasTag('multiply_color')) {
                lm = material.multiply_color as IndexedColor;
                flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
            }

            // Rotate
            const rotate = block.rotate || DEFAULT_ROTATE;
            let cardinal_direction = block.getCardinalDirection();

            // Can rotate
            if(material.can_rotate && rotate) {

                if(rotate.x != 0 || rotate.y != 1 || rotate.z != 0) {

                    matrix = style.applyRotate(chunk, block, neighbours, matrix, x, y, z)

                    DIRECTION_SOUTH     = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.SOUTH)
                    DIRECTION_EAST      = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.EAST)
                    DIRECTION_NORTH     = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.NORTH)
                    DIRECTION_WEST      = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.WEST)
                    //
                    if (
                        CubeSym.matrices[cardinal_direction][4] <= 0 ||
                        (rotate.y != 0 && material.tags.includes('rotate_by_pos_n'))
                    ) {
                        // @todo: calculate canDrawUP and neighbours based on rotation
                        canDrawUP = true;
                        canDrawDOWN = true;
                        canDrawSOUTH = true;
                        canDrawNORTH = true;
                        canDrawWEST = true;
                        canDrawEAST = true;
                        DIRECTION_SOUTH = DIRECTION.SOUTH;
                        DIRECTION_EAST = DIRECTION.EAST;
                        DIRECTION_NORTH = DIRECTION.NORTH;
                        DIRECTION_WEST = DIRECTION.WEST;
                    }
                }
            }

            // Layering
            if(material.layering?.slab) {
                if(style.isOnCeil(block)) {
                    y += material.layering.height
                }
            }

            // Убираем шапку травы с дерна, если над ним есть непрозрачный блок
            let replace_all_sides_texture_with_down = false
            if(material.is_dirt && material.is_cap_block && height == 1) {
                // если поставить блок над земляной тропинкой, то земляная тропинка превратится в визуально блок DIRT
                replace_all_sides_texture_with_down = true
            } else if(material.name == 'SANDSTONE') {
                const up_mat = neighbours.UP?.material;
                if(up_mat && up_mat.name == 'SANDSTONE') {
                    replace_all_sides_texture_with_down = true
                }
            }
            if(replace_all_sides_texture_with_down) {
                DIRECTION_UP      = DIRECTION.DOWN
                DIRECTION_SOUTH   = DIRECTION.DOWN
                DIRECTION_EAST    = DIRECTION.DOWN
                DIRECTION_NORTH   = DIRECTION.DOWN
                DIRECTION_WEST    = DIRECTION.DOWN
                flags = 0
                sideFlags = 0
                upFlags = 0
            }

            // uvlock
            if(!material.uvlock) {
                axes_up = UP_AXES[cardinal_direction];
                autoUV = false;
            }

            // Поворот текстуры травы в случайном направлении (для избегания эффекта мозаичности поверхности)
            if(material.random_rotate_up) {
                const rv = randoms.double(z * chunk.size.x + x + y * chunk.size.y) | 0
                if(block.id == bm.LILY_PAD.id) {
                    axes_down = UP_AXES[rv % 4];
                    flags |= QUAD_FLAGS.FLAG_WAVES_VERTEX | QUAD_FLAGS.FLAG_MASK_BIOME;
                } else {
                    axes_up = UP_AXES[rv % 4];
                }
                autoUV = false;
            }

        }

        // AABB
        _aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        // Push vertices
        if(canDrawUP) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'up', DIRECTION_UP, null, null);
            // connected_sides
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_UP)
            } else {
                sides.up = _sides.up.set(t, f, anim_frames, lm, axes_up, autoUV)
            }
            // overlay textures
            if(chunk?.chunkManager?.world?.settings?.overlay_textures) {
                emmited_blocks = []
                style.pushOverlayTextures(material, bm, x, y, z, neighbours, emmited_blocks, chunk, dirt_color, matrix, pivot)
                style.pushEdgeTextures(material, bm, x, y, z, neighbours, vertices, lm, f, height)
            }
        }
        if(canDrawDOWN) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'down', DIRECTION_DOWN, null, null);
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_DOWN)
            } else {
                sides.down = _sides.down.set(t, f, anim_frames, lm, axes_down, true);
            }
        }
        if(canDrawSOUTH) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'south', DIRECTION_SOUTH, width, height);
            // connected_sides
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_SOUTH)
            } else {
                sides.south = _sides.south.set(t, f, anim_frames, lm, null, false);
            }
        }
        if(canDrawNORTH) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'north', DIRECTION_NORTH, width, height);
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_NORTH)
            } else {
                sides.north = _sides.north.set(t, f, anim_frames, lm, null, false)
            }
        }
        if(canDrawWEST) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'west', DIRECTION_WEST, width, height);
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_WEST)
            } else {
                sides.west = _sides.west.set(t,  f, anim_frames, lm, null, false);
            }
        }
        if(canDrawEAST) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'east', DIRECTION_EAST, width, height);
            if(material.connected_sides) {
                style.pushConnectedSides(material, bm, x, y, z, neighbours, vertices, t, lm, f, neibIDs, DIRECTION_EAST)
            } else {
                sides.east = _sides.east.set(t, f, anim_frames, lm, null, false);
            }
        }

        pushAABB(vertices, _aabb, pivot, matrix, sides, _center.set(x, y, z));

        // lever
        if(material.name == 'LEVER') {
            // Geometries
            if(!_lever_part) {
                const c_up_top = style.block_manager.calcMaterialTexture(bm.OAK_LOG, DIRECTION.NORTH, null, null, block)
                _lever_part = {
                    "size": {"x": 2, "y": 8, "z": 2},
                    "translate": {"x": 0, "y": -3, "z": 0},
                    "faces": {
                        "up":    {"uv": [8, 7],"texture": c_up_top},
                        "north": {"uv": [8, 11], "texture": c_up_top},
                        "south": {"uv": [8, 11], "texture": c_up_top},
                        "west":  {"uv": [8, 11], "texture": c_up_top},
                        "east":  {"uv": [8, 11], "texture": c_up_top}
                    }
                }
            }
            mat4.identity(_lever_matrix)
            mat4.translate(_lever_matrix, _lever_matrix, [0, -.5 + 1/16, 0])
            mat4.rotateX(_lever_matrix, _lever_matrix, Math.PI/4 * (block.extra_data?.powered ? -1 : 1))
            mat4.translate(_lever_matrix, _lever_matrix, [0, .5, 0])
            if(matrix) {
                mat4.multiply(_lever_matrix, matrix, _lever_matrix)
            }
            default_style.pushPART(vertices, {
                ..._lever_part,
                lm:     lm,
                pos:    new Vector(0, 0, 0).addScalarSelf(x, y, z),
                matrix: _lever_matrix
            })
        }

        // Add animations
        if(typeof QubatchChunkWorker != 'undefined' && block.id == bm.SOUL_SAND.id) {
            if (neighbours.UP?.id == bm.BUBBLE_COLUMN.id) {
                QubatchChunkWorker.postMessage(['create_block_emitter', {
                    block_pos: block.posworld,
                    pos: [block.posworld.clone().addScalarSelf(.5, .5, .5)],
                    type: 'bubble_column',
                    isBottom: true
                }]);
            } else {
                QubatchChunkWorker.postMessage(['delete_animated_block', block.posworld]);
            }
        }

        // Jukebox
        if(block.id == bm.JUKEBOX.id) {
            style.playJukeboxDisc(chunk, block, x, y, z)
        }

        return emmited_blocks

    }

    //
    static isOnCeil(block) {
        // на верхней части блока (перевернутая ступенька, слэб)
        return block.extra_data?.point?.y >= .5 ?? false;
    }

    // Put into pot
    static putIntoPot(vertices, material, pivot, matrix, pos, biome, dirt_color) {
        const bm = style.block_manager
        const width = 8/32;
        const {x, y, z} = pos;
        const aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - width/2,
            x + .5 + width/2,
            y + 1 - 6/32,
            z + .5 + width/2
        );
        const c_up = bm.calcMaterialTexture(material, DIRECTION.UP);
        const c_down = bm.calcMaterialTexture(material, DIRECTION.DOWN);
        const c_side = bm.calcMaterialTexture(material, DIRECTION.LEFT);

        let flags = 0;

        // Texture color multiplier
        let lm = IndexedColor.WHITE;
        if(material.tags.includes('mask_biome')) {
            lm = dirt_color || IndexedColor.GRASS;
            flags = QUAD_FLAGS.FLAG_MASK_BIOME;
        } else if(material.tags.includes('mask_color')) {
            flags = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;
            lm = material.mask_color;
        }

        // Push vertices down
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, flags, 0, lm, null, true),
                down:   new AABBSideParams(c_down, flags, 0, lm, null, true),
                south:  new AABBSideParams(c_side, flags, 0, lm, null, true),
                north:  new AABBSideParams(c_side, flags, 0, lm, null, true),
                west:   new AABBSideParams(c_side, flags, 0, lm, null, true),
                east:   new AABBSideParams(c_side, flags, 0, lm, null, true),
            },
            pos
        );
        return;
    }

    // Can draw face
    static canDrawFace(block : any,  neighbour : any, drawAllSides : boolean, dir : int, width: float, height: float) {
        if(!neighbour || neighbour.id == 0) {
            return true
        }

        const bmat = block.material
        const nmat = neighbour.material

        if(bmat.is_cap_block && dir == DIRECTION.UP) {
            return true
        }

        if(nmat.is_solid) {
            if(dir == DIRECTION.DOWN || dir == DIRECTION.UP) {
                if(bmat.is_layering) {
                    const point = block.extra_data?.point
                    if(point) {
                        if(point.y < .5) {
                            return dir != DIRECTION.DOWN
                        } else {
                            return dir != DIRECTION.UP
                        }
                    }
                    return dir != DIRECTION.DOWN
                }
            }
            if(bmat.is_layering) {
                return false
            }
        } else if(nmat.is_cap_block && bmat.is_cap_block) {
            if(nmat.height >= height) {
                return false
            }
        }

        if(bmat.is_solid && dir == DIRECTION.UP) {
            if(nmat.is_layering) {
                const point = neighbour.extra_data?.point
                if(!point || point.y < .5) {
                    return false
                }
            } else if(nmat.is_cap_block) {
                return false
            }
        }

        let can_draw = drawAllSides || (nmat && nmat.transparent);
        if(can_draw) {
            if(block.id == neighbour.id && bmat.selflit) {
                return false
            } else if(nmat.id == bmat.id && bmat.layering && !block.extra_data) {
                return false
            }
        }

        return can_draw

    }

    // Calculate block size
    static calculateBlockSize(block, neighbours) {
        const material  = block.material;
        let width       = material.width ? material.width : 1;
        let height      = material.height ? material.height : 1;
        let depth       = material.depth ? material.depth : width;
        const up_mat    = neighbours.UP ? neighbours.UP.material : null;
        // Ladder
        if(material.style_name == 'ladder') {
            width = 1;
            height = 1;
            depth = 1;
        }
        // Button
        if(material.is_button && material.name != 'LEVER') {
            if(block.extra_data?.powered) {
                height /= 2;
            }
        } else if(material.is_fluid) {
            if(up_mat && up_mat.is_fluid) {
                height = 1.0;
            } else {
                height = .9;
            }
        }
        // Layering
        if(material.is_layering) {
            if(block.extra_data) {
                height = block.extra_data?.height || height;
            }
        } else if(material.is_dirt) {
            if(up_mat && (!up_mat.transparent || up_mat.is_fluid || neighbours.UP.material.is_cap_block)) {
                height = 1;
            }
        }
        return {width, height, depth};
    }

    static makeLeaves(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const is_fake               = block instanceof FakeTBlock
        const bm                    = style.block_manager
        const material              = block.material;
        const leaves_tex            = bm.calcTexture(material.texture, 'round');

        _lm_leaves.copyFrom(dirt_color);
        _lm_leaves.b = leaves_tex[3] * TX_CNT;
        const r1 = (randoms.double((z * 13 + x * 3 + y * 23)) | 0) / 100
        const r2 = (randoms.double((z * 11 + x * 37 + y)) | 0) / 100
        // Shift the horizontal plane randomly, to prevent a visible big plane.
        // Alternate shift by 0.25 block up/down from the center + some random.
        leaves_planes[0].move.y = ((x + z) % 2 - 0.5) * 0.5 + (r2 - 0.5) * 0.3;
        let flag = QUAD_FLAGS.FLAG_MASK_BIOME | QUAD_FLAGS.FLAG_LEAVES | QUAD_FLAGS.FLAG_NORMAL_UP
        if(block.extra_data) {
            if(block.extra_data && block.extra_data.v != undefined) {
                const color = LEAVES_COLORS[block.extra_data.v % LEAVES_COLORS.length]
                _lm_leaves.r = color.r
                _lm_leaves.g = color.g
            }
        }
        for(let i = 0; i < leaves_planes.length; i++) {
            if(is_fake && i == 0) continue
            const plane = leaves_planes[i];
            // fill object
            _pl.size     = plane.size;
            _pl.uv       = plane.uv as [number, number];
            _pl.rot      = _leaves_rot.setScalar(Math.PI*2 * r1, plane.rot[1] + r2 * 0.01, plane.rot[2]);
            _pl.lm       = _lm_leaves;
            _pl.pos      = _vec.set(
                x + (plane.move?.x || 0),
                y + (plane.move?.y || 0),
                z + (plane.move?.z || 0)
            );
            _pl.matrix   = leaves_matrices[i];
            _pl.flag     = flag;
            _pl.texture  = leaves_tex;
            default_style.pushPlane(vertices, _pl);
        }
    }

    static applyRotate(chunk : ChunkWorkerChunk, tblock: TBlock | FakeTBlock, neighbours : any, matrix : imat4, x : int, y : int, z : int) : imat4 {

        const material = tblock.material
        const rotate = tblock.rotate || DEFAULT_ROTATE
        const cardinal_direction = tblock.getCardinalDirection()
    
        // Can rotate
        if(material.can_rotate && rotate) {
            if(rotate.x != 0 || rotate.y != 1 || rotate.z != 0) {
                matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix)
            }
        }

        return matrix

    }

    static calcSideParams(block : TBlock | FakeTBlock, material : IBlockMaterial, bm : BLOCK, no_anim : boolean, cavity_id : int, force_tex : any, lm : IndexedColor, flags : int, sideFlags : int, upFlags : int, side : string, dir : int | string, width? : float, height? : float) : TCalcSideParamsResult {
        const is_side = side != 'up' && side != 'down'
        if(is_side && cavity_id === dir) {
            dir = 'cavity'
        }
        // force_tex = bm.calcTexture(material.texture, DIRECTION.UP);
        _sideParams.anim_frames = no_anim ? 0 : bm.getAnimations(material, side);
        const animFlag = _sideParams.anim_frames > 1 ? QUAD_FLAGS.FLAG_ANIMATED : 0;
        if(material.name == 'FURNACE' && dir == DIRECTION.NORTH) {
            const fuel_time = block?.extra_data?.state?.fuel_time ?? 0;
            if(fuel_time > 0) {
                dir = 'north_on';
            }
        }
        _sideParams.t = (force_tex as any) || bm.calcMaterialTexture(material, dir, width, height, block);
        if(is_side) {
            if(block.id == BLOCK.GRASS_BLOCK_SLAB.id || block.id == BLOCK.SNOW_DIRT_SLAB.id) {
                _sideParams.t[1] -= .5 / material.tx_cnt
            } else if(block.id == BLOCK.DIRT_PATH_SLAB.id) {
                _sideParams.t[1] -= .45 / material.tx_cnt
            }
        }
        _sideParams.f = flags | animFlag;
        if(side == 'up') {
            _sideParams.f |= upFlags
        } else if (side != 'down') {
            _sideParams.f |= sideFlags
        }
        if((_sideParams.f & QUAD_FLAGS.FLAG_MASK_BIOME) == QUAD_FLAGS.FLAG_MASK_BIOME) {
            lm.b = _sideParams.t[3] * TX_CNT;
        }
        return _sideParams
    }

    static playJukeboxDisc(chunk : ChunkWorkerChunk, tblock : TBlock | FakeTBlock, x : int, y : int, z : int) : boolean {
        if(typeof QubatchChunkWorker === 'undefined') {
            return false
        }
        const disc = tblock?.extra_data?.disc || null;
        if(disc) {
            QubatchChunkWorker.postMessage(['play_disc', {
                ...disc,
                dt: tblock.extra_data?.dt,
                pos: chunk.coord.clone().addScalarSelf(x, y, z)
            }]);
            QubatchChunkWorker.postMessage(['create_block_emitter', {
                block_pos: tblock.posworld,
                pos: [tblock.posworld.clone().addScalarSelf(.5, .5, .5)],
                type: 'music_note'
            }]);
        }
        return true
    }

    static pushOverlayTextures(center_material : IBlockMaterial, bm : BLOCK, x : number, y : number, z : number, neighbours, emmited_blocks: any[], chunk : ChunkWorkerChunk, dirt_color? : IndexedColor, matrix? : imat4, pivot? : number[] | IVector) {

        if(center_material.width || center_material.height) {
            return
        }

        _overlay.neightbours[0] = neighbours.WEST
        _overlay.neightbours[1] = neighbours.SOUTH
        _overlay.neightbours[2] = neighbours.EAST
        _overlay.neightbours[3] = neighbours.NORTH

        const center_material_have_overlay = !!center_material.texture_overlays

        for(let i = 0; i < _overlay.neightbours.length; i++) {
            const n = _overlay.neightbours[i]
            if(!n || n.id == center_material.id) {
                continue
            }
            const n_material = n.material
            if(n_material.texture_overlays) {
                if(center_material.layering?.full_block_name == n_material.name) {
                    continue
                }
                if(center_material_have_overlay) {
                    if(center_material.id == this.block_manager.GRASS_BLOCK.id && n.id == this.block_manager.DIRT.id) {

                    } else if(center_material.id == this.block_manager.DIRT.id && n.id == this.block_manager.GRASS_BLOCK.id) {
                        continue
                    } else {
                        if((n_material.overlay_textures_weight ?? n.id) < (center_material.overlay_textures_weight ?? center_material.id)) {
                            continue
                        }
                    }
                }
                let item = _overlay.materials.get(n.id)
                if(!item) {
                    item = _overlay.items[i]
                    item.material = n_material
                    _overlay.materials.set(n.id, item)
                }
                item.list[i] = true
                item.count++;
            }
        }

        if(_overlay.materials.size > 0) {

            let dmki = 0
            const lm = IndexedColor.WHITE;

            for(let item of _overlay.materials.values()) {
                const list = item.list
                const mat = item.material
                let overlay_name = null
                let overlay_axes_up = null
                if(item.count == 1) {
                    overlay_name = '1'
                    if(list[0]) overlay_axes_up = UP_AXES[2]
                    if(list[1]) overlay_axes_up = UP_AXES[3]
                    if(list[2]) overlay_axes_up = UP_AXES[0]
                    if(list[3]) overlay_axes_up = UP_AXES[1]
                } else if (item.count == 2) {
                    overlay_name = ((list[0] && list[2]) || (list[1] && list[3])) ? 'opposite' : 'corner'
                    if(overlay_name == 'corner') {
                        if(list[1] && list[2]) overlay_axes_up = UP_AXES[0]
                        if(list[2] && list[3]) overlay_axes_up = UP_AXES[1]
                        if(list[3] && list[0]) overlay_axes_up = UP_AXES[2]
                        if(list[0] && list[1]) overlay_axes_up = UP_AXES[3]
                    } else {
                        overlay_axes_up = list[0] ? UP_AXES[0] : UP_AXES[1]
                    }
                } else if (item.count == 3) {
                    overlay_name = '3'
                    if(!list[0]) overlay_axes_up = UP_AXES[0]
                    if(!list[1]) overlay_axes_up = UP_AXES[1]
                    if(!list[2]) overlay_axes_up = UP_AXES[2]
                    if(!list[3]) overlay_axes_up = UP_AXES[3]
                } else {
                    overlay_name = 'all'
                    overlay_axes_up = UP_AXES[0]
                }
                lm.copyFrom(dirt_color)
                const overlay_vertices = []
                let flags = 0
                if(mat.tags.includes('mask_biome')) {
                    lm.r += GRASS_PALETTE_OFFSET.x;
                    lm.g += GRASS_PALETTE_OFFSET.y;
                    flags |= QUAD_FLAGS.FLAG_MASK_BIOME;
                }
                const t = bm.calcMaterialTexture(mat, DIRECTION.UP, 1, 1, undefined, undefined, undefined, overlay_name);
                _overlay.sides.up.set(t, flags, 0, lm, overlay_axes_up, false);
                pushAABB(overlay_vertices, _aabb, null, null, _overlay.sides, _center.set(x, y, z));
                // TODO: take material from grass and change to decal1
                const material_key = OVERLAY_TEXTURE_MATERIAL_KEYS[dmki++ % 2]
                emmited_blocks.push(new FakeVertices(material_key, overlay_vertices))
                // clear item
                item.reset()
            }

            _overlay.materials.clear()

        }

    }
    
    static pushEdgeTextures(material : IBlockMaterial, bm : BLOCK, x : float, y : float, z : float, neighbours, vertices : float[], lm : IndexedColor, flags : int, height : float) {
        if(material.name != 'GRASS_BLOCK' && material.name != 'GRASS_BLOCK_SLAB') {
            return
        }
        if(!_grass_block_edge_tex) {
            _grass_block_edge_tex = bm.calcMaterialTexture(bm.GRASS_BLOCK, DIRECTION.UP, 1, 1, undefined, undefined, undefined, '1')
        }
        const c = _grass_block_edge_tex
        const d1 = 1
        const dm1 = -1
        const pp = lm.pack()
        const h2 = height == 1 ? .5 : 0
        const fo = flags // | QUAD_FLAGS.FLAG_NORMAL_UP
        // north
        if(neighbours.NORTH.material.transparent) {
            vertices.push(x + .5, z + 1.25, y + h2, 1, 0, 0, 0, .5, dm1, c[0], c[1], c[2], c[3], pp, fo)
        }
        // south
        if(neighbours.SOUTH.material.transparent) {
            vertices.push(x + .5, z - .25, y + h2, 1, 0, 0, 0, .5, d1, c[0], c[1], c[2], -c[3], pp, fo)
        }
        // west
        if(neighbours.WEST.material.transparent) {
            vertices.push(x - .25, z + .5, y + h2, 0, 1, 0, -.5, 0, dm1, c[0], c[1], c[2], c[3], pp, fo)
        }
        // east
        if(neighbours.EAST.material.transparent) {
            vertices.push(x + 1.25, z + .5, y + h2, 0, 1, 0, -.5, 0, d1, c[0], c[1], c[2], -c[3], pp, fo)
        }
        // emmited_blocks.push(new FakeVertices(OVERLAY_TEXTURE_MATERIAL_KEYS_DOUBLEFACE[0], overlay_vertices))
    }

    //
    static pushConnectedSides(material : IBlockMaterial, bm : BLOCK, x : float, y : float, z : float, neighbours : any, vertices : float[], t : float[], lm : IndexedColor, flags : int, neibIDs : int[], for_dir : DIRECTION) {

        const pp = lm.pack()
        const {axes, u_mul, v_mul, getNeighbourIndex, fixCoord} = CONNECTED_SIDE_PARAMS[for_dir]
        const getNeibID = (dx : int, dy: int, dz : int) => neibIDs[getNeighbourIndex(dx, dy, dz, (dx : int, dy : int, dz : int) => dxdydzIndex[dx + dz * 3 + dy * 9 + 13])]

        const checkNeib = (x : int, y : int, z : int) : boolean => {
            let resp = material.id == getNeibID(x, y, z)
            // TODO: доделать, чтобы на внутренних углах тоже были краевые текстуры
            // if(for_dir == DIRECTION.UP) resp = resp && (getNeibID(x, y + 1, z) === 0)
            // if(for_dir == DIRECTION.SOUTH) resp = resp && (getNeibID(x - 1, y, z) === 0)
            return resp
        }

        // Подсчёт, сколько подобных соседей есть вокруг блока (0...4)
        const sides = _connected_sides
        let cnt = 0
        cnt += (sides[DIRECTION.NORTH] = checkNeib(0, 0, 1)) ? 1 : 0
        cnt += (sides[DIRECTION.WEST] = checkNeib(-1, 0, 0)) ? 1 : 0
        cnt += (sides[DIRECTION.SOUTH] = checkNeib(0, 0, -1)) ? 1 : 0
        cnt += (sides[DIRECTION.EAST] = checkNeib(1, 0, 0)) ? 1 : 0

        let texture_name = 'up'
        if(material.connected_sides.side) {
            if(for_dir != DIRECTION.UP && for_dir != DIRECTION.DOWN) {
                texture_name = 'side'
            }
        }

        const t12 = bm.calcMaterialTexture(material, DIRECTION.UP, 1, 1, undefined, undefined, undefined, texture_name)
        t12[0] -= 1 / 64
        t12[1] -= 1 / 64
        t12[2] /= 3
        t12[3] /= 3

        const pushQ = (xx : float, zz : float, sx : float, sz : float) => {
            let yy = 1
            xx = xx * .5 + .25
            zz = zz * .5 + .25
            sx /= 64
            sz /= 64
            fixCoord(xx, yy, zz, (xx : int, yy : int, zz : int) => vertices.push(x + xx, z + zz, y + yy, ...axes[0], ...axes[1], t12[0]+sz, t12[1]+sx, t12[2]/2 * u_mul, t12[3]/2 * v_mul, pp, flags))
        }

        if(cnt == 0) {
            pushQ(0, 1, -.25, -.25)
            pushQ(1, 1, 2.25, -.25)
            pushQ(0, 0, -.25, 2.25)
            pushQ(1, 0, 2.25, 2.25)

        } else if(cnt == 4) {
            // 0
            if(!checkNeib(-1, 0, 1)) {
                pushQ(0, 1, 1.75, 1.75)
            } else {
                pushQ(0, 1, .75, .75)
            }
            if(!checkNeib(1, 0, 1)) {
                pushQ(1, 1, 0.25, 1.75)
            } else {
                pushQ(1, 1, 1.25, .75)
            }
            if(!checkNeib(-1, 0, -1)) {
                pushQ(0, 0, 1.75, .25)
            } else {
                pushQ(0, 0, .75, 1.25)
            }
            if(!checkNeib(1, 0, -1)) {
                pushQ(1, 0, .25, .25)
            } else {
                pushQ(1, 0, 1.25, 1.25)
            }

        } else if(cnt == 2) {
            // 2
            const is_opposite = sides[DIRECTION.WEST] == sides[DIRECTION.EAST]
            if(is_opposite)  {
                if(!sides[DIRECTION.EAST]) {
                    pushQ(0, 1, -.25, .75)
                    pushQ(1, 1, 2.25, .75)
                    pushQ(0, 0, -.25, 1.25)
                    pushQ(1, 0, 2.25, 1.25)
                } else {
                    pushQ(0, 1, .75, -.25)
                    pushQ(1, 1, 1.25, -.25)
                    pushQ(0, 0, .75, 2.25)
                    pushQ(1, 0, 1.25, 2.25)
                }
            } else {
                if(sides[DIRECTION.EAST] && sides[DIRECTION.NORTH]) {
                    pushQ(0, 1, -.25, 1.75)
                    if(!checkNeib(1, 0, 1)) {
                        pushQ(1, 1, .25, 1.75)
                    } else {
                        pushQ(1, 1, .25, .75)
                    }
                    pushQ(0, 0, -.25, 2.25)
                    pushQ(1, 0, .25, 2.25)
                } else if(sides[DIRECTION.WEST] && sides[DIRECTION.NORTH]) {
                    if(!checkNeib(-1, 0, 1)) {
                        pushQ(0, 1, 1.75, 1.75)
                    } else {
                        pushQ(0, 1, .75, .75)
                    }
                    pushQ(1, 1, 2.25, 1.75)
                    pushQ(0, 0, 1.75, 2.25)
                    pushQ(1, 0, 2.25, 2.25)
                } else if(sides[DIRECTION.WEST] && sides[DIRECTION.SOUTH]) {
                    pushQ(0, 1, 1.75, -.25)
                    pushQ(1, 1, 2.25, -.25)
                    if(!checkNeib(-1, 0, -1)) {
                        pushQ(0, 0, 1.75, 0.25)
                    } else {
                        pushQ(0, 0, 0.75, 1.25)
                    }
                    pushQ(1, 0, 2.25, .25)
                } else if(sides[DIRECTION.EAST] && sides[DIRECTION.SOUTH]) {
                    pushQ(0, 1, -.25, -.25)
                    pushQ(1, 1, .25, -.25)
                    pushQ(0, 0, -.25, .25)
                    if(!checkNeib(1, 0, -1)) {
                        pushQ(1, 0, .25, .25)
                    } else {
                        pushQ(1, 0, 1.25, 1.25)
                    }
                }
            }
        } else if(cnt == 1) {
            // 3
            if(sides[DIRECTION.NORTH]) {
                pushQ(0, 1, -.25, 1.75)
                pushQ(1, 1, 2.25, 1.75)
                pushQ(0, 0, -.25, 2.25)
                pushQ(1, 0, 2.25, 2.25)
            } else if(sides[DIRECTION.SOUTH]) {
                pushQ(0, 1, -.25, -.25)
                pushQ(1, 1, 2.25, -.25)
                pushQ(0, 0, -.25, .25)
                pushQ(1, 0, 2.25, 0.25)
            } else if(sides[DIRECTION.EAST]) {
                pushQ(0, 1, -.25, -.25)
                pushQ(1, 1, .25, -.25)
                pushQ(0, 0, -.25, 2.25)
                pushQ(1, 0, .25, 2.25)
            } else {
                pushQ(0, 1, 1.75, -.25)
                pushQ(1, 1, 2.25, -.25)
                pushQ(0, 0, 1.75, 2.25)
                pushQ(1, 0, 2.25, 2.25)
            }
        } else if(cnt == 3) {
            // 1
            if(!sides[DIRECTION.NORTH]) {
                pushQ(0, 1, .75, -.25)
                pushQ(1, 1, 1.25, -.25)
                //
                if(!checkNeib(-1, 0, -1)) {
                    pushQ(0, 0, 1.75, 0.25)
                } else {
                    pushQ(0, 0, .75, .25)
                }
                if(!checkNeib(1, 0, -1)) {
                    pushQ(1, 0, .25, 0.25)
                } else {
                    pushQ(1, 0, 1.25, .25)
                }
            } else if(!sides[DIRECTION.SOUTH]) {
                if(!checkNeib(-1, 0, 1)) {
                    pushQ(0, 1, 1.75, 1.75)
                } else {
                    pushQ(0, 1, .75, 1.75)
                }
                if(!checkNeib(1, 0, 1)) {
                    pushQ(1, 1, .25, 1.75)
                } else {
                    pushQ(1, 1, 1.25, 1.75)
                }
                pushQ(0, 0, .75, 2.25)
                pushQ(1, 0, 1.25, 2.25)
            } else if(!sides[DIRECTION.EAST]) {
                //
                if(!checkNeib(-1, 0, 1)) {
                    pushQ(0, 1, 1.75, 1.75)
                } else {
                    pushQ(0, 1, 1.75, 0.75)
                }
                if(!checkNeib(-1, 0, -1)) {
                    pushQ(0, 0, 1.75, 0.25)
                } else {
                    pushQ(0, 0, 1.75, 1.25)
                }
                //
                pushQ(1, 1, 2.25, 0.75)
                //
                pushQ(1, 0, 2.25, 1.25)
            } else if(!sides[DIRECTION.WEST]) {
                pushQ(0, 1, -.25, .75)
                if(!checkNeib(1, 0, 1)) {
                    pushQ(1, 1, .25, 1.75)
                } else {
                    pushQ(1, 1, 1.25, .75)
                }
                pushQ(0, 0, -.25, 1.25)
                //
                if(!checkNeib(1, 0, -1)) {
                    pushQ(1, 0, .25, .25)
                } else {
                    pushQ(1, 0, 1.25, 1.25)
                }
            }

        }

    }

}