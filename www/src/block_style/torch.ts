import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import { AABB } from '../core/AABB.js';
import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { default as default_style } from './default.js';
import type { BlockManager } from "../blocks.js";
import type { TBlock } from "../typed_blocks3.js";

const { mat3 } = glMatrix;

const tmpMat = mat3.create();
const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

const rotTorch = Math.PI / 5;
const pivotObj = {x: 0.5, y: 0, z: 0.5};
const lm = IndexedColor.WHITE.clone();

const aabb = new AABB();

export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['torch'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const {
            rotate
        } = tblock;

        const h = 2 / 16;
        let torch_height = 10/16;
        aabb.set(
            .5-h, 0, .5-h,
            .5+h, torch_height, .5+h
        )

        if (!rotate || rotate.y) {
            return [aabb];
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

        const c_up_top          = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const pos               = new Vector(0, 0, 0);
        const rotate            = block.rotate;
        const rot               = [0, 0, 0];
        const torch_pos         = block.posworld.clone();

        // Geometries
        const parts = [{
            "size": {"x": 2, "y": 10, "z": 2},
            "translate": {"x": 0, "y": -3, "z": 0},
            "faces": {
                "down":  {"uv": [8, 15], "flag": flag, "texture": c_up_top},
                "up":    {"uv": [8, 7], "flag": flag, "texture": c_up_top},
                "north": {"uv": [8, 11], "flag": flag, "texture": c_up_top},
                "south": {"uv": [8, 11], "flag": flag, "texture": c_up_top},
                "west":  {"uv": [8, 11], "flag": flag, "texture": c_up_top},
                "east":  {"uv": [8, 11], "flag": flag, "texture": c_up_top}
            }
        }];

        // if torch on wall
        if(rotate && !rotate.y) {
            const a = Math.PI / 5;
            const shift = 4.5 / 16;
            switch(rotate.x) {
                case 2: rot[0] = -a; pos.z += shift; break;
                case 3: rot[2] = -a; pos.x -= shift; break;
                case 0: rot[0] = a; pos.z -= shift; break;
                case 1: rot[2] = a; pos.x += shift; break;
            }
            pos.y += 2/16;
            torch_pos.addSelf(pos.div(new Vector(1.2, 1.2, 1.2)));
        }

        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos.addScalarSelf(x, y, z),
                rot:        rot,
                matrix:     matrix
            });
        }

        // flame animations
        if(typeof QubatchChunkWorker != 'undefined' && block.id == 50) {
            QubatchChunkWorker.postMessage(['add_animated_block', {
                block_pos:  block.posworld,
                pos:        [torch_pos.addScalarSelf(.5, .5, .5)],
                type:       'torch_flame'
            }]);
        }

    }

}