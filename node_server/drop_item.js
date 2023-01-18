import { getChunkAddr, Vector } from "../www/js/helpers.js";
import { PrismarinePlayerControl } from "../www/vendors/prismarine-physics/using.js";
import {ServerClient} from "../www/js/server_client.js";
import {PrismarineServerFakeChunkManager} from "./PrismarineServerFakeChunkManager.js";

export const MOTION_MOVED = 0;
export const MOTION_JUST_STOPPED = 1;
export const MOTION_STAYED = 2;

export class DropItem {

    #world;
    #chunk_addr;
    #prev_chunk_addr;
    #pc;

    constructor(world, params, velocity) {
        this.#world         = world;
        this.entity_id      = params.entity_id,
        this.dt             = params.dt,
        this.items          = params.items;
        this.pos            = new Vector(params.pos);
        this.posO           = new Vector(Infinity, Infinity, Infinity);
        // Private properties
        this.#chunk_addr    = new Vector();
        // Сохраним drop item в глобальном хранилище, чтобы не пришлось искать по всем чанкам
        world.all_drop_items.set(this.entity_id, this);
        //
        this.#pc = this.createPlayerControl({
            baseSpeed: 1,
            playerHeight: 0.25,
            stepHeight: .65,
            defaultSlipperiness: 0.75,
            playerHalfWidth: .25
        });
        this.motion = MOTION_MOVED;
        this.#prev_chunk_addr = new Vector(Infinity, Infinity, Infinity);
        //
        this.load_time = performance.now();
        //
        if(velocity) {
            this.addVelocity(velocity);
        }
    }

    /**
     * @param {object} options
     * @return {PrismarinePlayerControl}
     */
    createPlayerControl(options) {
        const world = this.getWorld();
        return new PrismarinePlayerControl({
            chunkManager: new PrismarineServerFakeChunkManager(world)
        }, this.pos, options);
    }

    get chunk_addr() {
        return getChunkAddr(this.pos, this.#chunk_addr);
    }

    setPrevChunkAddr(prevChunkAdr) {
        this.#prev_chunk_addr.set(prevChunkAdr);
    }

    addVelocity(vec) {
        this.#pc.player_state.vel.addSelf(vec);
        this.#pc.tick(0);
    }

    getWorld() {
        return this.#world;
    }

    getChunk() {
        return this.#world.chunks.get(this.chunk_addr);
    }

    // Create new drop item
    static async create(world, pos, items, velocity) {
        const params = {
            pos: new Vector(pos),
            items: JSON.parse(JSON.stringify(items))
        }
        let result = await world.db.createDropItem(params);
        params.entity_id = result.entity_id;
        params.dt = result.dt;
        return new DropItem(world, params, velocity);
    }

    // Tick
    tick(delta) {
        const pc = this.#pc;
        pc.tick(delta);
        this.pos.copyFrom(pc.player.entity.position);
        if(!this.pos.equal(this.posO)) {
            this.motion = MOTION_MOVED;
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
                    this.#prev_chunk_addr.copyFrom(this.chunk_addr);
                }
            }
            this.sendState();
        } else if (delta !== 0) { // If it doesn't move
            if(this.motion === MOTION_MOVED) {
                this.motion = MOTION_JUST_STOPPED;
                const chunk = this.getChunk();
                if(chunk && chunk.isReady()) {
                    this.#world.chunks.itemWorld.chunksItemMergingQueue.add(chunk);
                }
            } else {
                this.motion = MOTION_STAYED;
            }
        }
    }

    // Send current drop item state to players
    sendState() {
        const world = this.getWorld();
        let chunk_over = this.getChunk();
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

    async onUnload() {
        const world = this.getWorld();
        world.all_drop_items.delete(this.entity_id);
        await world.db.updateDropItem(this);
    }

    async restoreUnloaded() {
        this.getWorld().all_drop_items.set(this.entity_id, this);
    }
}