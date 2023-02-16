import {calcRotateMatrix, DIRECTION, IndexedColor, QUAD_FLAGS, Vector} from '../helpers.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { CubeSym } from '../core/CubeSym.js';
import type { BlockManager, FakeTBlock } from '../blocks.js';
import type { TBlock } from '../typed_blocks3.js';
import { BlockStyleRegInfo, default as default_style, TX_SIZE } from './default.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';

const {mat4} = glMatrix;

const DEFAULT_ROTATE = new Vector(0, 1, 0);
const pivotObj = {x: 0.5, y: .5, z: 0.5};

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const _xyz = new Vector(0, 0, 0)

const _petals_parts = [
    [{mx: 12, mz: 14, height: 3}, {mx: 9.5, mz: 9.5, height: 3}, {mx: 14.5, mz: 10.5, height: 3}],
    [{mx: 12.5, mz: 3.5, height: 3}],
    [{mx: 4.5, mz: 1.5, height: 3}, {mx: 1.5, mz: 5.5, height: 3}, {mx: 6.5, mz: 6.5, height: 3}],
    [{mx: 4.5, mz: 12.5, height: 3}]
];

const matrices = [];

function initMat() {
    for (let i=0;i<4;i++) {
        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, i * -(2 * Math.PI));
        matrices.push(matrix);
    }
}

initMat();

// Листья
export default class style {
    [key: string]: any;

    static block_manager : BlockManager

    static getRegInfo(block_manager : BlockManager) : BlockStyleRegInfo {
        style.block_manager = block_manager
        return new BlockStyleRegInfo(
            ['petals'],
            this.func,
            this.computeAABB
        );
    }

    // computeAABB
    static computeAABB(tblock : TBlock | FakeTBlock, for_physic : boolean, world : any = null, neighbours : any = null, expanded: boolean = false) : AABB[] {
        const aabb = new AABB().set(0, 0, 0, 1, .1, 1)
        const cardinal_direction = tblock.getCardinalDirection();
        const matrix = CubeSym.matrices[cardinal_direction]
        // on the ceil
        if(tblock.rotate && tblock.rotate.y == -1) {
            if(tblock.material.tags.includes('rotate_by_pos_n')) {
                aabb.translate(0, 1 - aabb.y_max, 0)
            }
        }
        aabb.applyMatrix(matrix, pivotObj);
        //
        if(!for_physic) {
            aabb.pad(1/500);
        }
        // aabb.pad(1/32)
        return [aabb];
    }

    // Build function
    static func(block : TBlock | FakeTBlock, vertices, chunk : ChunkWorkerChunk, x : number, y : number, z : number, neighbours, biome? : any, dirt_color? : IndexedColor, unknown : any = null, matrix? : imat4, pivot? : number[] | IVector, force_tex ? : tupleFloat4 | IBlockTexture) {

        const material = block.material;
        const count = Math.min(block.extra_data?.petals || 1, 4);
        const flag = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const stem_flags = flag | QUAD_FLAGS.MASK_BIOME

        const lm = dirt_color || IndexedColor.GRASS;

        x -= .5
        z -= .5

        // Textures
        const c_up = style.block_manager.calcMaterialTexture(block.material, DIRECTION.UP, null, null, block);
        const c_stem = style.block_manager.calcMaterialTexture(block.material, 'stem', null, null, block);

        // Rotate
        const rotate = block.rotate || DEFAULT_ROTATE;
        let firstMat = 0;
        if(material.can_rotate && rotate && block.rotate.x > 0) {
            firstMat = (block.rotate.x/54 + 4) %4;
        }

        // Geometries
        const parts = [];
        const planes = [];

        for(let i = 0; i < count; i++) {
            for(let petal of _petals_parts[i]) {

                let {height, mx, mz} = petal;
                const pos = new Vector(x, y - (1 - height / TX_SIZE) / 2, z);

                mx = 16 - mx
                // mz = 16 - mz

                const mat = matrices[(firstMat + i) % 4];
                // stems
                planes.push(...[
                    {
                        pos: pos.add(new Vector(mx / TX_SIZE, 0, mz / TX_SIZE)),
                        // pos: Vector.ZERO,
                        // translate: pos.add(new Vector(mx / TX_SIZE, 0, mz / TX_SIZE)),
                        size: {x: 0, y: 3, z: 1},
                        uv: [0.5, 5.5],
                        rot: [0, Math.PI / 4, 0],
                        matrix: mat
                    },
                    {
                        pos: pos.add(new Vector(mx / TX_SIZE, 0, mz / TX_SIZE)),
                        // pos: Vector.ZERO,
                        // translate: pos.add(new Vector(mx / TX_SIZE, 0, mz / TX_SIZE)),
                        size: {x: 0, y: 3, z: 1},
                        uv: [0.5, 5.5],
                        rot: [0, Math.PI / 4 + Math.PI / 2, 0],
                        matrix: mat
                    }
                ]);

            }

            // // part
            // const height = 3
            // const mx = 0
            // const mz = 0
            // const pos = new Vector(x, y - (1 - height / TX_SIZE) / 2, z);
            // parts.push({
            //     pos,
            //     "size": {"x": 2, "y": height, "z": 2},
            //     "translate": {"x": mx, "y": 0, "z": mz},
            //     "faces": {
            //         // "down":  {"uv": [1, 7], "flag": flag, "texture": c_up},
            //         "up": {"uv": [8, 8], "flag": flag, "texture": c_up},
            //         // "north": {"uv": [1, 11], "flag": flag, "texture": c_up},
            //         // "south": {"uv": [1, 11], "flag": flag, "texture": c_up},
            //         // "west":  {"uv": [1, 11], "flag": flag, "texture": c_up},
            //         // "east":  {"uv": [1, 11], "flag": flag, "texture": c_up}
            //     }
            // });
        }

        // stems
        for(let plane of planes) {
            default_style.pushPlane(vertices, {
                ...plane,
                lm:         lm,
                pos:        plane.pos,
                flag:       stem_flags,
                texture:    c_stem
            });
        }

        // for(let part of parts) {
        //     default_style.pushPART(vertices, {
        //         ...part,
        //         lm:         lm,
        //         pos:        part.pos,
        //         matrix:     matrix
        //     });
        // }

        // const aabb = new AABB(0, 0, 0, 1, .1, 1).translate(x, y, z)
        // _xyz.set(x, y, z)

        // pushAABB(
        //     vertices,
        //     aabb,
        //     pivot,
        //     matrix,
        //     {
        //         up: new AABBSideParams(c_up, 0, 1, null, null, false)
        //     },
        //     _xyz
        // )

        return null

    }

}