import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk.js";
import {impl as alea} from "../../vendors/alea.js";
import {AABB, AABBSideParams, pushAABB} from '../core/AABB.js';

export const TX_CNT = 32;
export const TX_SIZE = 16;

import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

//
export default class style {

    //
    static pushPlane(vertices, plane) {

        const pivot = null;

        const width = plane.size.x / TX_SIZE;
        const height = plane.size.y / TX_SIZE;
        const depth = plane.size.z / TX_SIZE;

        const aabb = new AABB();
        aabb.set(
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
            plane.pos.x + .5,
            plane.pos.y + .5,
            plane.pos.z + .5,
        ).expand(width/2, height/2, depth/2)
        .translate(width/2, 0, 0);
        if(plane.translate) {
            aabb.translate(plane.translate.x/TX_SIZE, plane.translate.y/TX_SIZE, plane.translate.z/TX_SIZE);
        }

        // Matrix
        let matrix = mat4.create();
        if(plane.rot && !isNaN(plane.rot[0])) {
            mat4.rotateY(matrix, matrix, plane.rot[1]);
        }
        if(plane.matrix) {
            matrix = mat4.multiply(matrix, matrix, plane.matrix);
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

        const faces = {
            west: new AABBSideParams(tex, plane.flag, plane?.lm?.b || 1, plane.lm, null, true)
        };

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, faces, plane.pos);

    }

    //
    static pushAABB(vertices, part) {

        const pivot = null;

        const width = part.size.x / TX_SIZE;
        const height = part.size.y / TX_SIZE;
        const depth = part.size.z / TX_SIZE;

        const aabb = new AABB();
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
        if(part.rot && !isNaN(part.rot[0])) {
            mat4.rotateY(matrix, matrix, part.rot[1]);
        }
        if(part.matrix) {
            matrix = mat4.multiply(matrix, matrix, part.matrix);
        }

        //
        const anim = part?.lm?.b || 1;

        // Faces
        const faces = part.faces;
        for(let k in faces) {

            const face = faces[k];
            const orig_tex = face.texture;

            // UV
            const uv = [orig_tex[0], orig_tex[1]];
            const add_uv = [
                -.5 + face.uv[0]/TX_SIZE,
                -.5 + face.uv[1]/TX_SIZE
            ];
            uv[0] += add_uv[0];
            uv[1] += add_uv[1];

            // Texture
            const tex = [...orig_tex];
            tex[0] += (add_uv[0] / TX_CNT);
            tex[1] += (add_uv[1] / TX_CNT);

            if(!('autoUV' in face)) {
                face.autoUV = true;
            }

            faces[k] = new AABBSideParams(tex, face.flag, anim, part.lm, null, face.autoUV)
        }

        // Push vertices
        pushAABB(vertices, aabb, pivot, matrix, faces, part.pos);

    }

}