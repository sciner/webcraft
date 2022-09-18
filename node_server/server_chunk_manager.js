import {ServerChunk, CHUNK_STATE_NEW, CHUNK_STATE_BLOCKS_GENERATED} from "./server_chunk.js";
import {ALLOW_NEGATIVE_Y, CHUNK_GENERATE_MARGIN_Y} from "../www/js/chunk_const.js";
import {getChunkAddr, SpiralGenerator, Vector, VectorCollector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";
import { AABB } from "../www/js/core/AABB.js";
import {DataWorld} from "../www/js/typed_blocks3.js";
import { compressNearby } from "../www/js/packet_compressor.js";

async function waitABit() {
    return true;
}

export class ServerChunkManager {

    constructor(world) {
        this.world                  = world;
        this.all                    = new VectorCollector();
        this.chunk_queue_load       = new VectorCollector();
        this.chunk_queue_gen_mobs   = new VectorCollector();
        this.ticking_chunks         = new VectorCollector();
        this.invalid_chunks_queue   = [];
        this.unloaded_chunk_addrs   = [];
        //
        this.DUMMY = {
            id:         world.block_manager.DUMMY.id,
            name:       world.block_manager.DUMMY.name,
            shapes:     [],
            properties: world.block_manager.DUMMY,
            material:   world.block_manager.DUMMY,
            getProperties: function() {
                return this.material;
            }
        };
        this.dataWorld = new DataWorld();
    }

    // Init worker
    async initWorker() {
        this.worker_inited = false;
        this.worker = new Worker(globalThis.__dirname + '/../www/js/chunk_worker.js');
        const onmessage = (data) => {
            if(data instanceof MessageEvent) {
                data = data.data;
            }
            const cmd = data[0];
            const args = data[1];
            switch(cmd) {
                case 'world_inited': {
                    this.worker_inited = true;
                    this.resolve_worker();
                    break;
                }
                case 'blocks_generated': {
                    let chunk = this.get(args.addr);
                    if(chunk) {
                        chunk.onBlocksGenerated(args);
                    }
                    break;
                }
                default: {
                    console.log(`Ignore worker command: ${cmd}`);
                }
            }
        };
        const onerror = (e) => {
            debugger;
        };
        if('onmessage' in this.worker) {
            this.worker.onmessage = onmessage;
            this.worker.onerror = onerror;
        } else {
            this.worker.on('message', onmessage);
            this.worker.on('error', onerror);
        }
        const promise = new Promise((resolve, reject) => {
            this.resolve_worker = resolve;
        });
        // Init webworkers
        const world_info = this.world.info;
        const generator = world_info.generator;
        const world_seed = world_info.seed;
        const world_guid = world_info.guid;
        const settings = {texture_pack: null};
        this.postWorkerMessage(['init', {generator, world_seed, world_guid, settings}]);
        return promise;
    }

    // postWorkerMessage
    postWorkerMessage(cmd) {
        this.worker.postMessage(cmd);
    }

    chunkStateChanged(chunk, state_id) {
        switch(state_id) {
            case CHUNK_STATE_BLOCKS_GENERATED: {
                this.chunk_queue_gen_mobs.set(chunk.addr, chunk);
                break;
            }
        }
    }

    async tick(tick_number) {
        this.unloadInvalidChunks();

        let pn = performance.now();

        // 1. queue chunks for load
        if(this.chunk_queue_load.size > 0) {
            for(const [addr, chunk] of this.chunk_queue_load.entries()) {
                this.chunk_queue_load.delete(addr);
                if(chunk.load_state == CHUNK_STATE_NEW) {
                    chunk.load();
                }
            }
        }
        // 2. queue chunks for generate mobs
        if(this.chunk_queue_gen_mobs.size > 0) {
            for(const [addr, chunk] of this.chunk_queue_gen_mobs.entries()) {
                this.chunk_queue_gen_mobs.delete(addr);
                if(chunk.load_state == CHUNK_STATE_BLOCKS_GENERATED) {
                    chunk.generateMobs();
                }
            }
        }
        // 3. tick for chunks
        if(this.ticking_chunks.size > 0) {
            for(let addr of this.ticking_chunks) {
                if (performance.now() - pn >= 20) {
                    await waitABit();
                    pn = performance.now();
                }

                let chunk = this.get(addr);
                if(!chunk) {
                    this.ticking_chunks.delete(addr);
                    continue;
                }
                chunk.tick(tick_number);
            }
        }
        // 4.
        if(this.unloaded_chunk_addrs.length > 0) {
            this.postWorkerMessage(['destructChunk', this.unloaded_chunk_addrs]);
            this.unloaded_chunk_addrs = [];
        }
    }

    addTickingChunk(addr) {
        this.ticking_chunks.set(addr, addr);
    }

    removeTickingChunk(addr) {
        this.ticking_chunks.delete(addr);
    }

    // Add to invalid queue
    // помещает чанк в список невалидных, т.к. его больше не видит ни один из игроков
    // в следующем тике мира, он будет выгружен методом unloadInvalidChunks()
    invalidate(chunk) {
        this.invalid_chunks_queue.push(chunk);
    }

    unloadInvalidChunks() {
        const cnt = this.invalid_chunks_queue.length;
        if(cnt == 0) {
            return false;
        }
        const p = performance.now();
        while(this.invalid_chunks_queue.length > 0) {
            const chunk = this.invalid_chunks_queue.pop();
            if(chunk.connections.size == 0) {
                this.remove(chunk.addr);
                chunk.onUnload();
            }
        }
        const elapsed = Math.round((performance.now() - p) * 10) / 10;
        console.debug(`Unload invalid chunks: ${cnt}; elapsed: ${elapsed} ms`);
    }

    add(chunk) {
        this.chunk_queue_load.set(chunk.addr, chunk);
        this.all.set(chunk.addr, chunk);
    }

    get(addr) {
        return this.all.get(addr) || null;
    }

    remove(addr) {
        this.chunk_queue_load.delete(addr);
        this.chunk_queue_gen_mobs.delete(addr);
        this.all.delete(addr);
    }

    // Check player visible chunks
    async checkPlayerVisibleChunks(player, force) {

        player.chunk_addr = getChunkAddr(player.state.pos);

        if (force || !player.chunk_addr_o.equal(player.chunk_addr)) {

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
                    if(!player.nearby_chunk_addrs.has(addr)) {
                        const item = {
                            addr: addr,
                            has_modifiers: this.world.chunkHasModifiers(addr) // у чанка есть модификации?
                        };
                        nearby.added.push(item);
                        player.nearby_chunk_addrs.set(addr, addr);
                        let chunk = this.get(addr);
                        if(!chunk) {
                            chunk = new ServerChunk(this.world, addr);
                            this.add(chunk);
                        }
                        chunk.addPlayer(player);
                    }
                }
            }

            // Check deleted
            for(let addr of player.nearby_chunk_addrs) {
                if(!added_vecs.has(addr)) {
                    player.nearby_chunk_addrs.delete(addr);
                    // @todo Возможно после выгрузки чанков что-то идёт не так (но это не точно)
                    this.get(addr, false)?.removePlayer(player);
                    nearby.deleted.push(addr);
                }
            }

            // Send new chunks
            if(nearby.added.length + nearby.deleted.length > 0) {
                const nearby_compressed = compressNearby(nearby);
                const packets = [{
                    // c: Math.round((nearby_compressed.length / JSON.stringify(nearby).length * 100) * 100) / 100,
                    name: ServerClient.CMD_NEARBY_CHUNKS,
                    data: nearby_compressed
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
            }

            player.chunk_addr_o = player.chunk_addr;

        }
    }

    // Возвращает блок по абслютным координатам
    getBlock(x, y, z) {
        if(x instanceof Vector || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        let addr = getChunkAddr(x, y, z);
        let chunk = this.all.get(addr);
        if(chunk) {
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

    // chunkMobsIsGenerated
    async chunkMobsIsGenerated(chunk_addr_hash) {
        return await this.world.db.mobs.chunkMobsIsGenerated(chunk_addr_hash);
    }

    // chunkSetMobsIsGenerated
    async chunkSetMobsIsGenerated(chunk_addr_hash) {
        return await this.world.db.mobs.chunkMobsSetGenerated(chunk_addr_hash, 1);
    }

    // Return chunks inside AABB
    getInAABB(aabb) {
        const pos1 = getChunkAddr(new Vector(aabb.x_min, aabb.y_min, aabb.z_min));
        const pos2 = getChunkAddr(new Vector(aabb.x_max, aabb.y_max, aabb.z_max));
        const aabb2 = new AABB().set(pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z).expand(.1, .1, .1);
        const resp = [];
        for(let [chunk_addr, chunk] of this.all.entries(aabb2)) {
            resp.push(chunk);
        }
        return resp;
    }

    chunkUnloaded(addr) {
        this.unloaded_chunk_addrs.push(addr);
        this.removeTickingChunk(addr);
    }

    // Send command to server worker
    checkDestroyMap() {
        const world = this.world;
        if(world.players.size == 0) {
            return;
        }
        const players = [];
        for (let [_, p] of world.players.entries()) {
            players.push({
                pos:                p.state.pos,
                chunk_addr:         getChunkAddr(p.state.pos.x, 0, p.state.pos.z),
                chunk_render_dist:  p.state.chunk_render_dist
            });
        }
        this.postWorkerMessage(['destroyMap', { players }]);
    }

    //
    getAround(pos, chunk_render_dist) {
        const world             = this.world;
        const margin            = Math.max(chunk_render_dist + 1, 1);
        const spiral_moves_3d   = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));
        const chunk_addr        = getChunkAddr(pos);
        const _addr             = new Vector(0, 0, 0);
        // array like iterator
        return (function* () {
            for(let i = 0; i < spiral_moves_3d.length; i++) {
                const sm = spiral_moves_3d[i];
                _addr.copyFrom(chunk_addr).addSelf(sm.pos);
                if(ALLOW_NEGATIVE_Y || _addr.y >= 0) {
                    const chunk = world.chunks.get(_addr);
                    if(chunk) {
                        yield chunk;
                    }
                }
            }
        })()
    }

}