import {FSMBrain} from "../brain.js";

import {Vector} from "@client/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 0.8,
            stepHeight: 1,
            playerHalfWidth: .4
        });
        this.setMaxHealth(10)    // максимальное здоровье
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

}