import { FSMBrain } from "../brain.js"
import { Vector } from "@client/helpers.js"
import { EnumDamage } from "@client/enums/enum_damage.js"
import { WorldAction } from "@client/world_action.js"
import {MOB_CONTROL, MobControlParams} from "@client/control/player_control.js";

export class Brain extends FSMBrain {

    parent: any
    velocity: Vector
    _rotate: Vector = new Vector()
    _rotate2: Vector = new Vector()

    constructor(mob) {
        super(mob)
        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        const power = 1
        const z = Math.cos(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const x = Math.sin(mob.rotate.z) * Math.cos(mob.rotate.x) * power
        const y = Math.sin(mob.rotate.x) * power
        this.velocity = new Vector(x, y, z)
        this.pc.player_state.vel = this.velocity.clone()
        this.stack.pushState(this.doStand)
    }

    onLive() {

    }

    doStand(delta : float): MobControlParams | null {
        const mob = this.mob
        if (this.pc.player_state.isCollidedVertically || this.pc.player_state.isCollidedHorizontally) {
            this.onKill(null, null)
            return null
        }
        const rotate = this._rotate.setScalar(Math.sin(mob.rotate.z), 0, Math.cos(mob.rotate.z))
        const rotate2 = this._rotate2.copyFrom(rotate).mulScalarSelf(.4)
        const pos = mob.pos.add(rotate2) // @todo вроде поправлено в рейкастере
        const ray = this.world.raycaster.get(pos, rotate, 2)
        // если на пути встретился моб
        if (ray?.mob) {
            ray.mob.setDamage(1, EnumDamage.SNOWBALL, mob)
            this.onKill(null, null)
            return null
        }
        // если на пути встретился игрок
        if (ray?.player) {
            ray.player.setDamage(1, EnumDamage.SNOWBALL, mob)
            this.onKill(null, null)
            return null
        }
        this.velocity.y -= .3 * delta
        this.pc.player_state.vel = new Vector(this.velocity.x, this.velocity.y, this.velocity.z)
        return MOB_CONTROL.NO_CHANGE
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
        const mob = this.mob
        mob.kill()
        const world = mob.getWorld()
        const actions = new WorldAction()
        actions.addParticles([
            {
                type: 'destroy_block', 
                pos: mob.pos, 
                block: {
                    id: 80
                },
                force: 1,
                scale: 1,
                small: false
            }
        ])
        world.actions_queue.add(actor, actions)
        return true
    }
    
    // если использовали предмет
    onUse(actor, id) {
        return false
    }
}