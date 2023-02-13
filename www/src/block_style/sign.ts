import {DIRECTION, AlphabetTexture, Vector} from '../helpers.js';
import {BLOCK, FakeTBlock} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import {CubeSym} from "../core/CubeSym.js";

const {mat4} = glMatrix;

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 16 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const BOTTOM_HEIGHT     = .6;

const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

// Табличка
export default class style {
    [key: string]: any;

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

        let x           = 0;
        let y           = 0;
        let z           = 0;
        let aabb        = null;
        const resp      = [];
        const width     = .5;
        const height    = 1;

        // Center
        if(block.rotate.y == 0) {
            const mul = 1.01;
            aabb = new AABB();
            aabb.set(
                x + .5 - CONNECT_X*mul/2,
                y + .6,
                z + .5 - CONNECT_Z*mul/2,
                x + .5 + CONNECT_X*mul/2,
                y + .6 + CONNECT_HEIGHT*mul,
                z + .5 + CONNECT_Z*mul/2,
            );
            const dist = -(.5 - aabb.depth / 2);
            const dir = CubeSym.dirAdd(block.rotate.x, CubeSym.ROT_Y2);
            aabb.rotate(dir, aabb.center);
            aabb.translate(cubeSymAxis[dir][0] * dist, -(.2 + aabb.height) / 2, cubeSymAxis[dir][1] * dist);
        } else {
            aabb = new AABB();
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - width/2,
                x + .5 + width/2,
                y + height,
                z + .5 + width/2,
            );
            resp.push(aabb);
        }

        return [aabb];

    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        // Texture
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);

        const draw_bottom = block.rotate.y != 0;

        const aabb = style.makeAABBSign(block, x, y, z)

        if(draw_bottom) {
            matrix = mat4.create();
            mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * (2 * Math.PI))
        } else {
            matrix = CubeSym.matrices[CubeSym.dirAdd(Math.floor(block.rotate.x), CubeSym.ROT_Y2)]
        }

        // Center
        let aabb_down;
        if(draw_bottom) {
            aabb_down = new AABB();
            aabb_down.set(
                x + .5 - CENTER_WIDTH/2,
                y,
                z + .5 - CENTER_WIDTH/2,
                x + .5 + CENTER_WIDTH/2,
                y + BOTTOM_HEIGHT,
                z + .5 + CENTER_WIDTH/2,
            );
        }

        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, 0, 0, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c, 0, 0, null, null, true),
                south:  new AABBSideParams(c, 0, 0, null, null, true),
                north:  new AABBSideParams(c, 0, 0, null, null, true),
                west:   new AABBSideParams(c, 0, 0, null, null, true),
                east:   new AABBSideParams(c, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        );

        if(draw_bottom) {
            // Push vertices down
            const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
            pushAABB(
                vertices,
                aabb_down,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                    down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_down, 0, 1, null, null, true),
                },
                new Vector(x, y, z)
            );
        }

        const text_block = style.makeTextBlock(block, aabb, pivot, matrix, x, y, z)
        if(text_block) {
            return [text_block]
        }

        return null;

    }

    //
    static makeAABBSign(tblock, x, y, z) {

        const draw_bottom = tblock.rotate ? (tblock.rotate.y != 0) : true

        const aabb = new AABB(
            x + .5 - CONNECT_X / 2,
            y + .6,
            z + .5 - CONNECT_Z / 2,
            x + .5 + CONNECT_X / 2,
            y + .6 + CONNECT_HEIGHT,
            z + .5 + CONNECT_Z / 2,
        )

        if(!draw_bottom) {
            aabb.translate(0, -(.2 + aabb.height) / 2, .5 - aabb.depth / 2)
        }

        return aabb

    }

    //
    static makeTextBlock(tblock, aabb, pivot, matrix, x, y, z) {
        // Return text block
        if(tblock.extra_data) {
            let text = tblock.extra_data?.text;
            if(text) {
                const sign = [];
                if(tblock.extra_data.username) sign.push(tblock.extra_data.username);
                if(tblock.extra_data.dt) sign.push(new Date(tblock.extra_data.dt || Date.now()).toISOString().slice(0, 10));
                return new FakeTBlock(
                    BLOCK.TEXT.id,
                    {
                        ...tblock.extra_data,
                        aabb: aabb,
                        chars: AlphabetTexture.getStringUVs(text),
                        sign: sign.length > 0 ? AlphabetTexture.getStringUVs(sign.join(' | ')) : null
                    },
                    new Vector(x, y, z),
                    tblock.rotate,
                    pivot,
                    matrix
                );
            }
        }
        return null
    }

}