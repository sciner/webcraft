import { default as default_style } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";

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
    pushVertices(vertices, pos, lm, matrix) {
        default_style.pushAABB(vertices, {
            ...this,
            lm:         lm,
            pos:        pos,
            matrix:     matrix
        }, this.pivot);
    }

}