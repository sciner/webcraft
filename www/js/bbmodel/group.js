import { IndexedColor, Vector } from '../helpers.js';
import { BBModel_Child } from './child.js';

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
    pushVertices(vertices, pos, lm, matrix) {
        for(let part of this.children) {
            part.pushVertices(vertices, pos, lm, matrix);
        }
    }

}