import {DIRECTION, MULTIPLY, ROTATE} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { AABB } from '../core/AABB.js';
// import {pushTransformed} from './cube.js';

// const {mat4} = glMatrix;
// const {mat3, mat4} = glMatrix;

const aabb = new AABB();

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 16 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const CONNECT_BOTTOM    = 9 / 16;

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
        if(block.rotate.y == 0) {

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

        let z_plus = 0;
        let bottom = CONNECT_BOTTOM;
        if(block.rotate.y == 0) {
            bottom = .5 - CONNECT_HEIGHT / 2;
            z_plus = .5;
        }

        // push_part(vertices, c, x + .5, y + bottom, z + .5, CONNECT_X, CONNECT_Z, CONNECT_HEIGHT);

        // South
        if(block.rotate.x == ROTATE.S) {
            push_part(vertices, c, x + .5, y + bottom, z + .5 - CONNECT_Z/2 + z_plus, CONNECT_X, CONNECT_Z, CONNECT_HEIGHT);
        }

        // North
        if(block.rotate.x == ROTATE.N) {
            push_part(vertices, c, x + .5, y + bottom, z + .5 + CONNECT_Z/2 - z_plus, CONNECT_X, CONNECT_Z, CONNECT_HEIGHT);
        }

        // West
        if(block.rotate.x == ROTATE.W) {
            push_part(vertices, c, x + .5 - CONNECT_Z/2 + z_plus, y + bottom, z + .5, CONNECT_Z, CONNECT_X, CONNECT_HEIGHT);
        }

        // East
        if(block.rotate.x == ROTATE.E) {
            push_part(vertices, c, x + .5 + CONNECT_Z/2 - z_plus, y + bottom, z + .5, CONNECT_Z, CONNECT_X, CONNECT_HEIGHT);
        }

        // Center
        if(block.rotate.y != 0) {
            push_part(vertices, c_down, x + .5, y, z + .5, CENTER_WIDTH, CENTER_WIDTH, 1);
        }

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