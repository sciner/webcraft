import {getChunkAddr, SpiralEntry, SpiralGenerator, Vector, VectorCollector} from "../www/js/helpers.js";
import {ALLOW_NEGATIVE_Y, CHUNK_GENERATE_MARGIN_Y} from "../www/js/chunk_const.js";
import {WorldChunkFlags} from "./db/world/WorldChunkFlags.js";
import { NEARBY_FLAGS } from "../www/js/packet_compressor.js";

export class NearbyCollector {
    constructor() {
        this.inner = new VectorCollector();
        this.chunk_render_dist = 0;
        this.markClean();
    }

    *[Symbol.iterator]() {
        for (let x of this.inner) {
            yield value;
        }
    }

    clear() {
        this.inner.clear();
    }

    has(vec) {
        return this.inner.has(vec);
    }

    markDirtyAdd() {
        this.dirty = Math.max(this.dirty, 1);
    }

    markDirtyDelete() {
        this.dirty = 2;
    }

    markClean() {
        /**
         * 0 - no changes
         * 1 - chunks were probably added
         * 2 - chunks were probably added/removed
         */
        this.dirty = 0;
        this.added = [];
        this.removed = [];
    }

    calculate() {
    }
}

export class ServerPlayerVision {
    constructor(player) {
        this.player = player;

        this.nearbyChunks = new NearbyCollector();

        this.safePosWaitingChunks   = [];
        this.safeTeleportMargin = 2;
        this.safeTeleportMarginY = 2;
        this.safePosInitialOverride = null;

        this.spiralCenter           = new Vector(0, 0, 0);

        // new logic here!
        this.waitSafeEntries = [];
        /**
         * list of chunk addrs, with distances!
         * @type {*[]}
         */
        this.waitEntries = [];

        this.spiralEntries = [];
        this.spiralLoading = 0;
        this.spiralWaiting = 0;
        this.spiralRadius = 0;
    }

    leave() {
        const {player} = this;
        const {chunkManager} = player.world;
        for (let i = 0; i < this.safePosWaitingChunks.length; i++) {
            this.safePosWaitingChunks[i].safeTeleportMarker--;
            chunkManager.invalidate(this.safePosWaitingChunks[i]);
        }
        for(let chunk of this.nearbyChunks.inner) {
            chunk?.removePlayer(player);
        }
        this.safePosWaitingChunks.length = 0;
        this.nearbyChunks.clear();
    }

    initSpawn() {
        const {player} = this;
        this.safePosWaitingChunks = this.queryVisibleChunks();
        for (let i = 0; i < this.safePosWaitingChunks.length; i++) {
            this.safePosWaitingChunks[i].safeTeleportMarker++;
        }
    }

    checkWaitingChunks() {
        let i = 0;
        while (i < this.safePosWaitingChunks.length) {
            if (this.safePosWaitingChunks[i].isReady()) {
                this.safePosWaitingChunks[i].safeTeleportMarker--;
                this.safePosWaitingChunks[i] = this.safePosWaitingChunks[this.safePosWaitingChunks.length - 1];
                --this.safePosWaitingChunks.length;
            } else {
                ++i;
            }
        }
        return i;
    }

    teleportSafePos(new_pos) {
        this.safePosWaitingChunks = this.queryVisibleChunks(new_pos);
        for (let i = 0; i < this.safePosWaitingChunks.length; i++) {
            this.safePosWaitingChunks[i].safeTeleportMarker++;
        }
        this.safePosInitialOverride = new_pos;
    }

