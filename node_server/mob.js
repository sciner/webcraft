import {getChunkAddr} from "../www/js/chunk.js";
// import {MobModel} from "../www/js/mob_model.js";

export class Mob {

    #world      = null;
    #chunk_addr = null;

    constructor(world, params) {
        this.#world         = world;
        this.id             = params.id,
        this.entity_id      = params.entity_id,
        this.type           = params.type;
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.pos            = params.pos;
        this.rotate         = params.rotate;
        this.#chunk_addr    = getChunkAddr(this.pos);
        // Сохраним моба в глобальном хранилище, чтобы не пришлось искать мобов по всем чанкам
        world.mobs.set(this.entity_id, this);
    }

    get chunk_addr() {
        return this.#chunk_addr;
    }

    // Create new mob
    static async create(world, params) {
        params.indicators = world.db.getDefaultPlayerIndicators();
        let result = await world.db.createMob(params);
        params.id = result.id;
        params.entity_id = result.entity_id;
        return new Mob(world, params);
    }

    tick() {
        let chunk_over = this.#world.chunks.get(this.#chunk_addr);
        if(chunk_over.load_state > 2) {
            // loaded and terrain created
        }
        // console.log('mobtick: ' + this.entity_id + '; load_state: ' + chunk_over?.addr.toHash());
    }

    onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        this.#world.mobs.delete(this.entity_id);
    }

}