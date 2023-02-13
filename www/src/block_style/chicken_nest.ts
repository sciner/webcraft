import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

const {mat4} = glMatrix;

// гнездо для кур
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['chicken_nest'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any, neighbours : any, expanded?: boolean) : AABB[] {
        const aabb = new AABB();
        aabb.set(0, 0, 0, 1, 0.13, 1);
        return [aabb]
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined') {
            return;
        }
        const bm = style.block_manager
        const planks = bm.calcTexture(bm.HAY_BLOCK.texture, DIRECTION.UP);
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