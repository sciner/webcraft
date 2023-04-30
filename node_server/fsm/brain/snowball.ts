import { FSMBrain } from "../brain.js"
import { Vector } from "@client/helpers.js"
import { EnumDamage } from "@client/enums/enum_damage.js"

export class Brain extends FSMBrain {

    parent: any
    velocity: Vector

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            playerHeight: .16,
            playerHalfWidth: .08
        })
        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        const power = 0.8
        const z = Math.cos(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const x = Math.sin(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const y = Math.sin(mob.rotate.x) * power
        this.velocity = new Vector(x, y, z)
        this.pc.player_state.vel = this.velocity.clone()
        this.stack.pushState(this.doStand)
    }

    onLive() {

    }

    doStand(delta) {
        const mob = this.mob
        if (this.pc.player_state.isCollidedVertically || this.pc.player_state.isCollidedHorizontally) {
            this.mob.kill()
            return
        }
        const rotate = new Vector(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z))
        const pos = mob.pos.add(rotate.mulScalar(.4)) // @todo вроде попроавлено в раейкастере
        const ray = this.raycaster.get(pos, rotate, 2)
        // если на пути встретился моб
        if (ray?.mob) {
            ray.mob.setDamage(2, EnumDamage.SNOWBALL, mob)
            mob.kill()
            return
        }
        // если на пути встретился игрок
        if (ray?.player) {
            ray.player.setDamage(2, EnumDamage.SNOWBALL, mob)
            mob.kill()
            return
        }
        this.velocity.y -= 0.02
        this.pc.player_state.vel = new Vector(this.velocity.x, this.velocity.y, this.velocity.z)
        this.applyControl(delta)
        this.sendState()
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
        return false
    }
    
    // если использовали предмет
    onUse(actor, id) {
        return false
    }
}