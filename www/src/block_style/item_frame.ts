import {calcRotateMatrix, DIRECTION, IndexedColor, QUAD_FLAGS, Vector} from '../helpers.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
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

const WIDTH_INNER = 10/16;
const HEIGHT_INNER = .5/16;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

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
        const flags = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.NO_AO;

        const c_side = bm.calcTexture(bm.OAK_PLANKS.texture, DIRECTION.DOWN);
        const c_down = bm.calcMaterialTexture(block.material, DIRECTION.DOWN);

        const parts = []
        parts.push(...[
            {
                "size": {"x": 1, "y": 12, "z": 1},
                "translate": {"x": 7.5, "y": 0, "z": 6},
                "faces": {
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            },{
                "size": {"x": 1, "y": 1, "z": 12},
                "translate": {"x": 7.5, "y": 6, "z": 0},
                "faces": {
                    "north": {"uv": [8, 8],"texture": c_side},
                    "south": {"uv": [8, 8],"texture": c_side},
                    "east": {"uv": [8, 8],"texture": c_side},
                    "west": {"uv": [8, 8],"texture": c_side}
                }
            }
        ])
        const pos = new Vector(x, y, z)
        for (const part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         IndexedColor.WHITE,
                pos:        pos,
                matrix:     matrix
            })
        }
        return null;

    }

}