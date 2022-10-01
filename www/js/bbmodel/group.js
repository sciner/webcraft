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
        this.rot_orig = rot.clone();
        this.animations = [];
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

        this.playAnimations(mx);

        mat4.multiply(mx, mx, this.matrix);

        for(let part of this.children) {
            part.pushVertices(vertices, pos, lm, mx);
        }
    }

    // Play animations
    playAnimations(mx) {

        if(this.animations.length == 0) {
            return false;
        }

        for(let animation of this.animations) {
            switch(animation.channel_name) {
                case 'position': {
                    mat4.translate(mx, mx, animation.point);
                    break;
                }
                case 'rotation': {
                    this.rot.copyFrom(this.rot_orig).subSelf(animation.point);
                    break;
                }
            }
        }

        // apply
        this.updateLocalTransform();

        // reset
        this.animations = [];
        this.rot.copyFrom(this.rot_orig);

    }

}