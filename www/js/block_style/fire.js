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
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        
        const texture = BLOCK.calcTexture(BLOCK.CAMPFIRE.texture, DIRECTION.UP);
        
        const planes = [];
        planes.push(...[
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 0}},
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 0, "y": 0, "z": 0}},
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 8, "y": 0, "z": 0}},
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": -8, "y": 0, "z": 0}},
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 8, "y": 0, "z": 0}},
            {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": -8, "y": 0, "z": 0}},
        ]);
        
        const flag = QUAD_FLAGS.FLAG_ANIMATED | QUAD_FLAGS.NO_AO;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        lm.b = 16;//BLOCK.getAnimations({"material": BLOCK.CAMPFIRE.texture_animations}, 'up');
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