import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {DIRECTION, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import {impl as alea} from "../../vendors/alea.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_TX_CNT } from "../constant.js";

const {mat4} = glMatrix;

const STALK_WIDTH = 6/32;
const TX_CNT = DEFAULT_TX_CNT;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const _temp_shift_pos = new Vector(0, 0, 0);

// Bamboo
export default class style {
    [key: string]: any;

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['bamboo'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        let x = 0;
        let y = 0;
        let z = 0;
        let margin = for_physic ? 0 : 1/16;

        _temp_shift_pos.copyFrom(block.posworld).subSelf(block.tb.coord);

        // Random shift
        const index = Math.abs(Math.round(_temp_shift_pos.x * CHUNK_SIZE_Z + _temp_shift_pos.z)) % 256;
        const r = randoms[index] * 4/16 - 2/16;
        x += 0.5 - 0.5 + r;
        z += 0.5 - 0.5 + r;

        const aabb = new AABB();
        aabb.set(
            x + .5 - STALK_WIDTH / 2 - margin,
            y + 0,
            z + .5 - STALK_WIDTH / 2 - margin,
            x + .5 + STALK_WIDTH / 2 + margin,
            y + 1,
            z + .5 + STALK_WIDTH / 2 + margin,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        let stage = block?.extra_data ? block.extra_data.stage : 3;

        const no_random_pos = block.hasTag('no_random_pos');
        const into_pot = block.hasTag('into_pot');

        // Random shift
        if(!no_random_pos) {
            const index = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
            const r = randoms[index] * 4/16 - 2/16;
            x += 0.5 - 0.5 + r;
            z += 0.5 - 0.5 + r;
        }

        const textures = {
            stalk:          BLOCK.calcMaterialTexture(block.material, DIRECTION.UP), // стебель
            stage0:         BLOCK.calcMaterialTexture(block.material, DIRECTION.EAST), // первая стадия роста
            singleleaf:     BLOCK.calcMaterialTexture(block.material, DIRECTION.WEST), // одинокий листик
            leaves:         BLOCK.calcMaterialTexture(block.material, DIRECTION.SOUTH), // малая листва
            large_leaves:   BLOCK.calcMaterialTexture(block.material, DIRECTION.NORTH) // широкая листва
        };

        if(into_pot) {
            stage = 4;
            y -= 6/32 - 1/500;
        }

        const pos = new Vector(x, y, z);
        const chains = [];

        switch(stage) {
            case 0: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 4,
                    translate: [0, 0, -.5],
                    texture: textures.stage0
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: -Math.PI / 4,
                    translate: [0, 0, -.5],
                    texture: textures.stage0
                });
                break;
            }
            case 1:
            case 2: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: Math.PI / 2,
                    translate: [0, 0, -.5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                break;
            }
            case 3: {
                break;
            }
            case 4: {
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: 0,
                    translate: [0, 0, -.5],
                    texture: textures.singleleaf
                });
                break;
            }
        }

        style.pushChains(vertices, chains);

        if(stage > 0) {
            //
            matrix = mat4.create();

            const aabb = new AABB();
            aabb.set(
                x + .5 - STALK_WIDTH/2,
                y,
                z + .5 - STALK_WIDTH/2,
                x + .5 + STALK_WIDTH/2,
                y + 1,
                z + .5 + STALK_WIDTH/2
            );

            const c_up = [...textures.stalk];
            const c_side = [...textures.stalk];

            c_up[0] += (-.5 + 29/32) / TX_CNT;
            c_up[1] += (-.5 + 3/32) / TX_CNT;

            c_side[0] += (-.5 + 3/32) / TX_CNT;

            // Push vertices down
            pushAABB(
                vertices,
                aabb,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                    down:   new AABBSideParams(c_up, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_side, 0, 1, null, null, true),
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
                {north: new AABBSideParams(chain.texture, 0, 1, null, null, true)},
                chain.pos
            );
        }
    }

}