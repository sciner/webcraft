import {Vector, SpiralGenerator} from "./helpers.js";
import Chunk from "./chunk.js";
import {BLOCK} from "./blocks.js";
import ServerClient from "./server_client.js";

const CHUNKS_ADD_PER_UPDATE = 16;

export const MAX_Y_MARGIN = 3;

//
export class ChunkManager {

    constructor(world) {
        let that                    = this;
        this.CHUNK_RENDER_DIST      = 4; // 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109), 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)
        this.chunks                 = {};
        this.chunks_prepare         = {};
        this.modify_list            = {};
        this.world                  = world;
        this.margin                 = Math.max(this.CHUNK_RENDER_DIST + 1, 1);
        this.rendered_chunks        = {fact: 0, total: 0};
        this.update_chunks          = true;
        this.vertices_length_total  = 0;
        this.dirty_chunks           = [];
        this.worker                 = new Worker('./js/chunk_worker.js'/*, {type: 'module'}*/);
        // Message received from worker
        this.worker.onmessage = function(e) {
            const cmd = e.data[0];
            const args = e.data[1];
            switch(cmd) {
                case 'blocks_generated': {
                    if(that.chunks.hasOwnProperty(args.key)) {
                        that.chunks[args.key].onBlocksGenerated(args);
                    }
                    break;
                }
                case 'vertices_generated': {
                    for(let result of args) {
                        if(that.chunks.hasOwnProperty(result.key)) {
                            that.chunks[result.key].onVerticesGenerated(result);
                        }
                    }
                    break;
                }
            }
        }
        // Init webworker
        this.postWorkerMessage(['init', world.saved_state.generator, world.seed]);
    }

    //
    setRenderDist(value) {
        value = Math.max(value, 4);
        value = Math.min(value, 16);
        this.CHUNK_RENDER_DIST = value;
        this.margin = Math.max(this.CHUNK_RENDER_DIST + 1, 1)
    }

    // toggleUpdateChunks
    toggleUpdateChunks() {
        this.update_chunks = !this.update_chunks;
    }

    // refresh
    refresh() {
    }

    // Draw level chunks
    draw(render, transparent) {
        this.rendered_chunks.total  = Object.keys(this.chunks).length;
        let applyVerticesCan        = 10;
        let groups = [];
        if(transparent) {
            groups = ['transparent', 'doubleface_transparent'];
        } else {
            groups = ['regular', 'doubleface'];
        }
        for(let group of groups) {
            const mat = render.materials[group];
            for(let item of this.poses) {
                if(item.chunk) {
                    if(item.chunk.hasOwnProperty('vertices_args')) {
                        if(applyVerticesCan-- > 0) {
                            item.chunk.applyVertices();
                        }
                    }
                    if(item.chunk.drawBufferGroup(render.renderBackend, group, mat)) {
                        this.rendered_chunks.fact += 0.25;
                    }
                }
            }
        }
        return true;
    }

    // Get
    getChunk(pos) {
        let k = this.getPosChunkKey(pos);
        if(this.chunks.hasOwnProperty(k)) {
            return this.chunks[k];
        }
        return null;
    }

    // Add
    addChunk(item) {
        if(this.chunks.hasOwnProperty(item.key) || this.chunks_prepare.hasOwnProperty(item.key)) {
            return false;
        }
        this.chunks_prepare[item.key] = {
            start_time: performance.now()
        };
        this.world.server.ChunkAdd(item.addr);
        return true;
    }

    // Remove
    removeChunk(key, addr) {
        this.vertices_length_total -= this.chunks[key].vertices_length;
        this.chunks[key].destruct();
        delete this.chunks[key];
        this.world.server.ChunkRemove(addr);
    }

    // postWorkerMessage
    postWorkerMessage(data) {
        this.worker.postMessage(data);
    };

    // Установить начальное состояние указанного чанка
    setChunkState(state) {
        let k = this.getPosChunkKey(state.pos);
        if(this.chunks_prepare.hasOwnProperty(k)) {
            let prepare     = this.chunks_prepare[k];
            let chunk       = new Chunk(this, state.pos, state.modify_list);
            chunk.load_time = performance.now() - prepare.start_time;
            this.chunks[k]  = chunk;
            delete(this.chunks_prepare[k]);
        }
    }

