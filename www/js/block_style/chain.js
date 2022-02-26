import {MULTIPLY, DIRECTION, QUAD_FLAGS, Color, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from "../../vendors/alea.js";
import { CubeSym } from '../core/CubeSym.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';

const TX_CNT = 32;

import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

function fromMat3(a, b) {
    a[ 0] = b[ 0];
    a[ 1] = b[ 1];
    a[ 2] = b[ 2];

    a[ 4] = b[ 3];
    a[ 5] = b[ 4];
    a[ 6] = b[ 5];

    a[ 8] = b[ 6];
    a[ 9] = b[ 7];
    a[10] = b[ 8];

    a[ 3] = a[ 7] = a[11] =
    a[12] = a[13] = a[14] = 0;
    a[15] = 1.0;

    return a;
}

const aabb = new AABB();
const pivotObj = {x: 0.5, y: .5, z: 0.5};

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Растения
export default class style {

    static lm = new Color();

    static getRegInfo() {
        return {
            styles: ['chain'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block) {
        let cardinal_direction = block.getCardinalDirection();
        let hw = (4.5/16) / 2;
        let sign_height = 1;
        if(block.material.planting) {
            hw = 12/16 / 2;
            sign_height = 12/16;
        }
        aabb.set(
            .5-hw, 0, .5-hw,
            .5+hw, sign_height, .5+hw
        );
        aabb.applyMatrix(CubeSym.matrices[cardinal_direction], pivotObj)
        return [aabb];
    }

    // getAnimations...
    static getAnimations(block, side) {
        if(!block.material.texture_animations) {
            return 1;
        }
        if(side in block.material.texture_animations) {
            return block.material.texture_animations[side];
        } else if('side' in block.material.texture_animations) {
            return block.material.texture_animations['side'];
        }
        return 1;
    }
    chain
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        const pos = new Vector(x, y, z);
        let flags = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const lm = MULTIPLY.COLOR.WHITE;

        let c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);

        const CHAIN_WIDTH = 6/32;
        const full_tex_size = c[2];
        c[0] = c[0] - full_tex_size/2 + (full_tex_size * CHAIN_WIDTH / 2);

        const chains = [];

        // Matrix
        let cardinal_direction = block.getCardinalDirection();
        const matrix4 = fromMat3(new Float32Array(16), CubeSym.matrices[cardinal_direction]);

        chains.push({
            pos: pos,
            width: CHAIN_WIDTH,
            height: 1,
            uv: [c[0], c[1]],
            flags: flags,
            lm: lm,
            matrix: [...matrix4],
            rot: Math.PI / 4,
            translate: [CHAIN_WIDTH/2, 0, 0],
            texture: [...c]
        });

        c[0] += CHAIN_WIDTH / TX_CNT;
        chains.push({
            pos: pos,
            width: CHAIN_WIDTH,
            height: 1,
            uv: [c[0], c[1]],
            flags: flags,
            lm: lm,
            matrix: [...matrix4],
            rot: -Math.PI / 4,
            translate: [-CHAIN_WIDTH/2, 0, 0],
            texture: c
        });

        style.pushChains(vertices, chains);

    }

    //
    static pushChains(vertices, chains) {
        const _aabb_chain_middle = new AABB();
        let pivot = null;
        for(let chain of chains) {
            _aabb_chain_middle.set(
                chain.pos.x +.5 - chain.width/2,
                chain.pos.y,
                chain.pos.z + .5 - chain.width/2,
                chain.pos.x + .5 + chain.width/2,
                chain.pos.y + chain.height,
                chain.pos.z + .5 + chain.width/2,
            );
            // Push vertices
            // Matrix
            let matrix = mat4.create();
            if(chain.rot) mat4.rotateY(matrix, matrix, chain.rot);
            if(chain.translate) mat4.translate(matrix, matrix, chain.translate);
            if(chain.matrix) {
                matrix = mat4.multiply(matrix, matrix, chain.matrix);
                // _aabb_chain_middle.applyMatrix(chain.matrix, pivotObj);
            }
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