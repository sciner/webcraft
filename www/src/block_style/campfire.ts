import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {DIRECTION, QUAD_FLAGS, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import {impl as alea} from "../../vendors/alea.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from "../constant.js";
import type { BlockManager } from "../blocks.js";
import type { TBlock } from "../typed_blocks3.js";

const {mat4} = glMatrix;

const TX_CNT = DEFAULT_TX_CNT;

const PLANKS_HEIGHT = 8/32;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const _temp_shift_pos = new Vector(0, 0, 0);

// Костёр
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['campfire'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        let y = 0;
        let aabb = new AABB();
        const w = 1;
        const h = .5;
        aabb.set(
            0 + .5 - w / 2,
            y,
            0 + .5 - w / 2,
            0 + .5 + w / 2,
            y + h,
            0 + .5 + w / 2,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const bm = style.block_manager
        const pos = new Vector(x, y, z);
        const active = block?.extra_data?.active;

        const textures = {
            fire:  bm.calcMaterialTexture(block.material, DIRECTION.UP), // пламя
            stone:  bm.calcMaterialTexture(block.material, DIRECTION.DOWN), // камень
            planks: bm.calcMaterialTexture(block.material, DIRECTION.DOWN) // доски, угли
        };

        // Add animations
        if(active && typeof QubatchChunkWorker != 'undefined') {
            QubatchChunkWorker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: [block.posworld.add(new Vector(.5, .5, .5))],
                type: 'campfire_flame'
            }]);
        }

        matrix = mat4.create();
        if(block.rotate) {
            mat4.rotateY(matrix, matrix, ((block.rotate.x - 1) / 4) * -(2 * Math.PI));
        }

        const aabb_stone = new AABB();
        aabb_stone.set(
            x,
            y,
            z + 1/16 + PLANKS_HEIGHT,
            x + 1,
            y + 1/16,
            z + 1/16 + PLANKS_HEIGHT + 6/16
        );
        const c_stone = [...textures.planks];
        c_stone[0] += (-.5 + 16/32) / TX_CNT;
        c_stone[1] += (-.5 + 24/32) / TX_CNT;

        pushAABB(
            vertices,
            aabb_stone,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_stone, 0, 1, null, null, true),
                down:   new AABBSideParams(c_stone, 0, 1, null, null, true),
                south:  new AABBSideParams(c_stone, 0, 1, null, null, true),
                north:  new AABBSideParams(c_stone, 0, 1, null, null, true),
                west:   new AABBSideParams(c_stone, 0, 1, null, null, true),
                east:   new AABBSideParams(c_stone, 0, 1, null, null, true),
            },
            pos
        );

        // Пламя
        if(active) {
            const chains = [];
            const flame_animations = bm.getAnimations(block.material, 'up');
            const flame_flags = QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.NO_AO; // | QUAD_FLAGS.FLAG_LEAVES;
            chains.push({
                pos: pos,
                width: 1,
                height: 1,
                uv: [.5, .5],
                rot: Math.PI / 4,
                translate: [0, 0, -.5],
                sides: {north: new AABBSideParams(textures.fire, flame_flags, flame_animations, null, null, true)},
                anim: 8
            });
            chains.push({
                pos: pos,
                width: 1,
                height: 1,
                uv: [.5, .5],
                rot: -Math.PI / 4,
                translate: [0, 0, -.5],
                sides: {north: new AABBSideParams(textures.fire, flame_flags, flame_animations, null, null, true)},
                anim: 8
            });
            style.pushChains(vertices, chains);
        }

        // Доски
        const aabb = new AABB();
        aabb.set(
            x,
            y,
            z + 1/16,
            x + 1,
            y + PLANKS_HEIGHT,
            z + 1/16 + PLANKS_HEIGHT
        );
        const c_planks_side = [...textures.planks];
        const c_planks_ends = [...textures.planks];
        c_planks_side[0] += (-.5 + 16/32) / TX_CNT;
        c_planks_side[1] += (-.5 + 4/32) / TX_CNT;
        c_planks_ends[0] += (-.5 + 4/32) / TX_CNT;
        c_planks_ends[1] += (-.5 + 12/32) / TX_CNT;

        // Варианты досок
        const planks_variants = [];
        // 1.
        planks_variants.push({matrix: matrix});
        // 2.
        const matrix2 = [...matrix];
        mat4.rotateY(matrix2, matrix2, Math.PI);
        planks_variants.push({matrix: matrix2});
        // 3.
        const matrix3 = [...matrix];
        mat4.rotateY(matrix3, matrix3, Math.PI / 2);
        mat4.translate(matrix3, matrix3, [0, PLANKS_HEIGHT - 1/16, 0]);
        planks_variants.push({matrix: matrix3});
        // 4.
        const matrix4 = [...matrix];
        mat4.rotateY(matrix4, matrix4, Math.PI * 1.5);
        mat4.translate(matrix4, matrix4, [0, PLANKS_HEIGHT - 1/16, 0]);
        planks_variants.push({matrix: matrix4});

        // Push planks vertices
        for(let item of planks_variants) {
            pushAABB(
                vertices,
                aabb,
                pivot,
                item.matrix,
                {
                    up:     new AABBSideParams(c_planks_side, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                    down:   new AABBSideParams(c_planks_side, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                    south:  new AABBSideParams(c_planks_side, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                    north:  new AABBSideParams(c_planks_side, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                    west:   new AABBSideParams(c_planks_ends, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                    east:   new AABBSideParams(c_planks_ends, QUAD_FLAGS.NO_CAN_TAKE_AO, 1, null, null, true),
                },
                pos
            );
        }

        return null;

    }

    //
    static pushChains(vertices, chains) {
        const _aabb_chain_middle = new AABB();
        let pivot = null;
        let matrix = null;
        for(let chain of chains) {
            _aabb_chain_middle.set(
                chain.pos.x + .5 - chain.width/2,
                chain.pos.y,
                chain.pos.z + .5 - chain.width/2,
                chain.pos.x + .5 + chain.width/2,
                chain.pos.y + chain.height,
                chain.pos.z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4.create();
            if(chain.rot) mat4.rotateY(matrix, matrix, chain.rot);
            if(chain.translate) mat4.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                _aabb_chain_middle,
                pivot,
                matrix,
                chain.sides,
                chain.pos
            );
        }
    }

}