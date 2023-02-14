import {DIRECTION, IndexedColor, Vector } from '../helpers.js';
import {pushSym} from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

// Лестница
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['ladder'],
            aabb: style.computeAABB,
            func: this.func
        };
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const cardinal_direction = tblock.getCardinalDirection()
        const width = 3 / 15.9
        return [
            new AABB(0, 0, 0, 1, 1, width).rotate(cardinal_direction, Vector.SHAPE_PIVOT)
        ]
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const cardinal_direction = block.getCardinalDirection();

        let texture     = block.material.texture;
        let bH          = 1.0;
        let width       = block.material.width ? block.material.width : 1;
        let lm          = IndexedColor.WHITE;
        let c           = null;
        let flags       = 0;

        // Texture color multiplier
        c = style.block_manager.calcTexture(texture, DIRECTION.BACK);
        let pp = IndexedColor.packLm(lm);

        pushSym(vertices, cardinal_direction,
            x + .5, z + .5, y + .5,
            0, width - .5, bH / 2 - .5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            pp, flags);
    }

}