import { Vector, unixTime, ObjectHelpers } from "../www/src/helpers.js";
import { PrismarinePlayerControl } from "../www/src/vendors/prismarine-physics/using.js";
import {ServerClient} from "../www/src/server_client.js";
import {PrismarineServerFakeChunkManager} from "./PrismarineServerFakeChunkManager.js";
import type { ServerWorld } from "./server_world.js";
import type { DropItemPacket } from "../www/src/drop_item_manager.js";
import type { WorldTransactionUnderConstruction } from "./db/world/WorldDBActor.js"
import type { BulkDropItemsRow } from "./db/world.js"

export const MOTION_MOVED = 0;  // It moved OR it lacks a chunk
export const MOTION_JUST_STOPPED = 1;
export const MOTION_STAYED = 2;

/** Parameters used in the constructor of {@link DropItem} */
export type DropItemParams = {
    rowId ?     : int
    id ?        : int
    pos         : Vector
    items
    entity_id   : string
    dt          : int       // unixTime()
    delayUserId ? : int     // id of a user that has pickup delay for this item
}

export class DropItem {

    #world : ServerWorld;
    #chunk_addr : Vector;
    #pc;

    static DIRTY_CLEAR      = 0;
    static DIRTY_NEW        = 1;
    static DIRTY_UPDATE     = 2;
    static DIRTY_DELETE     = 3;
    entity_id: any;
    dt: any;
    items: any;
    pos: Vector;
    posO: Vector;
    rowId: any;
    dirty: number;
    inChunk: any;
    motion: number;
    load_time: number;
    /** If it's defined, it's a plyer who has delay picking up this item. */
    delayUserId?: int;

    constructor(world : ServerWorld, params: DropItemParams, velocity? : Vector, isNew : boolean = false) {
        this.#world         = world;
        this.entity_id      = params.entity_id,
        this.dt             = params.dt,
        this.items          = params.items;
        this.pos            = new Vector(params.pos);
        this.posO           = new Vector(Infinity, Infinity, Infinity);
        this.rowId          = params.rowId;
        // Don't set this.dirty directly, call markDirty() instead.
        this.dirty          = isNew ? DropItem.DIRTY_NEW : DropItem.DIRTY_CLEAR;
        this.delayUserId    = params.delayUserId;
        /**
         * The chunk in which this item is currently listed.
         * It may be different from {@link chunk_addr} and {@link getChunk}
         */
        this.inChunk        = null;
        // Private properties
        this.#chunk_addr    = new Vector(0, 0, 0);
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
        //
        this.load_time = performance.now();
        //
        if(velocity) {
            this.addVelocity(velocity);
        }
    }

    /** @return data to send in CMD_DROP_ITEM_ADDED and CMD_DROP_ITEM_FULL_UPDATE */
    getItemFullPacket(): DropItemPacket {
        const res: DropItemPacket = {
            entity_id:  this.entity_id,
            items:      this.items,
            pos:        this.pos,
            dt:         this.dt
        }
        if (this.delayUserId) {
            res.delayUserId = this.delayUserId
        }
        return res
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
            case DropItem.DIRTY_DELETE:
                this.dirty = (this.dirty === DropItem.DIRTY_NEW)
                    ? DropItem.DIRTY_CLEAR // remove it without ever saving to DB
                    : dirtyChange
                break;
            default: throw Error('dirtyChange == ' + dirtyChange);
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

    /**
     * The address of the chunk in which the item should be acording to {@link pos}.
     * It may be different from {@link inChunk}.
     */
    get chunk_addr() {
        return Vector.toChunkAddr(this.pos, this.#chunk_addr);
    }

    addVelocity(vec : Vector) {
        this.#pc.player_state.vel.addSelf(vec);
        this.#pc.tick(0);
    }

    getWorld() {
        return this.#world;
    }

    /**
     * Returns the chunk in which this item should be according to its {@link pos}.
     * Note: it may be different from {@link inChunk}.
     */
    getChunk() {
        return this.#world.chunks.get(this.chunk_addr);
    }

    // Create new drop item. It's dirty and not in the DB yet.
    static create(world: ServerWorld, pos: Vector, items, velocity?: Vector, delayUserId?: number) {
        const params: DropItemParams = {
            pos,
            items:      ObjectHelpers.deepClone(items),
            entity_id:  randomUUID(),
            dt:         unixTime(),
            delayUserId
        };
        return new DropItem(world, params, velocity, true);
    }

    _migrateChunk() {
        const chunk_addr = this.chunk_addr;
        // Delete from the previous chunk
        if(this.inChunk && !chunk_addr.equal(this.inChunk.addr)) {
            this.inChunk.drop_items.delete(this.entity_id);
            this.inChunk = null;
        }

        if (!this.inChunk) {
            // Add to new chunk
            const new_chunk = this.getWorld().chunks.get(chunk_addr);
            if(new_chunk) {
                new_chunk.drop_items.set(this.entity_id, this);
                this.inChunk = new_chunk;
            }
        }
    }

    // Tick
    tick(delta) {
        // If the item is not in a ready chunk, it's safer to not move than to move
        // (posibly falling into infinity, or clipping into walls when the chunk loads).
        if (this.inChunk?.isReady()) {
            const pc = this.#pc;
            pc.tick(delta);
            this.pos.copyFrom(pc.player.entity.position);
        }
        if(!this.pos.equal(this.posO)) { // it moved
            this.motion = MOTION_MOVED;
            this.posO.set(this.pos.x, this.pos.y, this.pos.z);
            this._migrateChunk();
            this.sendState();
            return;
        }
        if (!this.inChunk) {
            this._migrateChunk();
        }
        // inChunk is already updated. If it's absent or not ready, then don't process the item's stop.
        const chunk = this.inChunk;
        if (delta !== 0 && chunk?.isReady()) { // If it doesn't move
            if(this.motion === MOTION_MOVED) {
                this.motion = MOTION_JUST_STOPPED;
                this.#world.chunks.itemWorld.chunksItemMergingQueue.add(chunk);
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

    /** @retrun true if there is anything to save in a world transaction */
    onUnload() {
        this.getWorld().all_drop_items.delete(this.entity_id);
        return this.dirty != DropItem.DIRTY_CLEAR;
    }

    restoreUnloaded() {
        this.getWorld().all_drop_items.set(this.entity_id, this);
    }

    writeToWorldTransaction(underConstruction: WorldTransactionUnderConstruction) {
        if (this.dirty !== DropItem.DIRTY_CLEAR) {
            if (this.dirty === DropItem.DIRTY_DELETE) {
                throw new Error('this.dirty === DropItem.DIRTY_DELETE');
            }
            const pos = this.pos;
            const row: BulkDropItemsRow = [
                this.entity_id,
                this.dt,
                JSON.stringify(this.items),
                pos.x, pos.y, pos.z
            ];
            const list = this.dirty === DropItem.DIRTY_NEW
                ? underConstruction.insertDropItemRows
                : underConstruction.updateDropItemRows;
            list.push(row);
            this.dirty = DropItem.DIRTY_CLEAR;
        }
    }

}