import {FSMBrain} from "../brain.js";

import {Vector} from "../../../www/js/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this,{
            baseSpeed: 1/4,
            playerHeight: 0.9,
            stepHeight: 1,
            playerHalfWidth: .5
        });
        this.isAggrressor = false;
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }

}