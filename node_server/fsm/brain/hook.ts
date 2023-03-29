import { FSMBrain } from "../brain.js";
import { BLOCK } from "@client/blocks.js";
import { Vector } from "@client/helpers.js";
import { WorldAction } from "@client/world_action.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import { ServerClient } from "@client/server_client.js";

export class Brain extends FSMBrain {
    count_grass: number;

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/4,
            playerHeight: 1.3,
            stepHeight: 1,
            playerHalfWidth: .45
        });
        this.stack.pushState(this.doStand);
        this.health = 1; // максимальное здоровье
    }

   
    // просто стоит и кушает траву, если голодная
    doStand(delta) {
        const mob = this.mob
        this.updateControl({
            yaw: mob.rotate.z,
            forward: false,
            jump: true,
            sneak: false,
        });
        this.applyControl(delta);
        this.sendState();
    }
   
    // Если убили моба
    onKill(actor, type_damage) {
        console.log('kill')
    }
    
    // если использовали предмет
    onUse(actor, id) {
        console.log('use')
       return false
    }
    
}