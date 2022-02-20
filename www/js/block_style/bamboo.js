import {DIRECTION, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

const STALK_WIDTH = 6/32;
const TX_CNT = 32;

// Bamboo
export default class style {

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
        let y = 0;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - STALK_WIDTH / 2,
            y + 0,
            0 + .5 - STALK_WIDTH / 2,
            0 + .5 + STALK_WIDTH / 2,
            y + 1,
            0 + .5 + STALK_WIDTH / 2,
        );
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const stage = block?.extra_data ? block.extra_data.stage : 3;

        const textures = {
            stalk:          BLOCK.calcMaterialTexture(block.material, DIRECTION.UP), // стебель
            stage0:         BLOCK.calcMaterialTexture(block.material, DIRECTION.EAST), // первая стадия роста
            singleleaf:     BLOCK.calcMaterialTexture(block.material, DIRECTION.WEST), // одинокий листик
            leaves:         BLOCK.calcMaterialTexture(block.material, DIRECTION.SOUTH), // малая листва
            large_leaves:   BLOCK.calcMaterialTexture(block.material, DIRECTION.NORTH) // широкая листва
        };

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
                    translate: [.5, 0, 0],
                    texture: textures.stage0
                });
                chains.push({
                    pos: pos,
                    width: 1,
                    height: 1,
                    uv: [.5, .5],
                    rot: -Math.PI / 4,
                    translate: [-.5, 0, 0],
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
                    translate: [0, 0, .5],
                    texture: stage == 1 ? textures.leaves : textures.large_leaves
                });
                break;
            }
            case 3: {
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
                    up:     new AABBSideParams(c_up, 0, 1),
                    down:   new AABBSideParams(c_up, 0, 1),
                    south:  new AABBSideParams(c_side, 0, 1),
                    north:  new AABBSideParams(c_side, 0, 1),
                    west:   new AABBSideParams(c_side, 0, 1),
                    east:   new AABBSideParams(c_side, 0, 1),
                },
                true,
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
                {north: new AABBSideParams(chain.texture, 0, 1)},
                true,
                chain.pos
            );
        }
    }

}