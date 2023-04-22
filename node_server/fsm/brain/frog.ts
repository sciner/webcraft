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
        this.pc             = this.createPlayerControl({
            baseSpeed: 0.25,
            playerHeight: 0.6,
            stepHeight: 1,
            playerHalfWidth: 0.3,
        });

        this.addTask(this.aiLookIdle)

    }

    // просто полет
    doForward(delta) {
       
    }

   
    onDamage(val : number, type_damage : EnumDamage, actor) {
        
    }

}