import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix;

//
export class BBModel_Group extends BBModel_Child {
    [key: string]: any;

    /**
     * @param {string} name
     * @param {Vector} pivot
     * @param {Vector} rot
     * @param {boolean} visibility
     */
    constructor(name, pivot, rot, visibility = true) {
        super();
        this.name = name;
        this.children = [];
        this.pivot = pivot;
        this.rot = rot;
        this.rot_orig = rot.clone();
        this.animations = [];
        this.visibility = !!visibility
        this.orig_visibility = !!visibility
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
     * @param {*} parent_matrix
     * @param {*} emmit_particles_func
     */
    pushVertices(vertices, pos, lm, parent_matrix, emmit_particles_func?) {

        const mx = mat4.create();
        mat4.copy(mx, parent_matrix);

        this.playAnimations(mx);

        mat4.multiply(mx, mx, this.matrix);

        for(let part of this.children) {
            if(!part.visibility) {
                continue
            }
            part.pushVertices(vertices, pos, lm, mx, emmit_particles_func);
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