import {getChunkAddr} from "../www/js/chunk.js";
import {Brains} from "./fsm/index.js";
import { Vector } from "../www/js/helpers.js";

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
        this.extra_data     = params.extra_data || {};
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

    //
    static convertRowToExtraData(row) {
        return {is_alive: !!row.is_active};
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
        params.extra_data = Mob.convertRowToExtraData(result);
        return new Mob(world, params);
    }

    tick(delta) {
        if(this.indicators.live.value == 0) {
            return false;
        }
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
    async save() {
        await this.#world.db.saveMob(this);
    }

    async onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        await this.save();
        this.#world.mobs.delete(this.entity_id);
    }

    async punch(server_player, params) {
        if(params.button_id == 3) {
            const mat = server_player.state.hands.right;
            if(this.type == 'sheep') {
                if(mat && mat.id == 552) {
                    // Add velocity for drop item
                    let velocity = new Vector(
                        -Math.sin(this.rotate.z),
                        0,
                        -Math.cos(this.rotate.z)
                    ).multiplyScalar(.5);
                    const items = [
                        {id: 350, count: 1}
                    ];
                    this.#world.createDropItems(server_player, this.pos.addSelf(new Vector(0, .5, 0)), items, velocity);
                }
            }
        } else if(params.button_id == 1) {
            if(this.indicators.live.value > 0) {
                await this.changeLive(-5);
                // Add velocity for drop item
                let velocity = this.pos.sub(server_player.state.pos).normSelf();
                velocity.y = .5;
                this.addVelocity(velocity);
                this.#brain.runPanic();
            }
        }
    }

    //
    async changeLive(value) {
        const ind = this.indicators.live;
        const prev_value = ind.value;
        ind.value = Math.max(prev_value + value, 0);
        console.log(`Mob live ${prev_value} -> ${ind.value}`);
        if(ind.value == 0) {
            await this.kill();
        } else {
            this.save();
        }
    }

    async kill() {
        if(this.already_killed) {
            return false;
        }
        this.already_killed = true;
        this.indicators.live.value = 0;
        this.extra_data.is_alive = false;
        this.save();
        await this.#world.db.setEntityActive(this.entity_id, 0);
        this.#brain.sendState();
    }

    isAlive() {
        return this.indicators.live.value > 0;
    }

}