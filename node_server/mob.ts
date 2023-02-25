import { MOUSE, PLAYER_STATUS } from "../www/src/constant.js";
import { Vector } from "../www/src/helpers.js";
import { ServerClient } from "../www/src/server_client.js";
import { MOB_SAVE_PERIOD, MOB_SAVE_DISTANCE } from "./server_constant.js";
import { DBWorldMob } from "./db/world/mob.js"
import { AABB } from "../www/src/core/AABB.js";
import type { ServerWorld } from "./server_world.js";
import type { FSMBrain } from "./fsm/brain.js";
import { EnumDamage } from "../www/src/enums/enum_damage.js";

export class MobSpawnParams {

    /**
     * @type { int }
     */
    id

    /**
     * @type { string }
     */
    entity_id
    pos: any;
    pos_spawn: Vector;
    rotate: Vector;
    type: any;
    skin: any;

    /**
     * @param {Vector} pos
     * @param {Vector} rotate
     * @param {string} type Model of mob
     * @param {string} skin Model skin id
     */
    constructor(pos, rotate, type, skin) {
        this.pos = new Vector(pos)
        this.pos_spawn = new Vector(pos)
        this.rotate = new Vector(rotate)
        this.type = type
        this.skin = skin
    }

}

//
export class MobState {
    id: any;
    pos: Vector;
    rotate: Vector;
    extra_data: any;

