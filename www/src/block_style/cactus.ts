import { DIRECTION, IndexedColor , Vector} from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { default as default_style } from './default.js';
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';

// кактус
export default class style {
    [key: string]: any;

    static getRegInfo() {
        return {
            styles: ['cactus'],
            func: this.func,
            aabb: this.computeAABB
        }
    }

    static computeAABB(block, for_physic) {
        const aabb = new AABB()
        aabb.set(1/16, 0, 1/16, 15/16, 1, 15/16);
        return [aabb]
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return
        }

        const texture = block.material.texture;
        const tex_up = BLOCK.calcTexture(texture, DIRECTION.UP);
        const tex_down = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const tex_side = BLOCK.calcTexture(texture, DIRECTION.WEST);
        const pos = new Vector(x, y, z)
        const aabb = new AABB();
        aabb.set(
            x + 1 / 16,
            y,
            z + 1 / 16,
            x + 15 / 16,
            y + 1,
            z + 15 / 16
        )
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(tex_up, 0, 1, null, null, true),
                down:   new AABBSideParams(tex_down, 0, 1, null, null, true),
                south:  new AABBSideParams(tex_side, 0, 1, null, null, true),
                north:  new AABBSideParams(tex_side, 0, 1, null, null, true),
                west:   new AABBSideParams(tex_side, 0, 1, null, null, true),
                east:   new AABBSideParams(tex_side, 0, 1, null, null, true),
            },
            pos
        )
    }
}