import { default as default_style } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";
import { IndexedColor, QUAD_FLAGS, Vector } from "../helpers.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;
const tempMat = mat4.create();
const zeroVec = new Vector();

//
export class BBModel_Cube extends BBModel_Child {
    [key: string]: any;

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
        let flag = 0
        this.faces = {}
        if(faces) {
            // if(this.json.name.includes('#grass')) {
            //     flag |= QUAD_FLAGS.FLAG_LEAVES
            // }
            for(let f in faces) {
                // remove empty faces
                const face = faces[f]
                if(!face.texture) {
                    continue
                }
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

    pushVertices(vertices : Float32Array, pos : Vector, lm : IndexedColor, parentMatrix : imat4, emmit_particles_func? : Function) {
        const worldMatrix = mat4.multiply(tempMat, parentMatrix, this.matrix);
        const model = this.model
        const force_texture_name = this.selected_texture_name ?? model.selected_texture_name
        const faces = force_texture_name ? this.faces_palette?.get(force_texture_name) : this.faces
        if(!faces) {
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