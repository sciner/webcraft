import {ServerChunk} from "./server_chunk.js";

import {BLOCK} from "../www/js/blocks.js";
import {getChunkAddr} from "../www/js/chunk.js";
import {SpiralGenerator, Vector, VectorCollector} from "../www/js/helpers.js";
import {ServerClient} from "../www/js/server_client.js";

// import {ChunkManager} from "../www/js/chunk_manager.js";

export const MAX_Y_MARGIN = 3;

export class ServerChunkManager {

    constructor(world) {
        this.world                  = world;
        this.all                    = new VectorCollector();
        this.invalid_chunks_queue   = [];
        //
        this.DUMMY = {
            id:         BLOCK.DUMMY.id,
            name:       BLOCK.DUMMY.name,
            shapes:     [],
            properties: BLOCK.DUMMY,
            material:   BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
    }

    // Init worker
    async initWorker() {
        this.worker_inited = false;
        this.worker = new Worker('../www/js/chunk_worker.js');
        this.worker.on('message', (data) => {
            let cmd = data[0];
            let args = data[1];
            // console.log(`worker: ${cmd}`);
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
                    console.log(`Invalid worker command: ${cmd}`);
                }
            }
        });
        let promise = new Promise((resolve, reject) => {
            this.resolve_worker = resolve;
        });
        // Init webworkers
        let world_info = this.world.info;
        this.postWorkerMessage(['init', world_info.generator, world_info.seed, world_info.guid]);
        return promise;
    }

    // postWorkerMessage
    postWorkerMessage(data) {
        this.worker.postMessage(data);
    }

    add(chunk) {
        this.all.set(chunk.addr, chunk);
    }

    tick() {
        this.unloadInvalidChunks();
        //
        for(let chunk of this.all) {
            if(chunk.load_state == 0) {
                chunk.load();
            }
        }
    }

    // Add to invalid queue
    // помещает чанк в список невалидных, т.к. его больше не видит ни один из игроков
    // в следующем тике мира, он будет выгружен методом unloadInvalidChunks()
    invalidate(chunk) {
        this.invalid_chunks_queue.push(chunk);
    }

    unloadInvalidChunks() {
        if(this.invalid_chunks_queue.length > 0) {
            console.log('Unload invalid chunks: ' + this.invalid_chunks_queue.length);
        }
        while(this.invalid_chunks_queue.length > 0) {
            let chunk = this.invalid_chunks_queue.pop();
            if(chunk.connections.size == 0) {
                this.all.delete(chunk.addr);
                chunk.onUnload();
            }
        }
    }

    get(addr) {
        return this.all.get(addr) || null;
    }

    remove(addr) {
        this.all.delete(addr);
    }

    // Check player visible chunks
    async checkPlayerVisibleChunks(player, force) {

        player.chunk_addr = getChunkAddr(player.state.pos);

        if (force || !player.chunk_addr_o.equal(player.chunk_addr)) {

            const chunk_render_dist = player.state.chunk_render_dist;

            let margin              = Math.max(chunk_render_dist + 1, 1);
            let spiral_moves_3d     = SpiralGenerator.generate3D(new Vector(margin, MAX_Y_MARGIN, margin));

            let nearby = {
                chunk_render_dist:  chunk_render_dist,
                added:              [], // чанки, которые надо подгрузить
                deleted:            [] // чанки, которые надо выгрузить
            };

            let added_vecs = new VectorCollector();

            // Find new chunks
            for(let sm of spiral_moves_3d) {
                let addr = player.chunk_addr.add(sm.pos);
                if(addr.y >= 0) {
                    added_vecs.set(addr, true);
                    if(!player.nearby_chunk_addrs.has(addr)) {
                        let item = {
                            addr: addr,
                            has_modifiers: this.world.chunkHasModifiers(addr) // у чанка есть модификации?
                        };
                        nearby.added.push(item);
                        // await this.world.loadChunkForPlayer(player, addr);
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
                    // @todo Это надо делать, но пока не работает =(
                    // this.get(addr, false)?.removePlayer(player);
                    nearby.deleted.push(addr);
                }
            }

            // Send new chunks
            if(nearby.added.length + nearby.deleted.length > 0) {
                // console.log('new: ' + nearby.added.length + '; delete: ' + nearby.deleted.length + '; current: ' + player.nearby_chunk_addrs.size);
                let packets = [{
                    name: ServerClient.CMD_NEARBY_CHUNKS,
                    data: nearby
                }];
                this.world.sendSelected(packets, [player.session.user_id], []);
            }

            player.chunk_addr_o = player.chunk_addr;

        }
    }

}