import {DIRECTION, AlphabetTexture, Vector, IndexedColor, TX_CNT} from '../helpers.js';
import {BlockManager, FakeTBlock} from "../blocks.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import {CubeSym} from "../core/CubeSym.js";
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';
import { SIGN_POSITION } from '../constant.js';


const {mat4} = glMatrix;

const CENTER_WIDTH      = 1.9 / 16;
const CONNECT_X         = 16 / 16;
const CONNECT_Z         = 2 / 16;
const CONNECT_HEIGHT    = 8 / 16;
const BOTTOM_HEIGHT     = .6;
const EMPTY_ARRAY       = []

const cubeSymAxis = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
];

// Табличка
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['sign'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {

        const rot           = tblock.rotate ?? Vector.ZERO
        const on_ceil       = rot.y == SIGN_POSITION.CEIL
        const on_wall_alt   = rot.y == SIGN_POSITION.WALL_ALT
        const on_floor      = rot.y == SIGN_POSITION.FLOOR

        if(on_wall_alt) {
            const aabb1 = new AABB(7/16, 0, 0, 9/16, 1, 1)
            if(for_physic) {
                aabb1.y_min = 14/16
            }
            aabb1.rotate((rot.x + 1) % 4, aabb1.center);
            return [aabb1]
        }

        if(for_physic) {
            return EMPTY_ARRAY
        }

        let x           = 0;
        let y           = 0;
        let z           = 0;
        let aabb        = null;
        const resp      = [];
        const width     = .5;
        const height    = 1;

        // Center
        if(tblock.rotate.y == 0) {
            const mul = 1.01;
            aabb = new AABB();
            aabb.set(
                x + .5 - CONNECT_X*mul/2,
                y + .6,
                z + .5 - CONNECT_Z*mul/2,
                x + .5 + CONNECT_X*mul/2,
                y + .6 + CONNECT_HEIGHT*mul,
                z + .5 + CONNECT_Z*mul/2,
            );
            const dist = -(.5 - aabb.depth / 2);
            const dir = CubeSym.dirAdd(tblock.rotate.x, CubeSym.ROT_Y2);
            aabb.rotate(dir, aabb.center);
            aabb.translate(cubeSymAxis[dir][0] * dist, -(.2 + aabb.height) / 2, cubeSymAxis[dir][1] * dist);
        } else {
            aabb = new AABB();
            aabb.set(
                x + .5 - width/2,
                y,
                z + .5 - width/2,
                x + .5 + width/2,
                y + height,
                z + .5 + width/2,
            );
            resp.push(aabb);
        }

        return [aabb];

    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        if(!block || typeof block == 'undefined') {
            return
        }

        const bm            = style.block_manager
        const c             = bm.calcMaterialTexture(block.material, DIRECTION.UP)
        const c_chain       = bm.calcTexture(bm.CHAIN.texture, DIRECTION.UP)
        const rot           = block.rotate ?? Vector.ZERO
        const on_ceil       = rot.y == SIGN_POSITION.CEIL
        const on_wall_alt   = rot.y == SIGN_POSITION.WALL_ALT
        const on_floor      = rot.y == SIGN_POSITION.FLOOR
        const aabb          = style.makeAABBSign(block, x, y, z)

        matrix = mat4.create()
        if(on_ceil || on_floor) {
            mat4.rotateY(matrix, matrix, ((block.rotate.x - 2) / 4) * (2 * Math.PI))
        } else {
            mat4.rotateY(matrix, matrix, -((block.rotate.x - 2) / 4) * (2 * Math.PI))
        }

        if(on_ceil) {
            aabb.expand(-1/16, 0, 0)
            aabb.translate(0, -(aabb.y_min - y), 0)
            // TODO: нарисовать вот тут цепи между aabb и верхним блоком
            if (neighbours.UP.id == block.id && (Math.abs(neighbours.UP.rotate.x - rot.x) > 0.01 && Math.abs(neighbours.UP.rotate.x - rot.x) < 1.99)) {
                style.drawChainTilt(vertices, x, y, z, c_chain, pivot, matrix, (aabb.y_max - y))
            } else {
                style.drawChain(vertices, x, y, z, c_chain, pivot, matrix, (aabb.y_max - y))
            }
        } else if(on_wall_alt) {
            const wall_fixture = aabb.clone()
            aabb.expand(-1/16, 0, 0)
            aabb.translate(0, -(aabb.y_min - y), 0)
            // настенный крепеж
            wall_fixture.y_max = wall_fixture.y_min + aabb.depth
            wall_fixture.translate(0, 1 - (wall_fixture.y_max % 1), 0)
            // Push wall fixture vertices
            pushAABB(
                vertices,
                wall_fixture,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c, 0, 0, null, null, true),
                    down:   new AABBSideParams(c, 0, 0, null, null, true),
                    south:  new AABBSideParams(c, 0, 0, null, null, true),
                    north:  new AABBSideParams(c, 0, 0, null, null, true),
                    west:   new AABBSideParams(c, 0, 0, null, null, true),
                    east:   new AABBSideParams(c, 0, 0, null, null, true),
                },
                new Vector(x, y, z)
            )
            // TODO: нарисовать вот тут цепи между aabb и wall_fixture
            style.drawChain(vertices, x, y, z, c_chain, pivot, matrix, (aabb.y_max - y))
        }

        // Push vertices
        pushAABB(
            vertices,
            aabb,
            pivot,
            matrix,
            {
                up:     new AABBSideParams(c, 0, 0, null, null, true), // flag: 0, anim: 1 implicit
                down:   new AABBSideParams(c, 0, 0, null, null, true),
                south:  new AABBSideParams(c, 0, 0, null, null, true),
                north:  new AABBSideParams(c, 0, 0, null, null, true),
                west:   new AABBSideParams(c, 0, 0, null, null, true),
                east:   new AABBSideParams(c, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )

        // Central stick
        if(on_floor) {
            const aabb_down = new AABB(
                x + .5 - CENTER_WIDTH/2,
                y,
                z + .5 - CENTER_WIDTH/2,
                x + .5 + CENTER_WIDTH/2,
                y + BOTTOM_HEIGHT,
                z + .5 + CENTER_WIDTH/2,
            )
            // Push vertices of central stick
            const c_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);
            pushAABB(
                vertices,
                aabb_down,
                pivot,
                matrix,
                {
                    up:     new AABBSideParams(c_down, 0, 1, null, null, true), // flag: 0, anim: 1 implicit
                    down:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    south:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    north:  new AABBSideParams(c_down, 0, 1, null, null, true),
                    west:   new AABBSideParams(c_down, 0, 1, null, null, true),
                    east:   new AABBSideParams(c_down, 0, 1, null, null, true),
                },
                new Vector(x, y, z)
            )
        }

        const text_block = style.makeTextBlock(block, aabb, pivot, matrix, x, y, z)
        if(text_block) {
            return [text_block]
        }

        return null;

    }

    static drawChainTilt(vertices, x, y, z, texture, pivot, matrix, pos) {
        const sh_chain = 0.22
        const big = [texture[0] - TX_CNT / (2 * 10000), texture[1], texture[2], texture[3]]
        const small = [texture[0] - TX_CNT / 10000, texture[1], texture[2], texture[3]]
        const aabb = new AABB()
        aabb.set(
            x + .4, y, z + .5,
            x + .6, y + 0.56, z + .5
        )
        aabb.translate(sh_chain, 0.4, 0)
        let m = new mat4.create()
        mat4.rotateZ(m, matrix, Math.PI / 8)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(big, 0, 0, null, null, true),
                north: new AABBSideParams(big, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        aabb.translate(-2 * sh_chain, 0, 0)
        mat4.rotateZ(m, matrix, -Math.PI / 8)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(big, 0, 0, null, null, true),
                north: new AABBSideParams(big, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        // малые звенья слева и права 
        m = new mat4.create()
        mat4.rotateY(m, matrix, Math.PI / 2)
        mat4.rotateX(m, m, -Math.PI / 8)
        aabb.translate(sh_chain, 0, sh_chain)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(small, 0, 0, null, null, true),
                north: new AABBSideParams(small, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        mat4.rotateY(m, matrix, Math.PI / 2)
        mat4.rotateX(m, m, Math.PI / 8)
        aabb.translate(0, 0, -2 * sh_chain)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(small, 0, 0, null, null, true),
                north: new AABBSideParams(small, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
    }

    static drawChain(vertices, x, y, z, texture, pivot, matrix, pos, ) {
        const sh_chain = 3 / 16
        const big = [texture[0] - TX_CNT / (2 * 10000), texture[1], texture[2], texture[3]]
        const small = [texture[0] - TX_CNT / 10000, texture[1], texture[2], texture[3]]
        const aabb = new AABB()
        aabb.set(
            x + .4, y, z + .5,
            x + .6, y + (1 - pos), z + .5
        )
        aabb.translate(sh_chain, pos, sh_chain)
        let m = new mat4.create()
        mat4.rotateY(m, matrix, Math.PI / 4)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(big, 0, 0, null, null, true),
                north: new AABBSideParams(big, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        aabb.translate(-2 * sh_chain, 0, -2 * sh_chain)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(big, 0, 0, null, null, true),
                north: new AABBSideParams(big, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        // малые звенья слева и права 
        m = new mat4.create()
        mat4.rotateY(m, matrix, -Math.PI / 4)
        aabb.translate(0, 0, 2 * sh_chain)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(small, 0, 0, null, null, true),
                north: new AABBSideParams(small, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
        aabb.translate(2 * sh_chain, 0, -2 * sh_chain)
        pushAABB(
            vertices,
            aabb,
            pivot,
            m,
            {
                south: new AABBSideParams(small, 0, 0, null, null, true),
                north: new AABBSideParams(small, 0, 0, null, null, true),
            },
            new Vector(x, y, z)
        )
    }

    //
    static makeAABBSign(tblock : TBlock | FakeTBlock, x : int, y : int, z : int) {

        const rot           = tblock.rotate ?? Vector.ZERO
        const draw_bottom   = rot ? (rot.y != 0) : true
        const is_bb         = !!tblock.material.bb

        const connect_z = is_bb ? 3/32 : CONNECT_Z

        const aabb = new AABB(
            x + .5 - CONNECT_X / 2,
            y + .6,
            z + .5 - connect_z / 2,
            x + .5 + CONNECT_X / 2,
            y + .6 + CONNECT_HEIGHT,
            z + .5 + connect_z / 2,
        )

        
        if(is_bb) {
            let tz = 0
            let ty = -.725/32
            if(!draw_bottom) {
                ty += -5/16
                tz = .5 - aabb.depth / 2
            }
            aabb.translate(0, ty, tz)
        } else {
            if(!draw_bottom) {
                aabb.translate(0, -(.2 + aabb.height) / 2, .5 - aabb.depth / 2)
            }
        }

        return aabb

    }

    // Return text block
    static makeTextBlock(tblock : TBlock | FakeTBlock, aabb : AABB, pivot, matrix, x : number, y : number, z : number) {
        if(tblock.extra_data) {
            const text = tblock.extra_data?.text;
            if(text) {
                const sign = [];
                if(tblock.extra_data.username) sign.push(tblock.extra_data.username);
                if(tblock.extra_data.dt) sign.push(new Date(tblock.extra_data.dt || Date.now()).toISOString().slice(0, 10));
                return new FakeTBlock(
                    style.block_manager.TEXT.id,
                    {
                        ...tblock.extra_data,
                        bb:     !!tblock.material.bb,
                        aabb:   aabb,
                        chars:  AlphabetTexture.getStringUVs(text),
                        sign:   sign.length > 0 ? AlphabetTexture.getStringUVs(sign.join(' | ')) : null
                    },
                    new Vector(x, y, z),
                    tblock.rotate ?? Vector.ZERO,
                    pivot,
                    matrix
                );
            }
        }
        return null
    }

}