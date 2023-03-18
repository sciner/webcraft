import {calcRotateMatrix, DIRECTION, IndexedColor, QUAD_FLAGS, Vector} from '../helpers.js';
import { BlockManager, DropItemVertices, FakeTBlock } from '../blocks.js';
import {AABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import type { TBlock } from '../typed_blocks3.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import { BlockStyleRegInfo, default as default_style } from './default.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

const WIDTH =  12 / 16;
const HEIGHT = 1 / 16;

// Рамка для предметов
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['item_frame'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB(
            0 + .5 - WIDTH / 2,
            0,
            0 + .5 - WIDTH / 2,
            0 + .5 + WIDTH / 2,
            0 + HEIGHT,
            0 + .5 + WIDTH / 2,
        )
        //
        const cardinal_direction = tblock.getCardinalDirection();
        const matrix = CubeSym.matrices[cardinal_direction];
        // on the ceil
        if(tblock.rotate && tblock.rotate.y == -1) {
            if(tblock.material.tags.includes('rotate_by_pos_n')) {
                aabb.translate(0, 1 - aabb.y_max, 0)
            }
        }
        aabb.applyMatrix(matrix, pivotObj);
        //
        if(expanded) {
            aabb.pad(1/500);
        }
        // aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const bm = style.block_manager
        const material = block.material;
        const c_side = bm.calcTexture(bm.OAK_PLANKS.texture, DIRECTION.DOWN);
        const c_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);
        const parts = []
        parts.push(...[
            {
                "size": {"x": 12, "y": 1, "z": 1},
                "translate": {"x": 0, "y": -7.5, "z": 5.5},
                "faces": {
                    "north": {"uv": [6, 6],"texture": c_side},
                    "south": {"uv": [6, 6],"texture": c_side},
                    "east": {"uv": [6, 6],"texture": c_side},
                    "west": {"uv": [6, 6],"texture": c_side},
                    "up": {"uv": [6, 6],"texture": c_side},
                    "down": {"uv": [6, 6],"texture": c_side}
                }
            },{
                "size": {"x": 12, "y": 1, "z": 1},
                "translate": {"x": 0, "y": -7.5, "z": -5.5},
                "faces": {
                    "north": {"uv": [6, 6],"texture": c_side},
                    "south": {"uv": [6, 6],"texture": c_side},
                    "east": {"uv": [6, 6],"texture": c_side},
                    "west": {"uv": [6, 6],"texture": c_side},
                    "up": {"uv": [6, 6],"texture": c_side},
                    "down": {"uv": [6, 6],"texture": c_side}
                }
            },{
                "size": {"x": 1, "y": 1, "z": 10},
                "translate": {"x": -5.5, "y": -7.5, "z": 0},
                "faces": {
                    "north": {"uv": [6, 6],"texture": c_side},
                    "south": {"uv": [6, 6],"texture": c_side},
                    "east": {"uv": [6, 6],"texture": c_side},
                    "west": {"uv": [6, 6],"texture": c_side},
                    "up": {"uv": [6, 6],"texture": c_side},
                    "down": {"uv": [6, 6],"texture": c_side}
                }
            },{
                "size": {"x": 1, "y": 1, "z": 10},
                "translate": {"x": 5.5, "y": -7.5, "z": 0},
                "faces": {
                    "north": {"uv": [6, 6],"texture": c_side},
                    "south": {"uv": [6, 6],"texture": c_side},
                    "east": {"uv": [6, 6],"texture": c_side},
                    "west": {"uv": [6, 6],"texture": c_side},
                    "up": {"uv": [6, 6],"texture": c_side},
                    "down": {"uv": [6, 6],"texture": c_side}
                }
            },{
                "size": {"x": 10, "y": 0.1, "z": 10},
                "translate": {"x": 0, "y": -8, "z": 0},
                "faces": {
                    "up": {"uv": [8, 8],"texture": c_down},
                    "down": {"uv": [8, 8],"texture": c_down}
                }
            }
        ])

        matrix = mat4.create()
        const rotate = block.rotate || DEFAULT_ROTATE
        const cd = block.getCardinalDirection()
        matrix = calcRotateMatrix(material, rotate, cd, matrix)

        const pos = new Vector(x, y, z)
        for (const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix
            })
        }

        // return item in frame
        if(block.extra_data && block.extra_data.item) {
            const vg = QubatchChunkWorker.drop_item_meshes[block.extra_data.item.id]

            const scale = 0.3

            // old version compatibility
            if(!('rot' in block.extra_data)) {
                block.extra_data.rot = 0
            }

            // Rotate item in frame
            const matRotate = mat4.create()

            // rotate item inside frame
            mat4.rotate(matRotate, matRotate, Math.PI / 4 * block.extra_data.rot + Math.PI, [0, 0, 1])
            mat4.rotate(matRotate, matRotate, Math.PI, [1, 0, 0])
            mat4.scale(matRotate, matRotate, [scale, scale, scale])

            if(rotate.y == 0) {
                let angle = 0
                if(rotate.x == 7) angle = Math.PI / 2 * 2
                if(rotate.x == 18) angle = Math.PI / 2 * 0
                if(rotate.x == 22) angle = Math.PI / 2 * 1
                if(rotate.x == 13) angle = Math.PI / 2 * 3
                mat4.rotate(matRotate, matRotate, angle, [0, 1, 0])
            } else {
                mat4.rotate(matRotate, matRotate, Math.PI/2, [1, 0, 0])
                if(rotate.y == -1) {
                    mat4.rotate(matRotate, matRotate, Math.PI, [0, 0, 1])
                }
            }

            const mesh = new DropItemVertices(block.extra_data.item.id, block.extra_data, new Vector(x, y, z), rotate, matRotate, vg.vertices)
            return [mesh]
        }

        return null

    }

}