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

const _lm_grass = new IndexedColor(0, 0, 0);
const _lm_leaves = new IndexedColor(0, 0, 0);
const _pl = new QuadPlane()
const _vec = new Vector(0, 0, 0);
const _sideParams = new TCalcSideParamsResult()

let _grass_block_edge_tex : tupleFloat4 | null = null

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

const pivotObj = {x: 0.5, y: .5, z: 0.5};
const DEFAULT_ROTATE = new Vector(0, 1, 0);
const _aabb = new AABB();
const _center = new Vector(0, 0, 0);
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

// Used for grass pseudo-random rotation
const randoms = new FastRandom('random_dirt_rotations', MAX_CHUNK_SQUARE, 100, true)
const OVERLAY_TEXTURE_MATERIAL_KEYS : string[] = []
const OVERLAY_TEXTURE_MATERIAL_KEYS_DOUBLEFACE : string[] = []

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
        const material = tblock.material;
        let width = material.width ? material.width : 1;
        let height = material.height ? material.height : 1;
        let depth = material.depth ? material.depth : width;

        if(for_physic && tblock.id == style.block_manager.SOUL_SAND.id) {
            height = 14/16;
        }

        // Button
        if(material.is_button) {
            if(tblock.extra_data?.pressed) {
                height /= 2;
            }
        }

        const x = 0;
        let y = 0;
        const z = 0;

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

    static isOnCeil(block) {
        // на верхней части блока (перевернутая ступенька, слэб)
        return block.extra_data?.point?.y >= .5 ?? false;
    }

    //
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
            flags = QUAD_FLAGS.MASK_BIOME;
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

    /**
     * Can draw face
     */
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

    // calculateBlockSize...
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
        if(material.is_button) {
            if(block.extra_data?.pressed) {
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
        
        const bm                    = style.block_manager
        const material              = block.material;
        const leaves_tex = bm.calcTexture(material.texture, 'round');
        _lm_leaves.copyFrom(dirt_color);
        _lm_leaves.b = leaves_tex[3] * TX_CNT;
        const r1 = (randoms.double((z * 13 + x * 3 + y * 23)) | 0) / 100
        const r2 = (randoms.double((z * 11 + x * 37 + y)) | 0) / 100
        // Shift the horizontal plane randomly, to prevent a visible big plane.
        // Alternate shift by 0.25 block up/down from the center + some random.
        leaves_planes[0].move.y = ((x + z) % 2 - 0.5) * 0.5 + (r2 - 0.5) * 0.3;
        let flag = QUAD_FLAGS.MASK_BIOME | QUAD_FLAGS.FLAG_LEAVES | QUAD_FLAGS.NORMAL_UP
        if(block.extra_data) {
            if(block.extra_data && block.extra_data.v != undefined) {
                const color = LEAVES_COLORS[block.extra_data.v % LEAVES_COLORS.length]
                _lm_leaves.r = color.r
                _lm_leaves.g = color.g
            }
        }
        for(let i = 0; i < leaves_planes.length; i++) {
            if(block instanceof FakeTBlock && i == 0) continue
            const plane = leaves_planes[i];
            // fill object
            _pl.size     = plane.size;
            _pl.uv       = plane.uv as [number, number];
            _pl.rot      = new Vector(Math.PI*2 * r1, plane.rot[1] + r2 * 0.01, plane.rot[2]);
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

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture, neibIDs : int[] = []) {

        const material = block.material

        // Pot
        if(block.hasTag('into_pot')) {
            return style.putIntoPot(vertices, block.material, pivot, matrix, _center.set(x, y, z), biome, dirt_color)
        }

        // Beautiful leaves
        const sheared = (block?.extra_data?.sheared) ? block?.extra_data?.sheared : false;
        if(material.transparent && material.is_leaves == LEAVES_TYPE.BEAUTIFUL && !sheared) {
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
        let flags                   = material.light_power ? QUAD_FLAGS.NO_AO : 0
        let sideFlags               = flags
        let upFlags                 = flags

        let DIRECTION_UP            = DIRECTION.UP
        let DIRECTION_DOWN          = DIRECTION.DOWN
        let DIRECTION_BACK          = DIRECTION.BACK
        let DIRECTION_RIGHT         = DIRECTION.RIGHT
        let DIRECTION_FORWARD       = DIRECTION.FORWARD
        let DIRECTION_LEFT          = DIRECTION.LEFT

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
                    flags = QUAD_FLAGS.MASK_BIOME;
                }
                sideFlags = QUAD_FLAGS.MASK_BIOME;
                upFlags = QUAD_FLAGS.MASK_BIOME;
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
                    matrix = calcRotateMatrix(material, rotate, cardinal_direction, matrix);
                    DIRECTION_BACK          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.BACK);
                    DIRECTION_RIGHT         = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.RIGHT);
                    DIRECTION_FORWARD       = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.FORWARD);
                    DIRECTION_LEFT          = CubeSym.dirAdd(CubeSym.inv(cardinal_direction), DIRECTION.LEFT);
                    //
                    if (
                        CubeSym.matrices[cardinal_direction][4] <= 0 ||
                        (material.tags.includes('rotate_by_pos_n') && rotate.y != 0)
                    ) {
                        // @todo: calculate canDrawUP and neighbours based on rotation
                        canDrawUP = true;
                        canDrawDOWN = true;
                        canDrawSOUTH = true;
                        canDrawNORTH = true;
                        canDrawWEST = true;
                        canDrawEAST = true;
                        DIRECTION_BACK = DIRECTION.BACK;
                        DIRECTION_RIGHT = DIRECTION.RIGHT;
                        DIRECTION_FORWARD = DIRECTION.FORWARD;
                        DIRECTION_LEFT = DIRECTION.LEFT;
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
                DIRECTION_UP        = DIRECTION.DOWN
                DIRECTION_BACK      = DIRECTION.DOWN
                DIRECTION_RIGHT     = DIRECTION.DOWN
                DIRECTION_FORWARD   = DIRECTION.DOWN
                DIRECTION_LEFT      = DIRECTION.DOWN
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
                    flags |= QUAD_FLAGS.FLAG_WAVES_VERTEX | QUAD_FLAGS.MASK_BIOME;
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
                style.pushConnectedSides(bm, vertices, x, y, z, material, neighbours, t, lm, f, neibIDs)
            } else {
                sides.up = _sides.up.set(t, f, anim_frames, lm, axes_up, autoUV)
            }
            // overlay textures
            if(chunk?.chunkManager?.world?.settings?.overlay_textures) {
                emmited_blocks = []
                style.pushOverlayTextures(material, emmited_blocks, bm, chunk, x, y, z, neighbours, dirt_color, matrix, pivot)

                if(material.name == 'GRASS_BLOCK' || material.name == 'GRASS_BLOCK_SLAB') {
                    if(!_grass_block_edge_tex) {
                        _grass_block_edge_tex = bm.calcMaterialTexture(bm.GRASS_BLOCK, DIRECTION.UP, 1, 1, undefined, undefined, undefined, '1')
                    }
                    const c = _grass_block_edge_tex
                    const d1 = 1
                    const dm1 = -1
                    const pp = lm.pack()
                    const h2 = height == 1 ? .5 : 0
                    const fo = f // | QUAD_FLAGS.NORMAL_UP
                    // const overlay_vertices : float[] = []
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
            }
        }
        if(canDrawDOWN) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'down', DIRECTION_DOWN, null, null);
            sides.down = _sides.down.set(t, f, anim_frames, lm, axes_down, true);
        }
        if(canDrawSOUTH) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'south', DIRECTION_BACK, width, height);
            sides.south = _sides.south.set(t, f, anim_frames, lm, null, false);
        }
        if(canDrawNORTH) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'north', DIRECTION_FORWARD, width, height);
            sides.north = _sides.north.set(t, f, anim_frames, lm, null, false);
        }
        if(canDrawWEST) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'west', DIRECTION_LEFT, width, height);
            sides.west = _sides.west.set(t,  f, anim_frames, lm, null, false);
        }
        if(canDrawEAST) {
            const {anim_frames, t, f} = style.calcSideParams(block, material, bm, no_anim, cavity_id, force_tex, lm, flags, sideFlags, upFlags, 'east', DIRECTION_RIGHT, width, height);
            sides.east = _sides.east.set(t, f, anim_frames, lm, null, false);
        }

        pushAABB(vertices, _aabb, pivot, matrix, sides, _center.set(x, y, z));

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
        if((_sideParams.f & QUAD_FLAGS.MASK_BIOME) == QUAD_FLAGS.MASK_BIOME) {
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

    static pushOverlayTextures(center_material : IBlockMaterial, emmited_blocks: any[], bm : BLOCK, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, dirt_color? : IndexedColor, matrix? : imat4, pivot? : number[] | IVector) {

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
                    flags |= QUAD_FLAGS.MASK_BIOME;
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
    
    static pushConnectedSides(bm : BLOCK, vertices : float[], x : float, y : float, z : float, material : IBlockMaterial, neighbours, t : float[], lm : IndexedColor, flags : int, neibIDs : int[]) {

        _overlay.neightbours[0] = neighbours.WEST
        _overlay.neightbours[1] = neighbours.SOUTH
        _overlay.neightbours[2] = neighbours.EAST
        _overlay.neightbours[3] = neighbours.NORTH

        const sides = [false, false, false, false]
        let cnt = 0

        cnt += (sides[DIRECTION.WEST] = material.id == neighbours.WEST.id) ? 1 : 0
        cnt += (sides[DIRECTION.SOUTH] = material.id == neighbours.SOUTH.id) ? 1 : 0
        cnt += (sides[DIRECTION.EAST] = material.id == neighbours.EAST.id) ? 1 : 0
        cnt += (sides[DIRECTION.NORTH] = material.id == neighbours.NORTH.id) ? 1 : 0

        const pp = lm.pack()
        const axes_up = UP_AXES[2]
        const axes_up_quad = [
            [
                axes_up[0][0]/2,
                axes_up[0][1]/2,
                axes_up[0][2]/2,
            ],
            [
                axes_up[1][0]/2,
                axes_up[1][1]/2,
                axes_up[1][2]/2,
            ]
        ]
        const t12 = bm.calcMaterialTexture(material, DIRECTION.UP, 1, 1, undefined, undefined, undefined, '12')
        t12[0] -= 1 / 64
        t12[1] -= 1 / 64
        t12[2] /= 3
        t12[3] /= 3

        const pushQ = (xx : float, zz : float, sx : float, sz : float) => {
            xx = xx * .5 + .25
            zz = zz * .5 + .25
            sx /= 64
            sz /= 64
            vertices.push(x + xx, z + zz, y + 1, ...axes_up_quad[0], ...axes_up_quad[1], t12[0]+sz, t12[1]+sx, t12[2]/2, t12[3]/2, pp, flags)
        }

        const getNeibID = (dx : int, dz : int) => {
            const index = 10 + (1 - dx) / 2 + (1 - dz)
            const id = neibIDs[index]
            // console.log(index, id)
            return id
        }

        if(cnt == 0) {
            pushQ(0, 1, -.25, -.25)
            pushQ(1, 1, 2.25, -.25)
            pushQ(0, 0, -.25, 2.25)
            pushQ(1, 0, 2.25, 2.25)

        } else if(cnt == 4) {
            // 0
            if(getNeibID(-1, 1) != material.id) {
                pushQ(0, 1, 1.75, 1.75)
            } else {
                pushQ(0, 1, .75, .75)
            }
            if(getNeibID(1, 1) != material.id) {
                pushQ(1, 1, 0.25, 1.75)
            } else {
                pushQ(1, 1, 1.25, .75)
            }
            if(getNeibID(-1, -1) != material.id) {
                pushQ(0, 0, 1.75, .25)
            } else {
                pushQ(0, 0, .75, 1.25)
            }
            if(getNeibID(1, -1) != material.id) {
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
                    if(getNeibID(1, 1) != material.id) {
                        pushQ(1, 1, .25, 1.75)
                    } else {
                        pushQ(1, 1, .25, .75)
                    }
                    pushQ(0, 0, -.25, 2.25)
                    pushQ(1, 0, .25, 2.25)
                } else if(sides[DIRECTION.WEST] && sides[DIRECTION.NORTH]) {
                    if(getNeibID(-1, 1) != material.id) {
                        pushQ(0, 1, 1.75, 1.75)
                    } else {
                        pushQ(0, 1, .75, .75)
                    }
                    pushQ(1, 1, 2.25, 1.75)
                    pushQ(0, 0, 1.75, 2.25)
                    pushQ(1, 0, 2.25, 2.25)
                } else if(sides[DIRECTION.WEST] && sides[DIRECTION.SOUTH]) {
                    pushQ(0, 1, .75, -.25)
                    pushQ(1, 1, 2.25, -.25)
                    if(getNeibID(-1, -1) != material.id) {
                        pushQ(0, 0, 1.75, 0.25)
                    } else {
                        pushQ(0, 0, 0.75, 1.25)
                    }
                    pushQ(1, 0, 2.25, .25)
                } else if(sides[DIRECTION.EAST] && sides[DIRECTION.SOUTH]) {
                    pushQ(0, 1, -.25, -.25)
                    pushQ(1, 1, .25, -.25)
                    pushQ(0, 0, -.25, .25)
                    if(getNeibID(1, -1) != material.id) {
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
                if(getNeibID(-1, -1) != material.id) {
                    pushQ(0, 0, 1.75, 0.25)
                } else {
                    pushQ(0, 0, .75, .25)
                }
                if(getNeibID(1, -1) != material.id) {
                    pushQ(1, 0, .25, 0.25)
                } else {
                    pushQ(1, 0, 1.25, .25)
                }
            } else if(!sides[DIRECTION.SOUTH]) {
                if(getNeibID(-1, 1) != material.id) {
                    pushQ(0, 1, 1.75, 1.75)
                } else {
                    pushQ(0, 1, .75, 1.75)
                }
                if(getNeibID(1, 1) != material.id) {
                    pushQ(1, 1, .25, 1.75)
                } else {
                    pushQ(1, 1, 1.25, 1.75)
                }
                pushQ(0, 0, .75, 2.25)
                pushQ(1, 0, 1.25, 2.25)
            } else if(!sides[DIRECTION.EAST]) {
                //
                if(getNeibID(-1, 1) != material.id) {
                    pushQ(0, 1, 1.75, 1.75)
                } else {
                    pushQ(0, 1, 1.75, 0.75)
                }
                if(getNeibID(-1, -1) != material.id) {
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
                if(getNeibID(1, 1) != material.id) {
                    pushQ(1, 1, .25, 1.75)
                } else {
                    pushQ(1, 1, 1.25, .75)
                }
                pushQ(0, 0, -.25, 1.25)
                // 
                if(getNeibID(1, -1) != material.id) {
                    pushQ(1, 0, .25, .25)
                } else {
                    pushQ(1, 0, 1.25, 1.25)
                }
            }

        }

    }

}