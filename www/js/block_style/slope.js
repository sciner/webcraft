import { MULTIPLY, DIRECTION, QUAD_FLAGS, Vector } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB, AABBSideParams, PLANES, pushAABB } from '../core/AABB.js';
import { TBlock } from '../typed_blocks.js';

const _aabb = new AABB();
const _center = new Vector(0, 0, 0);

// Рельсы
export default class style {
    
    static getRegInfo() {
        return {
            styles: ['slope'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    static computeAABB(block, for_physic) {
        return [new AABB().set(0, 0, 0, 1, 1, 1)];
    }
    
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const pos = new Vector(x, y, z);
        // const info = stairs_calculate(block, pos, neighbours);

        const texture           = block.material.texture;
        const c                 = BLOCK.calcTexture(texture, DIRECTION.NORTH);
        const c_up              = BLOCK.calcTexture(texture, DIRECTION.UP);
        const c_down            = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const lm                = MULTIPLY.COLOR.WHITE;
        const bcd               = block.getCardinalDirection();
        const anim_frames       = 0;
        const flags             = 0;
        const on_ceil           = style.isOnCeil(block);

        const width             = 1;
        const depth             = 1;
        const height            = 1;

        // AABB
        _aabb.set(
            x + .5 - width/2,
            y,
            z + .5 - depth/2,
            x + .5 + width/2,
            y + height,
            z + .5 + depth/2
        );

        const slope_axes = [
            [[1, 0, 0], [0, 1, -1]],
            [[0, 1, 0], [-1, 0, -1]],
            [[-1, 0, 0], [0, -1, -1]],
            [[0, -1, 0], [1, 0, -1]],
        ];

        const draw_sides = [];
        draw_sides.push(bcd);

        if(neighbours && neighbours.UP instanceof TBlock) {
            const dirs_name = ['NORTH', 'WEST', 'SOUTH', 'EAST'];
            const n = neighbours[dirs_name[bcd]];
            if(n.material.tags.indexOf('stairs') >= 0) {
                let index = (bcd - 1 + 4) % 4;
                const n_on_ceil = style.isOnCeil(n);
                if(n.getCardinalDirection() == index && on_ceil == n_on_ceil) draw_sides.push(index);
                index = (bcd + 1) % 4;
                if(n.getCardinalDirection() == index && on_ceil == n_on_ceil) draw_sides.push(index);
            }
        }

        for(let cd of draw_sides) {

            let slope_axe = slope_axes[(cd + (on_ceil ? 2 : 0)) % 4];

            const _sides = {
                up: new AABBSideParams(c_up, flags, anim_frames, lm, slope_axe, false, null, [0.5, 0.5, 0.5]),
                down: new AABBSideParams(c_down, flags, anim_frames, lm, on_ceil ? PLANES.up.axes : null, true, null, [0.5, 0.5, 0 + (on_ceil ? 1 : 0)]),
                south: new AABBSideParams(c, flags, anim_frames, lm, null, true),
                north: new AABBSideParams(c, flags, anim_frames, lm, null, true),
                west: new AABBSideParams(c,  flags, anim_frames, lm, null, true),
                east: new AABBSideParams(c, flags, anim_frames, lm, null, true)
            }

            if(cd == DIRECTION.NORTH) {
                delete(_sides.north);
                _sides.east.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                _sides.west.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                if(on_ceil) {
                    _sides.west.axes = [[0, 0, 1], [0, 1, 0]];
                    _sides.east.axes = [[0, -1, 0], [0, 0, -1]];
                    _sides.west.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.west.uv = [c[0], c[1], c[2], -c[3]];
                } else {
                    _sides.east.axes = [[0, 0, -1], [0, 1, 0]];
                    _sides.east.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.west.axes = [[0, -1, 0], [0, 0, 1]];
                }
            }
            if(cd == DIRECTION.WEST) {
                delete(_sides.west);
                _sides.south.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                _sides.north.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                if(on_ceil) {
                    _sides.north.axes =  [[1, 0, 0], [0, 0, -1]];
                    _sides.north.uv = [c[0], c[1], -c[2], c[3]];
                    _sides.south.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.south.axes = [[0, 0, 1], [-1, 0, 0]];
                } else {
                    _sides.north.axes = [[0, 0, -1], [-1, 0, 0]];
                    _sides.north.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.north.uv = [c[0], c[1], c[2], -c[3]];
                }
            }
            if(cd == DIRECTION.SOUTH) {
                delete(_sides.south);
                _sides.east.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                _sides.west.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                if(on_ceil) {
                    _sides.west.uv = [c[0], c[1], -c[2], c[3]];
                    _sides.east.axes = [[0, 0, 1], [0, -1, 0]];
                    _sides.east.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                } else {
                    _sides.west.axes = [[0, 0, -1], [0, -1, 0]];
                    _sides.west.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.west.uv = [c[0], c[1], c[2], -c[3]];
                }
            }
            if(cd == DIRECTION.EAST) {
                delete(_sides.east);
                _sides.south.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                _sides.north.flag = QUAD_FLAGS.FLAG_TRIANGLE;
                if(on_ceil) {
                    _sides.north.axes = [[0, 0, 1], [1, 0, 0]];
                    _sides.north.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                    _sides.north.uv = [c[0], c[1], c[2], -c[3]];
                    _sides.south.axes = [[-1, 0, 0], [0, 0, -1]];
                } else {
                    _sides.north.axes = [[-1, 0, 0], [0, 0, 1]];
                    _sides.south.axes = [[0, 0, -1], [1, 0, 0]];
                    _sides.south.flag |= QUAD_FLAGS.FLAG_MIR2_TEX;
                }
            }

            pushAABB(vertices, _aabb, pivot, matrix, _sides, _center.set(x, y, z));

        }

    }

    static isOnCeil(block) {
        // на верхней части блока (перевернутый склон)
        return block.extra_data && block.extra_data?.point?.y >= .5;
    }

}