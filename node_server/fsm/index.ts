import type {FSMBrain} from "./brain.js";
import type {Mob} from "../mob.js";
import type {TMobConfig} from "../mob/mob_config.js";

export class Brains {

    list = new Map<string, typeof FSMBrain>()

    constructor() {
    }

    async load(configs: Dict<TMobConfig>): Promise<void> {
        for(const [name, conf] of Object.entries(configs)) {
            const brainName = conf.brain
            if (!this.list.has(brainName)) {
                const module = await import(`./brain/${brainName}.js`)
                this.list.set(brainName, module.Brain)
            }
        }
    }

    get(type: string, mob: Mob): FSMBrain {
        const c = this.list.get(type) ?? this.list.get('default');
        return new c(mob);
    }

    getArrayOfNames(): string[] {
        return Array.from(this.list.keys())
    }
}