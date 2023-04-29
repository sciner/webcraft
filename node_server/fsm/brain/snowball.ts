import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { PLAYER_STATUS } from "@client/constant.js";
import { Weather } from "@client/block_type/weather.js";
import { FLUID_LAVA_ID, FLUID_TYPE_MASK, FLUID_WATER_ID } from "@client/fluid/FluidConst.js";

// рыба
const FISH = [
    {
        'name': 'COD',
        'weight': 60
    },
    {
        'name': 'SALMON',
        'weight': 25
    },
    {
        'name': 'TROPICAL_FISH',
        'weight': 2
    },
    {
        'name': 'PUFFERFISH',
        'weight': 13
    }
]
// мусор
const JUNK = [
    {
        'name': 'LILY_PAD',
        'weight': 17
    },
    {
        'name': 'FISHING_ROD',
        'weight': 2
    },
    {
        'name': 'LEATHER',
        'weight': 2
    },
    {
        'name': 'LEATHER_BOOTS',
        'weight': 10
    },
    {
        'name': 'ROTTEN_FLESH',
        'weight': 10
    },
    {
        'name': 'STICK',
        'weight': 5
    },
    {
        'name': 'STRING',
        'weight': 5
    },
    {
        'name': 'AWKWARD',
        'weight': 10
    },
    {
        'name': 'BONE',
        'weight': 10
    },
    {
        'name': 'BOWL',
        'weight': 10
    },
    {
        'name': 'INK_SAC',
        'weight': 1
    }
]

export class Brain extends FSMBrain {

    parent: any;
    timer_in_ground: number;
    timer_catchable: number;
    timer_caught_delay: number;
    timer_catchable_delay: number;
    fish_approach_angle: number;
    velocity: Vector;

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            playerHeight: .16,
            playerHalfWidth: .08
        });

        this.pc.player_state.flying = true
        mob.extra_data.play_death_animation = false
        
        this.health = 1; // максимальное здоровье
    
        const power = .8
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
        if (this.pc.player_state.isCollidedVertically || this.pc.player_state.isCollidedHorizontally) {
            this.mob.kill()
            return
        }
        this.velocity.y -= 0.01
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