import { DIRECTION, Vector, IndexedColor } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';

// Cauldron
export default class style {

    // getRegInfo
    static getRegInfo() {
        return {
            styles: ['cauldron'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block, for_physic, no_pad) {
        const aabb = new AABB();
        aabb.set( 0, 0, 0, 1, 1, 1);
        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {
        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }
        // свчечени от лавы должно быть
        const extra_data = block.extra_data;
        const level = extra_data.level; // Высота жидкости 0, 1, 2, 3
        const lava = extra_data.lava; // если внутри лава
        const water = extra_data.water; // если внтри вода
        const c_up = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = BLOCK.calcMaterialTexture(block.material, DIRECTION.FORWARD);
        const c_down = BLOCK.calcMaterialTexture(block.material, DIRECTION.DOWN);
        const c_inner = BLOCK.calcMaterialTexture(block.material, DIRECTION.EAST);
        const parts = [];
        parts.push(...[
            {
                "size": {"x": 16, "y": 16, "z": 16},
                "translate": {"x": 0, "y": 0, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_up},
                    "down": {"uv": [8, 8],"texture": c_down},
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            },
            {
                "size": {"x": 12, "y": 12, "z": 12},
                "translate": {"x": 0, "y": 2, "z": 0},
                "faces": {
                    "down": {"uv": [8, 8],"texture": c_inner},
                    "north": {"uv": [8, 8],"texture": c_inner},
                    "south": {"uv": [8, 8],"texture": c_inner},
                    "east": {"uv": [8, 8],"texture": c_inner},
                    "west": {"uv": [8, 8],"texture": c_inner}
                }
            }
        ]);
        const pos = new Vector(x, y, z);
        for (const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix
            });
        }
        return null;

    }

}