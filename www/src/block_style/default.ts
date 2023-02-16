import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';

import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { IndexedColor, Vector } from "../helpers.js";
import { DEFAULT_TX_CNT } from "../constant.js";
import type { WorkerWorld } from "../worker/world.js";
import type { BlockManager, FakeTBlock } from "../blocks.js";
import type { TBlock } from "../typed_blocks3.js";
import type { ChunkWorkerChunk } from "../worker/chunk.js";

const {mat4} = glMatrix;
const _aabb = new AABB()
const _pivot = new Vector(0, 0, 0)

// plane temp variables
const _plane_aabb = new AABB();
const _plane_faces = {
    // lm.b used for store count of blocks need to shift
    // where begin texture mask (default 0, but in shader used max(mask_shift, 1.))
    west: new AABBSideParams()
};

export const TX_CNT = DEFAULT_TX_CNT;
export const TX_SIZE = 16;

export class TCalcSideParamsResult {
    anim_frames : int
    t : tupleFloat4 // uv
    f : int // flags
}

export class BlockStyleRegInfo {

    styles: string[]
    func: Function
    aabb: Function

    constructor(styles : string[], func : Function, aabb? : Function) {
        this.styles = styles
        this.func = func
        this.aabb = aabb
    }

}

export class BlockStyle {

    static block_manager : BlockManager
    
    static getRegInfo(block_manager : BlockManager) {
        return this.block_manager
    }

    static computeAABB(tblock : TBlock, for_physic : boolean, world : WorkerWorld, neighbours : any, expanded: boolean) : AABB[] {
        return []
    }

    static func(block : TBlock | FakeTBlock, vertices : Float32Array | float[], chunk : ChunkWorkerChunk, x : int, y : int, z : int, neighbours : any, biome, dirt_color? : IndexedColor, unknown? : any, matrix? : imat4, pivot ? : any, force_tex? : object) : any {
    }

}

export class QuadPlane {

    size?: IVector
    uv: [number, number]
    texture: [number, number, number, number]
    rot: Vector
    lm?: IndexedColor
    pos: Vector
    matrix: imat4
    flag: int = 0

}

//
export default class {

    //
    static pushPlane(vertices, plane) {

        const pivot = null;

        const width = plane.size.x / TX_SIZE;
        const height = plane.size.y / TX_SIZE;
        const depth = plane.size.z / TX_SIZE;

        _plane_aabb.set(
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
        ).expand(width/2, height/2, depth/2)
        .translate(width/2, 0, 0);
        if(plane.translate) {
            _plane_aabb.translate(plane.translate.x/TX_SIZE, plane.translate.y/TX_SIZE, plane.translate.z/TX_SIZE);
        }

        // Matrix
        let matrix = mat4.create();
        if(plane.matrix) {
            matrix = mat4.multiply(matrix, matrix, plane.matrix);
            // matrix = mat4.translate(matrix, matrix, [-.5, 0, -.5]);
        }
        if(plane.rot && !isNaN(plane.rot[0])) {
            if (plane.rot[2] != 0) {
                mat4.rotateZ(matrix, matrix, plane.rot[2]);
            }
            if (plane.rot[1] != 0) {
                mat4.rotateY(matrix, matrix, plane.rot[1]);
            }
            if (plane.rot[0] != 0) {
                mat4.rotateX(matrix, matrix, plane.rot[0]);
            }
        }

        //
        const orig_tex = plane.texture;

        // UV
        const uv = [orig_tex[0], orig_tex[1]];
        const add_uv = [
            -.5 + plane.uv[0]/TX_SIZE,
            -.5 + plane.uv[1]/TX_SIZE
        ];
        uv[0] += add_uv[0];
        uv[1] += add_uv[1];

        // Texture
        const tex = [...orig_tex];
        tex[0] += (add_uv[0] / TX_CNT);
        tex[1] += (add_uv[1] / TX_CNT);

        _plane_faces.west.set(tex,  plane.flag, plane?.lm?.b || 0, plane.lm, null, true)

        // Push vertices
        pushAABB(vertices, _plane_aabb, pivot, matrix, _plane_faces, plane.pos);

    }

    //
    static pushPART(vertices, part, pivot = null) {

        const width = part.size.x / TX_SIZE;
        const height = part.size.y / TX_SIZE;
        const depth = part.size.z / TX_SIZE;

        // AABB
        // const aabb = new AABB();
        let aabb = part.aabb;
        if(!aabb) {
            aabb = part.aabb = _aabb;
        }
        aabb.set(
            part.pos.x + .5,
            part.pos.y + .5,
            part.pos.z + .5,
            part.pos.x + .5,
            part.pos.y + .5,
            part.pos.z + .5,
        ).expand(width/2, height/2, depth/2)
        if(part.translate) {
            aabb.translate(part.translate.x/TX_SIZE, part.translate.y/TX_SIZE, part.translate.z/TX_SIZE);
        }

        // Matrix
        let matrix = mat4.create();
        if(part.matrix) {
            matrix = mat4.multiply(matrix, matrix, part.matrix);
        }
        if(part.rot && !isNaN(part.rot[0])) {
            if(part.rot[0]) mat4.rotateX(matrix, matrix, part.rot[0]);
            if(part.rot[1]) mat4.rotateY(matrix, matrix, part.rot[1]);
            if(part.rot[2]) mat4.rotateZ(matrix, matrix, part.rot[2]);
        }

        // Faces
        let faces = part._faces_compilled;
        if(!faces) {

            faces = {};
            const anim = part?.lm?.b || 1;

            for(let k in part.faces) {

                const face = part.faces[k];
                const orig_tex = face.texture;
                const tx_cnt = face.tx_cnt ?? TX_CNT;
                const tx_size = face.tx_size ?? TX_SIZE;

                // UV
                const uv = [orig_tex[0], orig_tex[1]];
                const add_uv = [
                    -.5 + face.uv[0]/tx_size,
                    -.5 + face.uv[1]/tx_size
                ];
                uv[0] += add_uv[0];
                uv[1] += add_uv[1];

                // Texture
                const tex = [...orig_tex];
                tex[0] += (add_uv[0] / tx_cnt);
                tex[1] += (add_uv[1] / tx_cnt);

                if(!('autoUV' in face)) {
                    face.autoUV = true;
                }

                //
                if(!face.autoUV && face.uv.length == 4) {
                    tex[2] = face.uv[2] / tx_size;
                    tex[3] = face.uv[3] / tx_size;
                }

                faces[k] = new AABBSideParams(tex, face.flag, anim, part.lm, null, face.autoUV)

            }
            part._faces_compilled = faces;
        }

        if(pivot) {
            pivot = _pivot.copyFrom(pivot).divScalarSelf(TX_SIZE);
        }

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, faces, part.pos);

    }

}