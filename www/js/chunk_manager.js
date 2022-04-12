import {Helpers, SpiralGenerator, Vector, VectorCollector} from "./helpers.js";
import {Chunk, getChunkAddr, ALLOW_NEGATIVE_Y} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {BLOCK} from "./blocks.js";

const CHUNKS_ADD_PER_UPDATE     = 4;
const MAX_APPLY_VERTICES_COUNT  = 20;
export const MAX_Y_MARGIN       = 3;
export const GROUPS_TRANSPARENT = ['transparent', 'doubleface_transparent'];
export const GROUPS_NO_TRANSPARENT = ['regular', 'doubleface'];

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

        ChunkManager.instance = this;

        this.world                  = world;
        this.chunks                 = new VectorCollector();
        this.chunks_prepare         = new VectorCollector();
        this.lightPool = null;

        // Torches
        this.torches = {
            list: new VectorCollector(),
            add: function(args) {
                this.list.set(args.block_pos, args);
            },
            delete(pos) {
                this.list.delete(pos);
            },
            destroyAllInAABB(aabb) {
                for(let [pos, _] of this.list.entries(aabb)) {
                    this.list.delete(pos);
                }
            },
            update(player_pos) {
                const meshes = Game.render.meshes;
                const type_distance = {
                    torch: 12,
                    campfire: 96
                };
                // Add torches animations if need
                for(let [_, item] of this.list.entries()) {
                    if(Math.random() < .23) {
                        if(player_pos.distance(item.pos) < type_distance[item.type]) {
                            switch(item.type) {
                                case 'torch': {
                                    meshes.addEffectParticle('torch_flame', item.pos);
                                    break;
                                }
                                case 'campfire': {
                                    meshes.addEffectParticle('campfire_flame', item.pos);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        };

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
        this.worker                 = new Worker('./js/chunk_worker.js'/*, {type: 'module'}*/);
        this.lightWorker            = new Worker('./js/light_worker.js'/*, {type: 'module'}*/);
        this.sort_chunk_by_frustum  = false;
        this.timer60fps             = 0;

    }

    init() {

        const world                   = this.world;
        const that                    = this;

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
                case 'play_disc': {
                    TrackerPlayer.loadAndPlay('/media/disc/' + args.filename, args.pos, args.dt);
                    break;
                }
                case 'add_torch': {
                    that.torches.add(args);
                    break;
                }
                case 'maps_created': {
                    // chunkManager.postWorkerMessage(['createMaps', {addr: {x: 1, y: 1, z: 1}}]);
                    // console.log('maps_created', args.length * 4);
                    console.log('maps_created', args);
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
        const resource_cache = Helpers.getCache();

        this.use_light                = !!settings.use_light;
        this.worker_counter           = this.use_light ? 2 : 1;

        this.postWorkerMessage(['init', {
            generator,
            world_seed,
            world_guid,
            settings,
            resource_cache
        }]);
        this.postLightWorkerMessage(['init', null]);

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
        let applyVerticesCan = MAX_APPLY_VERTICES_COUNT;
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
        const rpList = this.renderList.get(resource_pack.id);
        if (!rpList) {
            return true;
        }
        let groups = transparent ? GROUPS_TRANSPARENT : GROUPS_NO_TRANSPARENT;;
        for(let group of groups) {
            const list = rpList.get(group);
            if (!list) {
                continue;
            }
            const mat = resource_pack.shader.materials[group];
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
        if(this.use_light) {
            this.lightWorker.postMessage(data);
        }
    }

    // Remove chunk
    removeChunk(addr) {
        this.chunks_prepare.delete(addr);
        let chunk = this.chunks.get(addr);
        if(chunk) {
            this.vertices_length_total -= chunk.vertices_length;
            // 1. Delete torch emmiters
            this.torches.destroyAllInAABB(chunk.aabb);
            // 2. Destroy playing discs
            TrackerPlayer.destroyAllInAABB(chunk.aabb);
            // 3. Call chunk destructor
            chunk.destruct();
            this.chunks.delete(addr)
            this.rendered_chunks.total--;
        }
    }

    // Update
    update(player_pos, delta) {

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

        this.timer60fps += delta;
        if(this.timer60fps >= 16.666) {
            this.timer60fps = 0;
            this.torches.update(player_pos);
        }

    }

    // Возвращает блок по абслютным координатам
    getBlock(x, y, z, v) {
        if(x instanceof Vector || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        this.get_block_chunk_addr = getChunkAddr(x, y, z, this.get_block_chunk_addr);
        let chunk = this.chunks.get(this.get_block_chunk_addr);
        if(chunk) {
            return chunk.getBlock(x, y, z, v);
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
            if(block.is_fluid || block.item || !block.spawnable) {
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