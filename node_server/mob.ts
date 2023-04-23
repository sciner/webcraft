import { MOB_TYPE, MOUSE, PLAYER_STATUS } from "@client/constant.js";
import { Vector } from "@client/helpers.js";
import { ServerClient } from "@client/server_client.js";
import { MOB_SAVE_PERIOD, MOB_SAVE_DISTANCE } from "./server_constant.js";
import { DBWorldMob, MobRow } from "./db/world/mob.js"
import { AABB } from "@client/core/AABB.js";
import type { ServerWorld } from "./server_world.js";
import type { FSMBrain } from "./fsm/brain.js";
import { EnumDamage } from "@client/enums/enum_damage.js";
import type { WorldTransactionUnderConstruction } from "./db/world/WorldDBActor.js";
import type { Indicators, PlayerSkin } from "@client/player.js";
import type { ServerPlayer } from "./server_player.js";
import { upgradeToNewIndicators } from "./db/world.js";
import type { ServerChunk } from "./server_chunk.js";
import type { ChunkGrid } from "@client/core/ChunkGrid.js";

export class MobSpawnParams {
    // These values are added by WorldMobManager.create
    id?:            int
    entity_id?:     string

    pos:            Vector
    pos_spawn:      Vector
    rotate:         Vector
    skin:           PlayerSkin

    // These values are added to params by the mob itself
    extra_data?:    any
    indicators?:    Indicators
    is_active?:     boolean | int // 0 or 1

    constructor(pos: Vector, rotate: Vector, skin: PlayerSkin) {
        this.pos = new Vector(pos)
        this.pos_spawn = new Vector(pos)
        this.rotate = new Vector(rotate)
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
     */
    equal(state: MobState): boolean {
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
    #brain : any
    #chunk_addr : Vector;
    #forward : Vector;

    /**
     * @type { MobState }
     */
    #prev_state;
    id: int;
    entity_id: string;
    skin: PlayerSkin;
    indicators: Indicators;
    is_active?: boolean | int;
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
    already_killed?: boolean | int;
    death_time?: number;
    #grid: ChunkGrid

    constructor(world : ServerWorld, params: MobSpawnParams, existsInDB: boolean) {

        this.#world         = world;
        this.#grid          = world.chunkManager.grid

        // Read params
        this.id             = params.id,
        this.entity_id      = params.entity_id,
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
        this.chunk_addr_o   = world.chunkManager.grid.toChunkAddr(this.pos);
        this.#forward       = new Vector(0, 1, 0);
        this.#brain         = world.brains.get(this.skin.model_name, this);
        this.width          = this.#brain.pc.playerHalfWidth * 2;
        this.height         = this.#brain.pc.playerHeight;

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
        return this.#grid.toChunkAddr(this.pos, this.#chunk_addr);
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

    getBrain() {
        return this.#brain
    }

    /**
     * Create new mob
     */
    static create(world : ServerWorld, params: MobSpawnParams) : Mob {
        // TODO: need to check mob type and skin from bbmodels
        // const model = world.models.list.get(params.type);
        // if(!model) {
        //     throw `Can't locate model for create: ${params.type}`;
        // }
        // if(!(params.skin in model.skins)) {
        //     throw `Can't locate skin for: ${params.type}/${params.skin}`;
        // }
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
        switch(params.skin.model_name) {
            case MOB_TYPE.BEE: {
                params.extra_data.pollen = 0;
                break;
            }
        }
        const mob = new Mob(world, params, false)
        const brain = mob.getBrain()
        if (brain.test) {
            brain.onInit()
        }
        return mob
    }

    tick(delta: float): void {
        if(this.indicators.live == 0) {
            return;
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
    onUnload(chunk : ServerChunk = null) {
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

    punch(server_player: ServerPlayer, params) {
        if(params.button_id == MOUSE.BUTTON_RIGHT) {
            this.#brain.onUse(server_player, server_player.state.hands.right.id);
        } else if(params.button_id == MOUSE.BUTTON_LEFT) {
            if(this.indicators.live > 0) {
                this.#brain.onDamage(5, EnumDamage.PUNCH, server_player);
            }
        }
    }

    // Kill
    kill(): void {
        if(this.already_killed) {
            return;
        }
        this.already_killed = true;
        this.indicators.live = 0;
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

    get isAlive() : boolean {
        return this.indicators.live > 0;
    }

    // если игрока нет, он умер или сменил игровой режим на безопасный, то его нельзя атаковать
    playerCanBeAtacked(player?: ServerPlayer) {
        return !player || player.status !== PLAYER_STATUS.ALIVE || !player.game_mode.getCurrent().can_take_damage;
    }

    static fromRow(world: ServerWorld, row: MobRow): Mob {
        return new Mob(world, {
            id:         row.id,
            rotate:     JSON.parse(row.rotate),
            pos_spawn:  JSON.parse(row.pos_spawn),
            pos:        new Vector(row.x, row.y, row.z),
            entity_id:  row.entity_id,
            skin:       {model_name: row.type, texture_name: row.skin} as PlayerSkin,
            is_active:  row.is_active != 0,
            extra_data: JSON.parse(row.extra_data),
            indicators: upgradeToNewIndicators(JSON.parse(row.indicators))
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

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction, force = false): void {
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
        const updateRow = DBWorldMob.toUpdateRow(this);
        if (!(dirtyFlags & (Mob.DIRTY_FLAG_NEW | Mob.DIRTY_FLAG_FULL_UPDATE))) {
            underConstruction.updateMobRows.push(updateRow);
            return;
        }

        // common fields for full update and insert
        const fullUpdateRow = DBWorldMob.upgradeRowToFullUpdate(updateRow, this);
        if (!(dirtyFlags & Mob.DIRTY_FLAG_NEW)) {
            underConstruction.fullUpdateMobRows.push(fullUpdateRow);
            return;
        }

        // insert
        const insertRow = DBWorldMob.upgradeRowToInsert(fullUpdateRow, this);
        underConstruction.insertMobRows.push(insertRow);
    }

}