/**
 * This is an abstract class
 */
export class Effect{
    /**
     * Unuque identificator of effect
     * @param {number} effectId 
     */
    constructor(effectId){
        /**
         * @type {number}
         */
        this.ticks = 0;
        /**
         * @function
         * @returns {boolean|undefined}
         */
        this.action = () => {
            throw 'not_implemented_exception';
        }

        /**
         * @type {number}
         */
        this.effectId = effectId;
    }
}