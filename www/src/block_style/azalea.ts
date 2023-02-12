import {DIRECTION, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

const w = 1;
const h = 1;

const WIDTH_INNER = 4/16;

// Azalea
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['azalea'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic) {
        let y = 0;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - w / 2,
            y + .5,
            0 + .5 - w / 2,
            0 + .5 + w / 2,
            y + 1,
            0 + .5 + w / 2,
        );
        let aabb2 = new AABB();
        aabb2.set(
            0 + .5 - WIDTH_INNER / 2,
            y + 0,
            0 + .5 - WIDTH_INNER / 2,
            0 + .5 + WIDTH_INNER / 2,
            y + .5,
            0 + .5 + WIDTH_INNER / 2,
        );
        return [aabb, aabb2];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const c_up = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.NORTH);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);

        const chains = [];
        chains.push({width: w, height: h, uv: [.5, .5], rot: Math.PI / 4, y: 0, translate: [0, 0, -w/2]});
        chains.push({width: w, height: h, uv: [.5, .5], rot: -Math.PI / 4, y: 0, translate: [0, 0, -w/2]});

        const CHAIN_Y = y;

        for(let chain of chains) {
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
                {north:  new AABBSideParams(c_down, 0, 1, null, null, true)},
                new Vector(x, y, z)
            );
        }

        //
        matrix = mat4.create();

        const aabb_up = new AABB();
        aabb_up.set(
            x,
            y,
            z,
            x + 1,
            y + 1,
            z + 1
        );

        // Push vertices down
        pushAABB(
            vertices,
            aabb_up,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_up, 0, 1, null, null, true),
                south:  new AABBSideParams(c_side, 0, 1, null, null, true),
                north:  new AABBSideParams(c_side, 0, 1, null, null, true),
                west:   new AABBSideParams(c_side, 0, 1, null, null, true),
                east:   new AABBSideParams(c_side, 0, 1, null, null, true),
            },
            new Vector(x, y, z)
        );

        return null;

    }

}