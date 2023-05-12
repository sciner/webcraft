import { FSMBrain } from "../brain.js"
import { Vector } from "@client/helpers.js"

export class Brain extends FSMBrain {

    parent: any
    velocity: Vector
    _rotate: Vector = new Vector()
    _rotate2: Vector = new Vector()
    _tblock: any = null
    _bpos: any = null

    constructor(mob) {
        super(mob)
        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        this.velocity = new Vector(0, 0, 0)
        this.pc.player_state.vel = this.velocity.clone()
        this.stack.pushState(this.doStand)
        this._bpos = new Vector().copyFrom(this.mob.pos).flooredSelf()
    }

    onLive() {
    }

    doStand(delta : float) {
        const mob = this.mob

        const tblock = this.world.getBlock(this._bpos, this._tblock)
        if(tblock) {
            const tblock_rotate = tblock.rotate
            if(tblock_rotate) {
                const period = 4000
                const angle = (((performance.now() / period) * 360) % 360) / 360 * (Math.PI * 2)
                if(tblock_rotate.y == 1) {
                    mob.rotate.z = angle
                } else {
                    // switch(tblock_rotate.x) {
                    //     case CD_ROT.WEST: {
                    //         mob.rotate.x = angle
                    //         break
                    //     }
                    //     default: {
                    //         mob.rotate.z = angle
                    //         break
                    //     }
                    // }
                }
                this.updateControl({
                    forward: false,
                    jump: false,
                    sneak: false
                });
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