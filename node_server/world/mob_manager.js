import { getChunkAddr } from "../../www/js/helpers.js";
import { ServerClient } from "../../www/js/server_client.js";
import { Mob } from "../mob.js";

// Store refs to all loaded mobs in the world
export class WorldMobManager {

    constructor(world) {
        this.world = world;
        this.list = new Map();
    }

    add(mob) {
        this.list.set(mob.id, mob);
    }

    get(id) {
        return this.list.get(id);
    }

    delete(id) {
        this.list.delete(id);
    }

    count() {
        return this.list.size;
    }

    async tick(delta) {
        const world = this.world;
        // !Warning. All mobs must update chunks before ticks
        for(let [mob_id, mob] of this.list) {
            if(mob.isAlive()) {
                const chunk_addr = mob.chunk_addr;
                if(!mob.chunk_addr_o.equal(chunk_addr)) {
                    const chunk_old = world.chunks.get(mob.chunk_addr_o);
                    const chunk_new = world.chunks.get(chunk_addr);
                    if(chunk_old && chunk_new) {
                        mob.chunk_addr_o.copyFrom(chunk_addr);
                        chunk_old.mobs.delete(mob_id);
                        chunk_new.mobs.set(mob_id, mob);
                    }
                }
            }
        }
        // Ticks
        for(let mob of this.list.values()) {
            if(mob.isAlive()) {
                mob.tick(delta);
            } else if(!mob.death_time) {
                mob.death_time = performance.now();
            } else if(performance.now() - mob.death_time > 1000) {
                await mob.onUnload();
            }
        }
    }

    // Create mob
    async create(params) {
        const world = this.world;
        const chunk_addr = getChunkAddr(params.pos);
        const chunk = world.chunks.get(chunk_addr);
        if(chunk) {
            try {
                const mob = await Mob.create(world, params);
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

    // Spawn new mob
    async spawn(player, params) {
        const world = this.world;
        try {
            if (!world.admins.checkIsAdmin(player)) {
                throw 'error_not_permitted';
            }
            await this.create(params);
            return true;
        } catch (e) {
            console.log('e', e);
            let packets = [{
                name: ServerClient.CMD_ERROR,
                data: {
                    message: e
                }
            }];
            world.sendSelected(packets, [player.session.user_id], []);
        }
    }

    //
    async activate(entity_id, spawn_pos, rotate) {
        const world = this.world;
        //
        const chunk = world.chunkManager.get(getChunkAddr(spawn_pos));
        if(!chunk) {
            console.error('error_chunk_not_loaded');
            return false;
        }
        //
        await world.db.mobs.activateMob(entity_id, spawn_pos, rotate);
        const mob = await world.db.mobs.load(entity_id);
        if(mob) {
            chunk.addMob(mob)
        }
    }

}