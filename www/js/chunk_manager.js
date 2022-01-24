import {SpiralGenerator, Vector, VectorCollector} from "./helpers.js";
import {Chunk, getChunkAddr, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getLocalChunkCoord, ALLOW_NEGATIVE_Y} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {BLOCK} from "./blocks.js";

const CHUNKS_ADD_PER_UPDATE     = 4;
export const MAX_Y_MARGIN       = 3;

const CC = [
    {x:  0, y:  1, z:  0},
    {x:  0, y: -1, z:  0},
    {x:  0, y:  0, z: -1},
    {x:  0, y:  0, z:  1},
    {x: -1, y:  0, z:  0},
    {x:  1, y:  0, z:  0}
];

//
export class ChunkManager {

    /**
     * @type {ChunkManager}
     */
    static instance;

    constructor(world) {
        let that                    = this;
        this.world                  = world;
        this.chunks                 = new VectorCollector();
        this.chunks_prepare         = new VectorCollector();

        // rendering
        this.poses                  = [];
        this.poses_need_update      = false;
        this.poses_chunkPos         = new Vector();
        this.rendered_chunks        = {fact: 0, total: 0};
        this.renderList             = new Map();

        this.update_chunks          = true;
        this.vertices_length_total  = 0;
        this.lightmap_count         = 0;
        this.lightmap_bytes         = 0;
        // this.dirty_chunks           = [];
        this.worker_inited          = false;
        this.worker_counter         = 2;
        this.worker                 = new Worker('./js/chunk_worker.js'/*, {type: 'module'}*/);
        this.lightWorker            = new Worker('./js/light_worker.js'/*, {type: 'module'}*/);
        this.sort_chunk_by_frustum  = false;
        //
        // Add listeners for server commands
        this.world.server.AddCmdListener([ServerClient.CMD_NEARBY_CHUNKS], (cmd) => {this.updateNearby(cmd.data)});
        this.world.server.AddCmdListener([ServerClient.CMD_CHUNK_LOADED], (cmd) => {
            this.setChunkState(cmd.data);
        });
        this.world.server.AddCmdListener([ServerClient.CMD_BLOCK_SET], (cmd) => {
            let pos = cmd.data.pos;
            let item = cmd.data.item;
            let block = BLOCK.fromId(item.id);
            let extra_data = cmd.data.item.extra_data ? cmd.data.item.extra_data : null;
            this.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id, extra_data, ServerClient.BLOCK_ACTION_REPLACE);
        });
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
        // Light worker messages receiver
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
        const generator = world_info.generator;
        const world_seed = world_info.seed;
        const world_guid = world_info.guid;
        const settings = world.settings;
        this.postWorkerMessage(['init', {generator, world_seed, world_guid, settings}]);
        this.postLightWorkerMessage(['init', null]);

