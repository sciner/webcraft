import { DIRECTION, IndexedColor, ROTATE } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import type { BlockManager } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';

// Забор
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) {
        style.block_manager = block_manager
        return {
            styles: ['fence'],
            func: this.func,
            aabb: this.computeAABB
        };
    }
    
    static computeAABB(tblock : TBlock, for_physic : boolean, world : any, neighbours : any, expanded?: boolean) : AABB[] {
        const bm = style.block_manager
        const shapes = []
        if(!world) {
            console.error('error_empty_world_for_compute_aabb')
            return shapes
        }
        const height = for_physic ? 1.5 : 1
        //
        const n = bm.autoNeighbs(world.chunkManager, tblock.posworld, 0, neighbours)
        // world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        // South z--
        if(bm.canFenceConnect(n.SOUTH)) {
            shapes.push(new AABB(.5-2/16, 5/16, 0, .5+2/16, height, .5+2/16))
        }
        // North z++
        if(bm.canFenceConnect(n.NORTH)) {
            shapes.push(new AABB(.5-2/16, 5/16, .5-2/16, .5+2/16, height, 1))
        }
        // West x--
        if(bm.canFenceConnect(n.WEST)) {
            shapes.push(new AABB(0, 5/16, .5-2/16, .5+2/16, height, .5+2/16))
        }
        // East x++
        if(bm.canFenceConnect(n.EAST)) {
            shapes.push(new AABB(.5-2/16, 5/16, .5-2/16, 1, height, .5+2/16))
        }
        // Central
        shapes.push(new AABB(.5-2/16, 0, .5-2/16, .5+2/16, height, .5+2/16))
        return shapes
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        const bm = style.block_manager
        const cardinal_direction = block.getCardinalDirection();

        let DIRECTION_BACK          = DIRECTION.BACK;
        let DIRECTION_RIGHT         = DIRECTION.RIGHT;
        let DIRECTION_FORWARD       = DIRECTION.FORWARD;
        let DIRECTION_LEFT          = DIRECTION.LEFT;

        if(!block.material.name) {
            console.error('block', JSON.stringify(block), block.id);
            debugger;
        }

        let texture                 = block.material.texture;

        // F R B L
        switch(cardinal_direction) {
            case ROTATE.S: {
                break;
            }
            case ROTATE.W: {
                DIRECTION_BACK      = DIRECTION.LEFT;
                DIRECTION_RIGHT     = DIRECTION.BACK;
                DIRECTION_FORWARD   = DIRECTION.RIGHT;
                DIRECTION_LEFT      = DIRECTION.FORWARD;
                break;
            }
            case ROTATE.N: {
                DIRECTION_BACK      = DIRECTION.FORWARD;
                DIRECTION_RIGHT     = DIRECTION.LEFT;
                DIRECTION_FORWARD   = DIRECTION.BACK;
                DIRECTION_LEFT      = DIRECTION.RIGHT;
                break;
            }
            case ROTATE.E: {
                DIRECTION_BACK      = DIRECTION.RIGHT;
                DIRECTION_RIGHT     = DIRECTION.FORWARD;
                DIRECTION_FORWARD   = DIRECTION.LEFT;
                DIRECTION_LEFT      = DIRECTION.BACK;
                break;
            }
        }

        let tex = bm.calcTexture(texture, DIRECTION_FORWARD);
        push_part(vertices, tex, x + .5, y, z + .5, 4/16, 4/16, 1);

        const add_middle = false;

        // South
        if(bm.canFenceConnect(neighbours.SOUTH)) {
            push_part(vertices, tex, x + .5, y + 6/16, z + .5 - 5/16, 2/16, 6/16, 2/16,);
            push_part(vertices, tex, x + .5, y + 12/16, z + .5 - 5/16, 2/16, 6/16, 2/16);
            if(add_middle) {
                push_part(vertices, tex, x + .5, y, z + 1/16, 4/16, 2/16, 1);
            }
        }
        // North
        if(bm.canFenceConnect(neighbours.NORTH)) {
            push_part(vertices, tex, x + .5, y + 6/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
            push_part(vertices, tex, x + .5, y + 12/16, z + .5 + 5/16, 2/16, 6/16, 2/16);
            if(add_middle) {
                push_part(vertices, tex, x + .5, y, z + 1 - 1/16, 4/16, 2/16, 1);
            }
        }
        // West
        if(bm.canFenceConnect(neighbours.WEST)) {
            push_part(vertices, tex, x + .5 - 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part(vertices, tex, x + .5 - 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
            if(add_middle) {
                push_part(vertices, tex, x + 1/16, y, z + .5, 2/16, 4/16, 1);
            }
        }
        // East
        if(bm.canFenceConnect(neighbours.EAST)) {
            push_part(vertices, tex, x + .5 + 5/16, y + 6/16, z + .5, 6/16, 2/16, 2/16);
            push_part(vertices, tex, x + .5 + 5/16, y + 12/16, z + .5, 6/16, 2/16, 2/16);
            if(add_middle) {
                push_part(vertices, tex, x + 1 - 1/16, y, z + .5, 2/16, 4/16, 1);
            }
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