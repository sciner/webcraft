import type {FSMBrain} from "./brain.js";
import type {Mob} from "../mob.js";

export class Brains {

    list = new Map<string, typeof FSMBrain>()

    constructor() {
    }

    add(type: string, module: typeof FSMBrain): void {
        // TODO: double for old brain names compatibility
        this.list.set(type, module);
        this.list.set(`mob/${type}`, module);
    }

    get(type: string, mob: Mob): FSMBrain {
        const c = this.list.get(type) ?? this.list.get('default');
        return new c(mob);
    }

    getArrayOfNames(): string[] {
        return Array.from(this.list.keys())
    }
}