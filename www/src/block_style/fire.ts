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
            ['fire'],
            this.func,
            this.computeAABB
        );
    }

    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : World = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const shapes = []
        if(for_physic) {
            return shapes
        }
        const extra_data = tblock.extra_data || {up: true}
        if(extra_data) {
            if (extra_data.north) {
                shapes.push(new AABB(0, 0, 0.94, 1, 1, 1))
            }
            if (extra_data.south) {
                shapes.push(new AABB(0, 0, 0, 1, 1, 0.06))
            }
            if (extra_data.west) {
                shapes.push(new AABB(0, 0, 0, 0.06, 1, 1))
            }
            if (extra_data.east) {
                shapes.push(new AABB(0.94, 0, 0, 1, 1, 1))
            }
            if (extra_data.up) {
                shapes.push(new AABB(0, 0, 0, 1, 0.06, 1))
            }
        }
        return shapes
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager
        const extra_data = block.extra_data || {up: true}
        const material = block.material
        const texture = bm.calcTexture(material.texture, DIRECTION.WEST)
        const planes = []

        if (extra_data) {
            if (extra_data.up) {
                planes.push(..._cache_planes.up);
                if(typeof QubatchChunkWorker != 'undefined') {
                    QubatchChunkWorker.postMessage(['create_block_emitter', {
                        block_pos: block.posworld,
                        pos: [block.posworld.clone().addScalarSelf(.5, .5, .5)],
                        type: 'campfire_flame'
                    }]);
                }
            } else {
                if (extra_data.west) {
                    planes.push(..._cache_planes.west)
                }
                if (extra_data.east) {
                    planes.push(..._cache_planes.east)
                }
                if (extra_data.south) {
                    planes.push(..._cache_planes.south)
                }
                if (extra_data.north) {
                    planes.push(..._cache_planes.north)
                }
            }
        }

        const flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.FLAG_ANIMATED
        const pos = new Vector(x, y, z)
        const lm = IndexedColor.WHITE.clone()
        lm.b = bm.getAnimations(material, 'west')

        for(const plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        pos,
                matrix:     matrix,
                flag:       flag,
                texture:    [...texture]
            });
        }

    }

}