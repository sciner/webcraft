import { FSMBrain } from "../brain.js"
import { Vector } from "@client/helpers.js"
import type { Mob } from "mob.js"

export class Brain extends FSMBrain {

    parent:             any
    velocity:           Vector
    _rotate:            Vector = new Vector()
    _rotate2:           Vector = new Vector()
    _tblock:            any = null
    _bpos:              any = null
    rotate_time_start:  float = performance.now()

    constructor(mob : Mob) {
        mob.rotate.z = 0
        super(mob)
        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        this.velocity = new Vector(0, 0, 0)
        this.pc.player_state.vel = this.velocity.clone()
        this.stack.pushState(mob.extra_data.blocks ? this.doRotate : this.doStand)
        this._bpos = new Vector().copyFrom(this.mob.pos).flooredSelf()
    }

    startRotation() {
        this.rotate_time_start = performance.now()
        this.stack.pushState(this.doRotate)
    }

    stopRotation() {
        this.stack.pushState(this.doStand)
    }

    onLive() {}

    doStand(delta : float) {
        const mob = this.mob
        if(mob.rotate.z != 0) {
            mob.rotate.z = 0
            this.updateControl({
                forward: false,
                jump: false,
                sneak: false
            })
            this.applyControl(delta)
            this.sendState()
        }
    }

    doRotate(delta : float) {
        const mob = this.mob
        const tblock = this.world.getBlock(this._bpos, this._tblock)
        if(tblock) {
            const tblock_rotate = tblock.rotate
            if(tblock_rotate) {
                const period = 16000
                const elapsed_from_rotate_start = performance.now() - this.rotate_time_start
                const angle = (((elapsed_from_rotate_start / period) * 360) % 360) / 360 * (Math.PI * 2)
                mob.rotate.z = angle
                this.updateControl({
                    forward: false,
                    jump: false,
                    sneak: false
                })
            }
        }
        this.applyControl(delta)
        this.sendState()
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
        return true
    }
    
    // если использовали предмет
    onUse(actor, id) {
        return false
    }

}