import { getChunkAddr, Vector } from "../../www/js/helpers.js";
import { Mob, MobSpawnParams } from "../mob.js";
import { DEAD_MOB_TTL } from "../server_constant.js";
import { WorldTickStat } from "./tick_stat.js";

// Store refs to all loaded mobs in the world
export class WorldMobManager {

    static STAT_NAMES = ['update_chunks', 'unload', 'other', 'onLive', 'onFind']

    /**
     * @param {import("../server_world.js").ServerWorld } world 
     */
    constructor(world) {

        this.world = world;
        this.list = new Map(); // by id

        this.ticks_stat = new WorldTickStat(WorldMobManager.STAT_NAMES)

        /**
         * Inactive mobs that are in memory. Because they are inactive, they are no in this.list.
         * They include:
         *  - newly created and deactivated before they were stored in DB
         *  - loaded and deactivated
         *  - killed, waiting to be deleted from DB
         * It's used to:
         *  - re-activate mobs from memory, because their data in DB may be missing or not up-to-date.
         *  - store deleted killed mobs until the next transaction (we could have stored nly their ids,
         *    but there may be also killed mobs in unloaded chunks, so it's simpler to store whole mobs).
         */
        this.inactiveByEntityId = new Map();
        // Immutable previous version of this map - mobs that are being written in the transaction right now.
        // It's used to avoid errors in race conditions.
        this.inactiveByEntityIdBeingWritten = null;
    }

    // убить всех мобов
    kill() {
        const mobs = this.list.values()
        for (const mob of mobs) {
            mob.kill()
        }
    }

    /**
     * @param {Mob} mob 
     */
    add(mob) {
        this.list.set(mob.id, mob);
    }

    /**
     * @param {int} id 
     * @returns 
     */
    get(id) {
        return this.list.get(id);
    }

    /**
     * @param {int} id 
     */
    delete(id) {
        this.list.delete(id);
    }

    /**
     * @returns {int}
     */
    count() {
        return this.list.size;
    }

    /**
     * @param {float} delta 
     */
    async tick(delta) {
        const world = this.world;
        this.ticks_stat.start()
        // !Warning. All mobs must update chunks before ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive()) {
                const chunk_addr = mob.chunk_addr;
                if(!mob.chunk_addr_o.equal(chunk_addr)) {
                    const chunk_old = world.chunks.get(mob.chunk_addr_o);
                    const chunk_new = world.chunks.get(chunk_addr);
                    if(chunk_old && chunk_new) {
                        mob.chunk_addr_o.copyFrom(chunk_addr);
                        chunk_old.mobs.delete(mob.id);
                        chunk_new.mobs.set(mob.id, mob);
                    }
                }
            }
        }
        this.ticks_stat.add('update_chunks')
        // Ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive()) {
                mob.tick(delta);
                this.ticks_stat.add('other')
            } else if(!mob.death_time) {
                mob.death_time = performance.now();
            } else if(performance.now() - mob.death_time > DEAD_MOB_TTL) {
                mob.onUnload();
                this.ticks_stat.add('unload')
            }
        }
        this.ticks_stat.end()
    }

    /**
     * Create mob
     * @param { MobSpawnParams } params 
     * @returns { ?Mob }
     */
    create(params) {
        const world = this.world;
        const chunk_addr = getChunkAddr(params.pos);
        const chunk = world.chunks.get(chunk_addr);
        if(chunk) {
            try {
                // fill some cration params
                params.id = this.world.db.mobs.getNextId();
                params.entity_id = randomUUID();
                if(!('pos' in params)) {
                    throw 'error_no_mob_pos';
                }
                const mob = Mob.create(world, params);
                chunk.addMob(mob);
                return mob;
            } catch(e) {
                console.error('error_create_mob', e);
            }
        } else {
            console.error('Chunk for mob not found');
        }
        return null;
    }

    /**
     * Spawn new mob
     * @param {import("../server_player.js").ServerPlayer } player 
     * @param { MobSpawnParams } params 
     * @returns { boolean }
     */
    spawn(player, params) {
        const world = this.world;
        try {
            if (!world.admins.checkIsAdmin(player)) {
                throw 'error_not_permitted';
            }
            this.create(params);
            return true;
        } catch (e) {
            console.log('e', e);
            player.sendError(e);
        }
        return false
    }

    /**
     * @param {string} entity_id 
     * @param {Vector} spawn_pos 
     * @param {Vector} rotate 
     * @returns 
     */
    async activate(entity_id, spawn_pos, rotate) {
        const world = this.world;
        //
        const chunk = world.chunkManager.get(getChunkAddr(spawn_pos));
        if(!chunk) {
            console.error('error_chunk_not_loaded');
            return false;
        }

        const fromMuatableMap = this.inactiveByEntityId.get(entity_id);
        const mob = fromMuatableMap
            ?? this.inactiveByEntityIdBeingWritten?.get(entity_id)
            ?? await world.db.mobs.load(entity_id);
        if(mob) {
            if (!mob.isAlive()) {
                console.error('Trying to activate a dead mob');
                return false;
            }
            if (mob.is_active) {
                console.error('Trying to activate an active mob');
                return false;
            }
            mob.is_active = true;
            mob.entity_id = entity_id;
            mob.spawn_pos = new Vector(spawn_pos);
            mob.rotate = new Vector(rotate);
            mob.dirtyFlags |= Mob.DIRTY_FLAG_FULL_UPDATE;
            chunk.addMob(mob);
            if (fromMuatableMap) {
                this.inactiveByEntityId.delete(entity_id);
            }
            return mob;
        }
    }

    writeToWorldTransaction(underConstruction) {
        for(const mob of this.list.values()) {
            mob.writeToWorldTransaction(underConstruction, underConstruction.shutdown);
        }
        for(const mob of this.inactiveByEntityId.values()) {
            mob.writeToWorldTransaction(underConstruction, true); // force saving because these mobs will be forgotten
        }
        // make the old map of new mobs immutable, but keep it util the transaction ends
        this.inactiveByEntityIdBeingWritten = this.inactiveByEntityId;
        this.inactiveByEntityId = new Map();
    }

    onWorldTransactionCommit() {
        this.inactiveByEntityIdBeingWritten = null;
    }

}