import { FSMBrain } from "../brain.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { BeeNest } from "@client/block_type/bee_nest.js";
import { EnumDifficulty } from "@client/enums/enum_difficulty.js";
import { Effect } from "@client/block_type/effect.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";
import { DEFAULT_STYLE_NAME, MOB_TYPE } from "@client/constant.js";
import { AI } from "fsm/ai.js";



export class Brain extends AI {
    

    constructor(mob) {
        super(mob)
        this.pc = this.createPlayerControl({
            baseSpeed: 0.3,
            playerHeight: 0.6,
            stepHeight: 1,
            playerHalfWidth: 0.3,
        });

        this.addTask(this.aiWander)
        this.addTask(this.aiLookIdle)
        this.addTask(this.aiJump)
    }

   
    onDamage(val : number, type_damage : EnumDamage, actor) {
        this.mob.kill()
    }

    aiJump(params:any) {
        if (Math.random() > 0.005) {
            return false
        }
        console.log('AI->Jump')
        const mob = this.mob
        const state = this.pc.player_state
        const power = .4
        const z = Math.cos(mob.rotate.z) * power
        const x = Math.sin(mob.rotate.z) * power
        const y = 2 * power
        state.vel = new Vector(x, y, z)
    }

    

    aiLookIdle(params:any) {
        if (Math.random() > 0.02) {
            return false
        }
        let angle = (Math.random() - Math.random())
        if (angle > Math.PI / 2) {
            angle = Math.PI / 2
        }
        if (angle < -Math.PI / 2) {
            angle = -Math.PI / 2
        }
        this.mob.rotate.z += angle
        return true
    }

}