import {DIRECTION, AlphabetTexture} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4}            = glMatrix;

// Табличка
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['text'],
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

        return [aabb];

    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        // Textures
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);

        pivot = [0, 0, 0];

        // we can use mat4 now
        matrix = mat4.create();
        mat4.scale(matrix, matrix, [1, 1, 1]);
        // mat4.rotateY(matrix, matrix, Math.random() * 2 * Math.PI);

        let width = 1;
        let height = 1;
        let depth = 1;

        let aabb = new AABB();
        aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - height/2,
            x + .5 + width/2,
            y + depth,
            z + .5 + height/2,
        );

        console.log('text extra data', block.extra_data);

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
            }
        );

        return null;

    }

}