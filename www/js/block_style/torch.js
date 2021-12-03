import { default as cube_style } from './cube.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import { ROTATE } from '../helpers.js';

const {mat3, mat4, quat, vec3} = glMatrix;

const cube_func = cube_style.getRegInfo().func;
const rotateTorch = mat3.create();

export default class style {

    static getRegInfo() {
        return {
            styles: ['torch'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome) {
        const {
            rotate
        } = block;

        if (!rotate || rotate.y) {
            return cube_func(block, vertices, chunk, x, y, z, neighbours, biome, false, null);
        }

        mat3.fromRotation(rotateTorch, Math.PI / 4);
        mat3.multiply(rotateTorch, rotateTorch, CubeSym.matrices[(rotate.x + 1) % 4]);

        return cube_func(
            block,
            vertices,
            chunk, 
            x + px,
            y + py,
            z + pz,
            neighbours,
            biome,
            false,
            rotateTorch
        );
    }
}