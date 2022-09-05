import { Effect } from "./effect.js";
//[JsDoc] import { ServerPlayer } from "../server_player.js";

import { MAX_OXYGEN_POINTS } from "../../www/js/constant.js";

// lost one point of oxygen after
export const lostOxygenTicks = 10; // after half a second
// get one point of oxygen after
export const restoreOxygenTicks = 2;
// lost helth points after
export const lostHelpTicks = 10 // after a second
// lost helpth points
const lostHelthPoint = 1 // standard Maincraft 

export const LackOfOxygenAndAsphyxiationEffectID = 1;

export class LackOfOxygenAndAsphyxiationEffect extends Effect {

    /**
     *
     * @param {ServerPlayer} player
     */
    constructor(player) {
        super(LackOfOxygenAndAsphyxiationEffectID);
        this.player = player;
        player.effects.push(this);
        this.oxygenBeenLost();
    }

    /**
     * @private
     * @returns {boolean}
     */
    isOxygenLostingMode = () => this.mode === "losting";

    oxygenBeenLost() {
        if (this.isOxygenLostingMode()){
            return;
        }
        this.mode = "losting";
        if (this.oxygen === 0){
            this.ticks = lostHelpTicks;
            this.action = this.lostingHelth;
        } else {
            this.ticks = lostOxygenTicks;
            this.action = this.lostingOxygen;
        }
    }

    oxygenGot() {
        if (!this.isOxygenLostingMode()){
            return;
        }
        this.mode = "restoring";
        this.ticks = restoreOxygenTicks;
        this.action = this.restoringOxygen;
    }

    /**
     * @private
     */
    restoringOxygen() {
        this.ticks = restoreOxygenTicks;
        let oxygen = this.player.changeOxygen(+1);
        //[todo] send info about decrising oxygen
        if (oxygen === MAX_OXYGEN_POINTS) {
            return true;
        }
    }

    /**
     * @private
     */
    lostingOxygen() {
        this.ticks = lostOxygenTicks;
        let oxygen = this.player.changeOxygen(-1);
        if (oxygen === 0) {
            this.ticks = lostHelpTicks;
            this.action = this.lostingHelth;
        }
    }

    /**
     * @private
     */
    lostingHelth() {
        this.ticks = lostHelpTicks;
        this.player.changeLive(-lostHelthPoint);
    }
}
