import {DIRECTION} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
// import {CubeSym} from '../core/CubeSym.js';

const {mat4} = glMatrix;

const WIDTH =  12 / 32;
const HEIGHT = 14 / 32;

const WIDTH_INNER = 8/32;
const HEIGHT_INNER = 4/32;

const CHAIN_WIDTH = 6/32;
const CHAIN_HEIGHT = 8/32;

const CHAIN_TOTAL_HEIGHT = 12/32;

const CONNECT_HEIGHT_ON_CEIL = 6 / 16;

// getAnimations...
let getAnimations = (material, side) => {
    if(!material.texture_animations) {
        return 1;
    }
    if(side in material.texture_animations) {
        return material.texture_animations[side];
    } else if('side' in material.texture_animations) {
        return material.texture_animations['side'];
    }
    return 1;
};

// Фонарь
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['lantern'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        if(block.rotate.y == -1) {
            y += 1 - HEIGHT - HEIGHT_INNER - CONNECT_HEIGHT_ON_CEIL;
        }
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            y,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            y + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        let aabb2 = new AABB();
        aabb2.set(
            0 + .5 - WIDTH_INNER / 2,
            y + HEIGHT,
            0 + .5 - WIDTH_INNER / 2,
            0 + .5 + WIDTH_INNER / 2,
            y + HEIGHT + HEIGHT_INNER,
            0 + .5 + WIDTH_INNER / 2,
        );
        return [aabb, aabb2];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        const animations_side = getAnimations(block.material, 'side');
        const on_ceil = block.rotate.y == -1;
        const CHAIN_Y = on_ceil ? y + 1 - CHAIN_TOTAL_HEIGHT: y + HEIGHT + HEIGHT_INNER; // CHAIN_TOTAL_HEIGHT

        // Chain
        const chains = [];
        if(on_ceil) {
            chains.push({width: CHAIN_WIDTH, height: CHAIN_HEIGHT/2, uv: [25/32, 22/32], rot: -Math.PI / 4, y: 0/32, translate: [-CHAIN_WIDTH/2, 0, 0]});
            chains.push({width: CHAIN_WIDTH, height: CHAIN_HEIGHT, uv: [25/32, 6/32], rot: Math.PI / 4, y: 2/32, translate: [CHAIN_WIDTH/2, 0, 0]});
            chains.push({width: CHAIN_WIDTH, height: CHAIN_HEIGHT/2, uv: [25/32, 14/32], rot: -Math.PI / 4, y: 8/32, translate: [-CHAIN_WIDTH/2, 0, 0]});
        } else {
            chains.push({width: CHAIN_WIDTH, height: CHAIN_HEIGHT/2, uv: [25/32, 22/32], rot: Math.PI / 4, y: 0, translate: [CHAIN_WIDTH/2, 0, 0]});
            chains.push({width: CHAIN_WIDTH, height: CHAIN_HEIGHT/2, uv: [25/32, 22/32], rot: -Math.PI / 4, y: 0, translate: [-CHAIN_WIDTH/2, 0, 0]});
        }

        for(let chain of chains) {
            const c_chain_middle = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
            c_chain_middle[0] += (-.5 + chain.uv[0]) / 32;
            c_chain_middle[1] += (-.5 + chain.uv[1]) / 32;
            const aabb_chain_middle = new AABB();
            aabb_chain_middle.set(
                x + .5 - chain.width/2,
                CHAIN_Y + chain.y,
                z + .5 - chain.width/2,
                x + .5 + chain.width/2,
                CHAIN_Y + chain.y + chain.height,
                z + .5 + chain.width/2,
            );
            // Push vertices
            matrix = mat4.create();
            mat4.rotateY(matrix, matrix, chain.rot);
            mat4.translate(matrix, matrix, chain.translate);
            pushAABB(
                vertices,
                aabb_chain_middle,
                pivot,
                matrix,
                {north:  new AABBSideParams(c_chain_middle, 0, animations_side)},
                true,
                new Vector(x, y, z)
            );
        }

        //
        matrix = mat4.create();
        if(on_ceil) {
            y += 1 - HEIGHT - HEIGHT_INNER - CONNECT_HEIGHT_ON_CEIL;
        }

        // 1. Верхняя часть
        const c_up_top = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_up_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        c_up_top[0] += (-.5 + 6/32) / 32;
        c_up_top[1] += (-.5 + 24/32) / 32;
        c_up_side[0] += (-.5 + 6/32) / 32;
        c_up_side[1] += (-.5 + 2/32) / 32;
        const aabb_up = new AABB();
        aabb_up.set(
            x + .5 - WIDTH_INNER/2,
            y + HEIGHT,
            z + .5 - WIDTH_INNER/2,
            x + .5 + WIDTH_INNER/2,
            y + HEIGHT + HEIGHT_INNER,
            z + .5 + WIDTH_INNER/2,
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_up,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up_top, 0, animations_side),
                south:  new AABBSideParams(c_up_side, 0, animations_side),
                north:  new AABBSideParams(c_up_side, 0, animations_side),
                west:   new AABBSideParams(c_up_side, 0, animations_side),
                east:   new AABBSideParams(c_up_side, 0, animations_side),
            },
            true,
            new Vector(x, y, z)
        );

        matrix = mat4.create();
        // mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * -(2 * Math.PI));

        // 2. Основная часть
        // Textures
        const c_top = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        c_top[0] += (-.5 + 6/32) / 32;
        c_top[1] += (-.5 + 24/32) / 32;
        c_side[0] += (-.5 + 6/32) / 32;
        c_side[1] += (-.5 + 11/32) / 32;
        let aabb_down = new AABB();
        aabb_down.set(
            x + .5 - WIDTH/2,
            y,
            z + .5 - WIDTH/2,
            x + .5 + WIDTH/2,
            y + HEIGHT,
            z + .5 + WIDTH/2,
        );
        // Push vertices
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_top, 0, animations_side),
                down:   new AABBSideParams(c_top, 0, animations_side),
                south:  new AABBSideParams(c_side, 0, animations_side),
                north:  new AABBSideParams(c_side, 0, animations_side),
                west:   new AABBSideParams(c_side, 0, animations_side),
                east:   new AABBSideParams(c_side, 0, animations_side),
            },
            true,
            new Vector(x, y, z)
        );

        return null;

    }

}