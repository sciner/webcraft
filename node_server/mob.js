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

    // 200 is approximately 1 time per 10 seconds
    save_per_tick = 200;

    constructor(world, params) {
        this.#world         = world;
        this.id             = params.id,
        this.entity_id      = params.entity_id,
        this.type           = params.type;
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.pos            = new Vector(params.pos);
        this.pos_spawn      = params.pos_spawn;
        this.rotate         = new Vector(params.rotate);
        // Private properties
        this.#chunk_addr    = new Vector();
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = Brains.get(this.type, this);
        this.width          = this.#brain.pc.physics.playerHalfWidth * 2;
        this.height         = this.#brain.pc.physics.playerHeight;
        // Сохраним моба в глобальном хранилище, чтобы не пришлось искать мобов по всем чанкам
        world.mobs.set(this.id, this);
        this.save_offset = Math.round(Math.random() * this.save_per_tick);
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
        let model = world.models.list.get(params.type);
        if(!model) {
            throw "Can't locate model for: " + params.type;
        }
        if(!(params.skin in model.skins)) {
            throw "Can't locate skin for: " + params.type + '/' + params.skin;
        }
        params.indicators = world.db.getDefaultPlayerIndicators();
        let result = await world.db.createMob(params);
        params.id = result.id;
        params.entity_id = result.entity_id;
        return new Mob(world, params);
    }

    tick(delta) {
        this.#brain.tick(delta);
        if(this.save_offset++ % this.save_per_tick == 0) {
            // console.log('Mob state saved ' + this.entity_id);
            this.save();
        }
    }

    addVelocity(vec) {
        this.#brain.pc.player_state.vel.addSelf(vec);
        this.#brain.pc.tick(0);
    }

    // Save mob state to DB
    save() {
        this.#world.db.saveMob(this);
    }

    onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        this.save();
        this.#world.mobs.delete(this.entity_id);
    }

    punch(server_player, params) {
        // console.log('params.interractMob id:', mob);
        console.log('live', this.indicators.live.value);
        // Add velocity for drop item
        let velocity = new Vector(0, 0.5, 0);
        this.addVelocity(velocity);
        this.#brain.panic = true;
        setTimeout(() => {
            this.#brain.panic = false;
        }, 3000);
    }

}