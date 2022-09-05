//[JsDoc]
//import { TBlock } from "../../www/js/typed_blocks3.js";
//import { GameMode } from "../../www/js/game_mode.js";
//import { ServerPlayer } from "../server_player.js";
//[JsDoc]

import { LackOfOxygenAndAsphyxiationEffectID, LackOfOxygenAndAsphyxiationEffect } from "./lack_of_oxygen_and_asphyxiation_effect.js";

export class HeadEffectChecker {
    /**
     * 
     * @param {ServerPlayer} player 
     */
    constructor(player) {
        /**
         * @type {ServerPlayer}
         */
        this.player = player;
    }

    /**
     * 
     * @param {GameMode} gameMode 
     */
    atGameModeSet(gameMode){
        if (gameMode.mayGetDamaged ? gameMode.mayGetDamaged() : gameMode.can_take_damage){
            this.checkEffectOfBlock = this.activeCheckEffectOfBlock;
        } else {
            this.checkEffectOfBlock = this.dummyCheckEffectOfBlock;
            this.removeTemporaryEffects();
        }
    }

    /**
     * Description of the function
     * @name CheckEffectOfBlockAction
     * @function
     * @param {TBlock} block 
    */

    /**
     * @type {CheckEffectOfBlockAction}
     */
    checkEffectOfBlock = this.activeCheckEffectOfBlock;

    /**
     * @private
     * @param {TBlock} block 
     */

    dummyCheckEffectOfBlock(block) {}

    /**
     * @private
     * @param {TBlock} block 
     */

    activeCheckEffectOfBlock(block) {
        // now it's only one effect
        /**
         * @type {null|LackOfOxygenAndAsphyxiationEffect}
         */
        let effect = null;
        let effects = this.player.effects;
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].effectId == LackOfOxygenAndAsphyxiationEffectID) {
                effect = effects[i];
            }
        }
        if (this.blockHasOxygen(block)){
            if (effect === null) {
                return;
            }
            effect.oxygenGot();
        } else {
            if (effect === null) {
                effect = new LackOfOxygenAndAsphyxiationEffect(this.player);
            }
            effect.oxygenBeenLost();
        }
    }

    removeTemporaryEffects() {
        // remove Asphyxiation
        let effects = this.player.effects;
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].effectId == LackOfOxygenAndAsphyxiationEffectID) {
                effects.slice(i, 1);
            }
        }
    }

    /**
     * @private
     * @param {TBlock} block 
     * @returns {boolean}
     */
    blockHasOxygen(block) {
        let mat = block.material;
        return !(mat.is_fluid || (mat.id > 0 && mat.passable == 0 && !mat.transparent));
    }
}
