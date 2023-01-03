import { Vector } from "./helpers.js"
import { Resources } from "./resources.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";

// import glMatrix from "./../vendors/gl-matrix-3.3.min.js"
// const { mat4, vec3, quat } = glMatrix;

export class PlayerArm {

    /**
     * @param { import("./player.js").ServerPlayer } player
     * @param { import("./render.js").ServerPlayer } render
     */
    constructor(player, render) {

        const model = Resources._bbmodels.get('arm')
        const arm = new Mesh_Object_BBModel(render, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model)
        // arm.setAnimation('atack_sword')

        const orig_draw = arm.draw.bind(arm)

        this.mesh = arm

        const draw = function(render, delta) {
            arm.apos.set(0, .1, -.35)
            return orig_draw(render, delta)
        }

        draw.bind(arm)

        arm.draw = draw

    }

    draw(render, pos, mx, delta) {
        return this.mesh.draw(render, pos, mx, delta)
    }

}