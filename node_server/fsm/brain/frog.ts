import { Vector } from "@client/helpers.js";
import type { EnumDamage } from "@client/enums/enum_damage.js";
import { AI } from "fsm/ai.js";

export class Brain extends AI {
    
    constructor(mob) {
        super(mob)
        this.pc = this.createPlayerControl({
            baseSpeed: 0.2,
            playerHeight: 0.6,
            stepHeight: 1,
            playerHalfWidth: 0.3,
        })

        // Список задач на выполнение
        this.addTask(this.aiMoveHome)
        this.addTask(this.aiWander)
        this.addTask(this.aiLookIdle)
        this.addTask(this.aiJump)
    }

    // начальные установки
    onInit() {
        const mob = this.mob
        this.setHealth(10)
        this.setHome(mob.pos)
        this.setSpeed(.2)
    }
    
    aiJump(params:any) {
        if (Math.random() > 0.005) {
            return false
        }
        const mob = this.mob
        const state = this.pc.player_state
        const power = .5
        const z = Math.cos(mob.rotate.z) * power
        const x = Math.sin(mob.rotate.z) * power
        const y = power
        state.vel = new Vector(x, y, z)
    }

}