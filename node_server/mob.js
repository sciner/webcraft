import {getChunkAddr} from "../www/js/chunk.js";
import {BLOCK} from "../www/js/blocks.js";

import {CHUNK_STATE_NEW, CHUNK_STATE_LOADING, CHUNK_STATE_LOADED, CHUNK_STATE_BLOCKS_GENERATED} from "./server_chunk.js";
import { Vector } from "../www/js/helpers.js";
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
        if(chunk_over.load_state == CHUNK_STATE_BLOCKS_GENERATED && this.type == 'chicken') {
            let pos = this.pos.sub(new Vector(0, 1, 0));
            let block = chunk_over.getBlock(pos);
            // console.log('Mob at block', block?.material.name, pos);
        }
        // console.log('mobtick: ' + this.entity_id + '; load_state: ' + chunk_over?.addr.toHash());
    }

    onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        this.#world.mobs.delete(this.entity_id);
    }

}