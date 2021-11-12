import {Vector, SpiralGenerator, VectorCollector} from "./helpers.js";
import {Chunk, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {BLOCK} from "./blocks.js";

const CHUNKS_ADD_PER_UPDATE     = 16;
export const MAX_Y_MARGIN       = 3;

//
export class ChunkManager {

    constructor(world) {
        let that                    = this;
        this.CHUNK_RENDER_DIST      = 4; // 0(1chunk), 1(9), 2(25chunks), 3(45), 4(69), 5(109), 6(145), 7(193), 8(249) 9(305) 10(373) 11(437) 12(517)
        this.chunks                 = new VectorCollector(), // Map();
        this.chunks_prepare         = new VectorCollector();
        this.modify_list            = {};
        this.world                  = world;
        this.margin                 = Math.max(this.CHUNK_RENDER_DIST + 1, 1);
        this.rendered_chunks        = {fact: 0, total: 0, vc: new VectorCollector()};
        this.update_chunks          = true;
        this.vertices_length_total  = 0;
        this.dirty_chunks           = [];
        this.worker_inited          = false;
        this.worker_counter         = 2;
        this.worker                 = new Worker('./js/chunk_worker.js'/*, {type: 'module'}*/);
        this.lightWorker            = new Worker('./js/light_worker.js'/*, {type: 'module'}*/);
        this.sort_chunk_by_frustum  = false;
        this.clearNerby();
        //
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
        this.AIR = {
            id: BLOCK.AIR.id,
            properties: BLOCK.AIR
        };
        // Message received from worker
        this.worker.onmessage = function(e) {
            let cmd = e.data[0];
            let args = e.data[1];
            switch(cmd) {
                case 'world_inited':
                case 'worker_inited': {
                    that.worker_counter--;
                    that.worker_inited = that.worker_counter === 0;
                    break;
                }
                case 'blocks_generated': {
                    let chunk = that.chunks.get(args.addr);
                    if(chunk) {
                        chunk.onBlocksGenerated(args);
                    }
                    break;
                }
                case 'vertices_generated': {
                    for(let result of args) {
                        let chunk = that.chunks.get(result.addr);
                        if(chunk) {
                            chunk.onVerticesGenerated(result);
                        }
                    }
                    break;
                }
            }
        }
        this.lightWorker.onmessage = function(e) {
            let cmd = e.data[0];
            let args = e.data[1];
            switch(cmd) {
                case 'worker_inited': {
                    that.worker_counter--;
                    that.worker_inited = that.worker_counter === 0;
                    break;
                }
                case 'light_generated': {
                    let chunk = that.chunks.get(args.addr);
                    if(chunk) {
                        chunk.onLightGenerated(args);
                    }
                    break;
                }
            }
        }
        // Init webworkers
        let world_info = world.info;
        this.postWorkerMessage(['init', world_info.generator, world_info.seed, world_info.guid]);
        this.postLightWorkerMessage(['init', null]);
    }

    //
    setRenderDist(value) {
        value = Math.max(value, 2);
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
    draw(render, resource_pack, transparent) {
        if(!this.worker_inited || !this.nearby_modified_list) {
            return;
        }
        let applyVerticesCan = 10;
        let groups = [];
        if(transparent) {
            groups = ['transparent', 'doubleface_transparent'];
        } else {
            groups = ['regular', 'doubleface'];
        }
        // let show = new VectorCollector();
        // let hide = new VectorCollector();
        for(let group of groups) {
            const mat = resource_pack.shader.materials[group];
            for(let item of this.poses) {
                if(item.chunk) {
                    if(item.chunk.need_apply_vertices) {
                        if(applyVerticesCan-- > 0) {
                            item.chunk.applyVertices();
                        }
                    }
                    if(item.chunk.vertices_length > 0) {
                        // Check frustum
                        item.chunk.updateInFrustum(render);
                        if(item.chunk.in_frustum) {
                            if(item.chunk.drawBufferGroup(render.renderBackend, resource_pack, group, mat)) {
                                // show.add(item.addr);
                                this.rendered_chunks.vc.add(item.chunk.addr, null);
                            }
                        } else {
                            //if(item.chunk.vertices.has(group)) {
                            //    hide.add(item.addr);
                            //}
                        }
                    }
                }
            }
        }
        // console.log(hide.size, show.size);
        return true;
    }

    // Get
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    // Add
    addChunk(item) {
        if(this.chunks.has(item.addr) || this.chunks_prepare.has(item.addr)) {
            return false;
        }
        this.chunks_prepare.add(item.addr, {
            start_time: performance.now()
        });
        if(this.nearby_modified_list.has(item.addr)) {
            this.world.server.ChunkAdd(item.addr);
        } else {
           if(!this.setChunkState({pos: item.addr, modify_list: null})) {
               return false;
           }
        }
        return true;
    }

    // Установить начальное состояние указанного чанка
    setChunkState(state) {
        let prepare = this.chunks_prepare.get(state.pos);
        if(prepare) {
            let chunk = new Chunk(state.pos, state.modify_list);
            chunk.load_time = performance.now() - prepare.start_time;
            this.chunks.add(state.pos, chunk);
            this.rendered_chunks.total++;
            this.chunks_prepare.delete(state.pos);
            return true;
        }
        return false;
    }

    // Remove
    removeChunk(addr) {
        let chunk = this.chunks.get(addr);
        this.vertices_length_total -= chunk.vertices_length;
        chunk.destruct();
        this.chunks.delete(addr)
        this.rendered_chunks.total--;
        this.world.server.ChunkRemove(addr);
    }

    // postWorkerMessage
    postWorkerMessage(data) {
        this.worker.postMessage(data);
    };

    // postLightWorkerMessage
    postLightWorkerMessage(data) {
        this.lightWorker.postMessage(data);
    };

    // Update
    update(player_pos) {
        if(!this.update_chunks || !this.worker_inited || !this.nearby_modified_list) {
            return false;
        }
        let frustum = Game.render.frustum;
        let chunk_size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        let div2 = new Vector(2, 2, 2);
        var spiral_moves_3d = SpiralGenerator.generate3D(new Vector(this.margin, MAX_Y_MARGIN, this.margin));
        let chunkAddr = getChunkAddr(player_pos.x, player_pos.y, player_pos.z);
        if(!this.chunkAddr || this.chunkAddr.distance(chunkAddr) > 0 || !this.prev_margin || this.prev_margin != this.margin) {
            this.poses = [];
            this.prev_margin = this.margin;
            this.chunkAddr = chunkAddr;
            for(let sm of spiral_moves_3d) {
                let addr = chunkAddr.add(sm.pos);
                if(addr.y >= 0) {
                    let coord = addr.mul(chunk_size);
                    let coord_center = coord.add(chunk_size.div(div2));
                    this.poses.push({
                        addr:               addr,
                        coord:              coord,
                        coord_center:       coord_center,
                        frustum_geometry:   Chunk.createFrustumGeometry(coord, chunk_size),
                        chunk:              null
                    });
                }
            }
        }
        if(this.chunks.size != this.poses.length || (this.prevchunkAddr && this.prevchunkAddr.distance(chunkAddr) > 0)) {
            this.prevchunkAddr = chunkAddr;
            let can_add = CHUNKS_ADD_PER_UPDATE;
            // Помечаем часть чанков неживымии и запрещаем в этом Update добавление чанков
            for(let chunk of this.chunks) {
                if(!chunk.inited) {
                    can_add = 0;
                    break;
                }
                chunk.isLive = false;
            }
            //
            let frustum_sort_func = function(a, b) {
                if(a.in_frustrum && b.in_frustrum) {
                    return a.coord_center.horizontalDistance(frustum.camPos) - b.coord_center.horizontalDistance(frustum.camPos);
                }
                if(b.in_frustrum) return 1;
                return -1;
            };
            // Check for add
            let possible_add_chunks = []; // Кандидаты на загрузку
            for(let item of this.poses) {
                if(item.addr.y >= 0 && !item.chunk) {
                    item.in_frustrum = frustum ? frustum.intersectsGeometryArray(item.frustum_geometry) : false;
                    possible_add_chunks.push(item);
                }
                if(!item.chunk) {
                    item.chunk = this.chunks.get(item.addr);
                }
                if(item.chunk) {
                    item.chunk.isLive = true;
                }
            }
            // Frustum sorting for add | Сортировка чанков(кандидатов на загрузку) по тому, видимый он в камере или нет
            if(frustum && this.sort_chunk_by_frustum) {
                possible_add_chunks.sort(frustum_sort_func);
            }
            // Add chunks
            for(let item of possible_add_chunks) {
                if(can_add < 1) {
                    break;
                }
                if(this.addChunk(item)) {
                    can_add--;
                }
            }
            // Check for remove chunks
            for(let chunk of this.chunks) {
                if(!chunk.isLive) {
                    this.removeChunk(chunk.addr);
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
        let addr = getChunkAddr(x, y, z);
        let chunk = this.chunks.get(addr);
        if(chunk) {
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, block, is_modify, power, rotate, entity_id, extra_data) {
        // определяем относительные координаты чанка
        let chunkAddr = getChunkAddr(x, y, z);
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
                name: ServerClient.CMD_BLOCK_SET,
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
                b = BLOCK.BLOCK_BY_ID.get(b.id);
                if(b.hasOwnProperty('sound')) {
                    Game.sounds.play(b.sound, action);
                }
            }
        }
        // устанавливаем блок
        return chunk.setBlock(pos.x, pos.y, pos.z, item, false, item.power, item.rotate, item.entity_id, extra_data);
    }

    // destroyBlock
    destroyBlock(pos) {
        let render = Game.render;
        let block = this.getBlock(pos.x, pos.y, pos.z);
        if(block.id == BLOCK.TULIP.id) {
            render.setBrightness(.15);
        } else if(block.id == BLOCK.DANDELION.id) {
            render.setBrightness(1);
        } else if(block.id == BLOCK.CACTUS.id) {
            render.setRain(true);
        }
        render.destroyBlock(block, pos);
        this.setBlock(pos.x, pos.y, pos.z, BLOCK.AIR, true);
    }

    //
    clearNerby() {
        if(!this.nearby_modified_list) {
            return;
        }
        this.nearby_modified_list.clear();
        this.nearby_modified_list = null;
    }

    // setNearbyModified...
    setNearbyModified(vec_list) {
        if(!this.nearby_modified_list) {
            this.nearby_modified_list = new VectorCollector();
        }
        this.nearby_modified_list.clear();
        for(let vec of vec_list) {
            this.nearby_modified_list.add(vec, true);
        }
    }

}
