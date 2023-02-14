import { DIRECTION, Vector} from '../helpers.js';
import { AABB, AABBSideParams, pushAABB } from '../core/AABB.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';


// кактус
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['cactus'],
            this.func,
            this.computeAABB
        )
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB()
        aabb.set(1/16, 0, 1/16, 15/16, 1, 15/16);
        return [aabb]
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(typeof block == 'undefined') {
            return
        }

        const bm = style.block_manager

        const texture = block.material.texture;
        const tex_up = bm.calcTexture(texture, DIRECTION.UP);
        const tex_down = bm.calcTexture(texture, DIRECTION.DOWN);
        const tex_side = bm.calcTexture(texture, DIRECTION.WEST);
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