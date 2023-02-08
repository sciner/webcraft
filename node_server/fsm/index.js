import { FSMBrain } from "./brain.js";

export class Brains {

    constructor() {
        /**
         * @type {Map<string, FSMBrain>}
         */
        this.list = new Map();
    }

    /**
     * @param {string} type 
     * @param {*} module 
     */
    add(type, module) {
        this.list.set(type, module);
    }

    /**
     * @param {string} type 
     * @param {*} mob 
     * @returns {FSMBrain}
     */
    get(type, mob) {
        let c = null;
        if(this.list.has(type)) {
            c = this.list.get(type);
        } else {
            c = this.list.get('default');
        }
        return new c(mob);
    }

}