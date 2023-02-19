import { Vector } from "../../www/src/helpers.js";
import { alea } from "../../www/src/terrain_generator/default.js";

export class Treasure_Sets {

    #world
    treasure_sets: Map<any, any>;

    constructor(world, sets) {
        this.#world = world
        this.clear()
        this.init(sets)
    }

    clear() {
        this.treasure_sets = new Map()
    }

    init(sets) {
        const sets_count = this.treasure_sets.size
        const bm = this.#world.block_manager;
        const extended = []
        //
        for(let s of sets) {
            if(s.items) {
                for(let item of s.items) {
                    if(!item.id) {
                        const b = bm.fromName(item.name)
                        if(!b) {
                            throw `error_invalid_treasure_item_name|${item.name}`
                        }
                        delete(item.name);
                        item.id = b?.id
                        if(b.power != 0) {
                            item.power = b.power
                        }
                    }
                }
            }
            if(s.extends) {
                const parent = this.treasure_sets.get(s.extends)
                if(parent) {
                    s.items = [...parent.items, ...(s.items ?? [])]
                } else {
                    extended.push(s)
                    continue
                }
            }
            this.treasure_sets.set(s.name, s)
        }
        //
        if(this.treasure_sets.size == sets_count) {
            throw 'error_extends_treasure_chests';
        }
        //
        if(extended.length > 0) {
            this.init(extended);
        }
    }
    
    /**
     * Generate chest slots
     * @param {*} world 
     * @param {Vector} xyz 
     * @param {string} set_name 
     * @param {int} count 
     */
    generateSlots(world, xyz, set_name, count) {

        const rnd = new alea(world.seed + new Vector(xyz).toHash());

        const kit = this.treasure_sets.get(set_name)
        if(!kit) throw `error_invalid_treasure_set_name|${set_name}`
        const items_kit = [...kit.items]

        //
        const slots = {};

        for(let i = 0; i < count; i++) {
            if(rnd.double() > .8) {
                continue;
            }
            const kit_index = Math.floor(rnd.double() * items_kit.length);
            const item = {...items_kit[kit_index]};
            item.count = item.count[Math.floor(rnd.double() * item.count.length)];
            if(item.count > 0) {
                slots[i] = item;
            }
        }

        return slots

    }

}