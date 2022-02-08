import {DIRECTION, AlphabetTexture} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4}            = glMatrix;

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 16 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const CONNECT_BOTTOM    = 9 / 16;
const BOTTOM_HEIGHT     = .6;

class FakeBlock {

    constructor(id, extra_data, pos, rotate, pivot, matrix) {
        this.id = id;
        this.extra_data = extra_data;
        this.pos = pos;
        this.rotate = rotate;
        this.pivot = pivot;
        this.matrix = matrix;
    }

    get material() {
        return BLOCK.fromId(this.id);
    }

};

// console.log(AlphabetTexture.getStringUVs('Привет, Мир!!!'));

// Табличка
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['sign'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {

        if(for_physic) {
            return [];
        }

        let x = 0;
        let y = 0;
        let z = 0;
        const resp      = [];
        const width     = .5;
        const height    = 1;
 
        // Center
        // if(block.rotate.y != 0) {
            let aabb = new AABB();
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - width/2,
                x + .5 + width/2,
                y + height,
                z + .5 + width/2,
            );
            resp.push(aabb);
        // }

        return [aabb];

    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Textures
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        // we can use mat4 now
        matrix = mat4.create();
        mat4.scale(matrix, matrix, [1, 1, 1]);
        mat4.rotateY(matrix, matrix, Math.random() * 2 * Math.PI);

        let aabb = new AABB();
        aabb.set(
            x + .5 - CONNECT_X/2,
            y + .6,
            z + .5 - CONNECT_Z/2,
            x + .5 + CONNECT_X/2,
            y + .6 + CONNECT_HEIGHT,
            z + .5 + CONNECT_Z/2,
        );

        // Center
        //if(block.rotate.y != 0) {
            let aabb_down = new AABB();
            aabb_down.set(
                x + .5 - CENTER_WIDTH/2,
                y,
                z + .5 - CENTER_WIDTH/2,
                x + .5 + CENTER_WIDTH/2,
                y + BOTTOM_HEIGHT,
                z + .5 + CENTER_WIDTH/2,
            );
        //}

        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, 0, 1), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c, 0, 1),
                south:  new AABBSideParams(c, 0, 1),
                north:  new AABBSideParams(c, 0, 1),
                west:   new AABBSideParams(c, 0, 1),
                east:   new AABBSideParams(c, 0, 1),
            },
            true
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_down,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_down, 0, 1), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c_down, 0, 1),
                south:  new AABBSideParams(c_down, 0, 1),
                north:  new AABBSideParams(c_down, 0, 1),
                west:   new AABBSideParams(c_down, 0, 1),
                east:   new AABBSideParams(c_down, 0, 1),
            },
            true
        );

        // Return text block
        if(block.extra_data) {
            let text = block.extra_data?.text;
            if(text) {
                return [new FakeBlock(
                    BLOCK.TEXT.id,
                    {
                        aabb: aabb,
                        chars: AlphabetTexture.getStringUVs(text)
                    },
                    new Vector(x, y, z),
                    block.rotate,
                    pivot,
                    matrix
                )];
            }
        }

        return null;

    }

}