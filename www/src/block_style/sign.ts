import {calcRotateMatrix, DIRECTION, AlphabetTexture, Vector, IndexedColor, fromMat3} from '../helpers.js';
import {BlockManager, FakeTBlock} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import {CubeSym} from "../core/CubeSym.js";
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';


const {mat4} = glMatrix;

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 14 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const BOTTOM_HEIGHT     = .6;

const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

// Табличка
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['sign'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {

        if(for_physic) {
            return [];
        }

        let x           = 0;
        let y           = 0;
        let z           = 0;
        let aabb        = null;
        const resp      = [];
        const width     = .5;
        const height    = 1;

        /* Center
        if(tblock.rotate.y == 0) {
            const mul = 1.01;
            aabb = new AABB();
            aabb.set(
                x + .5 - CONNECT_X*mul/2,
                y + .6,
                z + .5 - CONNECT_Z*mul/2,
                x + .5 + CONNECT_X*mul/2,
                y + .6 + CONNECT_HEIGHT*mul,
                z + .5 + CONNECT_Z*mul/2,
            );
            const dist = -(.5 - aabb.depth / 2);
            const dir = CubeSym.dirAdd(tblock.rotate.x, CubeSym.ROT_Y2);
            aabb.rotate(dir, aabb.center);
            aabb.translate(cubeSymAxis[dir][0] * dist, -(.2 + aabb.height) / 2, cubeSymAxis[dir][1] * dist);
        } else {*/
            aabb = new AABB();
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - width/2,
                x + .5 + width/2,
                y + height,
                z + .5 + width/2,
            );
            resp.push(aabb);
      //  }

        return [aabb];

    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        if(!block || typeof block == 'undefined') {
            return;
        }

        const bm = style.block_manager
        const c_up = bm.calcMaterialTexture(block.material, DIRECTION.UP)
        const c_chain = bm.calcTexture(bm.CHAIN.texture, DIRECTION.UP)
        const rotate = block.rotate
        const parts = []
        if (rotate.y == 1) {
            parts.push(...[
                {
                    "size": {"x": 14, "y": 8, "z": 2},
                    "translate": {"x": 0, "y": 4, "z": 0},
                    "faces": {
                        "up": {"uv": [8, 8],"texture": c_up},
                        "down": {"uv": [8, 8],"texture": c_up},
                        "north": {"uv": [8, 8],"texture": c_up},
                        "south": {"uv": [8, 8],"texture": c_up},
                        "east": {"uv": [8, 8],"texture": c_up},
                        "west": {"uv": [8, 8],"texture": c_up}
                    }
                },
                {
                    "size": {"x": 2, "y": 8, "z": 2},
                    "translate": {"x": 0, "y": -4, "z": 0},
                    "faces": {
                        "up": {"uv": [8, 8],"texture": c_up},
                        "down": {"uv": [8, 8],"texture": c_up},
                        "north": {"uv": [8, 8],"texture": c_up},
                        "south": {"uv": [8, 8],"texture": c_up},
                        "east": {"uv": [8, 8],"texture": c_up},
                        "west": {"uv": [8, 8],"texture": c_up}
                    }
                }
            ])
        }
        /*if (rotate.y == 0) {
            if (rotate.z == -1) {
                parts.push(
                    {
                        "size": {"x": 14, "y": 8, "z": 2},
                        "translate": {"x": 0, "y": 0, "z": 7},
                        "faces": {
                            "up": {"uv": [8, 8],"texture": c_up},
                            "down": {"uv": [8, 8],"texture": c_up},
                            "north": {"uv": [8, 8],"texture": c_up},
                            "south": {"uv": [8, 8],"texture": c_up},
                            "east": {"uv": [8, 8],"texture": c_up},
                            "west": {"uv": [8, 8],"texture": c_up}
                        }
                    }
                )
            } else {
                parts.push(
                    {
                        "size": {"x": 14, "y": 8, "z": 2},
                        "translate": {"x": 0, "y": rotate.y == 1 ? 4 : -2, "z": 0},
                        "faces": {
                            "up": {"uv": [8, 8],"texture": c_up},
                            "down": {"uv": [8, 8],"texture": c_up},
                            "north": {"uv": [8, 8],"texture": c_up},
                            "south": {"uv": [8, 8],"texture": c_up},
                            "east": {"uv": [8, 8],"texture": c_up},
                            "west": {"uv": [8, 8],"texture": c_up}
                        }
                    }
                )    
            }
        }
        if (rotate.x == 0 || rotate.y == -1) {

        }
        


        parts.push(
            {
                "size": {"x": 2, "y": 8, "z": 14},
                "translate": {"x": 0, "y": rotate.y == 1 ? 4 : -2, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_up},
                    "north": {"uv": [8, 8],"texture": c_up},
                    "south": {"uv": [8, 8],"texture": c_up},
                    "east": {"uv": [8, 8],"texture": c_up},
                    "west": {"uv": [8, 8],"texture": c_up}
                }
            }
        )
        // напольный
        if (rotate.y == 1) {
            parts.push(
                {
                    "size": {"x": 2, "y": 8, "z": 2},
                    "translate": {"x": 0, "y": -4, "z": 0},
                    "faces": {
                        "up": {"uv": [8, 8],"texture": c_up},
                        "down": {"uv": [8, 8],"texture": c_up},
                        "north": {"uv": [8, 8],"texture": c_up},
                        "south": {"uv": [8, 8],"texture": c_up},
                        "east": {"uv": [8, 8],"texture": c_up},
                        "west": {"uv": [8, 8],"texture": c_up}
                    }
                }
            )
        } else {
            // боковой/потолочный
            parts.push(...[
                {
                    "rot": [0, Math.PI / 4, 0],
                    "size": {"x": 0, "y": 4, "z": 3},
                    "translate": {"x": 3, "y": 5, "z": -3},
                    "faces": {
                        "east": {"uv": [4.5, 5],"texture": c_chain},
                        "west": {"uv": [4.5, 5],"texture": c_chain}
                    }
                },
                {
                    "rot": [0, -Math.PI / 4, 0],
                    "size": {"x": 0, "y": 2, "z": 3},
                    "translate": {"x": -3, "y": 3, "z": -3},
                    "faces": {
                        "east": {"uv": [4.5, 10],"texture": c_chain},
                        "west": {"uv": [4.5, 10],"texture": c_chain}
                    }
                },
                {
                    "rot": [0, Math.PI / 4, 0],
                    "size": {"x": 0, "y": 4, "z": 3},
                    "translate": {"x": -3, "y": 5, "z": 3},
                    "faces": {
                        "east": {"uv": [4.5, 5],"texture": c_chain},
                        "west": {"uv": [4.5, 5],"texture": c_chain}
                    }
                },
                {
                    "rot": [0, -Math.PI / 4, 0],
                    "size": {"x": 0, "y": 2, "z": 3},
                    "translate": {"x": 3, "y": 3, "z": 3},
                    "faces": {
                        "east": {"uv": [4.5, 10],"texture": c_chain},
                        "west": {"uv": [4.5, 10],"texture": c_chain}
                    }
                }
            ])
            if (rotate.y == 0) {
                parts.push(
                    {
                        "size": {"x": 4, "y": 2, "z": 16},
                        "translate": {"x": 0, "y": 7, "z": 0},
                        "faces": {
                            "up": {"uv": [8, 8],"texture": c_up},
                            "down": {"uv": [8, 8],"texture": c_up},
                            "north": {"uv": [8, 8],"texture": c_up},
                            "south": {"uv": [8, 8],"texture": c_up},
                            "east": {"uv": [8, 8],"texture": c_up},
                            "west": {"uv": [8, 8],"texture": c_up}
                        }
                    }
                )
            } else {
                parts.push(...[
                    {
                        "rot": [0, -Math.PI / 4, 0],
                        "size": {"x": 0, "y": 2, "z": 3},
                        "translate": {"x": -3, "y": 7, "z": -3},
                        "faces": {
                            "east": {"uv": [4.5, 1],"texture": c_chain},
                            "west": {"uv": [4.5, 1],"texture": c_chain}
                        }
                    },
                    {
                        "rot": [0, -Math.PI / 4, 0],
                        "size": {"x": 0, "y": 2, "z": 3},
                        "translate": {"x": 3, "y": 7, "z": 3},
                        "faces": {
                            "east": {"uv": [4.5, 1],"texture": c_chain},
                            "west": {"uv": [4.5, 1],"texture": c_chain}
                        }
                    }
                ])
            }
        }*/


/*

        parts.push(...[
            {
                "size": {"x": 4, "y": 2, "z": 16},
                "translate": {"x": 0, "y": 7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_up},
                    "north": {"uv": [8, 8],"texture": c_up},
                    "south": {"uv": [8, 8],"texture": c_up},
                    "east": {"uv": [8, 8],"texture": c_up},
                    "west": {"uv": [8, 8],"texture": c_up}
                }
            },
            {
                "rot": [0, Math.PI / 4, 0],
                "size": {"x": 0, "y": 4, "z": 3},
                "translate": {"x": 3, "y": 5, "z": -3},
                "faces": {
                    "east": {"uv": [4.5, 5],"texture": c_chain},
                    "west": {"uv": [4.5, 5],"texture": c_chain}
                }
            },
            {
                "rot": [0, -Math.PI / 4, 0],
                "size": {"x": 0, "y": 2, "z": 3},
                "translate": {"x": -3, "y": 3, "z": -3},
                "faces": {
                    "east": {"uv": [4.5, 10],"texture": c_chain},
                    "west": {"uv": [4.5, 10],"texture": c_chain}
                }
            },
            {
                "rot": [0, Math.PI / 4, 0],
                "size": {"x": 0, "y": 4, "z": 3},
                "translate": {"x": -3, "y": 5, "z": 3},
                "faces": {
                    "east": {"uv": [4.5, 5],"texture": c_chain},
                    "west": {"uv": [4.5, 5],"texture": c_chain}
                }
            },
            {
                "rot": [0, -Math.PI / 4, 0],
                "size": {"x": 0, "y": 2, "z": 3},
                "translate": {"x": 3, "y": 3, "z": 3},
                "faces": {
                    "east": {"uv": [4.5, 10],"texture": c_chain},
                    "west": {"uv": [4.5, 10],"texture": c_chain}
                }
            },
            {
                "size": {"x": 2, "y": 10, "z": 14},
                "translate": {"x": 0, "y": -3, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_up},
                    "north": {"uv": [8, 8],"texture": c_up},
                    "south": {"uv": [8, 8],"texture": c_up},
                    "east": {"uv": [8, 8],"texture": c_up},
                    "west": {"uv": [8, 8],"texture": c_up}
                }
            }
        ])
*/
        matrix = mat4.create()
        // висит на верху, значит разворачиваем к лицу
        if (rotate.y == 0) {
            const angle = rotate.z == 1 ? rotate.x + 1 : rotate.x + 2
            matrix = fromMat3(new Float32Array(16), CubeSym.matrices[angle % 4])
        } else {
            mat4.rotateY(matrix, matrix, block.rotate.x * Math.PI / 2 + Math.PI)
        }

        const pos = new Vector(x, y, z)
        for (const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix
            })
        }

        /*
        // Texture
        const c = bm.calcMaterialTexture(block.material, DIRECTION.UP);

        const draw_bottom = block.rotate.y != 0;

        const aabb = style.makeAABBSign(block, x, y, z)

        if(draw_bottom) {
            matrix = mat4.create();
            mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * (2 * Math.PI))
        } else {
            matrix = CubeSym.matrices[CubeSym.dirAdd(Math.floor(block.rotate.x), CubeSym.ROT_Y2)]
        }

        // Center
        let aabb_down;
        if(draw_bottom) {
            aabb_down = new AABB();
            aabb_down.set(
                x + .5 - CENTER_WIDTH/2,
                y,
                z + .5 - CENTER_WIDTH/2,
                x + .5 + CENTER_WIDTH/2,
                y + BOTTOM_HEIGHT,
                z + .5 + CENTER_WIDTH/2,
            );
        }

        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, 0, 0, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c, 0, 0, null, null, true),
                south:  new AABBSideParams(c, 0, 0, null, null, true),
                north:  new AABBSideParams(c, 0, 0, null, null, true),
                west:   new AABBSideParams(c, 0, 0, null, null, true),
                east:   new AABBSideParams(c, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        );

        if(draw_bottom) {
            // Push vertices down
            const c_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);
            pushAABB(
                vertices,
                aabb_down,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                    down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_down, 0, 1, null, null, true),
                },
                new Vector(x, y, z)
            );
        }

        const text_block = style.makeTextBlock(block, aabb, pivot, matrix, x, y, z)
        if(text_block) {
            return [text_block]
        }*/

        const aabb = style.makeAABBSign(block, x, y, z)
        const text_block = style.makeTextBlock(block, aabb, pivot, matrix, x, y, z)
        if(text_block) {
            return [text_block]
        }

        return null;

    }

    //
    static makeAABBSign(tblock, x, y, z) {

        const draw_bottom = tblock.rotate ? (tblock.rotate.y != 0) : true

        const aabb = new AABB(
            x + .5 - CONNECT_X / 2,
            y + .6,
            z + .5 - CONNECT_Z / 2,
            x + .5 + CONNECT_X / 2,
            y + .6 + CONNECT_HEIGHT,
            z + .5 + CONNECT_Z / 2,
        )

        if(tblock.rotate.y == 0) {
            if (tblock.rotate.z == -1) {
                aabb.translate(0, -(.2 + aabb.height) / 2, .5 - aabb.depth / 2)
            } else {
                aabb.translate(0, -.45, 0)
            }
        }

        return aabb

    }

    //
    static makeTextBlock(tblock, aabb, pivot, matrix, x, y, z) {
        const bm = style.block_manager
        // Return text block
        if(tblock.extra_data) {
            let text = tblock.extra_data?.text;
            if(text) {
                const sign = [];
                if(tblock.extra_data.username) sign.push(tblock.extra_data.username);
                if(tblock.extra_data.dt) sign.push(new Date(tblock.extra_data.dt || Date.now()).toISOString().slice(0, 10));
                return new FakeTBlock(
                    bm.TEXT.id,
                    {
                        ...tblock.extra_data,
                        aabb: aabb,
                        chars: AlphabetTexture.getStringUVs(text),
                        sign: sign.length > 0 ? AlphabetTexture.getStringUVs(sign.join(' | ')) : null
                    },
                    new Vector(x, y, z),
                    tblock.rotate,
                    pivot,
                    matrix
                );
            }
        }
        return null
    }

}