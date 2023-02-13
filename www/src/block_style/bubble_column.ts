import type { BlockManager } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import type { TBlock } from '../typed_blocks3.js';

export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['bubble_column'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        // Add animations
        if(typeof worker != 'undefined') {
            worker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: [block.posworld.add(new Vector(.5, .5, .5))],
                type: 'bubble_column',
                isBottom: false
            }]);
        }
    }
}