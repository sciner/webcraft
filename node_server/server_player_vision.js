import {getChunkAddr, SpiralGenerator, Vector, VectorCollector} from "../www/js/helpers.js";
import {ALLOW_NEGATIVE_Y, CHUNK_GENERATE_MARGIN_Y} from "../www/js/chunk_const.js";
import {WorldChunkFlags} from "./db/world/WorldChunkFlags.js";
import { NEARBY_FLAGS } from "../www/js/packet_compressor.js";


export class ServerPlayerVision {
    constructor(player) {
        this.player = player;

        this.chunks                 = new VectorCollector();
        this.nearby_chunk_addrs     = new VectorCollector();

        this.safePosWaitingChunks   = [];
        this.safeTeleportMargin = 2;
        this.safeTeleportMarginY = 2;
        this.safePosInitialOverride = null;

        this.chunk_addr_o           = new Vector(0, 0, 0);
    }

    leave() {
        const {player} = this;
        const {chunkManager} = player.world;
        for (let i = 0; i < this.safePosWaitingChunks.length; i++) {
            this.safePosWaitingChunks[i].safeTeleportMarker--;
            chunkManager.invalidate(this.safePosWaitingChunks[i]);
        }
        for(let addr of this.chunks) {
            chunkManager.get(addr)?.removePlayer(player);
        }
        this.safePosWaitingChunks.length = 0;
        this.chunks.clear();
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

    updateVisibleChunks(force) {
        const {player, nearby_chunk_addrs} = this;
        const {world} = player;
        const {chunkManager} = world;
        player.chunk_addr = getChunkAddr(player.state.pos);

        if (!force && this.chunk_addr_o.equal(player.chunk_addr)) {
            return null;
        }

        this.chunk_addr_o = player.chunk_addr;

        const added_vecs        = new VectorCollector();
        const chunk_render_dist = player.state.chunk_render_dist;
        const margin            = Math.max(chunk_render_dist + 1, 1);
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));

        //
        const nearby = {
            chunk_render_dist:  chunk_render_dist,
            added:              [], // чанки, которые надо подгрузить
            deleted:            [] // чанки, которые надо выгрузить
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
}