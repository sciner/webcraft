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

    tick() {}

}