import { default as cube_style } from './cube.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';
import { Vector } from '../helpers.js';

const { mat3 } = glMatrix;

const cube_func = cube_style.getRegInfo().func;
const tmpMat = mat3.create();
const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

const rotTorch = Math.PI / 5;
const pivotArr = [0.5, 0, 0.5];
const pivotObj = {x: 0.5, y: 0, z: 0.5};

const aabb = new AABB();

export default class style {

    static getRegInfo() {
        return {
            styles: ['torch'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block) {
        const {
            rotate
        } = block;

        const h = 2 / 16;
        let torch_height = 10/16;
        aabb.set(
            .5-h, 0, .5-h,
            .5+h, torch_height, .5+h
        )

        if (!rotate || rotate.y) {
            return aabb;
        }

        const symRot = CubeSym.matrices[(rotate.x + 1) % 4];
        mat3.fromRotation(tmpMat, rotTorch);
        mat3.multiply(tmpMat, tmpMat, symRot);

        aabb.applyMatrix(tmpMat, pivotObj)
        aabb.translate(
            cubeSymAxis[rotate.x][0] * 0.55,
            0.25,
            cubeSymAxis[rotate.x][1] * 0.55
        );

        aabb.y_min -= Math.sin(rotTorch) * h * 2;
        aabb.y_max += Math.sin(rotTorch) * h * 2;
         
        return [aabb];
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        const {
            rotate
        } = block;

        if ((!rotate || rotate.y) && (typeof worker != 'undefined')) {
            worker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: [block.posworld],
                type: 'torch_flame'
            }]);
            return cube_func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, false, null, null);
        }

        const symRot = CubeSym.matrices[(rotate.x + 1) % 4];
        mat3.fromRotation(tmpMat, rotTorch);
        mat3.multiply(tmpMat, tmpMat, symRot);

        const torch_pos = chunk.coord.add(new Vector(
            x + cubeSymAxis[rotate.x][0] * 0.2,
            y + .1,
            z + cubeSymAxis[rotate.x][1] * 0.2,
        ));

        if(typeof worker != 'undefined' && block.id == 50) {
            worker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: [torch_pos],
                type: 'torch_flame'
            }]);
        }

        return cube_func(
            block,
            vertices,
            chunk, 
            x + cubeSymAxis[rotate.x][0] * 0.55,
            y + 0.25,
            z + cubeSymAxis[rotate.x][1] * 0.55,
            neighbours,
            biome,
            dirt_color,
            false,
            tmpMat,
            pivotArr
        );
    }
}