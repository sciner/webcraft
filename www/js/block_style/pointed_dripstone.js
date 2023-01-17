import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';
import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { default as default_style } from './default.js';
import { BLOCK } from '../blocks.js';

// pointed_dripstone
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['pointed_dripstone'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        const aabb = new AABB();
        aabb.set(0.25, 0, 0.25, 0.75, 1, 0.75);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const extra_data = block.extra_data;
        const material = block.material;
        const texture = BLOCK.calcTexture(material.texture, DIRECTION.WEST);//getTexture(material, extra_data, neighbours);
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [block.extra_data?.up ? 0 : Math.PI, block.extra_data?.up ? Math.PI / 4 : Math.PI * 5 / 4, 0]},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [block.extra_data?.up ? 0 : Math.PI, block.extra_data?.up ? -Math.PI / 4 : Math.PI * 3 / 4, 0]}
        ]);
        const flag = 0;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for (const plane of planes) {
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