        ChunkManager.instance = this;
    }

    //
    setRenderDist(value) {
        this.world.server.setRenderDist(value);
    }

    // toggleUpdateChunks
    toggleUpdateChunks() {
        this.update_chunks = !this.update_chunks;
    }

    // refresh
    refresh() {
    }

    prepareRenderList(render) {
        if (this.poses_need_update || !Game.player.chunkAddr.equal(this.poses_chunkPos)) {
            this.poses_need_update = false;
            const pos               = this.poses_chunkPos = Game.player.chunkAddr;
            const pos_temp          = pos.clone();
            let margin              = Math.max(Game.player.state.chunk_render_dist + 1, 1);
            let spiral_moves_3d     = SpiralGenerator.generate3D(new Vector(margin, MAX_Y_MARGIN, margin));
            this.poses.length = 0;
            for (let i = 0; i<spiral_moves_3d.length;i++) {
                const item = spiral_moves_3d[i];
                pos_temp.set(pos.x + item.pos.x, pos.y + item.pos.y, pos.z + item.pos.z); // pos.add(item.pos)
                const chunk = this.chunks.get(pos_temp);
                if (chunk) {
                    this.poses.push(chunk);
                }
            }
        }

        const {renderList} = this;
        for (let [key, v] of renderList) {
            for (let [key2, v2] of v) {
                v2.length = 0;
            }
        }
        let applyVerticesCan = 20;
        for(let chunk of this.poses) {
            if(chunk.need_apply_vertices) {
                if(applyVerticesCan-- > 0) {
                    chunk.applyVertices();
                }
            }
            chunk.updateInFrustum(render);
            if(chunk.vertices_length === 0) {
                continue;
            }
            if(!chunk.in_frustum) {
                continue;
            }
            for(let [key, v] of chunk.vertices) {
                let key1 = v.resource_pack_id;
                let key2 = v.material_group;
                if (!v.buffer) {
                    continue;
                }
                if (!renderList.get(key1)) {
                    renderList.set(key1, new Map());
                }
                const rpList = renderList.get(key1);
                if (!rpList.get(key2)) {
                    rpList.set(key2, []);
                }
                const list = rpList.get(key2);
                list.push(chunk);
                list.push(v);
                chunk.rendered = 0;
            }
        }
    }

    // Draw level chunks
    draw(render, resource_pack, transparent) {
        if(!this.worker_inited || !this.nearby) {
            return;
        }
        let groups = [];
        if(transparent) {
            groups = ['transparent', 'doubleface_transparent'];
        } else {
            groups = ['regular', 'doubleface'];
        }
        const rpList = this.renderList.get(resource_pack.id);
        if (!rpList) {
            return true;
        }
        for(let group of groups) {
            const mat = resource_pack.shader.materials[group];
            const list = rpList.get(group);
            if (!list) {
                continue;
            }
            for (let i = 0; i < list.length; i += 2) {
                const chunk = list[i];
                const vertices = list[i + 1];
                chunk.drawBufferVertices(render.renderBackend, resource_pack, group, mat, vertices);
                if (!chunk.rendered) {
                    this.rendered_chunks.fact++;
                }
                chunk.rendered++;
            }
        }
        return true;
    }

    /**
     * Return chunk by address
     * @param {*} addr 
     * @returns Chunk
     */
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    // Add
    loadChunk(item) {
        if(this.chunks.has(item.addr) || this.chunks_prepare.has(item.addr)) {
            return false;
        }
        this.chunks_prepare.add(item.addr, {
            start_time: performance.now()
        });
        if(item.has_modifiers) {
            this.world.server.loadChunk(item.addr);
        } else {
           if(!this.setChunkState({addr: item.addr, modify_list: null})) {
               return false;
           }
        }
        return true;
    }

    // Установить начальное состояние указанного чанка
    setChunkState(state) {
        let prepare = this.chunks_prepare.get(state.addr);
        if(prepare) {
            let chunk = new Chunk(state.addr, state.modify_list, this);
            chunk.load_time = performance.now() - prepare.start_time;
            this.chunks.add(state.addr, chunk);
            this.rendered_chunks.total++;
            this.chunks_prepare.delete(state.addr);
            this.poses_need_update = true;
            return true;
        }
        return false;
    }

    // postWorkerMessage
    postWorkerMessage(data) {
        this.worker.postMessage(data);
    }

    // postLightWorkerMessage
    postLightWorkerMessage(data) {
        this.lightWorker.postMessage(data);
    }

    // Remove chunk
    removeChunk(addr) {
        this.chunks_prepare.delete(addr);
        let chunk = this.chunks.get(addr);
        if(chunk) {
            this.vertices_length_total -= chunk.vertices_length;
            chunk.destruct();
            this.chunks.delete(addr)
            this.rendered_chunks.total--;
        }
    }

    // Update
    update(player_pos) {

        if(!this.update_chunks || !this.worker_inited || !this.nearby) {
            return false;
        }

        // Load chunks
        let can_add = CHUNKS_ADD_PER_UPDATE;

        let j = 0;
        for (let i=0;i<this.nearby.added.length;i++) {
            const item = this.nearby.added[i];
            if (!this.nearby.deleted.has(item.addr)) {
                if (can_add > 0) {
                    if (this.loadChunk(item)) {
                        can_add--;
                    }
                } else {
                    // save for next time
                    this.nearby.added[j++] = item;
                }
            }
        }
        this.nearby.added.length = j;

        // Delete chunks
        if(this.nearby.deleted.size > 0) {
            for(let addr of this.nearby.deleted) {
                this.removeChunk(addr);
            }
            this.nearby.deleted.clear();
        }

        // Build dirty chunks
        for(let chunk of this.chunks) {
            if(chunk.dirty && !chunk.buildVerticesInProgress) {
                let ok = true;
                if(!chunk.addr_neighbors) {
                    chunk.addr_neighbors = [];
                    for(let c of CC) {
                        chunk.addr_neighbors.push(chunk.addr.add(c));
                    }
                }
                for(let addr of chunk.addr_neighbors) {
                    if(ALLOW_NEGATIVE_Y || addr.y >= 0) {
                        if(!this.getChunk(addr)) {
                            ok = false;
                            break;
                        }
                    }
                }
                if(ok) {
                    chunk.buildVertices();
                }
            }
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
        let chunk = this.chunks.get(addr);
        if(chunk) {
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, block, is_modify, power, rotate, entity_id, extra_data, action_id) {
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
        // устанавливаем блок
        return chunk.setBlock(pos.x, pos.y, pos.z, item, false, item.power, item.rotate, item.entity_id, extra_data);
    }

    // Set nearby chunks
    updateNearby(data) {
        if(!this.nearby) {
            this.nearby = {
                added:      [],
                deleted:    new VectorCollector()
            };
        }
        if (this.nearby.deleted.length > 0) {
            this.update();
        }
        for(let item of data.added) {
            this.nearby.added.push(item);
        }
        for(let addr of data.deleted) {
            this.nearby.deleted.add(addr, new Vector(addr));
        }
        Game.player.state.chunk_render_dist = data.chunk_render_dist;
    }

    //
    setTestBlocks(pos) {
        let d = 10;
        let cnt = 0;
        let startx = pos.x;
        let all_blocks = BLOCK.getAll();
        for(let [id, block] of all_blocks) {
            if(block.fluid || block.item || !block.spawnable) {
                continue;
            }
            if(cnt % d == 0) {
                pos.x = startx;
                pos.z += 2;
            }
            pos.x += 2;
            this.setBlock(pos.x, pos.y, pos.z, block, true, null, null, null, block.extra_data, ServerClient.BLOCK_ACTION_REPLACE);
            cnt++;
        }
    }

}
