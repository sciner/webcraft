import {AlphabetTexture, Vector} from '../helpers.js';
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';

// Табличка
export default class style {

    static _aabb = new AABB();
    static _aabbc = new AABB();
    static _center = new Vector(0, 0, 0);
    static _padding = new Vector(0, 0, 0);

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['text'],
            func: this.func
        };
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, unknown, matrix, pivot, force_tex) {

        if(!block.extra_data || !block.extra_data.aabb) {
            return;
        }

        const aabb                  = style._aabb;
        const aabbc                 = style._aabbc;
        const center                = style._center.set(x, y, z);
        aabb.copyFrom(block.extra_data.aabb).pad(.1 / 16);

        const LETTER_W              = (aabb.width / 8) * .7;
        const LETTER_H              = (aabb.height / 4) * .7;
        const LETTER_SPACING_MUL    = .5;
        const PADDING               = style._padding.set(LETTER_W / 4, -LETTER_H / 4, 0);
        const char_size             = AlphabetTexture.char_size_norm;

        // Letter position
        let cx                      = 0;
        let cy                      = 0;

        function wrap() {
            cx = 0;
            cy++;
        }

        // Each over all text chars
        for(let char of block.extra_data.chars) {
            if(char.char == "\r") {
                wrap();
                continue;
            }
            // Letter texture
            let c = [
                char.xn + char_size.width / 2,
                char.yn + char_size.height / 2,
                char_size.width,
                char_size.height
            ];
            // Letter position
            aabbc.copyFrom(aabb);
            aabbc.x_min += (cx * LETTER_W) * LETTER_SPACING_MUL;
            aabbc.x_max = aabbc.x_min + LETTER_W;
            aabbc.y_min = aabbc.y_max - (cy+1) * LETTER_H;
            aabbc.y_max = aabbc.y_min + LETTER_H;
            aabbc.translate(PADDING.x, PADDING.y, PADDING.z);
            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    south:  new AABBSideParams(c, 0, 1)
                },
                false,
                center
            );
            cx++;
        }

        // Draw signature and date on backside
        cx = 0;
        cy = 8;
        const sign = block.extra_data.sign;
        const SCALE_SIGN = 2;
        for(let i in sign) {
            const char = sign[sign.length - 1 - i];
            if(char.char == "\r") {
                wrap();
                continue;
            }
            // Letter texture
            let c = [
                char.xn + char_size.width / 2,
                char.yn + char_size.height / 2,
                -char_size.width,
                -char_size.height
            ];
            // Letter position
            aabbc.copyFrom(aabb);
            aabbc.x_min += (cx * LETTER_W) * (LETTER_SPACING_MUL / SCALE_SIGN);
            aabbc.x_max = aabbc.x_min + LETTER_W / SCALE_SIGN;
            aabbc.y_min = aabbc.y_max - (cy+1) * LETTER_H / SCALE_SIGN;
            aabbc.y_max = aabbc.y_min + LETTER_H / SCALE_SIGN;
            aabbc.translate(PADDING.x, PADDING.y, PADDING.z);
            // Push letter vertices
            pushAABB(
                vertices,
                aabbc,
                pivot,
                matrix,
                {
                    north:  new AABBSideParams(c, 0, 1)
                },
                false,
                center
            );
            cx++;
        }

        return null;

    }

}