    constructor(id : int, pos : Vector, rotate : Vector, extra_data) {
        this.id = id;
        this.pos = new Vector(pos).round(3);
        this.rotate = new Vector(rotate).round(3);
        this.extra_data = JSON.parse(JSON.stringify(extra_data))
        if(this.extra_data?.time_fire !== undefined) {
            this.extra_data.in_fire = this.extra_data.time_fire > 0
            delete(this.extra_data.time_fire)
        }
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

    /**
     * Flags in {@link dirtyFlags}. Without them, an active mob is still considered "dirty",
     * and normal updates are saved in some (but not in every) world transaction.
     */
    static DIRTY_FLAG_NEW           = 0x1; // the record is inserted. It has proority over other flags.
    static DIRTY_FLAG_FULL_UPDATE   = 0x2; // Causes aditional data to be saved, and forces the mob to not skip a transaction.
    static DIRTY_FLAG_UPDATE        = 0x4; // It indicates that something important has changed. Saving in the next transaction won't be skipped.
    static DIRTY_FLAG_SAVED_DEAD    = 0x8; // If the mob is dead and was already saved as dead, it won't be saved again.

    #world : ServerWorld;
    #brain : FSMBrain;
    #chunk_addr : Vector;
    #forward : Vector;

    /**
     * @type { MobState }
     */
    #prev_state;
    id: number;
    entity_id: string;
    type: string;
    skin: string;
    indicators: any;
    is_active: any;
    pos: Vector;
    pos_spawn: Vector;
    rotate: Vector;
    extra_data: any;
    dirtyFlags: number;
    chunk_addr_o: Vector;
    width: number;
    height: number;
    lastSavedTime: number;
    lastSavedPos: Vector;
    _aabb: AABB;
    already_killed?: boolean;
    death_time?: number;
    spawn_pos?: Vector;

    constructor(world : ServerWorld, params, existsInDB) {

        this.#world         = world;

        // Read params
        this.id             = params.id,
        this.entity_id      = params.entity_id,
        this.type           = params.type;
        this.skin           = params.skin;
        this.indicators     = params.indicators;
        this.is_active      = params.is_active;
        this.pos            = new Vector(params.pos);

        // In the old DBWorldMob.create, there was
        //   ':pos_spawn':       JSON.stringify(params.pos),
        // Preserve this semantics if (params.pos_spawn == null)
        this.pos_spawn      = new Vector(params.pos_spawn ?? params.pos);

        this.rotate         = new Vector(params.rotate);
        this.extra_data     = params.extra_data || {};
        this.dirtyFlags     = existsInDB ? 0 : Mob.DIRTY_FLAG_NEW;
        // Private properties
        this.#chunk_addr    = new Vector();
        this.chunk_addr_o   = Vector.toChunkAddr(this.pos);
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = world.brains.get(this.type, this);
        this.width          = this.#brain.pc.physics.playerHalfWidth * 2;
        this.height         = this.#brain.pc.physics.playerHeight;

        // Сохраним моба в глобальном хранилище, чтобы не пришлось искать мобов по всем чанкам
        world.mobs.add(this);

        // To determine when to make regular saves. Add a random to spread different mobs over different transactions.
        this.lastSavedTime  = performance.now() + Math.random() * 0.5 * MOB_SAVE_PERIOD;
        this.lastSavedPos   = new Vector(this.pos); // to force saving is the position changed to much
        this._aabb = new AABB
    }

    get aabb() : AABB {
        this._aabb.set(
            this.pos.x - this.width / 2,
            this.pos.y,
            this.pos.z - this.width / 2,
            this.pos.x + this.width / 2,
            this.pos.y + this.height,
            this.pos.z + this.width / 2
        )
        return this._aabb
    }

    get chunk_addr() : Vector {
        return Vector.toChunkAddr(this.pos, this.#chunk_addr);
    }

    get forward() : Vector {
        return this.#forward.set(
            Math.sin(this.rotate.z),
            0,
            Math.cos(this.rotate.z),
        );
    }

    getWorld() : ServerWorld {
        return this.#world;
    }

    getBrain() : FSMBrain {
        return this.#brain;
    }

    /**
     * Create new mob
     */
    static create(world : ServerWorld, params) : Mob {
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
        params.is_active = 1; // previously is_active was selected from DB, where it's set to 1 by default
        //
        switch(params.type) {
            case 'bee': {
                params.extra_data.pollen = 0;
                break;
            }
        }
        return new Mob(world, params, false);
    }

    tick(delta: float) {
        if(this.indicators.live.value == 0) {
            return false;
        }
        //
        this.#brain.tick(delta);
    }

    addVelocity(vec: Vector) {
        this.#brain.pc.player_state.vel.addSelf(vec);
        this.#brain.pc.tick(0);
    }

    // Marks that the mob needs to save a normal update in the next word transaction (i.e. not skip that transaction).
    markDirty() {
        this.dirtyFlags |= Mob.DIRTY_FLAG_UPDATE;
    }

    /**
     * It's a responsibilty of the caller to add the mob to the appropriate list where
     * it'll await the world transaction.
     * @param chunk - optional, increases performance a bit.
     * @retrun true if there is anything to save in a world transaction
     */
    onUnload(chunk = null) {
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
        // we assume there is always some change to save, unless it's been already saved as dead
        return (this.dirtyFlags & Mob.DIRTY_FLAG_SAVED_DEAD) == 0;
    }

    restoreUnloaded(chunk) {
        this.#world.mobs.add(this);
        chunk.mobs.set(this.id, this); // or should we call chunk.addMob(this) ?
    }

    setDamage(val : number, type_damage? : EnumDamage, actor?) {
        this.#brain.onDamage(val, type_damage, actor);
    }

    setUseItem(item_id, actor) {
        return this.#brain.onUse(actor, item_id);
    }

    punch(server_player, params) {
        if(params.button_id == MOUSE.BUTTON_RIGHT) {
            this.#brain.onUse(server_player, server_player.state.hands.right.id);
        } else if(params.button_id == MOUSE.BUTTON_LEFT) {
            if(this.indicators.live.value > 0) {
                this.#brain.onDamage(5, EnumDamage.PUNCH, server_player);
            }
        }
    }

    // Kill
    kill() {
        if(this.already_killed) {
            return false;
        }
        this.already_killed = true;
        this.indicators.live.value = 0;
        this.extra_data.is_alive = false;
        this.#brain.sendState();
    }

    // Deactivate
    deactivate() {
        this.is_active = false;
        this.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE;
        this.#world.mobs.inactiveByEntityId.set(this.entity_id, this);
        this.onUnload();
    }

    /**
     * @returns {boolean}
     */
    get isAlive() : boolean {
        return this.indicators.live.value > 0;
    }

    // если игрока нет, он умер или сменил игровой режим на безопасный, то его нельзя атаковать
    playerCanBeAtacked(player) {
        return !player || player.status !== PLAYER_STATUS.ALIVE || !player.game_mode.getCurrent().can_take_damage;
    }

    static fromRow(world: ServerWorld, row): Mob {
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
        }, true);
    }

    exportState(return_diff = false): MobState {
        const new_state = new MobState(this.id, this.pos, this.rotate, this.extra_data)
        if(return_diff && this.#prev_state) {
            if(new_state.equal(this.#prev_state)) {
                return null
            }
            if(JSON.stringify(new_state.extra_data) == JSON.stringify(this.#prev_state.extra_data)) {
                new_state.extra_data = null
            }
        }
        return this.#prev_state = new_state
    }

    writeToWorldTransaction(underConstruction, force = false): void {
        const dirtyFlags = this.dirtyFlags;
        if (dirtyFlags & Mob.DIRTY_FLAG_SAVED_DEAD) {
            return;
        }

        if (!this.isAlive) {  // dying is important, don't skip this transaction
            underConstruction.deleteMobIds.push(this.id);
            // prevent it from ever being written again (if it's still in memory by the time of the next transacton)
            this.dirtyFlags = Mob.DIRTY_FLAG_SAVED_DEAD;
            return;
        }
        this.dirtyFlags = 0;

        // if the update is unimportant, skip some transactions
        if (dirtyFlags === 0 && !force &&
            performance.now() - this.lastSavedTime < MOB_SAVE_PERIOD &&
            this.pos.distanceSqr(this.lastSavedPos) < MOB_SAVE_DISTANCE * MOB_SAVE_DISTANCE
        ) {
            return;
        }
        this.lastSavedTime  = performance.now() + Math.random() * 0.5 * MOB_SAVE_PERIOD;
        this.lastSavedPos.copyFrom(this.pos);

        // common fields for all updates
        const row = DBWorldMob.toUpdateRow(this);
        if (!(dirtyFlags & (Mob.DIRTY_FLAG_NEW | Mob.DIRTY_FLAG_FULL_UPDATE))) {
            underConstruction.updateMobRows.push(row);
            return;
        }

        // common fields for full update and insert
        DBWorldMob.upgradeRowToFullUpdate(row, this);
        if (!(dirtyFlags & Mob.DIRTY_FLAG_NEW)) {
            underConstruction.fullUpdateMobRows.push(row);
            return;
        }

        // insert
        DBWorldMob.upgradeRowToInsert(row, this);
        underConstruction.insertMobRows.push(row);
    }

}