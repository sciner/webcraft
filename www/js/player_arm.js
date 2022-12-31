import { Vector } from "./helpers.js"

import glMatrix from "./../vendors/gl-matrix-3.3.min.js"
const { mat4, vec3, quat } = glMatrix;

export class PlayerArm {

    /**
     * 
     */
    constructor(player) {

        const arm = Qubatch.render.addBBModel(new Vector(0, 0, 0), 'arm', new Vector(0, 0, 0), 'atack_sword')
        const orig_draw = arm.draw.bind(arm)

        this.mesh = arm

        const draw = function(render, delta) {

            const prot = Qubatch.player.rotate

            // arm.animation_name = 'atack_sword'

            /*
            const q = quat.fromEuler(quat.create(), prot.x, prot.y, prot.z) // < maybe needs flip
            const forward = vec3.transformQuat(vec3.create(), vec3.create(0, 0, 0.1),  q)
            const left = vec3.transformQuat(vec3.create(), vec3.create(0.1, 0, 0),  q)
            let pos = vec3.add(vec3.create(), player.lerpPos, forward)
            pos = vec3.add(pos, pos, left)
            arm.apos.copyFrom(pos)
            */

            arm.apos.copyFrom(player.getEyePos()).addSelf(Qubatch.player.forward)

            /*
            arm.apos.copyFrom(player.lerpPos).addScalarSelf(
                Math.sin(prot.z) * .75,
                1,
                Math.cos(prot.z) * .75,
            )*/

            arm.rotate.z = prot.z + -Math.PI/2

            return orig_draw(render, delta)
        }

        draw.bind(arm)

        arm.draw = draw

    }

}