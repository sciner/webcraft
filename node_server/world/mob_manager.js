import { getChunkAddr } from "../../www/js/chunk.js";
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
        for(let [mob_id, mob] of this.list) {
            if (mob.isAlive()) {
                mob.tick(delta);
            } else if(!mob.death_time) {
                mob.death_time = performance.now();
            } else if(performance.now() - mob.death_time > 1000) {
                await mob.onUnload();
                const packets = [{
                    name: ServerClient.CMD_MOB_DELETED,
                    data: [mob_id]
                }];
                world.sendAll(packets);
            }
        }
    }

    // Create mob
    async create(params) {
        const world = this.world;
        const chunk_addr = getChunkAddr(params.pos);
        const chunk = world.chunks.get(chunk_addr);
        if(chunk) {
            const mob = await Mob.create(world, params);
            chunk.addMob(mob);
            return mob;
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

}