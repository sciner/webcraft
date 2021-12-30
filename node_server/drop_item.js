import {getChunkAddr} from "../www/js/chunk.js";
import { Vector } from "../www/js/helpers.js";
import { PrismarinePlayerControl, PHYSICS_TIMESTEP} from "../www/vendors/prismarine-physics/using.js";
import {CHUNK_STATE_BLOCKS_GENERATED} from "./server_chunk.js";
import {ServerClient} from "../www/js/server_client.js";

export class DropItem {

    #world;
    #chunk_addr;
    #prev_chunk_addr;
    #pc;

    constructor(world, params) {
        this.#world         = world;
        this.entity_id      = params.entity_id,
        this.items          = params.items;
        this.pos            = new Vector(params.pos);
        this.posO           = new Vector(this.pos);
        // Private properties
        this.#chunk_addr    = new Vector();
        // Сохраним drop item в глобальном хранилище, чтобы не пришлось искать по всем чанкам
        world.all_drop_items.set(this.entity_id, this);
        //
        this.#pc = this.createPlayerControl(1, 0.3, 1);
        this.#prev_chunk_addr = getChunkAddr(this.pos);
    }

    /**
     * @param {number} base_speed 
     * @param {number} playerHeight 
     * @param {number} stepHeight 
     * @return {PrismarinePlayerControl}
     */
    createPlayerControl(base_speed, playerHeight, stepHeight) {
        let world = this.getWorld();
        return new PrismarinePlayerControl({
            chunkManager: {
                chunk_addr: new Vector(),
                getBlock: (x, y, z) => {
                    let pos = new Vector(x, y, z).floored();
                    this.#chunk_addr = getChunkAddr(pos, this.#chunk_addr);
                    let chunk = world.chunks.get(this.#chunk_addr);
                    if(chunk && chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                        return chunk.getBlock(pos);
                    } else {
                        return world.chunks.DUMMY;
                    }
                }
            }
        }, this.pos, base_speed, playerHeight, stepHeight);
    }

    get chunk_addr() {
        return getChunkAddr(this.pos, this.#chunk_addr);
    }

    getWorld() {
        return this.#world;
    }

    // Create new drop item
    static async create(world, player, pos, items) {
        const params = {
            pos: new Vector(pos),
            items: JSON.parse(JSON.stringify(items))
        }
        let result = await world.db.createDropItem(params);
        params.entity_id = result.entity_id;
        return new DropItem(world, params);
    }

    // Tick
    tick(delta) {
        const pc = this.#pc;
        pc.tick(delta);
        this.pos.copyFrom(pc.player.entity.position);
        if(!this.pos.equal(this.posO)) {
            this.posO.set(this.pos.x, this.pos.y, this.pos.z);
            // Migrate drop item from previous chunk to new chunk
            if(!this.chunk_addr.equal(this.#prev_chunk_addr)) {
                const world = this.getWorld();
                // Delete from previous chunk
                const prev_chunk = world.chunks.get(this.#prev_chunk_addr);
                if(prev_chunk) {
                    prev_chunk.drop_items.delete(this.entity_id);
                }
                // Add drop item to new chunk
                const new_chunk = world.chunks.get(this.chunk_addr);
                if(new_chunk) {
                    new_chunk.drop_items.set(this.entity_id, this);
                    this.#prev_chunk_addr.clone(this.chunk_addr);
                }
            }
            this.sendState();
        }
    }

    // Send current drop item state to players
    sendState() {
        const world = this.getWorld();
        let chunk_over = world.chunks.get(this.chunk_addr);
        if(!chunk_over) {
            return;
        }
        const packets = [{
            name: ServerClient.CMD_DROP_ITEM_UPDATE,
            data: {
                entity_id:  this.entity_id,
                pos:        this.pos
            }
        }];
        world.sendSelected(packets, Array.from(chunk_over.connections.keys()), []);
    }

    onUnload() {
        this.#world.all_drop_items.delete(this.entity_id);
    }

}