    // Update
    update() {
        if(!this.update_chunks) {
            return false;
        }
        let world = this.world;
        if(!world.localPlayer) {
            return;
        }
        var spiral_moves_3d = SpiralGenerator.generate3D(new Vector(this.margin, MAX_Y_MARGIN, this.margin));
        let chunkAddr = BLOCK.getChunkAddr(world.localPlayer.pos.x, world.localPlayer.pos.y, world.localPlayer.pos.z);
        if(!this.chunkAddr || this.chunkAddr.distance(chunkAddr) > 0 || !this.prev_margin || this.prev_margin != this.margin) {
            this.poses = [];
            this.prev_margin = this.margin;
            this.chunkAddr = chunkAddr;
            for(let sm of spiral_moves_3d) {
                let addr = chunkAddr.add(sm.pos);
                if(addr.y >= 0) {
                    this.poses.push({
                        addr:   addr,
                        key:    addr.toChunkKey(),
                        chunk:  null
                    });
                }
            }
        }
        let keys = Object.keys(this.chunks);
        if(keys.length != this.poses.length || (this.prevchunkAddr && this.prevchunkAddr.distance(chunkAddr) > 0)) {
            this.prevchunkAddr = chunkAddr;
            let can_add = CHUNKS_ADD_PER_UPDATE;
            for(let key of keys) {
                let chunk = this.chunks[key];
                if(!chunk.inited) {
                    can_add = 0;
                    break;
                }
                chunk.isLive = false;
            }
            // Check for add
            for(let item of this.poses) {
                if(item.addr.y >= 0) {
                    if(can_add > 0) {
                        if(this.addChunk(item)) {
                            can_add--;
                        }
                    }
                }
                if(!item.chunk) {
                    item.chunk = this.chunks[item.key];
                }
                if(item.chunk) {
                    item.chunk.isLive = true;
                }
            }
            // Check for remove
            for(let key of Object.keys(this.chunks)) {
                let chunk = this.chunks[key];
                if(!chunk.isLive) {
                    this.removeChunk(key, chunk.addr);
                }
            }
        }

        // Build dirty chunks
        for(let chunk of this.dirty_chunks) {
            if(chunk.dirty && !chunk.buildVerticesInProgress) {
                if(
                    this.getChunk(new Vector(chunk.addr.x - 1, chunk.addr.y, chunk.addr.z)) &&
                    this.getChunk(new Vector(chunk.addr.x + 1, chunk.addr.y, chunk.addr.z)) &&
                    this.getChunk(new Vector(chunk.addr.x, chunk.addr.y, chunk.addr.z - 1)) &&
                    this.getChunk(new Vector(chunk.addr.x, chunk.addr.y, chunk.addr.z + 1))
                ) {
                    chunk.buildVertices();
                }
            }
        }

    }

    addToDirty(chunk) {
        this.dirty_chunks.push(chunk);
    }

    deleteFromDirty(chunk_key) {
        for(let i in this.dirty_chunks) {
            let chunk = this.dirty_chunks[i];
            if(chunk.key == chunk_key) {
                this.dirty_chunks.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * getPosChunkKey...
     * @param {Vector} pos 
     * @returns string
     */
    getPosChunkKey(pos) {
        if(pos instanceof Vector) {
            return pos.toChunkKey();
        }
        return new Vector(pos.x, pos.y, pos.z).toChunkKey();
    }

    // Возвращает блок по абслютным координатам
    getBlock(x, y, z) {
        let vec = BLOCK.getChunkAddr(x, y, z);
        let chunk_key = this.getPosChunkKey(vec);
        let chunk = this.chunks[chunk_key];
        if(chunk) {
            return chunk.getBlock(x, y, z);
        }
        return BLOCK.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, block, is_modify, power, rotate, entity_id, extra_data) {
        // определяем относительные координаты чанка
        let chunkAddr = BLOCK.getChunkAddr(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(!chunk) {
            return null;
        }
        let pos = new Vector(x, y, z);
        let item = {
            id:         block.id,
            power:      power ? power : 1.0,
            rotate:     rotate,
            entity_id:  entity_id,
            extra_data: extra_data ? extra_data : null
        };
        if(is_modify) {
            // @server Отправляем на сервер инфу об установке блока
            this.world.server.Send({
                name: ServerClient.EVENT_BLOCK_SET,
                data: {
                    pos: pos,
                    item: item
                }
            });
            // заменяемый блок
            let world_block = chunk.getBlock(pos.x, pos.y, pos.z);
            let b = null;
            let action = null;
            if(block.id == BLOCK.AIR.id) {
                // dig
                action = 'dig';
                b = world_block;
            } else if(world_block && world_block.id == block.id) {
                // do nothing
            } else {
                // place
                action = 'place';
                b = block;
            }
            if(action) {
                b = BLOCK.BLOCK_BY_ID[b.id];
                if(b.hasOwnProperty('sound')) {
                    Game.sounds.play(b.sound, action);
                }
            }
        }
        // устанавливаем блок
        return chunk.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id, extra_data);
    }

    // destroyBlock
    destroyBlock(pos, is_modify) {
        let block = this.getBlock(pos.x, pos.y, pos.z);
        if(block.id == BLOCK.TULIP.id) {
            this.world.renderer.setBrightness(.15);
        } else if(block.id == BLOCK.DANDELION.id) {
            this.world.renderer.setBrightness(1);
        } else if(block.id == BLOCK.CACTUS.id) {
            this.world.setRain(true);
        }
        /*
        // @server
        this.world.server.Send({
            name: ServerClient.EVENT_BLOCK_DESTROY,
            data: {
                pos: new Vector(x, y, z)
            }
        });
        */
        this.world.destroyBlock(block, pos);
        this.setBlock(pos.x, pos.y, pos.z, BLOCK.AIR, true);
    }

    // setDirtySimple
    setDirtySimple(pos) {
        let chunk = this.getChunk(pos);
        if(chunk) {
            chunk.dirty = true;
        }
    }

}