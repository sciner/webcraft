import { IndexedColor, Vector } from '../helpers.js';
import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

//
export class BBModel_Group extends BBModel_Child {

    /**
     * @param {string} name
     * @param {Vector} pivot
     * @param {Vector} rot
     */
    constructor(name, pivot, rot) {
        super();
        this.name = name;
        this.children = [];
        this.pivot = pivot;
        this.rot = rot;
    }

    /**
     * @param {BBModel_Child} child
     */
    addChild(child) {
        this.children.push(child);
    }

    /**
     * @param {Float32Array} vertices
     * @param {Vector} pos
     * @param {IndexedColor} lm
     * @param {*} matrix
     */
    pushVertices(vertices, pos, lm, parentMatrix) {

        const mx = mat4.create();
        mat4.copy(mx, parentMatrix);

        // if(this.name == 'h_jaw') {
        //     this.rot.x = performance.now() / 1000 * 60;
        //     this.updateLocalTransform();
        // }
        mat4.multiply(mx, mx, this.matrix);

        for(let part of this.children) {
            part.pushVertices(vertices, pos, lm, mx);
        }
    }

}