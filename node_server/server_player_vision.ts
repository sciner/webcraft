import {SpiralEntry, SpiralGenerator, Vector, VectorCollector} from "@client/helpers.js";
import { CHUNK_GENERATE_MARGIN_Y, CHUNK_STATE} from "@client/chunk_const.js";
import {WorldChunkFlags} from "./db/world/WorldChunkFlags.js";
import { NEARBY_FLAGS } from "@client/packet_compressor.js";
import {ServerChunk} from "./server_chunk.js";
import type { ServerPlayer } from "server_player.js";
import type { ChunkGrid } from "@client/core/ChunkGrid.js";

const PLAYER_CHUNK_QUEUE_SIZE = 20;

export class NearbyCollector {
    inner: VectorCollector;
    chunk_render_dist: number;
    dirty: number;
    added: any[];
    deleted: any[];
    constructor() {
        this.inner = new VectorCollector();
        this.markClean();
        this.chunk_render_dist = 0;
    }

    *[Symbol.iterator]() {
        for (let value of this.inner) {
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
        this.deleted = [];
    }

    add(pos, elem) {
        this.inner.add(pos, elem);
        this.added.push(pos.clone());
    }

    delete(pos) {
        this.inner.delete(pos);
        this.deleted.push(pos.clone());
    }
}

export class ServerPlayerVision {
    player: ServerPlayer;
    nearbyChunks: NearbyCollector;
    safePosWaitingChunks: any[];
    safeTeleportMargin: number;
    safeTeleportMarginY: number;
    safePosInitialOverride?: Vector | null;
    spiralCenter: Vector;
    waitSafeEntries: any[];
    waitEntries: any[];
    spiralEntries: any[];
    spiralLoading: number;
    spiralWaiting: number;
    spiralRadius: number;
    extraRadius: number;
    grid: ChunkGrid
    tempVec = new Vector()

    constructor(player : ServerPlayer) {
        this.player = player;
        this.grid = player.world.chunkManager.grid

        this.nearbyChunks = new NearbyCollector();

        this.safePosWaitingChunks   = [];
        this.safeTeleportMargin = 2;
        this.safeTeleportMarginY = 2;
        this.safePosInitialOverride = null;

        this.spiralCenter           = new Vector(Infinity, 0, 0);

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

        /**
         * dont kill chunks that are a bit further player spiral
         */
        this.extraRadius = 2;
    }

    leave() {
        const {player} = this;
        this.flushSafeWaiting();
        this.flushSpiral();
        this.waitEntries.length = 0;
        this.waitSafeEntries.length = 0;
        this.spiralEntries.length = 0;
        for(let chunk of this.nearbyChunks) {
            chunk?.removePlayer(player);
        }
        this.nearbyChunks.clear();
    }

    initSpawn() {
        this.safeVisibleChunks();
    }

    teleportSafePos(new_pos) {
        this.safeVisibleChunks(new_pos);
        this.safePosInitialOverride = new_pos;
    }

    flushSafeWaiting() {
        const {player} = this;
        const {chunkManager} = player.world;
        const {safePosWaitingChunks} = this;
        for (let i = 0; i < safePosWaitingChunks.length; i++) {
            const chunk = safePosWaitingChunks[i];
            chunk.safeTeleportMarker--;
            chunkManager.invalidate(chunk);
        }
        safePosWaitingChunks.length = 0;
    }

    flushSpiral() {
        const {spiralEntries} = this;
        for (let i = 0; i < spiralEntries.length; i++) {
            const {chunk} = spiralEntries[i];
            if (chunk) {
                chunk.spiralMarker--;
            }
        }
    }

    checkWaitingState() {
        const { waitSafeEntries, safePosWaitingChunks } = this;
        const { chunkManager } = this.player.world;

        let n = waitSafeEntries.length;
        if (n > 0) {
            let j = 0;
            for (let i = 0; i < n; i++) {
                const entry = waitSafeEntries[i];
                let chunk = chunkManager.getOrRestore(entry.pos);
                if (chunk) {
                    if (chunk.load_state >=6) {
                        console.log("WTF?");
                        waitSafeEntries[j++] = entry;
                    } else {
                        entry.chunk = chunk;
                        this.safePosWaitingChunks.push(chunk);
                        chunk.safeTeleportMarker++;
                    }
                } else {
                    waitSafeEntries[j++] = entry;
                }
            }
            waitSafeEntries.length = j;
        }

        n = safePosWaitingChunks.length;
        let ready = 0;
        for (let i = 0; i < n; i++) {
            if (safePosWaitingChunks[i].isReady()) {
                ready++;
            }
        }
        const wait = n - ready + waitSafeEntries.length;
        if (wait === 0) {
            this.flushSafeWaiting();
        }
        return wait;
    }

