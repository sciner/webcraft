import { MOUSE, PLAYER_STATUS_ALIVE } from "../www/js/constant.js";
import { getChunkAddr, Vector } from "../www/js/helpers.js";
import { ServerClient } from "../www/js/server_client.js";

//
export class MobState {
    
    constructor(id, pos, rotate, extra_data) {
        this.id = id;
        this.pos = pos;
        this.rotate = rotate;
        this.extra_data = extra_data;
    }

    /**
     * Compare
     * @param {MobState} state 
     */
    equal(state) {
        if (this.pos.equal(state.pos)) {
            if (this.rotate.equal(state.rotate)) {
                if(JSON.stringify(this.extra_data) == JSON.stringify(state.extra_data)) {
                    return true;
                }
            }
        }
        return false;
    }

}

//
export class Mob {

    #world;
    #brain;
    #chunk_addr;
    #forward;

    // 200 is approximately 1 time per 10 seconds
    save_per_tick = 200;

    constructor(world, params) {
        this.#world         = world;
        // Read params
        this.id             = params.id,
        this.entity_id      = params.entity_id,
        this.type           = params.type;
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.is_active      = params.is_active;
        this.pos            = new Vector(params.pos);
        this.pos_spawn      = new Vector(params.pos_spawn);
        this.rotate         = new Vector(params.rotate);
        this.extra_data     = params.extra_data || {};
        // Private properties
        this.#chunk_addr    = new Vector();
        this.chunk_addr_o   = getChunkAddr(this.pos);
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = world.brains.get(this.type, this);
        this.width          = this.#brain.pc.physics.playerHalfWidth * 2;
        this.height         = this.#brain.pc.physics.playerHeight;
        // Сохраним моба в глобальном хранилище, чтобы не пришлось искать мобов по всем чанкам
        world.mobs.add(this);
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
    
    getBrain() {
        return this.#brain;
    }

    // Create new mob
    static async create(world, params) {
        const model = world.models.list.get(params.type);
        if(!model) {
            throw `Can't locate model for create: ${params.type}`;
        }
        if(!(params.skin in model.skins)) {
            throw `Can't locate skin for: ${params.type}/${params.skin}`;
        }
        // make extra_data
        if(!params.extra_data) {
            params.extra_data = {};
        }
        params.extra_data.is_alive = true;
        params.extra_data.play_death_animation = true;
        // make indicators
        params.indicators = world.db.getDefaultPlayerIndicators();
        // store in DB
        const result = await world.db.mobs.create(params);
        for(let k in result) {
            params[k] = result[k];
        }
        //
        switch(params.type) {
            case 'bee': {
                params.extra_data.pollen = 0;
                break;
            }
        }
        return new Mob(world, params);
    }

    tick(delta) {
        if(this.indicators.live.value == 0) {
            return false;
        }
        //
        this.#brain.tick(delta);
        //
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
        if (this.indicators.live.value > 0) {
            await this.#world.db.mobs.save(this);
        } else {
            await this.#world.db.mobs.delete(this);
        }
    }

    /** @param chunk - optional, increases performance a bit. */
    async onUnload(chunk = null) {
        console.debug(`Mob unloaded ${this.entity_id}, ${this.id}`);
        const world = this.#world;
        world.mobs.delete(this.id);
        chunk = chunk ?? world.chunkManager.get(this.chunk_addr);
        if(chunk) {
            chunk.mobs.delete(this.id);
            const connections = Array.from(chunk.connections.keys());
            const packets = [{
                name: ServerClient.CMD_MOB_DELETE,
                data: [this.id]
            }];
            world.sendSelected(packets, connections, []);
        } else {
            // throw 'error_no_mob_chunk';
        }
        await this.save();
    }

    restoreUnloaded(chunk) {
        this.#world.mobs.add(this);
        chunk.mobs.set(this.id, this); // or should we call chunk.addMob(this) ?
    }
    
    setDamage(val, type_damage, actor) {
        this.#brain.onDamage(actor, val);
    }
    
    setUseItem(item_id, actor) {
        return this.#brain.onUse(actor, item_id);
    }

    async punch(server_player, params) {
        if(params.button_id == MOUSE.BUTTON_RIGHT) {
            this.#brain.onUse(server_player, server_player.state.hands.right.id);
        } else if(params.button_id == MOUSE.BUTTON_LEFT) {
            if(this.indicators.live.value > 0) {
                await this.#brain.onDamage(server_player, 5);
            }
        }
    }

    async kill() {
        if(this.already_killed) {
            return false;
        }
        this.already_killed = true;
        this.indicators.live.value = 0;
        this.extra_data.is_alive = false;
        await this.save();
        this.#brain.sendState();
    }

    // Deactivate
    async deactivate() {
        this.is_active = false;
        await this.save();
        await this.onUnload();
    }

    isAlive() {
        return this.indicators.live.value > 0;
    }

    // если игрока нет, он умер или сменил игровой режим на безопасный, то его нельзя атаковать
    playerCanBeAtacked(player) {
        return !player || player.status !== PLAYER_STATUS_ALIVE || !player.game_mode.getCurrent().can_take_damage;
    }

    //
    static fromRow(world, row) {
        return new Mob(world, {
            id:         row.id,
            rotate:     JSON.parse(row.rotate),
            pos_spawn:  JSON.parse(row.pos_spawn),
            pos:        new Vector(row.x, row.y, row.z),
            entity_id:  row.entity_id,
            type:       row.type,
            skin:       row.skin,
            is_active:  row.is_active != 0,
            extra_data: JSON.parse(row.extra_data),
            indicators: JSON.parse(row.indicators)
        });
    }

    exportState() {
        return new MobState(this.id, this.pos, this.rotate, this.extra_data);
    }

}