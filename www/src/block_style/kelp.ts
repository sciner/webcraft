import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';

// kelp
export default class style {
    [key: string]: any;

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['kelp'],
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

        const extra_data = block.extra_data;
        const material = block.material;
        const texture = BLOCK.calcTexture(material.texture, (neighbours.UP.id == block.id) ? DIRECTION.WEST : DIRECTION.UP);
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 4, 0]},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 4, 0]}
        ]);
        const flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.FLAG_ANIMATED;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        lm.b = BLOCK.getAnimations(material, (neighbours.UP.id == block.id) ? "west" : "up");
        for(const plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...texture]
            });
        }
    }

}