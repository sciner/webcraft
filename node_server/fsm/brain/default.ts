import {FSMBrain} from "../brain.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.doStand);
    }


}