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

        if(this.name == 'body') {
            /*
            this.rot.z = Math.sin(performance.now() / 100);
            mat4.translate(mx, mx, [
                0,
                Math.sin(performance.now() / 1000) / 16,
                0
            ]);
            const scale = 1 + Math.sin(performance.now() / 1000) / 8;
            mat4.scale(mx, mx, [scale, scale, scale]);
            this.updateLocalTransform();
            */
        }

        // Play animations
        if(this.animations.length > 0) {

            for(let animation of this.animations) {
                switch(animation.channel_name) {
                    case 'position': {
                        mat4.translate(mx, mx, animation.point);
                        break;
                    }
                    case 'rotation': {
                        this.rot.copyFrom(this.rot_orig).subSelf(animation.point.multiplyScalar(16));
                        break;
                    }
                }
            }

            this.updateLocalTransform();

            this.animations = [];
            this.rot.copyFrom(this.rot_orig);

        }

        mat4.multiply(mx, mx, this.matrix);

        for(let part of this.children) {
            part.pushVertices(vertices, pos, lm, mx);
        }
    }

}