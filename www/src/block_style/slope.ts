import { IndexedColor, DIRECTION, QUAD_FLAGS, Vector } from '../helpers.js';
import { BLOCK } from "../blocks.js";
import { AABB, AABBSideParams, PLANES, pushAABB } from '../core/AABB.js';
import { TBlock } from '../typed_blocks3.js';
import { default as stairs_style } from './stairs.js';

const _aabb = new AABB();
const _center = new Vector(0, 0, 0);
const dirs_name = ['NORTH', 'WEST', 'SOUTH', 'EAST'];
const dirs_name_lower = ['north', 'west', 'south', 'east'];

const slope_axes = [
    [[1, 0, 0], [0, 1, -1]],
    [[0, 1, 0], [-1, 0, -1]],
    [[-1, 0, 0], [0, -1, -1]],
    [[0, -1, 0], [1, 0, -1]],
];

// Рельсы
export default class style {
    [key: string]: any;

    static getRegInfo() {
        return {
            styles: ['slope'],
            func: style.func,
            aabb: stairs_style.computeAABB
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix = null, pivot = null, force_tex) {

        if(typeof block == 'undefined') {
            return;
        }

        const pos               = new Vector(x, y, z);

        const texture           = block.material.texture;
        const c                 = BLOCK.calcTexture(texture, DIRECTION.NORTH);
        const c_up              = BLOCK.calcTexture(texture, DIRECTION.UP);
        const c_down            = BLOCK.calcTexture(texture, DIRECTION.DOWN);
        const lm                = IndexedColor.WHITE;
        const cd                = block.getCardinalDirection();
        const on_ceil           = style.isOnCeil(block);
        const anim_frames       = 0;
        const flag              = 0; // QUAD_FLAGS.NO_CAN_TAKE_AO;

        _center.set(x, y, z)

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

        const item = {
            cd: cd,
            mods: {
                // modify main slope
                up: {
                    axes: slope_axes[(cd + (on_ceil ? 2 : 0)) % 4],
                    offset: [0.5, 0.5, 0.5],
                    autoUV: false
                }
            },
            deleted: [dirs_name_lower[cd]]
        };

        //
        const cancelDelete = (side) => {
            const index = item.deleted.indexOf(side);
            if(index >= 0) {
                delete(item.deleted[index]);
                item.deleted.splice(index, 1);
                item.deleted = Array.from(item.deleted);
            }
        }

        if(neighbours && neighbours.UP instanceof TBlock) {
            const info = stairs_style.calculate(block, pos, neighbours);
            const ne = info.sides[0];
            const wn = info.sides[1];
            const sw = info.sides[2];
            const es = info.sides[3];
            const top_parts_count = (ne?1:0) + (wn?1:0) + (sw?1:0) + (es?1:0);
            if(top_parts_count == 3) {
                // inner corner
                const n = neighbours[dirs_name[cd]];
                if(n.material.tags.includes('stairs')) {
                    const n_on_ceil = style.isOnCeil(n);
                    let index = (cd - 1 + 4) % 4;
                    if(n.getCardinalDirection() == index && on_ceil == n_on_ceil) {
                        item.mods[dirs_name_lower[(index + 2) % 4]] = {
                            axes:   PLANES[dirs_name_lower[(index + 2) % 4]].axes,
                            flag:   flag
                        };
                        //
                        item.deleted = [];
                        item.mods[dirs_name_lower[cd]] = {
                            axes:   slope_axes[(index + (on_ceil ? 2 : 0)) % 4],
                            autoUV: false,
                            offset: [0.5, 0.5, 0.5],
                            uv:     [c[0], c[1], -c[2], c[3] * ((cd == 3 || cd == 2) ? -1 : 1)]
                        }
                    }
                    index = (cd + 1) % 4;
                    if(n.getCardinalDirection() == index && on_ceil == n_on_ceil) {
                        item.mods[dirs_name_lower[(index + 2) % 4]] = {
                            axes:   PLANES[dirs_name_lower[(index + 2) % 4]].axes,
                            flag:   flag,
                            uv:     [c[0], c[1], c[2], c[3]]
                        };
                        //
                        item.deleted = [];
                        item.mods[dirs_name_lower[cd]] = {
                            autoUV: false,
                            axes:   slope_axes[(index + (on_ceil ? 2 : 0)) % 4],
                            offset: [0.5, 0.5, 0.5],
                            uv:     [c[0], c[1], c[2], c[3] * (((cd == 3 || cd == 2) || (cd == 2 && on_ceil)) ? -1 : 1)]
                        }
                    }
                }
            } else if(top_parts_count == 1) {
                // outer corner
                if(ne) {
                    const mir_y =  on_ceil ? 1 : -1;
                    item.mods.up = {
                        autoUV: false,
                        axes:   [[-1, 0, 1 * mir_y], [0, -1, 0]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX,
                        uv:     [c[0], c[1], c[2], c[3] * mir_y]
                    };
                    item.mods.south = {
                        autoUV: false,
                        axes:   [[1, 0, 0], [0, 1, 1 * -mir_y]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE,
                        offset: [0.5, 0.5, 0.5],
                        uv:     [c[0], c[1], c[2], c[3] * -mir_y]
                    };
                    cancelDelete('south');
                    item.deleted.push(...['west', dirs_name_lower[(cd + 2) % 4]]);
                }
                if(sw) {
                    const mir_y =  on_ceil ? 1 : -1;
                    item.mods.up = {
                        autoUV: false,
                        axes:   [[-1, 0, 0], [0, -1, 1 * -mir_y]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE,
                        offset: [0.5, 0.5, 0.5],
                        uv:     [c[0], c[1], c[2], c[3] * mir_y]
                    };
                    item.mods.east = {
                        autoUV: false,
                        axes:   [[1, 0, 1 * mir_y], [0, 1, 0]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX,
                        offset: [0.5, 0.5, 0.5],
                        uv:     [c[0], c[1], c[2], c[3] * -mir_y]
                    };
                    cancelDelete('east');
                    item.deleted.push(...['north', dirs_name_lower[(cd + 2) % 4]]);
                }
                if(wn) {
                    const mir_y =  on_ceil ? 1 : -1;
                    item.mods.up = {
                        autoUV: false,
                        axes:   [[0, -1, 1 * mir_y], [1, 0, 0]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX,
                        uv:     [c[0], c[1], c[2], c[3] * mir_y]
                    };
                    item.mods.east = {
                        autoUV: false,
                        axes:   [[0, 1, 0], [-1, 0, 1 * -mir_y]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE,
                        offset: [0.5, 0.5, 0.5],
                        uv:     [c[0], c[1], c[2], c[3] * -mir_y]
                    };
                    cancelDelete('east');
                    item.deleted.push(...['south', dirs_name_lower[(cd + 2) % 4]]);
                }
                //
                if(es) {
                    const mir_y =  on_ceil ? 1 : -1;
                    item.mods.west = {
                        autoUV: false,
                        axes:   [[0, -1, 0], [1, 0, 1 * -mir_y]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE,
                        offset: [0.5, 0.5, 0.5],
                        uv:     [c[0], c[1], c[2], c[3] * mir_y]
                    };
                    item.mods.up = {
                        autoUV: false,
                        axes:   [[0, 1, 1 * mir_y], [-1, 0, 0]],
                        flag:   flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX,
                        uv:     [c[0], c[1], c[2], c[3] * mir_y]
                    };
                    cancelDelete('west');
                    item.deleted.push(...['north', dirs_name_lower[(cd + 2) % 4]]);
                }
            }
        }

        const _sides = {
            up: new AABBSideParams(c_up, flag, anim_frames, lm, null, false, null, [0.5, 0.5, 0.5]),
            down: new AABBSideParams(c_down, flag, anim_frames, lm, on_ceil ? PLANES.up.axes : null, true, null, [0.5, 0.5, 0 + (on_ceil ? 1 : 0)]),
            south: new AABBSideParams(c, flag, anim_frames, lm, null, true),
            north: new AABBSideParams(c, flag, anim_frames, lm, null, true),
            west: new AABBSideParams(c,  flag, anim_frames, lm, null, true),
            east: new AABBSideParams(c, flag, anim_frames, lm, null, true)
        }

        if(cd == DIRECTION.NORTH) {
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
        } else if(cd == DIRECTION.WEST) {
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
        } else if(cd == DIRECTION.SOUTH) {
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
        } else if(cd == DIRECTION.EAST) {
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

        // apply modifications
        for(let k in item.mods) {
            _sides[k] = {..._sides[k], ...item.mods[k]};
        }

        // delete unused
        for(let k of item.deleted) {
            delete(_sides[k]);
        }

        pushAABB(vertices, _aabb, pivot, matrix, _sides, _center);

    }

    static isOnCeil(block) {
        // на верхней части блока (перевернутый склон)
        return block.extra_data && block.extra_data?.point?.y >= .5;
    }

}