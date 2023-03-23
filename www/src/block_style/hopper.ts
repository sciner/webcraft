import { DIRECTION, Vector, IndexedColor } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import { CD_ROT } from '../core/CubeSym.js';


// Hopper
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['hopper'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        return [
            new AABB(0, 10/16, 0, 1, 1, 1),
            new AABB(4/16, 4/16, 4/16, 12/16, 10/16, 12/16),
            new AABB(6/16, 0, 6/16, 10/16, 4/16, 10/16),
        ];
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager

        if(!block || typeof block == 'undefined' || block.id == bm.AIR.id) {
            return
        }

        const hopping_blocks = [bm.FURNACE.id, bm.CHEST.id, bm.HOPPER.id]
        const c_up = bm.calcMaterialTexture(block.material, DIRECTION.UP)
        const c_side = bm.calcMaterialTexture(block.material, DIRECTION.FORWARD)
        const c_inside = bm.calcMaterialTexture(block.material, DIRECTION.EAST)
        let parts = [];
        parts.push(...[
            {
                "size": {"x": 16, "y": 6, "z": 16},
                "translate": {"x": 0, "y": 5, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_side},
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            },
            {
                "size": {"x": 12, "y": 4, "z": 12},
                "translate": {"x": 0, "y": 6, "z": 0},
                "faces": {
                    "down": {"uv": [8, 8],"texture": c_inside},
                    "north": {"uv": [8, 8],"texture": c_inside},
                    "south": {"uv": [8, 8],"texture": c_inside},
                    "east": {"uv": [8, 8],"texture": c_inside},
                    "west": {"uv": [8, 8],"texture": c_inside}
                }
            },
            {
                "size": {"x": 8, "y": 6, "z": 8},
                "translate": {"x": 0, "y": -1, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_side},
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            }
        ])
        let sh_x = 0, sh_z = 0, sh_y = -2
        const cd = block.getCardinalDirection()
        if (hopping_blocks.includes(neighbours.DOWN.id) && (cd <= 3)) {
            sh_y = -6
        } else 
        if (hopping_blocks.includes(neighbours.WEST.id) && cd == CD_ROT.WEST) {
            sh_x = -6
        }
        if (hopping_blocks.includes(neighbours.EAST.id) && cd == CD_ROT.EAST) {
            sh_x = 6
        } 
        if (hopping_blocks.includes(neighbours.NORTH.id) && cd == CD_ROT.NORTH) {
            sh_z = 6
        }
        if (hopping_blocks.includes(neighbours.SOUTH.id) && cd == CD_ROT.SOUTH) {
            sh_z = -6
        }
        parts.push(...[
            {
                "size": {"x": 4, "y": 4, "z": 4},
                "translate": {"x": sh_x, "y": sh_y, "z": sh_z},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_side},
                    "down": {"uv": [8, 8],"texture": c_side},
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            }
        ])

        const pos = new Vector(x, y, z)
        for (const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix
            })
        }

        return null

    }

}