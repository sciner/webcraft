import {DIRECTION, QUAD_FLAGS, IndexedColor, Vector} from '../helpers.js';
import {AABB} from '../core/AABB.js';
import { default as default_style, TX_SIZE } from './default.js';
import glMatrix from '../../vendors/gl-matrix-3.3.min.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

const WIDTH =  4 / TX_SIZE;
const HEIGHT = 6 / TX_SIZE;

const {mat4} = glMatrix;

const lm = IndexedColor.WHITE.clone();

// Свечи
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['candle'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        let y = 0; // 1 - .85;
        let aabb = new AABB();
        aabb.set(
            0 + .5 - WIDTH / 2,
            y,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            y + HEIGHT,
            0 + .5 + WIDTH / 2,
        );

        //
        if(!for_physic) {
            aabb.pad(1/500);
        }

        return [aabb];
    }

    // Build function
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const active            = block?.extra_data?.active;
        const c_up_top          = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const count             = Math.min(block.extra_data?.candles || 1, 4);
        const flag              = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;

        const candles = [
            [{mx: 0, mz: 0, height: 5}],
            [{mx: 0, mz: -1.5, height: 5}, {mx: 0, mz: 1.5, height: 3}],
            [{mx: -1.5, mz: -1.5, height: 5}, {mx: -1.5, mz: 1.5, height: 3},{mx: 1.5, mz: 0, height: 2}],
            [{mx: -1.5, mz: -1.5, height: 5}, {mx: -1.5, mz: 1.5, height: 3}, {mx: 1.5, mz: -1.5, height: 2}, {mx: 1.5, mz: 1.5, height: 4}]
        ];

        // Geometries
        const parts = [];
        const planes = [];

        const wick_positions = [];

        for(let candle of candles[count - 1]) {

            const {height, mx, mz} = candle;
            const pos = new Vector(x, y - (1 - height / TX_SIZE) / 2, z);

            // candlewicks
            planes.push(...[
                {
                    pos: pos.add(new Vector(mx / TX_SIZE, (height / 2 + .5) / TX_SIZE, mz / TX_SIZE)),
                    size: {x: 0, y: 1, z: 1},
                    uv: [0.5, 5.5],
                    rot: [0, Math.PI / 4, 0]
                },
                {
                    pos: pos.add(new Vector(mx / TX_SIZE, (height / 2 + .5) / TX_SIZE, mz / TX_SIZE)),
                    size: {x: 0, y: 1, z: 1},
                    uv: [0.5, 5.5],
                    rot: [0, Math.PI / 4 + Math.PI / 2, 0]
                }
            ]);

            if(active && typeof worker != 'undefined') {
                wick_positions.push(block.posworld.add(new Vector(-x, -y, -z)).addSelf(planes[planes.length - 1].pos));
            }

            // part
            parts.push({
                pos,
                "size": {"x": 2, "y": height, "z": 2},
                "translate": {"x": mx, "y": 0, "z": mz},
                "faces": {
                    "down":  {"uv": [1, 7], "flag": flag, "texture": c_up_top},
                    "up":    {"uv": [1, 7], "flag": flag, "texture": c_up_top},
                    "north": {"uv": [1, 11], "flag": flag, "texture": c_up_top},
                    "south": {"uv": [1, 11], "flag": flag, "texture": c_up_top},
                    "west":  {"uv": [1, 11], "flag": flag, "texture": c_up_top},
                    "east":  {"uv": [1, 11], "flag": flag, "texture": c_up_top}
                }
            });

        }

        for(let plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                matrix:     matrix,
                pos:        plane.pos,
                flag:       flag,
                texture:    [...c_up_top]
            });
        }

        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        part.pos,
                matrix:     matrix
            });
        }

        // Animated block effects
        if(typeof worker != 'undefined') {
            worker.postMessage(['add_animated_block', {
                block_pos: block.posworld,
                pos: wick_positions,
                type: 'torch_flame'
            }]);
        }

        return null;

    }

}