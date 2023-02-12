"use strict";

import {Color, DIRECTION, IndexedColor, QUAD_FLAGS, TX_CNT} from '../helpers.js';
import {impl as alea} from "../../vendors/alea.js";
import {BLOCK} from "../blocks.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import { AABB } from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { DEFAULT_ATLAS_SIZE } from '../constant.js';

const {mat3} = glMatrix;

const defaultPivot = [0.5, 0.5, 0.5];
const defaultMatrix = mat3.create();
const aabb = new AABB();

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_redstone_texture');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = Math.round(a.double() * 100);
}

export function pushTransformed(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    pp, flags
) {
    pivot = pivot || defaultPivot;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix,
    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2],
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8],
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5],

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, pp, flags
    );
}

export default class style {

    static getRegInfo() {
        return {
            styles: ['redstone'],
            func: this.func,
            aabb: this.computeAABB
        };
    }

    // computeAABB
    static computeAABB(block) {
        let hw = 1 / 2;
        let sign_height = .05;
        aabb.set(
            .5-hw, 0, .5-hw,
            .5+hw, sign_height, .5+hw
        );
        return [aabb];
    }

    // Pushes the vertices necessary for rendering a specific block into the array.
    static func(block, vertices, chunk, x, y, z, neighbours, biome, dirt_color, _unknown, matrix = null, pivot = null, force_tex) {

        let index               = Math.abs(Math.round(x * CHUNK_SIZE_Z + z)) % 256;
        const r                 = randoms[index];
        const H                 = 1;
        const flags             = QUAD_FLAGS.FLAG_MASK_COLOR_ADD;

        const material          = block.material;
        const redstone_textures = material.redstone.textures;
        const tx_cnt            = material.tx_cnt;

        // Texture color multiplier
        // @todo from extra_data.signal
        const lm                = new IndexedColor(1.5 / tx_cnt * DEFAULT_ATLAS_SIZE, (16.5 + 1 / 16) / tx_cnt * DEFAULT_ATLAS_SIZE, 0, 0);
        const pp                = lm.pack();
        const posworld          = block.posworld;

        const upper_neighbours_connect = {
            south: BLOCK.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x, posworld.y + 1, posworld.z - 1)), // z--
            north: BLOCK.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x, posworld.y + 1, posworld.z + 1)), // z++
            west: BLOCK.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x - 1, posworld.y + 1, posworld.z)), // x--
            east: BLOCK.canRedstoneDustConnect(chunk.chunkManager.getBlock(posworld.x + 1, posworld.y + 1, posworld.z)) // x++
        };

        const neighbours_connect = {
            south: BLOCK.canRedstoneDustConnect(neighbours.SOUTH) || upper_neighbours_connect.south,
            north: BLOCK.canRedstoneDustConnect(neighbours.NORTH) || upper_neighbours_connect.north,
            west: BLOCK.canRedstoneDustConnect(neighbours.WEST) || upper_neighbours_connect.west,
            east: BLOCK.canRedstoneDustConnect(neighbours.EAST) || upper_neighbours_connect.east
        };

        let zconnects = 0;
        let xconnects = 0;

        const c_line = BLOCK.calcTexture(redstone_textures.line[r % redstone_textures.line.length], DIRECTION.UP, tx_cnt);

        // South z--
        if(neighbours_connect.south) {
            zconnects++;
        }
        // North z++
        if(neighbours_connect.north) {
            zconnects++;
        }
        // West x--
        if(neighbours_connect.west) {
            xconnects++;
        }
        // East x++
        if(neighbours_connect.east) {
            xconnects++;
        }

        let y_plus = 1/100;

        function drawZ(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, 1, 0,
                ...c_line,
                pp, flags);
        }

        function drawSouth(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z - .25, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, .5, 0,
                c_line[0] - .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                pp, flags);
        }

        function drawNorth(x, y, z) {
            y_plus += 1/500;
            pushTransformed(
                vertices, matrix, pivot,
                x, z + .25, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, .5, 0,
                c_line[0] + .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                pp, flags);
        }

        function drawX(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, 1, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                .5, .5, 0,
                ...top_vectors,
                ...c_line,
                pp, flags);
        }

        function drawWest(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, .5, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x - .25, z, y + y_plus,
                .5, .5, 0,
                ...top_vectors,
                c_line[0] - .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                pp, flags);
        }

        function drawEast(x, y, z) {
            y_plus += 1/500;
            let top_vectors = [0, -1, 0, .5, 0, 0];
            pushTransformed(
                vertices, matrix, pivot,
                x + .25, z, y + y_plus,
                0.5, 0.5, 0,
                ...top_vectors,
                c_line[0] + .25/16/32, c_line[1], c_line[2], c_line[3]/2,
                pp, flags);
        }

        // 1.1
        if(zconnects > 0) {
            if(zconnects == 2) {
                drawZ(x, y, z);
            } else {
                if(neighbours_connect.south) {
                    drawSouth(x, y, z);
                } else if(neighbours_connect.north) {
                    drawNorth(x, y, z);
                }
            }
        }

        // 1.2
        if(xconnects > 0) {
            if(xconnects == 2) {
                drawX(x, y, z)
            } else {
                if(neighbours_connect.west) {
                    drawWest(x, y, z);
                } else if(neighbours_connect.east) {
                    drawEast(x, y, z);
                }
            }
            y_plus += 1/500;
        }

        // 1.3 Center
        const draw_center = !(zconnects == 2 && xconnects == 0 || zconnects == 0 && xconnects == 2);
        if(draw_center) {
            const c_center = BLOCK.calcTexture(redstone_textures.dot[r % redstone_textures.dot.length], DIRECTION.UP, tx_cnt);
            pushTransformed(
                vertices, matrix, pivot,
                x, z, y + y_plus,
                0.5, 0.5, 0,
                1, 0, 0,
                0, 1, 0,
                ...c_center,
                pp, flags);
        }

        // 2. Draw connects in upper neighbours
        if(upper_neighbours_connect.south) {
            drawNorth(x, y + 1, z - 1)
        }
        if(upper_neighbours_connect.north) {
            drawSouth(x, y + 1, z + 1)
        }
        if(upper_neighbours_connect.west) {
            drawEast(x - 1, y + 1, z)
        }
        if(upper_neighbours_connect.east) {
            drawWest(x + 1, y + 1, z)
        }

        // 3. Draw vertical to neighbours

        // South
        if(upper_neighbours_connect.south) {
            let animations_south = 1;
            let pp2 = IndexedColor.packArg(lm.r, lm.g, animations_south);
            pushTransformed(
                vertices, matrix, pivot,
                x, z + 1/500, y,
                .5, .5 - 1 / 2, H / 2,
                1, 0, 0,
                0, 0, H,
                c_line[0], c_line[1], c_line[2], -c_line[3],
                pp2, flags);
        }

        // North
        if(upper_neighbours_connect.north) {
            let animations_north = 1;
            let pp2 = IndexedColor.packArg(lm.r, lm.g, animations_north);
            pushTransformed(
                vertices, matrix, pivot,
                x, z - 1/500, y,
                .5, .5 + 1 / 2, H / 2,
                1, 0, 0,
                0, 0, -H,
                c_line[0], c_line[1], -c_line[2], c_line[3],
                pp2, flags);
        }

        // West
        if(upper_neighbours_connect.west) {
            let animations_west = 1;
            let pp2 = IndexedColor.packArg(lm.r, lm.g, animations_west);
            pushTransformed(
                vertices, matrix, pivot,
                x + 1/500, z, y,
                .5 - 1 / 2, .5, H / 2,
                0, 1, 0,
                0, 0, -H,
                c_line[0], c_line[1], -c_line[2], c_line[3],
                pp2, flags);
        }

        // East
        if(upper_neighbours_connect.east) {
            let animations_east = 1;
            let pp2 = IndexedColor.packArg(lm.r, lm.g, animations_east);
            pushTransformed(
                vertices, matrix, pivot,
                x - 1/500, z, y,
                .5 + 1 / 2, .5, H / 2,
                0, 1, 0,
                0, 0, H,
                c_line[0], c_line[1], c_line[2], -c_line[3],
                pp2, flags);
        }

    }

}