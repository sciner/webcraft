import { IndexedColor, DIRECTION, QUAD_FLAGS, Vector } from '../helpers.js';
import { AABB, AABBSideParams, PLANES, pushAABB } from '../core/AABB.js';
import { TBlock } from '../typed_blocks3.js';
import { default as stairs_style } from './stairs.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';


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

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['slope'],
            style.func,
            stairs_style.computeAABB
        );
    }

    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        if(typeof block == 'undefined') {
            return;
        }

        const bm                = style.block_manager
        const pos               = new Vector(x, y, z);

        const texture           = block.material.texture;
        const c                 = bm.calcTexture(texture, DIRECTION.NORTH);
        const c_up              = bm.calcTexture(texture, DIRECTION.UP);
        const c_down            = bm.calcTexture(texture, DIRECTION.DOWN);
        const lm                = IndexedColor.WHITE;
        const cd                = block.getCardinalDirection();
        const on_ceil           = style.isOnCeil(block);
        const anim_frames       = 0;
        const flag              = 0; // QUAD_FLAGS.FLAG_NO_CAN_TAKE_AO;

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

        let deleted = [dirs_name_lower[cd]]

        const _sides = {
            up: new AABBSideParams(c_up, flag, anim_frames, lm, null, false, null, [0.5, 0.5, 0.5]),
            down: new AABBSideParams(c_down, flag, anim_frames, lm, on_ceil ? PLANES.up.axes : null, true, null, [0.5, 0.5, 0 + (on_ceil ? 1 : 0)]),
            south: new AABBSideParams(c, flag, anim_frames, lm, null, true),
            north: new AABBSideParams(c, flag, anim_frames, lm, null, true),
            west: new AABBSideParams(c,  flag, anim_frames, lm, null, true),
            east: new AABBSideParams(c, flag, anim_frames, lm, null, true)
        }

        const side = _sides.up
        side.axes = slope_axes[(cd + (on_ceil ? 2 : 0)) % 4]
        side.offset = [0.5, 0.5, 0.5]
        side.autoUV = false

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

        //
        const cancelDelete = (side : string) => {
            const index = deleted.indexOf(side);
            if(index >= 0) {
                deleted.splice(index, 1);
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
                        deleted.length = 0
                        let side = _sides[dirs_name_lower[(index + 2) % 4]]
                            side.axes = PLANES[dirs_name_lower[(index + 2) % 4]].axes,
                            side.flag = flag
                        //
                        side = _sides[dirs_name_lower[cd]]
                            side.axes    = slope_axes[(index + (on_ceil ? 2 : 0)) % 4]
                            side.autoUV  = false
                            side.offset  = [0.5, 0.5, 0.5]
                            side.uv      = [c[0], c[1], -c[2], c[3] * ((cd == 3 || cd == 2) ? -1 : 1)]
                    }
                    index = (cd + 1) % 4;
                    if(n.getCardinalDirection() == index && on_ceil == n_on_ceil) {
                        deleted.length = 0
                        let side = _sides[dirs_name_lower[(index + 2) % 4]]
                            side.axes    = PLANES[dirs_name_lower[(index + 2) % 4]].axes
                            side.flag    = flag
                            side.uv      = [c[0], c[1], c[2], c[3]]
                        //
                        side = _sides[dirs_name_lower[cd]]
                            side.autoUV  = false
                            side.axes    = slope_axes[(index + (on_ceil ? 2 : 0)) % 4]
                            side.offset  = [0.5, 0.5, 0.5]
                            side.uv      = [c[0], c[1], c[2], c[3] * (((cd == 3 || cd == 2) || (cd == 2 && on_ceil)) ? -1 : 1)]
                    }
                }
            } else if(top_parts_count == 1) {
                // outer corner
                if(ne) {
                    const mir_y =  on_ceil ? 1 : -1;
                    let side = _sides.up
                        side.autoUV = false
                        side.axes   = [[-1, 0, 1 * mir_y], [0, -1, 0]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX
                        side.uv     = [c[0], c[1], c[2], c[3] * mir_y]
                    side = _sides.south
                        side.autoUV = false
                        side.axes   = [[1, 0, 0], [0, 1, 1 * -mir_y]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE
                        side.offset = [0.5, 0.5, 0.5]
                        side.uv     = [c[0], c[1], c[2], c[3] * -mir_y]
                    cancelDelete('south');
                    deleted.push(...['west', dirs_name_lower[(cd + 2) % 4]]);
                }
                if(sw) {
                    const mir_y =  on_ceil ? 1 : -1;
                    let side = _sides.up
                        side.autoUV = false
                        side.axes   = [[-1, 0, 0], [0, -1, 1 * -mir_y]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE
                        side.offset = [0.5, 0.5, 0.5]
                        side.uv     = [c[0], c[1], c[2], c[3] * mir_y]
                    side = _sides.east
                        side.autoUV = false
                        side.axes   = [[1, 0, 1 * mir_y], [0, 1, 0]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX
                        side.offset = [0.5, 0.5, 0.5]
                        side.uv     = [c[0], c[1], c[2], c[3] * -mir_y]
                    cancelDelete('east');
                    deleted.push(...['north', dirs_name_lower[(cd + 2) % 4]]);
                }
                if(wn) {
                    const mir_y =  on_ceil ? 1 : -1;
                    let side = _sides.up
                        side.autoUV = false,
                        side.axes   = [[0, -1, 1 * mir_y], [1, 0, 0]],
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX,
                        side.uv =     [c[0], c[1], c[2], c[3] * mir_y]
                    side = _sides.east
                        side.autoUV = false
                        side.axes   = [[0, 1, 0], [-1, 0, 1 * -mir_y]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE
                        side.offset = [0.5, 0.5, 0.5]
                        side.uv     = [c[0], c[1], c[2], c[3] * -mir_y]
                    cancelDelete('east');
                    deleted.push(...['south', dirs_name_lower[(cd + 2) % 4]]);
                }
                //
                if(es) {
                    const mir_y =  on_ceil ? 1 : -1;
                    let side = _sides.west
                        side.autoUV = false
                        side.axes   = [[0, -1, 0], [1, 0, 1 * -mir_y]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE
                        side.offset = [0.5, 0.5, 0.5]
                        side.uv     = [c[0], c[1], c[2], c[3] * mir_y]
                    side = _sides.up
                        side.autoUV = false,
                        side.axes   = [[0, 1, 1 * mir_y], [-1, 0, 0]]
                        side.flag   = flag | QUAD_FLAGS.FLAG_TRIANGLE | QUAD_FLAGS.FLAG_MIR2_TEX
                        side.uv     = [c[0], c[1], c[2], c[3] * mir_y]
                    cancelDelete('west');
                    deleted.push(...['north', dirs_name_lower[(cd + 2) % 4]]);
                }
            }
        }

        // delete unused
        for(let k of deleted) {
            delete(_sides[k]);
        }

        pushAABB(vertices, _aabb, pivot, matrix, _sides, _center);

    }

    static isOnCeil(block) {
        // на верхней части блока (перевернутый склон)
        return block.extra_data && block.extra_data?.point?.y >= .5;
    }

}