    // forces chunks visible to the player to load, and return their list
    queryVisibleChunks(posOptional, chunk_render_dist = 0) {
        const {player} = this;
        let list = [];
        const pos = posOptional || player.state.pos;
        const chunk_addr = this.grid.toChunkAddr(pos);
        chunk_render_dist = chunk_render_dist || this.safeTeleportMargin;
        const margin            = Math.max(chunk_render_dist + 1, 1);
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, this.safeTeleportMarginY, margin)).entries;
        // Find new chunks
        for(let i = 0; i < spiral_moves_3d.length; i++) {
            const entry = new SpiralEntry().copyTranslate(spiral_moves_3d[i], chunk_addr);
            list.push(entry);
        }
        return list;
    }

    safeVisibleChunks(posOptioanl?, chunk_render_dist?) {
        this.waitSafeEntries = this.queryVisibleChunks(posOptioanl, chunk_render_dist);
        this.waitSafeEntries.forEach((x) => x.dist = 0);
        this.flushSafeWaiting();
    }

    genSpiral() {
        const {player, spiralEntries} = this;
        const chunk_render_dist = player.state.chunk_render_dist;
        const margin            = this.spiralRadius = Math.max(chunk_render_dist + 1, 1);
        const centerAddr        = this.spiralCenter = player.chunk_addr;
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin)).entries;
        this.flushSpiral();
        while (spiralEntries.length < spiral_moves_3d.length) {
            spiralEntries.push(new SpiralEntry());
        }
        let n = spiralEntries.length = spiral_moves_3d.length;
        for (let i = 0; i < n; i++) {
            spiralEntries[i].copyTranslate(spiral_moves_3d[i], centerAddr);
        }

        this.waitEntries.length = 0;
        this.spiralLoading = 0;
        this.spiralWaiting = 0;
        this.spiralCenter.copyFrom(centerAddr);
        this.spiralRadius = margin;

        this.nearbyChunks.chunk_render_dist = chunk_render_dist;
        this.nearbyChunks.markDirtyDelete();
        this.checkSpiralChunks(spiralEntries.length);
    }

    checkSpiralChunks(maxScan = PLAYER_CHUNK_QUEUE_SIZE * 2) {
        const {player, spiralEntries} = this;
        const {world} = player;
        const {chunkManager} = world;
        let n = spiralEntries.length;
        let found = 0;
        //TODO: ALLOW_NEGATIVE_Y ?
        let rightScan = Math.min(n, this.spiralLoading + maxScan);
        for (let i = this.spiralLoading; i < rightScan; i++) {
            const entry = spiralEntries[i];
            if (!entry.chunk || entry.chunk.load_state >= CHUNK_STATE.UNLOADING) {
                entry.chunk = chunkManager.getOrRestore(entry.pos);
                if (entry.chunk) {
                    entry.chunk.spiralMarker++;
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
        const {spiralEntries, nearbyChunks, player,
            spiralCenter, spiralRadius, extraRadius} = this;
        const {world} = player;
        if (nearbyChunks.dirty === 0) {
            return false;
        }
        const checkDelete = nearbyChunks.dirty === 2;

        const scanId = ++ServerChunk.SCAN_ID;
        for (let i = 0; i < spiralEntries.length; i++) {
            const {pos, chunk} = spiralEntries[i];
            if (!chunk) {
                continue;
            }

            chunk.scanId = scanId;
            if (!nearbyChunks.has(pos)) {
                nearbyChunks.add(pos, chunk)
                chunk.addPlayer(player);
            }
        }

        if (checkDelete) {
            for (let chunk of nearbyChunks) {
                if (chunk.scanId !== scanId
                    && spiralCenter.distance(chunk.addr) > spiralRadius + extraRadius) {
                    nearbyChunks.delete(chunk.addr);
                    chunk.removePlayer(player);
                }
            }
        }

        if (nearbyChunks.added.length > 0) {
            nearbyChunks.added = nearbyChunks.added.map((addr) => {
                const chunk = world.chunkManager.get(addr);
                const hasModifiers = world.worldChunkFlags.has(addr,
                    WorldChunkFlags.MODIFIED_BLOCKS | WorldChunkFlags.MODIFIED_FLUID);
                const flags =
                    (hasModifiers ? NEARBY_FLAGS.HAS_MODIFIERS : 0) |
                    (chunk.hasOtherData() ? NEARBY_FLAGS.HAS_OTHER_DATA : 0);
                return {addr, flags}
            })
        }

        return nearbyChunks.added.length + nearbyChunks.deleted.length > 0;
    }

    preTick(force: boolean = false) : void {
        const {player, tempVec} = this;
        const grid = player.world.chunkManager.grid
        player.chunk_addr = grid.toChunkAddr(player.state.pos);
        grid.getChunkCenterByAddr(this.spiralCenter, tempVec).subSelf(player.state.pos);
        if (force || !player.chunk_addr.equal(this.spiralCenter)
            && (Math.abs(tempVec.x) >= 16 || Math.abs(tempVec.z) >= 16 || Math.abs(tempVec.y) >= 30)) {
            this.genSpiral();
        }
        this.populateWaitingAddrs();
    }

    postTick() {
        this.checkSpiralChunks();
    }

    populateWaitingAddrs() {
        this.checkSpiralChunks();
        const {waitEntries, spiralEntries} = this;

        let n = waitEntries.length;
        if (n > 0) {
            let j = 0;
            for (let i = 0; i < n; i++) {
                const entry = waitEntries[i];
                if (!entry.chunk) {
                    waitEntries[j++] = entry;
                }
            }
            waitEntries.length = j;
        }

        while (this.spiralWaiting < spiralEntries.length && waitEntries.length < PLAYER_CHUNK_QUEUE_SIZE) {
            const entry = spiralEntries[this.spiralWaiting++];
            if (!entry.chunk) {
                waitEntries.push(entry);
            }
        }
    }
}