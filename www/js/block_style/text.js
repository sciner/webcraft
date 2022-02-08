import {DIRECTION, AlphabetTexture} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

// Табличка
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['text'],
            func: this.func
        };
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        // Textures
        // const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);

        let width = 1;
        let height = 1;
        let depth = 1;

        let aabb = new AABB();
        if(block.extra_data && block.extra_data.aabb) {
            aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16);
        } else {
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - height/2,
                x + .5 + width/2,
                y + depth,
                z + .5 + height/2,
            );
        }

        const c_empty = [0, 0, 0, 0]; // 100/1024, 100/1024, 2/1024, 2/1024];

        /*
        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c_empty, 0, 1), // flag: 0, anim: 1 implicit 
                down:   new AABBSideParams(c_empty, 0, 1),
                south:  new AABBSideParams(c_empty, 0, 1),
                north:  new AABBSideParams(c_empty, 0, 1),
                west:   new AABBSideParams(c_empty, 0, 1),
                east:   new AABBSideParams(c_empty, 0, 1),
            },
            true
        );*/

        const LETTER_W = (aabb.width / 8) * .7;
        const LETTER_H = (aabb.height / 4) * .7;
        const MAX_CHARS_PER_LINE = 22;
        const LETTER_SPACING_MUL = .5;
        const PADDING = new Vector(
            LETTER_W / 2,
            -LETTER_H / 2,
            0
        );
        let cx = 0;
        let cy = 0;
        let aabbc = new AABB();
        const char_size = {width: 32/1024,height: 32/1024};
        function wrap() {
            cy++;
            cx = 0;
        };
        for(let char of block.extra_data.chars) {
            let c = [
                char.xn + char_size.width / 2,
                char.yn + char_size.height / 2,
                char_size.width,
                char_size.height
            ];
            aabbc.copyFrom(aabb);
            aabbc.x_min += (cx * LETTER_W) * LETTER_SPACING_MUL;
            aabbc.x_max = aabbc.x_min + LETTER_W;
            aabbc.y_min = aabbc.y_max - (cy+1) * LETTER_H;
            aabbc.y_max = aabbc.y_min + LETTER_H;
            aabbc.translate(PADDING.x, PADDING.y, PADDING.z);
            // Push vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_empty, 0, 1), // flag: 0, anim: 1 implicit 
                    down:   new AABBSideParams(c_empty, 0, 1),
                    south:  new AABBSideParams(c, 0, 1),
                    north:  new AABBSideParams(c_empty, 0, 1),
                    west:   new AABBSideParams(c_empty, 0, 1),
                    east:   new AABBSideParams(c_empty, 0, 1),
                }
            );
            if(++cx == MAX_CHARS_PER_LINE || char.char == ' ' && cx > MAX_CHARS_PER_LINE * .8) {
                wrap();
            }
        }

        return null;

    }

}