import {FSMBrain} from "../brain.js";
import {CHUNK_STATE_NEW, CHUNK_STATE_LOADING, CHUNK_STATE_LOADED, CHUNK_STATE_BLOCKS_GENERATED} from "../../server_chunk.js";

import {Vector} from "../../../www/js/helpers.js";

export class Brain extends FSMBrain {

    constructor(mob) {
        super(mob);
        this.prevPos        = new Vector(mob.pos);
        this.lerpPos        = new Vector(mob.pos);
        this.pc             = this.createPlayerControl(this, 1/2, 0.8, 1);
        // Начинаем с просто "Стоять"
        this.stack.pushState(this.standStill);
    }

}