    // forces chunks visible to the player to load, and return their list
    queryVisibleChunks(posOptioanl, chunk_render_dist = 0) {
        const {player} = this;
        const {chunkManager} = player.world;
        var list = [];
        const pos = posOptioanl || player.state.pos;
        const chunk_addr = getChunkAddr(pos);
        chunk_render_dist = chunk_render_dist || player.safeTeleportMargin;
        const margin            = Math.max(chunk_render_dist + 1, 1);
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, player.safeTeleportMarginY, margin));
        // Find new chunks
        for(let i = 0; i < spiral_moves_3d.length; i++) {
            const addr = chunk_addr.add(spiral_moves_3d[i].pos);
            list.push(chunkManager.getOrAdd(addr));
        }
        return list;
    }

    genSpiral() {
        const {player, spiralEntries} = this;
        const chunk_render_dist = player.state.chunk_render_dist;
        const margin            = this.spiralRadius = Math.max(chunk_render_dist + 1, 1);
        const centerAddr        = this.spiralCenter = player.chunk_addr;
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));
        while (spiralEntries.length < spiral_moves_3d) {
            spiralEntries.push(new SpiralEntry());
        }
        let n = spiralEntries.length = spiral_moves_3d.length;
        for (let i = 0; i < n; i++) {
            spiralEntries[i].copyTranslate(spiral_moves_3d[i], centerAddr);
        }

        this.spiralLoading = 0;
        this.spiralWaiting = 0;
        this.spiralCenter.copyFrom(centerAddr);
        this.spiralRadius = margin;

        this.nearbyChunks.chunk_render_dist = chunk_render_dist;
        this.nearbyChunks.markDirtyDelete();
        this.checkSpiralChunks();
    }

    checkSpiralChunks() {
        const {player, spiralEntries} = this;
        const {world} = player;
        const {chunkManager} = world;
        let n = spiralEntries.length;
        let found = 0;
        for (let i = this.spiralLoading; i < n; i++) {
            const entry = spiralEntries[i];
            if (!entry.chunk) {
                entry.chunk = chunkManager.getOrRestore(entry.pos);
                if (entry.chunk) {
                    found++;
                }
            }
        }
        if (found > 0) {
            this.nearbyChunks.markDirtyAdd();
        }
        while (this.spiralLoading < n && spiralEntries[this.spiralLoading].chunk) {
            this.spiralLoading++;
        }
    }

    updateNearby() {
        if (nearbyChunks.dirty === 0) {
            return false;
        }

        const {nearbyChunks} = this;
        const checkDelete = nearbyChunks.dirty === 2;

        return true;
    }

    updateVisibleChunks(force) {
        const {player, nearby_chunk_addrs, spiralEntries} = this;
        const {world} = player;
        const {chunkManager} = world;
        player.chunk_addr = getChunkAddr(player.state.pos);

        let nearby = {
            chunk_render_dist:  chunk_render_dist,
            added:              [], // чанки, которые надо подгрузить
            deleted:            [] // чанки, которые надо выгрузить
        }
        if (force || !this.spiralCenter.equal(player.chunk_addr)) {
            this.genSpiral();
        }

        const added_vecs        = new VectorCollector();
        const chunk_render_dist = player.state.chunk_render_dist;
        const margin            = Math.max(chunk_render_dist + 1, 1);
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));

        //
        const nearby = {

        };

        // Find new chunks
        for(let i = 0; i < spiral_moves_3d.length; i++) {
            const sm = spiral_moves_3d[i];
            const addr = player.chunk_addr.add(sm.pos);
            if(ALLOW_NEGATIVE_Y || addr.y >= 0) {
                added_vecs.set(addr, true);
                if(!nearby_chunk_addrs.has(addr)) {
                    nearby_chunk_addrs.set(addr, addr);
                    let chunk = chunkManager.getOrAdd(addr);
                    chunk.addPlayer(player);
                    const hasModifiers = world.worldChunkFlags.has(addr,
                        WorldChunkFlags.MODIFIED_BLOCKS | WorldChunkFlags.MODIFIED_FLUID);
                    const flags =
                        (hasModifiers ? NEARBY_FLAGS.HAS_MODIFIERS : 0) |
                        (chunk.hasOtherData() ? NEARBY_FLAGS.HAS_OTHER_DATA : 0);
                    nearby.added.push({addr, flags});
                }
            }
        }

        // Check deleted
        for(let addr of nearby_chunk_addrs) {
            if(!added_vecs.has(addr)) {
                nearby_chunk_addrs.delete(addr);
                chunkManager.get(addr, false)?.removePlayer(player);
                nearby.deleted.push(addr);
            }
        }

        return nearby;
    }

    checkWaitingAddrs() {
        const {waitSafeEntries, waitEntries} = this;
        const { chunkManager } = this.player.world;
        let n = waitSafeEntries.length;
        if (n > 0) {
            let j = 0;
            for (let i = 0; i < n; i++) {
                const entry = waitSafeEntries[i];
                let chunk = chunkManager.getOrRestore(entry.pos);
                if (chunk) {
                    entry.chunk = chunk;
                    this.safePosWaitingChunks.push(chunk);
                    chunk.safeTeleportMarker++;
                } else {
                    waitSafeEntries[j++] = entry;
                }
            }
            waitSafeEntries.length = j;
        }
        n = waitEntries.length;
        if (n > 0) {
            let j = 0;
            for (let i = 0; i < n; i++) {
                const entry = waitEntries[i];
                let chunk = chunkManager.getOrRestore(entry.pos);
                if (chunk) {
                    entry.chunk = chunk;
                } else {
                    waitEntries[j++] = entry;
                }
            }
            if (waitEntries.length > j) {
                waitEntries.length = j;
                this.nearbyChunks.markDirtyAdd();
            }
        }
    }
}