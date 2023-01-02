import { Vector } from "./helpers.js"

import glMatrix from "./../vendors/gl-matrix-3.3.min.js"
const { mat4, vec3, quat } = glMatrix;

export class PlayerArm {

    /**
     * 
     */
    constructor(player) {

        const arm = Qubatch.render.addBBModel(new Vector(0, 0, 0), 'arm', new Vector(0, 0, 0), 'atack_sword+')
        const orig_draw = arm.draw.bind(arm)

        this.mesh = arm

        const draw = function(render, delta) {
            arm.apos.set(0, .1, 0)
            arm.rotate.z = -Math.PI/2
            return orig_draw(render, delta)
        }

        draw.bind(arm)

        arm.draw = draw

    }

    draw(render, pos, mx, delta) {
        return this.mesh.draw(render, pos, mx, delta)
    }

}