import { DIRECTION, IndexedColor } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB, PLANES } from '../core/AABB.js';

// кактус
export default class style {

    static getRegInfo() {
        return {
            styles: ['cactus'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(1/16, 0, 1/16, 15/16, 1, 15/16);
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const texture = block.material.texture;
        const tex_up = BLOCK.calcTexture(texture, DIRECTION.UP);
        const tex_down = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const tex_side = BLOCK.calcTexture(texture, DIRECTION.WEST);
        const flags = 0;
        const lm = IndexedColor.WHITE;
        const pp = lm.pack();

        const w = block.material.width;
        const w2 = w / 2;

        x += (1 - w) / 2;
        z += (1 - w) / 2;

        // UP
        vertices.push(x + w2, z + w2, y + 1, ...PLANES.up.axes[0], ...PLANES.up.axes[1], tex_up[0], tex_up[1], tex_up[2], tex_up[3], lm.pack(), flags);
        // DOWN
        vertices.push(x + w2, z + w2, y, ...PLANES.down.axes[0], ...PLANES.down.axes[1], tex_down[0], tex_down[1], tex_down[2], tex_down[3], lm.pack(), flags);
        // SOUTH
        vertices.push(x + w2, z, y + .5, ...PLANES.south.axes[0], ...PLANES.south.axes[1], tex_side[0], tex_side[1], tex_side[2], tex_side[3], pp, flags);        
        // NORTH
        vertices.push(x + w2, z + w, y + .5, ...PLANES.north.axes[0], ...PLANES.north.axes[1], tex_side[0], tex_side[1], tex_side[2], tex_side[3], pp, flags);
        // EAST
        vertices.push(x + w, z + w2, y + .5, ...PLANES.east.axes[0], ...PLANES.east.axes[1], tex_side[0], tex_side[1], tex_side[2], tex_side[3], pp, flags);
        // WEST
        vertices.push(x, z + w2, y + .5, ...PLANES.west.axes[0], ...PLANES.west.axes[1], tex_side[0], tex_side[1], tex_side[2], tex_side[3], pp, flags);
        
    }
}