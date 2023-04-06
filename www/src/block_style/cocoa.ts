import {DIRECTION, QUAD_FLAGS, IndexedColor, Vector} from '../helpers.js';
import {AABB} from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';

const WIDTH =  16 / 32;
const HEIGHT = 20 / 32;

const {mat4} = glMatrix;

const lm = IndexedColor.WHITE.clone();

// Фонарь
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager;
        return new BlockStyleRegInfo(
            ['cocoa'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        let y = 1 - .85;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            y,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            y + HEIGHT,
            0 + .5 + WIDTH / 2,
        );
        const a = ((tblock.rotate.x - 1) / 4) * (2 * Math.PI);
        aabb.translate(.22 * Math.cos(a), 0, .22 * Math.sin(a));
        return [aabb];
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const c_up_top          = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const stage             = block.extra_data.stage;
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const rot               = [0, ((3 - block.rotate.x) / 4) * (2 * Math.PI), 0];
        const pos               = new Vector(x, y, z);

        // 1. Chains
        const planes = [];
        planes.push(...[
            {"size": {"x": 0, "y": 4, "z": 4}, "uv": [14, 2], "rot": [0, 0, 0], "translate": {"x": 0, "y": 6, "z": -6}}
        ]);

        let plane_matrix = mat4.create();
        mat4.rotateY(plane_matrix, plane_matrix, rot[1] + Math.PI/2);

        for(let plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     plane_matrix,
                flag:       flag,
                texture:    [c_up_top[0], c_up_top[1], c_up_top[2] * -1, c_up_top[3]]
            });
        }

        // 2. Parts
        const parts = [];
        switch(stage) {
            case 0: {
                parts.push({
                    "size": {"x": 4, "y": 5, "z": 4},
                    "translate": {"x": -5, "y": 1.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [2, 2], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [13, 6.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 1: {
                parts.push({
                    "size": {"x": 6, "y": 7, "z": 6},
                    "translate": {"x": -4, "y": .5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3, 3], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [12, 7.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
            case 2: {
                parts.push({
                    "size": {"x": 7, "y": 9, "z": 7},
                    "translate": {"x": -3.5, "y": -.5, "z": 0},
                    "faces": {
                        "down":  {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "up":    {"uv": [3.5, 3.5], "flag": flag, "texture": c_up_top},
                        "north": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "south": {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "west":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top},
                        "east":  {"uv": [11, 8.5], "flag": flag, "texture": c_up_top}
                    }
                });
                break;
            }
        }

        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                rot:        rot,
                matrix:     matrix
            });
        }

        return null;

    }

}