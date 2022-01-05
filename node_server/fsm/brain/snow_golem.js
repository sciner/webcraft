import {FSMBrain} from "../brain.js";

import {Vector} from "../../../www/js/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        //
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, 1/4, 1.6, 1);
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.standStill);
    }

}