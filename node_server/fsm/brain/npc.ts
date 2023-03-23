import {FSMBrain} from "../brain.js";

import {Vector} from "@client/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, {
            baseSpeed: 1/2,
            playerHeight: 1.8,
            stepHeight: 1
        });
        this.health = 20;    // максимальное здоровье
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

}