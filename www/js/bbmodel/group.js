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
    pushVertices(vertices, pos, lm, matrix) {

        const mx = mat4.create();
        mat4.multiply(mx, matrix, mx);

        if(this.name == 'h_jaw') {

            // console.log(this.pivot, this.rot, [-(16-this.pivot.x)/16, -this.pivot.y/16, -this.pivot.z/16])

            //
            if(this.pivot && this.rot) {
                mat4.translate(mx, mx, [-(16-this.pivot.x)/16, -this.pivot.y/16, -this.pivot.z/16]);
                mat4.rotateX(mx, mx, performance.now() / 1000 /* this.rot.x/2 */ );
                mat4.rotateY(mx, mx, this.rot.z);
                mat4.rotateZ(mx, mx, this.rot.y);
                mat4.translate(mx, mx, [(16-this.pivot.x)/16, this.pivot.y/16, this.pivot.z/16]);
            }
            
        }

        for(let part of this.children) {
            part.pushVertices(vertices, pos, lm, mx);
        }
    }

}