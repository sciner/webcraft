import {DIRECTION, IndexedColor, Vector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import { TBlock } from '../typed_blocks3.js';

const CENTER_WIDTH      = 8 / 16;
const CONNECT_X         = 6 / 16;
const CONNECT_HEIGHT    = 14 / 16;
const CONNECT_BOTTOM    = 0 / 16;

const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0, 0, 0)));

// Забор
export default class style {

    static getRegInfo() {
        return {
            styles: ['wall'],
            func: this.func
        };
    }

    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, unknown, matrix, pivot, force_tex) {

        if(!block || typeof block == 'undefined' || block.id == BLOCK.AIR.id) {
            return;
        }

        // Texture
        const c = BLOCK.calcMaterialTexture(block.material, DIRECTION.UP);

        let zconnects = 0;
        let xconnects = 0;

        //
        const checkDiag = (n1, n2) => {
            if(neighbours.UP?.material?.style != 'wall') {
                return false;
            }
            if(neighbours[n1].tb) {
                const east_neighbours = neighbours[n1].tb.getNeighbours(neighbours[n1], null, BLOCK_CACHE);
                return east_neighbours[n2] && east_neighbours[n2].material.style == 'wall';
            }
            return false;
        };

        // South and North
        const ss = BLOCK.canWallConnect(neighbours.SOUTH);
        const sn = BLOCK.canWallConnect(neighbours.NORTH);
        // South
        if(ss) {
            let h = checkDiag('SOUTH', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + (1 - h) * 16 / 1024, c[2], c[3]];
            push_part(vertices, c2, x + .5, y + CONNECT_BOTTOM, z + .25, CONNECT_X, .5, h);
            zconnects++;
        }
        // North
        if(sn) {
            let h = checkDiag('NORTH', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + (1 - h) * 16 / 1024, c[2], c[3]];
            push_part(vertices, c2, x + .5, y + CONNECT_BOTTOM, z + .75, CONNECT_X, .5, h);
            zconnects++;
        }

        // West and East
        const sw = BLOCK.canWallConnect(neighbours.WEST);
        const se = BLOCK.canWallConnect(neighbours.EAST);
        // West
        if(sw) {
            let h = checkDiag('WEST', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + (1 - h) * 16 / 1024, c[2], c[3]];
            push_part(vertices, c2, x + .25, y + CONNECT_BOTTOM, z + .5, .5, CONNECT_X, h);
            xconnects++;
        }
        // East
        if(se) {
            let h = checkDiag('EAST', 'UP') ? 1 : CONNECT_HEIGHT;
            const c2 = [c[0], c[1] + (1 - h) * 16 / 1024, c[2], c[3]];
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