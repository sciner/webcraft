import {DIRECTION, AlphabetTexture, Vector, QUAD_FLAGS} from '../helpers.js';
import {BLOCK, FakeTBlock} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import {CubeSym} from "../core/CubeSym.js";

const {mat4} = glMatrix;

const CLOTH_X           = 14 / 16;
const CLOTH_Z           = 4.5 / 32;
const CLOTH_HEIGHT      = 12 / 16;

const UV_MUL = {
    up: [-1, -1],
    down: [-1, 1],
    south: [1, 1],
    north: [1, -1],
    west: [-1, -1],
    east: [1, 1],
}

const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

// Баннер
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['banner'],
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
        const rotate    = block.rotate || Vector.ZERO;

        const on_wall = (block.extra_data?.on_wall || rotate.y == 0) || false;
 
        // Center
        if(on_wall) {
            const mul = 1.01;
            aabb = new AABB();
            aabb.set(
                x + .5 - CLOTH_X*mul/2,
                y + .6,
                z + .5 - CLOTH_Z*mul/2,
                x + .5 + CLOTH_X*mul/2,
                y + .6 + CLOTH_HEIGHT*mul,
                z + .5 + CLOTH_Z*mul/2,
            );
            const dist = -(.5 - aabb.depth / 2);
            const dir = CubeSym.dirAdd(rotate.x, CubeSym.ROT_Y2);
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

        //
        const material = block.material;
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const rotate = block.rotate || Vector.ZERO.clone();
        const on_wall = (block.extra_data?.on_wall || rotate.y == 0) || false;

        c[0] -= .5 / 32;
        c[1] -= .5 / 32;

        if(rotate.y == 0) {
            y -= 1;
        }

        const shift_clotch = (1/20) * (y%2);

        const parts = {
            stem: {
                origin: {x: 0, y: 0, z: 0},
                size: {x: 3, y: 57, z: 3},
                faces: {
                    up:     {x: 94, y: 2, w: 4, h: 4},
                    down:   {x: 98, y: 2, w: 4, h: 4},
                    south:  {x: 102, y: 46, w: 4, h: 84},
                    north:  {x: 94, y: 46, w: 4, h: 84},
                    west:   {x: 98, y: 46, w: 4, h: 84},
                    east:   {x: 90, y: 46, w: 4, h: 84}
                }
            },
            girder: {
                origin: {x: 0, y: 57, z: 0},
                size: {x: 28, y: 3, z: 3},
                faces: {
                    up:     {x: 24, y: 86, w: 40, h: 2},
                    down:   {x: 64, y: 86, w: 40, h: 2},
                    south:  {x: 68, y: 90, w: 40, h: 4},
                    north:  {x: 24, y: 90, w: 40, h: 4},
                    west:   {x: 46, y: 90, w: 4, h: 4},
                    east:   {x: 2, y: 90, w: 4, h: 4}
                }
            },
            cloth: {
                origin: {x: shift_clotch, y: 4, z: -2.25 + shift_clotch},
                size: {x: 28, y: 56, z: 1.5},
                lm: material.mask_color,
                flag: QUAD_FLAGS.MASK_BIOME,
                faces: {
                    up:     {x: 22, y: 1, w: 40, h: 2},
                    down:   {x: 62, y: 1, w: 40, h: 2},
                    south:  {x: 64, y: 42, w: 40, h: 80},
                    north:  {x: 22, y: 42, w: 40, h: -80},
                    west:   {x: 43, y: 42, w: 2, h: 80},
                    east:   {x: 1, y: 42, w: 2, h: 80}
                }
            }
        };

        const trans     = new Vector(0, 0, 0);
        const rot       = new Vector(0, 0, 0);
        const center    = new Vector(x, y, z);
        const pos       = new Vector(x + .5, y, z + .5);

        if(block.rotate) {
            // check if on wall
            if(on_wall) {
                parts.stem.visible = false;
                rot.y = ((block.rotate.x - 2) / 4) * -(Math.PI * 2);
                trans.set(0, 0, 14.5)
            } else {
                rot.y = ((block.rotate.x - 2) / 4) * (Math.PI * 2);
            }
        }

        // Draw parts
        style.drawParts(parts, pos, center, c, trans, rot, vertices, pivot);

        /*
        // Return text block
        if(block.rotate) {
            const text = ''; // block.extra_data.color;
            return [new FakeTBlock(
                BLOCK.TEXT.id,
                {
                    ...block.extra_data,
                    aabb: parts.cloth.aabb,
                    chars: AlphabetTexture.getStringUVs(text),
                    sign: AlphabetTexture.getStringUVs('#banner')
                },
                new Vector(x, y, z),
                rotate,
                pivot,
                parts.cloth.matrix
            )];
        }
        */

        return null;

    }

    // Draw parts
    static drawParts(parts, pos, center, c, trans, rot, vertices, pivot) {

        const matrix = mat4.create();
        if(rot) {
            mat4.rotateY(matrix, matrix, rot.y);
        }
        if(trans) {
            trans.divScalar(32);
        }

        for(let k in parts) {
            const part = parts[k];
            const aabb = new AABB();
            part.origin = new Vector(part.origin).divScalar(32);
            part.size = new Vector(part.size).divScalar(32);
            aabb.set(
                pos.x - part.size.x / 2,
                pos.y,
                pos.z - part.size.z / 2,
                pos.x + part.size.x / 2,
                pos.y + part.size.y,
                pos.z + part.size.z / 2,
            );
            aabb.translate(part.origin.x, part.origin.y, part.origin.z);
            if(trans) {
                aabb.translate(trans.x, trans.y, trans.z);
            }
            part.aabb = aabb;
            part.matrix = matrix;
            if('visible' in part && !part.visible) {
                continue;
            }
            const faces = {};
            for(let fk in part.faces) {
                const face = part.faces[fk];
                const flag = (face.flag || part.flag || 0);
                const lm = (face.lm || part.lm || null);
                const anims = (face.anims || part.anims || lm?.b || 0);
                faces[fk] = new AABBSideParams([c[0] + face.x/1024, c[1] + face.y/1024, face.w/1024, face.h/1024], flag, anims, lm, null, false);
                faces[fk].uv[2] *= UV_MUL[fk][0];
                faces[fk].uv[3] *= UV_MUL[fk][1];
            }
            pushAABB(vertices, aabb, pivot, matrix, faces, center);
        }
    }

}