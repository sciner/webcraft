import { default as default_style } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";
import { Vector } from "../helpers.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;
const tempMat = mat4.create();
const zeroVec = new Vector();

//
export class BBModel_Cube extends BBModel_Child {

    /**
     * @param { import("./model.js").BBModel_Model } model
     * @param {object} json
     * @param {Vector} size
     * @param {Vector} translate
     */
    constructor(model, json, size, translate) {
        super(model, json)
        this.size = size
        this.translate = translate
        this.setFaces(json.faces)
    }

    setFaces(faces) {
        const flag = null
        this.faces = {}
        if(faces) {
            for(let f in faces) {
                const face = faces[f];
                this.faces[f] = {
                    tx_cnt:     1,
                    tx_size:    1024,
                    autoUV:     false,
                    texture_id: face.texture,
                    uv:         face.uv,
                    flag:       flag,
                    texture:    [.5, .5, 1, 1]
                }
            }
        }
    }

    /**
     * @param {Float32Array} vertices
     * @param {Vector} pos
     * @param {IndexedColor} lm
     * @param {*} matrix
     * @param {*} emmit_particles_func
     */
    pushVertices(vertices, pos, lm, parentMatrix, emmit_particles_func) {
        const worldMatrix = mat4.multiply(tempMat, parentMatrix, this.matrix);
        const model = this.model
        const faces = model.selected_texture_name ? this.faces_palette?.get(model.selected_texture_name) : this.faces
        if(!faces) {
            debugger
            throw 'error_bbcube_no_faces'
        }
        default_style.pushPART(vertices, {
            faces:      faces,
            size:       this.size,
            translate:  this.translate,
            lm:         lm,
            pos:        pos,
            matrix:     worldMatrix
        }, zeroVec);
    }

}