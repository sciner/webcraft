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

function pushAABB(vertices, aabb, pivot, matrix, cc) {

    let lm          = MULTIPLY.COLOR.WHITE;
    let flags       = 0;
    let upFlags     = 0;
    let sideFlags   = 0;

    let x = aabb.x_min + aabb.width / 2
    let y = aabb.y_min + aabb.height / 2
    let z = aabb.z_min + aabb.depth / 2

    const TX_CNT = 32;

    // pivot = defaultPivot;
    // matrix = defaultMatrix;

    // up
    let animations_up = 1;
    let vector_up = [aabb.width, 0, 0, 0, aabb.depth, 0]; // vectors.up
    pushTransformed(
        vertices, matrix, pivot,
        x, z, aabb.y_max,
        0, 0, 0,
        ...vector_up,
        cc.up[0], cc.up[1], -aabb.width/32, aabb.depth/32,
        lm.r, lm.g, animations_up, flags | upFlags
    );

    // down
    let animations_down = 1;
    let vector_down = [aabb.width, 0, 0, 0, -aabb.depth, 0]; // vectors.up
    pushTransformed(
        vertices, matrix, pivot,
        x, z, aabb.y_min,
        0, 0, 0,
        ...vector_down,
        cc.up[0], cc.up[1], -aabb.width/32, aabb.depth/32,
        lm.r, lm.g, animations_down, flags | upFlags
    );

    // south
    let animations_south = 1;
    let vector_south = [aabb.width, 0, 0, 0, 0, aabb.height];
    pushTransformed(
        vertices, matrix, pivot,
        x, z, y,
        0, -aabb.depth/2, 0,
        ...vector_south,
        cc.south[0], cc.south[1], aabb.width/TX_CNT, -aabb.height/TX_CNT,
        lm.r, lm.g, animations_south, flags | sideFlags
    );

    // north
    let animations_north = 1;
    let vector_north = [aabb.width, 0, 0, 0, 0, -aabb.height];
    pushTransformed(
        vertices, matrix, pivot,
        x, z, y,
        0, aabb.depth/2, 0,
        ...vector_north,
        cc.north[0], cc.north[1], -aabb.width/TX_CNT, aabb.height/TX_CNT,
        lm.r, lm.g, animations_north, flags | sideFlags);

    // west
    let animations_west = 1;
    let vector_west = [0, aabb.depth, 0, 0, 0, -aabb.height];
    pushTransformed(
        vertices, matrix, pivot,
        x-aabb.width/2, z, y,
        0, 0, 0,
        ...vector_west,
        cc.west[0], cc.west[1], -aabb.depth/TX_CNT, aabb.height/TX_CNT,
        lm.r, lm.g, animations_west, flags | sideFlags
    );

    // east
    let animations_east = 1;
    let vectors_east = [0, aabb.depth, 0, 0, 0, aabb.height];
    pushTransformed(
        vertices, matrix, pivot,
        x + aabb.width/2, z, y,
        0, 0, 0,
        ...vectors_east,
        cc.west[0], cc.west[1], -aabb.depth/TX_CNT, aabb.height/TX_CNT,
        lm.r, lm.g, animations_east, flags | sideFlags
    );

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

        // Calc matrices
        const scale = new Vector(1.5, 1.5, 1.5);
        // const scale = new Vector(1, 1, 1);
        matrix = mat3.create();
        // mat4.identity(matrix);
        // mat4.translate(matrix, matrix, 0, 0, 0);
        // mat4.rotate(matrix, matrix, Math.PI, [1, 1, 1]);
        mat4.scale(matrix, matrix, scale.toArray());

        //
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up: c,
                down: c,
                south: c,
                north: c,
                west: c,
                east: c
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