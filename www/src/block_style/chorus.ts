import { DIRECTION, Vector, IndexedColor } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';


// Chorus
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['chorus'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB()
        if (tblock.id == style.block_manager.CHORUS_FLOWER.id) {
            aabb.set( 0, 0, 0, 1, 1, 1)
        } else {
            aabb.set( .2, .2, .2, .8, .8, .8)
        }
        return [aabb]
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        
        const bm = style.block_manager

        if(!block || typeof block == 'undefined' || block.id == bm.AIR.id) {
            return;
        }
        const parts = []
        // это цветок хоруса
        if (block.id == bm.CHORUS_FLOWER.id) {
            const isDead = block?.extra_data?.notick
            const texture = bm.calcMaterialTexture(block.material, isDead ? DIRECTION.DOWN : DIRECTION.UP)
            parts.push(...[
                {
                    "size": { "x": 12, "y": 2, "z": 12 },
                    "translate": { "x": 0, "y": 7, "z": 0 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                },
                {
                    "size": { "x": 12, "y": 2, "z": 12 },
                    "translate": { "x": 0, "y": -7, "z": 0 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                },
                {
                    "size": { "x": 2, "y": 12, "z": 12 },
                    "translate": { "x": 7, "y": 0, "z": 0 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "up": { "uv": [8, 8], "texture": texture }
                    }
                },
                {
                    "size": { "x": 2, "y": 12, "z": 12 },
                    "translate": { "x": -7, "y": 0, "z": 0 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture },
                        "up": { "uv": [8, 8], "texture": texture }
                    }
                },
                {
                    "size": { "x": 12, "y": 12, "z": 2 },
                    "translate": { "x": 0, "y": 0, "z": 7 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture },
                        "up": { "uv": [8, 8], "texture": texture }
                    }
                },
                {
                    "size": { "x": 12, "y": 12, "z": 2 },
                    "translate": { "x": 0, "y": 0, "z": -7 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture },
                        "up": { "uv": [8, 8], "texture": texture }
                    }
                }
            ])
        } else {
            const texture = bm.calcMaterialTexture(block.material, DIRECTION.FORWARD)
            parts.push(...[
                {
                    "size": { "x": 8, "y": 8, "z": 8 },
                    "translate": { "x": 0, "y": 0, "z": 0 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            ])
            // верх
            let size = neighbours.UP.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": 7, "y": size, "z": 7 },
                    "translate": { "x": 0, "y": 4 + size / 2, "z": 0 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
            // низ
            size = neighbours.DOWN.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": 7, "y": size, "z": 7 },
                    "translate": { "x": 0, "y": -4 - size / 2, "z": 0 },
                    "faces": {
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
            // запад
            size = neighbours.WEST.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": size, "y": 7, "z": 7 },
                    "translate": { "x": -4 - size / 2, "y": 0, "z": 0 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
            // восток
            size = neighbours.EAST.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": size, "y": 7, "z": 7 },
                    "translate": { "x": 4 + size / 2, "y": 0, "z": 0 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
            // север
            size = neighbours.NORTH.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": 7, "y": 7, "z": size },
                    "translate": { "x": 0, "y": 0, "z": 4 + size / 2 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "down": { "uv": [8, 8], "texture": texture },
                        "north": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
            // Юг
            size = neighbours.SOUTH.id == 0 ? 2 : 4
            parts.push(
                {
                    "size": { "x": 7, "y": 7, "z": size },
                    "translate": { "x": 0, "y": 0, "z": -4 - size / 2 },
                    "faces": {
                        "up": { "uv": [8, 8], "texture": texture },
                        "down": { "uv": [8, 8], "texture": texture },
                        "south": { "uv": [8, 8], "texture": texture },
                        "east": { "uv": [8, 8], "texture": texture },
                        "west": { "uv": [8, 8], "texture": texture }
                    }
                }
            )
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
    }

}