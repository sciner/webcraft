import {getChunkAddr} from "../www/js/chunk.js";
import {BLOCK} from "../www/js/blocks.js";
import {ServerClient} from "../www/js/server_client.js";

import {CHUNK_STATE_NEW, CHUNK_STATE_LOADING, CHUNK_STATE_LOADED, CHUNK_STATE_BLOCKS_GENERATED} from "./server_chunk.js";
import { Vector } from "../www/js/helpers.js";
import {PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../www/vendors/prismarine-physics/using.js";
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
        //
        this.prevPos        = new Vector(this.pos);
        this.lerpPos        = new Vector(this.pos);
        this.pc             = new PrismarinePlayerControl({
            chunkManager: {
                getBlock: (x, y, z) => {
                    let pos = new Vector(x, y, z).floored();
                    let chunk_addr = getChunkAddr(pos);
                    let chunk = this.#world.chunks.get(chunk_addr);
                    if(chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                        return chunk.getBlock(pos);
                    } else {
                        return this.#world.chunks.DUMMY;
                    }
                }
            }
        }, this.pos);
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

    tick(delta) {

        let chunk_over = this.#world.chunks.get(this.#chunk_addr);
        if(chunk_over && chunk_over.load_state == CHUNK_STATE_BLOCKS_GENERATED) {

            let pc                 = this.pc;
            // this.posO              = new Vector(this.lerpPos);
            pc.controls.back       = false; // !!(this.keys[KEY.S] && !this.keys[KEY.W]);
            pc.controls.forward    = true; // !!(this.keys[KEY.W] && !this.keys[KEY.S]);
            pc.controls.right      = false; // !!(this.keys[KEY.D] && !this.keys[KEY.A]);
            pc.controls.left       = false; // !!(this.keys[KEY.A] && !this.keys[KEY.D]);
            pc.controls.jump       = false; // !!this.keys[KEY.SPACE];
            pc.controls.sneak      = false; // !!this.keys[KEY.SHIFT];
            pc.controls.sprint     = false; // this.running;
            pc.player_state.yaw    = this.rotate.z;

            // Random rotate
            if(Math.random() * 5000 < 200) {
                this.rotate.z = (Math.random() * Math.PI * 2) - Math.PI;
            }
            // this.rotate.z += delta;
 
            // Random jump
            pc.controls.jump = Math.random() * 5000 < 200;
            // Physics tick
            let ticks = pc.tick(delta);

            this.pos.copyFrom(pc.player.entity.position);
            let packets = [{
                name: ServerClient.CMD_MOB_UPDATE,
                data: {
                    id:       this.id,
                    rotate:   this.rotate,
                    pos:      this.pos
                }
            }];
            let connections = Array.from(chunk_over.connections.keys());
            this.#world.sendSelected(packets, connections, []);

            /*
                let pos = this.pos.sub(new Vector(0, 1, 0));
                let block = chunk_over.getBlock(pos);
                console.log('Mob at block', block?.material.name);
            */
        }
        // console.log('mobtick: ' + this.entity_id + '; load_state: ' + chunk_over?.addr.toHash());
    }

    onUnload() {
        console.log('Mob unloaded: ' + this.entity_id);
        this.#world.mobs.delete(this.entity_id);
    }

}