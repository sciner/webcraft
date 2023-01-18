import { getChunkAddr, Vector, unixTime, ObjectHelpers } from "../www/js/helpers.js";
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

    static DIRTY_CLEAR      = 0;
    static DIRTY_NEW        = 1;
    static DIRTY_UPDATE     = 2;
    static DIRTY_DELETE     = 3;

    constructor(world, params, velocity, isNew) {
        this.#world         = world;
        this.entity_id      = params.entity_id,
        this.dt             = params.dt,
        this.items          = params.items;
        this.pos            = new Vector(params.pos);
        this.posO           = new Vector(Infinity, Infinity, Infinity);
        this.rowId          = params.rowId;
        // Don't set this.dirty directly, call markDirty instead.
        this.dirty          = isNew ? DropItem.DIRTY_NEW : DropItem.DIRTY_CLEAR;
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
     * Changes dirty status according to dirtyChange (one of DropItem.DIRTY_***).
     * It doesn't validate all posible cases, only processes expected valid changes.
     */
    markDirty(dirtyChange) {
        switch(dirtyChange) {
            case DropItem.DIRTY_CLEAR:
            case DropItem.DIRTY_NEW:
                this.dirty = dirtyChange;
                break;
            case DropItem.DIRTY_UPDATE:
                // It can't override DropItem.DIRTY_NEW
                if (this.dirty === DropItem.DIRTY_CLEAR) {
                    this.dirty = dirtyChange;
                }
                break;
            default: // case DropItem.DIRTY_DELETE:
                this.dirty = (this.dirty === DropItem.DIRTY_NEW)
                    ? DropItem.DIRTY_CLEAR // remove it without ever saving to DB
                    : dirtyChange
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

    // Create new drop item. It's dirty and not in the DB yet.
    static async create(world, pos, items, velocity) {
        const params = {
            pos,
            items:      ObjectHelpers.deepClone(items),
            entity_id:  randomUUID(),
            dt:         unixTime()
        };
        return new DropItem(world, params, velocity, true);
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
        if (this.dirty != DropItem.DIRTY_CLEAR) {
            return world.dbActor.worldSavingPromise;
        }
    }

    async restoreUnloaded() {
        this.getWorld().all_drop_items.set(this.entity_id, this);
    }

    writeToWorldTransaction(underConstruction) {
        if (this.dirty !== DropItem.DIRTY_CLEAR) {
            underConstruction.insertOrUpdateDropItems.push(this);
        }
    }

}