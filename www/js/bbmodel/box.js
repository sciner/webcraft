import { default as default_style } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";
import { Vector } from "../helpers.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;
const tempMat = mat4.create();
const zeroVec = new Vector();

//
export class BBModel_Box extends BBModel_Child {

    /**
     * @param {Vector} size
     * @param {Vector} translate
     */
    constructor(size, translate) {
        super();
        this.size = size;
        this.translate = translate;
        this.faces = {};
    }

    /**
     * @param {Float32Array} vertices
     * @param {Vector} pos
     * @param {IndexedColor} lm
     * @param {*} matrix
     */
    pushVertices(vertices, pos, lm, parentMatrix) {
        const worldMatrix = mat4.multiply(tempMat, parentMatrix, this.matrix);
        const model = this.model
        const faces = model.selected_texture_name ? this.faces_palette?.get(model.selected_texture_name) : this.faces
        if(!faces) {
            debugger
            throw 'error_no_faces'
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