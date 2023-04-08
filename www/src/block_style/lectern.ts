import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';


const {mat4} = glMatrix;

// Наковальня
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['lectern'],
            this.func,
            this.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {
        if(!block || typeof block == 'undefined') {
            return;
        }

        const bm = style.block_manager
        const texture = block.material.texture;
        const up = bm.calcTexture(texture, DIRECTION.UP);
        // const side = bm.calcTexture(texture, DIRECTION.WEST);
        const front = bm.calcTexture(texture, DIRECTION.NORTH);
        const base = bm.calcTexture(texture, DIRECTION.DOWN);
        const bottom = bm.calcTexture(bm.OAK_PLANKS.texture, DIRECTION.UP);

        const flag = 0;
        const parts = [];
        parts.push(...[
            {
                "size": {"x": 8, "y": 13, "z": 8},
                "translate": {"x": 0, "y": 0.5, "z": 0},
                "faces": {
                    "north": {"uv": [12, 9], "flag": flag, "texture": front},
                    "south": {"uv": [4, 8], "flag": flag, "texture": front},
                    "west":  {"uv": [12, 9], "flag": flag, "texture": front},
                    "east":  {"uv": [12, 9], "flag": flag, "texture": front}
                }
            },
            {
                "size": {"x": 16, "y": 2, "z": 16},
                "translate": {"x": 0, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8], "flag": flag, "texture": base},
                    "down": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "north": {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "south": {"uv": [8, 13], "flag": flag, "texture": base},
                    "west":  {"uv": [6, 1.5], "flag": flag, "texture": base},
                    "east":  {"uv": [6, 1.5], "flag": flag, "texture": base}
                }
            },
            {
                "size": {"x": 16, "y": 4, "z": 13},
                "translate": {"x": 0, "y": 6, "z": 1.5},
                "faces": {
                    "up": { "uv": [8, 8], "flag": flag, "texture": up},
                    "down": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "north": {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "south": {"uv": [8, 2], "flag": flag, "texture": [up[0], up[1], up[2], up[3] * -1]},
                    "west":  {"uv": [8, 8], "flag": flag, "texture": bottom},
                    "east":  {"uv": [8, 8], "flag": flag, "texture": bottom}
                },
                "rot": [-Math.PI / 12, 0, 0]
            }
        ]);
        const cd = block.getCardinalDirection();
        matrix = mat4.create();
        switch(cd) {
            case DIRECTION.NORTH:
                mat4.rotateY(matrix, matrix, Math.PI);
                break;
            case DIRECTION.WEST:
                mat4.rotateY(matrix, matrix, Math.PI / 2);
                break;
            case DIRECTION.EAST:
                mat4.rotateY(matrix, matrix, -Math.PI / 2);
                break;
        }
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }

        if(block.extra_data?.book) {
            drawBook(vertices, pos, matrix);
        }

    }

}

function drawBook(vertices, pos, matrix) {
    const bm = style.block_manager
    const book = bm.calcTexture({'up':[24, 24]}, DIRECTION.UP);
    const flag = 0;
    const parts = [];
    parts.push(...[
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": -3.7, "y": 7.6, "z": 1},
            "faces": {
                "up": {"uv": [3, 5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, Math.PI / 140, -Math.PI / 36]
        },
        {
            "size": {"x": 6, "y": 1, "z": 10},
            "translate": {"x": 3.7, "y": 7.6, "z": 1},
            "faces": {
                "up": {"uv": [19, 5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, -Math.PI / 140, Math.PI / 36]
        },
        {
            "size": {"x": 5, "y": 1, "z": 8},
            "translate": {"x": -3.3, "y": 8.6, "z": 1},
            "faces": {
                "up": {"uv": [3.5, 15], "flag": flag, "texture": book},
                "north": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "south": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "west": {"uv": [5, 10.5], "flag": flag, "texture": book},
                "east": {"uv": [5, 10.5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, Math.PI / 140, -Math.PI / 36]
        },
        {
            "size": {"x": 5, "y": 1, "z": 8},
            "translate": {"x": 3.3, "y": 8.6, "z": 1},
            "faces": {
                "up": {"uv": [3.5, 15], "flag": flag, "texture": book},
                "north": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "south": {"uv": [3.5, 10.5], "flag": flag, "texture": book},
                "west": {"uv": [5, 10.5], "flag": flag, "texture": book},
                "east": {"uv": [5, 10.5], "flag": flag, "texture": book}
            },
            "rot": [-Math.PI / 12, -Math.PI / 140, Math.PI / 36]
        }
    ]);

    const lm = IndexedColor.WHITE;
    for(let part of parts) {
        default_style.pushPART(vertices, {
            ...part,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        });
    }
}