import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { BLOCK } from '../blocks.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';

const {mat4} = glMatrix;

// fire
export default class style {
    [key: string]: any;

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['fire'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
        const shapes = []
        if(for_physic) {
            return shapes
        }
        if(block.extra_data) {
            if (block.extra_data.north) {
                shapes.push(new AABB(0, 0, 0.94, 1, 1, 1))
            }
            if (block.extra_data.south) {
                shapes.push(new AABB(0, 0, 0, 1, 1, 0.06))
            }
            if (block.extra_data.west) {
                shapes.push(new AABB(0, 0, 0, 0.06, 1, 1))
            }
            if (block.extra_data.east) {
                shapes.push(new AABB(0.94, 0, 0, 1, 1, 1))
            }
            if (block.extra_data.up) {
                shapes.push(new AABB(0, 0, 0, 1, 0.06, 1))
            }
        }
        return shapes
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const extra_data = block.extra_data;
        const material = block.material;
        const texture = BLOCK.calcTexture(material.texture, DIRECTION.WEST);
        const planes = [];
        if (extra_data) {
            if (extra_data.up) {
                planes.push(...[
                    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI, 0], "translate": {"x": 7.99, "y": 0, "z": 0}},
                    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 7.99, "y": 0, "z": 0}},
                    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}},
                    {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}},
                    {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
                    {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, -Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}},
                    {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [-Math.PI / 2, Math.PI / 4, -Math.PI / 2], "translate": {"x": 0, "y": 0, "z": 0}},
                    {"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [Math.PI / 2, Math.PI / 4, Math.PI / 2], "translate": {"x": 0, "y": 0, "z": 0}},
                ]);
                if(typeof worker != 'undefined') {
                    worker.postMessage(['add_animated_block', {
                        block_pos: block.posworld,
                        pos: [block.posworld.add(new Vector(.5, .5, .5))],
                        type: 'campfire_flame'
                    }]);
                }
            } else {

                if (extra_data.west) {
                    planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}]);
                }
                if (extra_data.east) {
                    planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}]);
                }
                if (extra_data.south) {
                    planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}]);
                }
                if (extra_data.north) {
                    planes.push(...[{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}]);
                }
            }
        }
        const flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.FLAG_ANIMATED;
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE.clone();
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