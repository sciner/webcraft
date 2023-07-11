import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import { TBlock } from '../typed_blocks3.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';

const CENTER_WIDTH      = 8 / 16;
const CONNECT_X         = 6 / 16;
const CONNECT_Z         = 8 / 16
const CONNECT_HEIGHT    = 14 / 16;
const CONNECT_BOTTOM    = 0 / 16;

const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));

// Забор
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['wall'],
            this.func,
            style.computeAABB,
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const bm                = style.block_manager
        // const CENTER_WIDTH      = 8 / 16
        // const CONNECT_HEIGHT    = 14 / 16
        // const CONNECT_BOTTOM    = 0 / 16
        // const CONNECT_X         = 6 / 16
        // const CONNECT_Z         = 8 / 16
        const height            = for_physic ? 1.5 : CONNECT_HEIGHT
        const shapes            = []
        //
        let zconnects = 0
        let xconnects = 0
        //
        let n = bm.autoNeighbs(world.chunkManager, tblock.posworld, 0, neighbours)
        // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        // South z--
        if(bm.canWallConnect(n.SOUTH)) {
            shapes.push(new AABB(.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, CONNECT_Z/2))
            zconnects++
        }
        // North z++
        if(bm.canWallConnect(n.NORTH)) {
            if(zconnects) {
                shapes.pop()
                shapes.push(new AABB(.5-CONNECT_X/2, CONNECT_BOTTOM, 0, .5-CONNECT_X/2 + CONNECT_X, height, 1))
            } else {
                shapes.push(new AABB(.5-CONNECT_X/2, CONNECT_BOTTOM, .5+CONNECT_Z/2, .5-CONNECT_X/2 + CONNECT_X, height, .5+CONNECT_Z))
            }
            zconnects++
        }
        // West x--
        if(bm.canWallConnect(n.WEST)) {
            shapes.push(new AABB(0, CONNECT_BOTTOM, .5-CONNECT_X/2, CONNECT_Z/2, height, .5-CONNECT_X/2 + CONNECT_X))
            xconnects++
        }
        // East x++
        if(bm.canWallConnect(n.EAST)) {
            if(xconnects) {
                shapes.pop();
                shapes.push(new AABB(0, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X))
            } else {
                shapes.push(new AABB(1 - CONNECT_Z/2, CONNECT_BOTTOM, .5-CONNECT_X/2, 1, height, .5-CONNECT_X/2 + CONNECT_X))
            }
            xconnects++
        }
        if((zconnects == 2 && xconnects == 0) || (zconnects == 0 && xconnects == 2)) {
            // do nothing
        } else {
            // Central
            shapes.push(new AABB(
                .5-CENTER_WIDTH/2, 0, .5-CENTER_WIDTH/2,
                .5+CENTER_WIDTH/2, Math.max(height, 1), .5+CENTER_WIDTH/2
            ))
        }
        return shapes
    }

    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager

        // Texture
        const c = bm.calcMaterialTexture(block.material, DIRECTION.UP);

        let zconnects = 0;
        let xconnects = 0;
        const sz = 1024

        //
        const checkDiag = (n1, n2) => {
            if(neighbours.UP?.material?.style_name != 'wall') {
                return false;
            }
            if(neighbours[n1].tb) {
                const east_neighbours = neighbours[n1].tb.getNeighbours(neighbours[n1], null, BLOCK_CACHE);
                return east_neighbours[n2] && east_neighbours[n2].material.style_name == 'wall';
            }
            return false;
        };

        // South and North
        const ss = bm.canWallConnect(neighbours.SOUTH);
        const sn = bm.canWallConnect(neighbours.NORTH);
        // South
        if(ss) {
            let h = checkDiag('SOUTH', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + ((1-h)/2) * 16 / sz, c[2], c[3]]
            push_part(vertices, c2, x + .5, y + CONNECT_BOTTOM, z + .25, CONNECT_X, .5, h);
            zconnects++;
        }
        // North
        if(sn) {
            let h = checkDiag('NORTH', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + ((1-h)/2) * 16 / sz, c[2], c[3]]
            push_part(vertices, c2, x + .5, y + CONNECT_BOTTOM, z + .75, CONNECT_X, .5, h);
            zconnects++;
        }

        // West and East
        const sw = bm.canWallConnect(neighbours.WEST);
        const se = bm.canWallConnect(neighbours.EAST);
        // West
        if(sw) {
            let h = checkDiag('WEST', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + ((1-h)/2) * 16 / sz, c[2], c[3]]
            push_part(vertices, c2, x + .25, y + CONNECT_BOTTOM, z + .5, .5, CONNECT_X, h);
            xconnects++;
        }
        // East
        if(se) {
            let h = checkDiag('EAST', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + ((1-h)/2) * 16 / sz, c[2], c[3]]
            push_part(vertices, c2, x + .75, y + CONNECT_BOTTOM, z + .5, .5, CONNECT_X, h);
            xconnects++;
        }

        let draw_center = !(zconnects == 2 && xconnects == 0 || zconnects == 0 && xconnects == 2);
        if(!draw_center) {
            draw_center = neighbours.UP && neighbours.UP.id > 0;
        }

        if(draw_center) {
            push_part(vertices, c, x + .5, y, z + .5, CENTER_WIDTH, CENTER_WIDTH, 1);
        }

    }

}

function push_part(vertices, c, x, y, z, xs, zs, h) {
    let pp          = IndexedColor.WHITE.packed;
    let flags       = 0;
    let sideFlags   = 0;
    let upFlags     = 0;
    // TOP
    vertices.push(x, z, y + h,
        xs, 0, 0,
        0, zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        pp, flags | upFlags);
    // BOTTOM
    vertices.push(x, z, y,
        xs, 0, 0,
        0, -zs, 0,
        c[0], c[1], c[2] * xs, c[3] * zs,
        pp, flags);
    // SOUTH
    vertices.push(x, z - zs/2, y + h/2,
        xs, 0, 0,
        0, 0, h,
        c[0], c[1], c[2]*xs, -c[3]*h,
        pp, flags | sideFlags);
    // NORTH
    vertices.push(x, z + zs/2, y + h/2,
        xs, 0, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*xs, c[3]*h,
        pp, flags | sideFlags);
    // WEST
    vertices.push(x - xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, -h,
        c[0], c[1], -c[2]*zs, c[3]*h,
        pp, flags | sideFlags);
    // EAST
    vertices.push(x + xs/2, z, y + h/2,
        0, zs, 0,
        0, 0, h,
        c[0], c[1], c[2]*zs, -c[3]*h,
        pp, flags | sideFlags);
}