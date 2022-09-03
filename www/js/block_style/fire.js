import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';

const {mat4} = glMatrix;

// fire
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['fire'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(block, for_physic) {
        if (for_physic) {
            return [];
        }
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 0.06, 1);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const extra_data = block.extra_data;
        const material = block.material;
        const texture = BLOCK.calcTexture(material.texture, DIRECTION.WEST);
        const planes = [];
        if (neighbours.WEST.id != BLOCK.AIR.id || neighbours.DOWN.id != BLOCK.AIR.id) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": -7.99, "y": 0, "z": 0}} ]);
        }
        if (neighbours.EAST.id != BLOCK.AIR.id || neighbours.DOWN.id != BLOCK.AIR.id) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 7.99, "y": 0, "z": 0}} ]);
        }
        if (neighbours.NORTH.id != BLOCK.AIR.id || neighbours.DOWN.id != BLOCK.AIR.id) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}} ]);
        }
        if (neighbours.SOUTH.id != BLOCK.AIR.id || neighbours.DOWN.id != BLOCK.AIR.id) {
            planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": -7.99, "y": 0, "z": 0}} ]);
        }
        if (neighbours.DOWN.id != BLOCK.AIR.id) {
            planes.push(...[
                {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
                {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
                {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
                {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 2, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
            ]);
        }
        const flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.FLAG_ANIMATED;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        lm.b = BLOCK.getAnimations(material, "west");
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