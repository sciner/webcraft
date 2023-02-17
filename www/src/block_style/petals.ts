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

const _petals_parts = [
    {height: 1.5, stems: [{mx: 11.5, mz: 14.5}, {mx: 9.5, mz: 9.5}, {mx: 14.5, mz: 10.5}]},
    {height: 0.5, stems: [{mx: 12.5, mz: 4.5}]},
    {height: 1.0, stems: [{mx: 4.0, mz: 2.0}, {mx: 1.5, mz: 5.5}, {mx: 6.5, mz: 6.5}]},
    {height: 1.0, stems: [{mx: 3.5, mz: 12.5}]}
];

const flower_poses = [
    {x: 12, z: 12, uv: [4, 4]},
    {x: 4, z: 12,  uv: [12, 4]},
    {x: 4, z: 4,   uv: [12, 12]},
    {x: 12, z: 4,  uv: [4, 12]}
]

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
        let ang = 0, xx = 0;
        if(material.can_rotate && rotate && rotate.x > 0) {
            xx = (rotate.x % 4 + 4) % 4;
            ang = (rotate.x / 4) * -(2 * Math.PI)
        }

        // Geometries
        const parts = [];
        const planes = [];

        for(let i = 0; i < count; i++) {

            const item = _petals_parts[i]
            const height = item.height

            for(let petal of item.stems) {

                let {mx, mz} = petal;
                const pos = new Vector(x + 0.5, y - (1 - height / TX_SIZE) / 2, z + 0.5);
                mx = 16 - mx
                const vt = new Vector(mx / TX_SIZE - 0.5, 0, mz / TX_SIZE - 0.5);
                vt.rotateByCardinalDirectionSelf(xx);
                // stems
                planes.push(...[
                    {
                        pos: pos.add(vt),
                        size: {x: 0, y: height, z: 1},
                        uv: [0.5, 4 + height / 2],
                        rot: [0, Math.PI / 4 + ang, 0]
                    },
                    {
                        pos: pos.add(vt),
                        size: {x: 0, y: height, z: 1},
                        uv: [0.5, 4 + height / 2],
                        rot: [0, Math.PI / 4 + Math.PI / 2 + ang, 0]
                    }
                ]);

            }

            // flowers
            const pose = flower_poses[i]
            const xz = flower_poses[(i - rotate.x * 2 + 8) % 4]
            const vt = new Vector(xz.z / TX_SIZE - 0.5, 0, xz.x / TX_SIZE - 0.5);
            vt.rotateByCardinalDirectionSelf(xx);
            const pos = new Vector(x, y - (1 - height / TX_SIZE) / 2, z)
            pos.x -= vt.x - .5
            pos.z += vt.z + .5
            parts.push({
                pos,
                "size": {"x": 8, "y": height, "z": 8},
                "faces": {
                    "up": {"uv": pose.uv, "flag": flag, "texture": c_up},
                }
            });

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

        matrix = mat4.create()
        mat4.rotateY(matrix, matrix, rotate.x/4 * -(Math.PI*2))

        for(let part of parts) {
            default_style.pushPART(vertices, {
                ...part,
                lm:         lm,
                pos:        part.pos,
                matrix:     matrix
            });
        }

        return null

    }

}