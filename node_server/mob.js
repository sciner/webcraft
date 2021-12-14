import {getChunkAddr} from "../www/js/chunk.js";
import {Brains} from "./fsm/index.js";
import { Vector } from "../www/js/helpers.js";

// import {BLOCK} from "../www/js/blocks.js";
// import {MobModel} from "../www/js/mob_model.js";

await Brains.init();

export class Mob {

    #world;
    #brain;
    #chunk_addr;
    #forward;

    constructor(world, params) {

        this.#world         = world;
        this.id             = params.id,
        this.entity_id      = params.entity_id,
        this.type           = params.type;
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.pos            = params.pos;
        this.pos_spawn      = params.pos_spawn;
        this.rotate         = params.rotate;
        // Private properties
        this.#chunk_addr    = new Vector();
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = Brains.get(this.type, this);
        // Сохраним моба в глобальном хранилище, чтобы не пришлось искать мобов по всем чанкам
        world.mobs.set(this.entity_id, this);
    }

    get chunk_addr() {
        return getChunkAddr(this.pos, this.#chunk_addr);
    }

    get forward() {
        return this.#forward.set(
            Math.sin(this.rotate.z),
            0,
            Math.cos(this.rotate.z),
        );
    }

    getWorld() {
        return this.#world;
    }

    // Create new mob
    static async create(world, params) {
        params.indicators = world.db.getDefaultPlayerIndicators();
        let result = await world.db.createMob(params);
        params.id = result.id;
        params.entity_id = result.entity_id;
        return new Mob(world, params);
    }

    tick(delta) {
        this.#brain.tick(delta);
    }

    onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        this.#world.mobs.delete(this.entity_id);
    }

}