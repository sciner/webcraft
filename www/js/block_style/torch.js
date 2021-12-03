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

        const a = 45;
        const sinA = Math.sin(Math.PI * a / 180)

        let xrot = 0;
        let yrot = 0;
        let px = 0;
        let py = 0;
        let pz = 0;

        switch(rotate.x) {
            case ROTATE.S:
                xrot = a;
                pz = sinA;
                break;
            case ROTATE.N:
                xrot = -a;
                py = sinA;
                pz = -0.5;
                break;
            case ROTATE.E:
                yrot = a;
                py = sinA;
                px = -0.5;
                break;
            case ROTATE.W:
                yrot = -a;
                px = sinA;
                break;
        }

        mat3.fromQuat(rotateTorch, quat.fromEuler([0,0,0,0], xrot , 0 , yrot))

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