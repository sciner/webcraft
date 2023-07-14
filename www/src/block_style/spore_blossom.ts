import { DIRECTION, QUAD_FLAGS, IndexedColor, Vector } from '../helpers.js';
import { AABB } from '../core/AABB.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';
import glMatrix from '@vendors/gl-matrix-3.3.min.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import type { World } from '../world.js';

const _cache_planes = {
    up: [
        Object.freeze({"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, -Math.PI / 4], "translate": {"x": 0, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [-Math.PI / 2, Math.PI / 4, -Math.PI / 2], "translate": {"x": 0, "y": 0, "z": 0}}),
        Object.freeze({"size": {"x": 16, "y": 16, "z": 16}, "uv": [8, 8], "rot": [Math.PI / 2, Math.PI / 4, Math.PI / 2], "translate": {"x": 0, "y": 0, "z": 0}}),
    ],
    west: [{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}],
    east: [{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}],
    north: [{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, -Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}],
    south: [{"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, Math.PI / 2, 0], "translate": {"x": 7.99, "y": 0, "z": 0}}],
}

const {mat4} = glMatrix;

// fire
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['spore_blossom'],
            this.func,
            this.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        return [new AABB(
            0,
            0,
            0,
            1,
            1,
            1,
        )]
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager
        const material = block.material
        const base = bm.calcTexture(material.texture, DIRECTION.DOWN)
        const flower = bm.calcTexture(material.texture, DIRECTION.UP)

        


        const planes = []
        planes.push(...[
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, -Math.PI / 2], "translate": {"x": 7, "y": 0, "z": 0}, "texture" : base},
            {"size": {"x": 0, "y": 16, "z": 16}, "uv": [8, 8], "rot": [0, 0, 0], "translate": {"x": 0, "y": 0, "z": 0}, "texture" : flower}
        ])
        const flag = QUAD_FLAGS.FLAG_NO_AO
        const pos = new Vector(x, y, z)
        const lm = IndexedColor.WHITE

        for(const plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...plane.texture]
            })
        }

    }

}