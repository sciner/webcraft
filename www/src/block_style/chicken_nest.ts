import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';

// гнездо для кур
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['chicken_nest'],
            this.func,
            this.computeAABB
        );
    }
    
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 0.13, 1);
        return [aabb]
    }
    
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const planks = bm.calcTexture(block.material.texture.side, DIRECTION.UP);
        const parts = [];
        parts.push(...[
            {
                "size": {"x": 10, "y": 2, "z": 3},
                "translate": {"x": 0, "y": -7, "z": 6.5},
                "faces": {
                    "up": {"uv": [8, 8],"texture": planks},
                    "down": {"uv": [8, 8],"texture": planks},
                    "north": {"uv": [8, 8],"texture": planks},
                    "south": {"uv": [8, 8],"texture": planks}
                }
            },{
                "size": {"x": 10, "y": 2, "z": 3},
                "translate": {"x": 0, "y": -7, "z": -6.5},
                "faces": {
                    "up": {"uv": [8, 8],"texture": planks},
                    "down": {"uv": [8, 8],"texture": planks},
                    "north": {"uv": [8, 8],"texture": planks},
                    "south": {"uv": [8, 8],"texture": planks}
                }
            },{
                "size": {"x": 3, "y": 2, "z": 16},
                "translate": {"x": 6.5, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": planks},
                    "down": {"uv": [8, 8],"texture": planks},
                    "north": {"uv": [8, 8],"texture": planks},
                    "south": {"uv": [8, 8],"texture": planks},
                    "west":  {"uv": [8, 8],"texture": planks},
                    "east":  {"uv": [8, 8],"texture": planks}
                }
            },{
                "size": {"x": 3, "y": 2, "z": 16},
                "translate": {"x": -6.5, "y": -7, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": planks},
                    "down": {"uv": [8, 8],"texture": planks},
                    "north": {"uv": [8, 8],"texture": planks},
                    "south": {"uv": [8, 8],"texture": planks},
                    "west":  {"uv": [8, 8],"texture": planks},
                    "east":  {"uv": [8, 8],"texture": planks}
                }
            }
        ]);
        // яйца
        const eggs = block?.extra_data?.eggs;
        const egg = bm.calcTexture(bm.SAND.texture, DIRECTION.UP);
        for (let i = 0; i < eggs; i++) {
            const col = Math.floor(i / 3) * 3.2 - 3.2;
            const row = (i % 3) * 3.2 - 3.2
             parts.push(...[
                {
                    "size": {"x": 3, "y": 4, "z": 3},
                    "translate": {"x": col, "y": -6, "z": row},
                    "faces": {
                        "up": {"uv": [8, 8],"texture": egg},
                        "down": {"uv": [8, 8],"texture": egg},
                        "north": {"uv": [8, 8],"texture": egg},
                        "south": {"uv": [8, 8],"texture": egg},
                        "east": {"uv": [8, 8],"texture": egg},
                        "west": {"uv": [8, 8],"texture": egg}
                    }
                }
            ]);
        }
        const pos = new Vector(x, y, z);
        const lm = IndexedColor.WHITE;
        for(const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        pos,
                matrix:     matrix
            });
        }
    }
    
}