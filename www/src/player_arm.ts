import { IndexedColor, Vector } from "./helpers.js"
import { Resources } from "./resources.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";

import glMatrix from "./../vendors/gl-matrix-3.3.min.js"
import type { Renderer } from "./render.js";
import type { Player } from "./player.js";
const { mat4, vec3, quat } = glMatrix;

const lm        = IndexedColor.WHITE
const vecZero   = Vector.ZERO.clone()

export class PlayerArm {
    [key: string]: any;

    #player: Player
    #render: Renderer

    constructor(player : Player, render : Renderer) {

        this.#player = player
        this.#render = render

        const model = Resources._bbmodels.get('arm')
        this.mesh = new Mesh_Object_BBModel(render, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model, undefined, true)
        this.mesh.setAnimation('idle') // atack_sword

        //
      /*  const atack_sword_animation = arm.model.animations.get('atack_sword')

        //const orig_draw = arm.draw.bind(arm)

        this.mesh = arm

        //
        let pn = performance.now()
        const getDelta = () => {
            const resp = performance.now() - pn
            pn = performance.now()
            return resp
        }

        // Bind draw
        const draw = function(render : Renderer, delta : float) {
            delta = getDelta()
            arm.apos.set(0, .1, -.35)
            return orig_draw(render, delta)
        }
        draw.bind(arm)
        arm.draw = draw

        // Bind redraw
        const redraw = (delta) => {

            const f = player.getAttackAnim(0, delta, false)
            arm.setAnimation(f ? atack_sword_animation.name : 'idle')

            arm.vertices = [];
            const mx = mat4.create();
            mat4.rotateY(mx, mx, arm.rotation[2] + Math.PI);
            arm.model.playAnimation(arm.animation_name, atack_sword_animation.length * f);
            arm.model.draw(arm.vertices, vecZero, lm, mx);
            arm.buffer.updateInternal(arm.vertices);
        }
        redraw.bind(arm)
        arm.redraw = redraw
        */
    }

    draw(delta) {
        if (this.mesh) {
            const rotate = new Vector(Math.sin(this.#player.rotate.z + Math.PI/4), Math.sin(this.#player.rotate.x), Math.cos(this.#player.rotate.z + Math.PI/4))
            const pos = this.#player.getEyePos().add(rotate)
            this.mesh.apos.copyFrom(pos);
            const mx = mat4.create();
            mat4.rotateY(mx, mx, this.#player.rotate.z + Math.PI/2);
           // mat4.rotateZ(mx, mx, this.#player.rotate.x);
            this.mesh.drawBuffered(this.#render, delta, mx)
        }
    }

}