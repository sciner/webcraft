import {DIRECTION, MULTIPLY, ROTATE} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { AABB } from '../core/AABB.js';
import {pushTransformed} from './cube.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat3, mat4} = glMatrix;

// const {mat4} = glMatrix;
// const {mat3, mat4} = glMatrix;

const aabb = new AABB();
const defaultPivot = [0.5, 0.5, 0.5];
const defaultMatrix = mat3.create();

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 16 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const CONNECT_BOTTOM    = 9 / 16;

/**
 * Multiple arrays between by minimal lenght
 * @param {number[]} a
 * @param {number[]} b
 * @param {number[]} out
 */
const perMul = (a, b, out = []) => {
    const m = Math.min(a.length, b.length);

    for(let i = 0; i < m; i ++) {
        out[i] = a[i] * b[i];
    }

    return out;
}

/**
 * Dot arrays
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns 
 */
const perDot = (a, b) => {
    const m = Math.min(a.length, b.length);

    let out = 0;

    for(let i = 0; i < m; i ++) {
        out += a[i] * b[i];
    }

    return out;
}

const PLANES = {
    up: {
        // axisX , axisY. axisY is flips sign!
        axes  : [[1, 0, 0], /**/ [0, 1, 0]],
        // origin offset realtive center
        offset : [0, 0, 0.5],
    },
    down: {
        axes  : [[1, 0, 0], /**/ [0, -1, 0]],
        offset: [0, 0, -0.5],
    },
    south: {
        axes  : [[1, 0, 0], /**/ [0, 0, 1]],
        offset: [0, -0.5, 0],
    },
    north: {
        axes  : [[1, 0, 0], /**/ [0, 0, -1]],
        offset: [0, 0.5, 0],
    },
    east: {
        axes  : [[0, 1, 0], /**/ [0, 0, 1]],
        offset: [0.5, 0, 0],
    },
    west: {
        axes  : [[0, 1, 0], /**/ [0, 0, -1]],
        offset: [-0.5, 0, 0],
    }
}

function pushAABB(vertices, aabb, pivot, matrix, sides) {

    let lm          = MULTIPLY.COLOR.WHITE;
    let globalFlags       = 0;

    let x = aabb.x_min + aabb.width / 2
    let y = aabb.y_min + aabb.height / 2
    let z = aabb.z_min + aabb.depth / 2

    const size = [
        aabb.width,
        aabb.depth,
        aabb.height
    ];

    const tmp3 = [];

    for(const key in PLANES) {
        const {
            axes, offset,
        } = PLANES[key];

        const {
            uv, flag = 0, anim = 1
        } = sides[key];

        const uvSize0 = -perDot(axes[0], size) * Math.abs(uv[2]);
        const uvSize1 = -perDot(axes[1], size) * Math.abs(uv[3]);

        pushTransformed(
            vertices, matrix, pivot,
            // center
            x, z, y,
            // offset
            ...perMul(size, offset, tmp3),
            // axisx
            ...perMul(size, axes[0], tmp3),
            //axisY
            ...perMul(size, axes[1], tmp3),
            // UV center
            uv[0], uv[1],
            // UV size
            uvSize0, uvSize1,
            // tint location
            lm.r, lm.g,
            // animation
            anim,
            // flags
            globalFlags | flag
        );           
    }
}

// Забор
export default class style {

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
        let hw = 1 / 4;
        let sign_height = 1;
        if(block.rotate && block.rotate.y == 0) {

            let z_plus = 0;
            let bottom = CONNECT_BOTTOM;
            if(block.rotate.y == 0) {
                bottom = .5 - CONNECT_HEIGHT / 2;
                z_plus = .5;
            }

            const CON_MUL = 1.1;
            const CON_MUL_Z = 1.3;

            let x = 0;
            let y = 0;
            let z = 0;

            let xs = 0;
            let ys = CONNECT_HEIGHT * CON_MUL;
            let zs = 0;

            // South
            if(block.rotate.x == ROTATE.S) {
                x += .5;
                y =+ bottom;
                z += .5 - CONNECT_Z/2 + z_plus;
                xs = CONNECT_X * CON_MUL;
                zs = CONNECT_Z * CON_MUL_Z;
            }

            // North
            if(block.rotate.x == ROTATE.N) {
                x += .5;
                y += bottom;
                z += .5 + CONNECT_Z/2 - z_plus;
                xs = CONNECT_X * CON_MUL;
                zs = CONNECT_Z * CON_MUL_Z;
            }

            // West
            if(block.rotate.x == ROTATE.W) {
                x += .5 - CONNECT_Z/2 + z_plus;
                y += bottom;
                z += .5;
                xs = CONNECT_Z * CON_MUL_Z;
                zs = CONNECT_X * CON_MUL;
            }

            // East
            if(block.rotate.x == ROTATE.E) {
                x += .5 + CONNECT_Z/2 - z_plus;
                y += bottom;
                z += .5;
                xs = CONNECT_Z * CON_MUL_Z;
                zs = CONNECT_X * CON_MUL;
            }

            aabb.set(x - xs/2, y, z-zs/2, x + xs/2, y + ys, z + zs/2);
        } else {
            aabb.set(
                .5-hw, 0, .5-hw,
                .5+hw, sign_height, .5+hw
            );
        }
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Texture
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        let aabb = new AABB();
        aabb.set(
            x + .5 - CONNECT_X/2,
            y + .6,
            z + .5 - CONNECT_Z/2,
            x + .5 + CONNECT_X/2,
            y + .6 + CONNECT_HEIGHT,
            z + .5 + CONNECT_Z/2,
        );

        pivot = [0, 0, 0];

        // we can use mat4 now
        matrix = mat4.create();

        mat4.scale(matrix, matrix, [0.5, 0.5, 0.5]);

        mat4.rotateY(matrix, matrix, Math.PI / 3);

        //
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up   : { uv: c, flag: 0, anim: 1 }, // flag: 0, anim: 1 implicit 
                down : { uv: c, flag: 0, anim: 1 },
                south: { uv: c, flag: 0, anim: 1 },
                north: { uv: c, flag: 0, anim: 1 },
                west : { uv: c, flag: 0, anim: 1 },
                east : { uv: c, flag: 0, anim: 1 },
            }
        );

        // Center
        //if(block.rotate.y != 0) {
        push_part(vertices, c_down, x + .5, y, z + .5, CENTER_WIDTH, CENTER_WIDTH, 1);
        //}

    }

}

function push_part(vertices, c, x, y, z, xs, zs, h) {
    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        lm.r, lm.g, lm.b, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        lm.r, lm.g, lm.b, flags | sideFlags);
}