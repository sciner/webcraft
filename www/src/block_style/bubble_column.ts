import { AABB } from '../core/AABB.js';

export default class style {
    [key: string]: any;

    static getRegInfo() {
        return {
            styles: ['bubble_column'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
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