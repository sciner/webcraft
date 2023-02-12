import { DIRECTION, Vector, IndexedColor, QUAD_FLAGS } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { default as default_style } from './default.js';

// Cauldron
export default class style {

    /**
     * @param { import("../blocks.js").BLOCK } block_manager 
     * @returns 
     */
    static getRegInfo(block_manager) {
        style.block_manager = block_manager
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
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex, only_fluid = false) {

        const bm = style.block_manager

        if(!block || typeof block == 'undefined' || block.id == bm.AIR.id) {
            return;
        }

        // свечение от лавы должно быть
        const extra_data = block.extra_data;
        const level = extra_data?.level ?? 0 // Высота жидкости 0, 1, 2, 3
        const lava = extra_data?.lava ?? false // если внутри лава
        const water = extra_data?.water ?? false // если внутри вода
        const snow = extra_data?.snow ?? false // если внутри снег
        const c_up = bm.calcMaterialTexture(block.material, DIRECTION.UP);
        const c_side = bm.calcMaterialTexture(block.material, DIRECTION.FORWARD);
        const c_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);
        const c_inner = bm.calcMaterialTexture(block.material, DIRECTION.EAST);
        let parts = [];
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
                "size": {"x": 12, "y": 10, "z": 12},
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

        if(only_fluid) {
            parts = [];
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

        if (level > 0) {
            const y1 = y + .15 + level / 4;
            const w = only_fluid ? 0.6 : 0.75;
            let blockFluid = null;
            if (water) {
                blockFluid = bm.STILL_WATER;
            }
            if (lava) {
                blockFluid = bm.STILL_LAVA;
            }
            if (blockFluid) {
                const side = 'up';
                const dir = blockFluid.UP;
                const anim_frames = bm.getAnimations(blockFluid, side);
                let lm = IndexedColor.WHITE.clone();
                let flags = QUAD_FLAGS.NO_AO;
                if(blockFluid.tags.indexOf('multiply_color') >= 0) {
                    lm.copyFrom(blockFluid.multiply_color);
                    flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
                }
                if (anim_frames > 1) {
                    flags |= QUAD_FLAGS.FLAG_ANIMATED;
                    lm.b = anim_frames;
                }
                const t = bm.calcMaterialTexture(blockFluid, dir, w, w);
                vertices.push(x + 0.5, z + 0.5, y1,
                    w, 0, 0,
                    0, w, 0,
                    t[0], t[1], t[2], t[3],
                    lm.pack(), flags
                );
            }
            if (snow) {
                const lm = IndexedColor.WHITE;
                const t = bm.calcMaterialTexture(bm.POWDER_SNOW, DIRECTION.UP, w, w);
                vertices.push(x + 0.5, z + 0.5, y1,
                    w, 0, 0,
                    0, w, 0,
                    t[0], t[1], t[2], t[3],
                    lm.pack(), 0
                );
            }
        }

        return null;

    }

}