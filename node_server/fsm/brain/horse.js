import { FSMBrain } from '../brain.js';

import { Vector } from '../../../www/js/helpers.js';

export class Brain extends FSMBrain {
    constructor(mob) {
        super(mob);
        this.prevPos = new Vector(mob.pos);
        this.lerpPos = new Vector(mob.pos);
        this.pc = this.createPlayerControl(this, {
            baseSpeed: 1 / 4,
            playerHeight: 1.4,
            stepHeight: 1,
            playerHalfWidth: 0.7,
        });

        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }
}
