import { Vector } from "@client/helpers.js";
import { Mob, MobSpawnParams } from "../mob.js";
import { DEAD_MOB_TTL } from "../server_constant.js";
import type { ServerPlayer } from "../server_player.js";
import type { ServerWorld } from "../server_world.js";
import { WorldTickStat } from "./tick_stat.js";

// Store refs to all loaded mobs in the world
export class WorldMobManager {

    static STAT_NAMES = ['update_chunks', 'unload', 'other', 'onLive', 'onFind']
    static MOB_STAT_NAMES = ['onLive', 'onFind']
    world: ServerWorld;
    list: Map<int, Mob>;
    ticks_stat: WorldTickStat;
    ticks_stat_by_mob_type: Map<string, WorldTickStat> = new Map();
    inactiveByEntityId: Map<string, Mob>;
    inactiveByEntityIdBeingWritten: Map<string, Mob> | null;

    constructor(world: ServerWorld) {

        this.world = world;
        this.list = new Map();

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

    getTickStatForMob(mob: Mob): WorldTickStat {
        let res = this.ticks_stat_by_mob_type.get(mob.type)
        if (res == null) {
            res = new WorldTickStat(WorldMobManager.MOB_STAT_NAMES)
            this.ticks_stat_by_mob_type.set(mob.type, res)
            res.start()
        }
        return res
    }

    // убить всех мобов
    kill() {
        for (const mob of this.list.values()) {
            mob.kill()
        }
    }

    add(mob: Mob): void {
        this.list.set(mob.id, mob);
    }

    get(id: int): Mob | undefined {
        return this.list.get(id);
    }

    delete(id: int): void {
        this.list.delete(id);
    }

    count(): int {
        return this.list.size;
    }

    async tick(delta: float) {
        const world = this.world;
        this.ticks_stat.start()
        for(const stat of this.ticks_stat_by_mob_type.values()) {
            stat.start()
        }
        // !Warning. All mobs must update chunks before ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive) {
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
            if(mob.isAlive) {
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
        for(const stat of this.ticks_stat_by_mob_type.values()) {
            stat.end()
        }
    }

    /**
     * Create mob
     */
    create(params: MobSpawnParams): Mob | null {
        const world = this.world;
        const chunk_addr = Vector.toChunkAddr(params.pos);
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
     */
    spawn(player: ServerPlayer, params: MobSpawnParams): boolean {
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

    async activate(entity_id: string, pos_spawn: Vector, rotate: Vector): Promise<Mob | null> {
        const world = this.world;
        //
        const chunk = world.chunkManager.get(Vector.toChunkAddr(pos_spawn));
        if(!chunk) {
            console.error('error_chunk_not_loaded');
            return null;
        }

        const fromMuatableMap = this.inactiveByEntityId.get(entity_id);
        const mob = fromMuatableMap
            ?? this.inactiveByEntityIdBeingWritten?.get(entity_id)
            ?? await world.db.mobs.load(entity_id);
        if(mob) {
            if (!mob.isAlive) {
                console.error('Trying to activate a dead mob');
                return null;
            }
            if (mob.is_active) {
                console.error('Trying to activate an active mob');
                return null;
            }
            mob.is_active = true;
            mob.entity_id = entity_id;
            mob.pos_spawn = new Vector(pos_spawn);
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