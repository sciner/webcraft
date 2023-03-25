import {Helpers, getChunkAddr, SpiralGenerator, Vector, VectorCollector, IvanArray, VectorCollectorFlat} from "./helpers.js";
import {Chunk} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {BLOCK} from "./blocks.js";
import {ChunkDataTexture} from "./light/ChunkDataTexture.js";
import {TrivialGeometryPool} from "./light/GeometryPool.js";
import {Basic05GeometryPool} from "./light/Basic05GeometryPool.js";
import {DataWorld, TBlock} from "./typed_blocks3.js";
import { CHUNK_GENERATE_MARGIN_Y } from "./chunk_const.js";
import { decompressNearby, NEARBY_FLAGS } from "./packet_compressor.js";
import { Mesh_Object_BeaconRay } from "./mesh/object/bn_ray.js";
import { FluidWorld } from "./fluid/FluidWorld.js";
import { FluidMesher } from "./fluid/FluidMesher.js";
import { LIGHT_TYPE } from "./constant.js";
import {ChunkExporter} from "./geom/ChunkExporter.js";
import { Biomes } from "./terrain_generator/biome3/biomes.js";
import type { World } from "./world.js";
import type { Renderer } from "./render.js";
import type { BaseResourcePack } from "./base_resource_pack.js";

const CHUNKS_ADD_PER_UPDATE     = 8;
const MAX_APPLY_VERTICES_COUNT  = 20;
export const GROUPS_TRANSPARENT = ['transparent', 'doubleface_transparent'];
export const GROUPS_NO_TRANSPARENT = ['regular', 'doubleface', 'decal1', 'decal2'];

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
    [key: string]: any;
    poses: any[]

    static instance: ChunkManager;

    chunks: VectorCollectorFlat = new VectorCollectorFlat()
    chunks_prepare: VectorCollector = new VectorCollector()

    #world: World;

    state = {
        generated: {
            count: 0,
            generated_count: 0,
            time: 0
        }
    }

    constructor(world: World) {

        ChunkManager.instance = this;

        this.#world                     = world;
        this.block_sets                 = 0;
        this.draw_debug_grid            = world.settings.chunks_draw_debug_grid;
        this.cluster_draw_debug_grid    = world.settings.cluster_draw_debug_grid;

        this.lightPool              = null;
        this.lightProps = {
            texFormat: 'rgba8unorm',
            hasTexture: true,
            depthMul: 1,
        }

        this.bufferPool             = null;
        this.chunkDataTexture       = new ChunkDataTexture();

        // rendering
        this.poses                  = [];
        this.poses_need_update      = false;
        this.poses_chunkPos         = new Vector(0, 0, 0);
        this.rendered_chunks        = {fact: 0, total: 0};
        this.renderList             = new Map();

        this.update_chunks          = true;
        this.vertices_length_total  = 0;
        this.worker_inited          = false;
        this.timer60fps             = 0;
        this.dataWorld              = new DataWorld(this);
        this.fluidWorld             = new FluidWorld(this);
        this.fluidWorld.mesher      = new FluidMesher(this.fluidWorld);
        this.biomes                 = new Biomes(null);

        this.chunk_modifiers        = new VectorCollector();

        this.groundLevelEastimtion  = null;

        if (navigator.userAgent.indexOf('Firefox') > -1 || globalThis.useGenWorkers) {
            this.worker = new Worker('./js-bundles/chunk_worker_bundle.js');
            this.lightWorker = new Worker('./js-bundles/light_worker_bundle.js');
        } else {
            this.worker = new Worker('./js/chunk_worker.js'/*, {type: 'module'}*/);
            this.worker.onerror = (e) => {
                debugger;
            };
            this.lightWorker = new Worker('./js/light_worker.js'/*, {type: 'module'}*/);
            this.lightWorker.onerror = (e) => {
                debugger;
            };
        }

        this.worldId = 'CLIENT';

        const that = this;

        // Destruct chunks queue
        this.destruct_chunks_queue = {
            list: [],
            add({addr, uniqId}) {
                this.list.push({addr: addr.clone(), uniqId});
            },
            clear: function() {
                this.list = [];
            },
            send: function() {
                if(this.list.length > 0) {
                    //
                    that.postWorkerMessage(['destructChunk', this.list]);
                    //
                    that.postWorkerMessage(['destroyMap', {
                        players: [{
                            chunk_render_dist: Qubatch.player.state.chunk_render_dist,
                            chunk_addr: Vector.toChunkAddr(Qubatch.player.state.pos)
                        }]
                    }]);
                    //
                    that.postLightWorkerMessage(['destructChunk', this.list]);
                    this.clear();
                }
            }
        };

        this.export = new ChunkExporter(this);
    }

    get lightmap_count() {
        return this.lightPool ? this.lightPool.totalRegions : 0;
    }

    get lightmap_bytes() {
        return this.lightPool ? this.lightPool.totalBytes : 0;
    }

    init() {

        const world                   = this.#world;
        const that                    = this;

        // Add listeners for server commands
        world.server.AddCmdListener([ServerClient.CMD_NEARBY_CHUNKS], (cmd) => {this.updateNearby(decompressNearby(cmd.data))});
        world.server.AddCmdListener([ServerClient.CMD_CHUNK_LOADED], (cmd) => {
            // console.log('1. chunk: loaded', new Vector(cmd.data.addr).toHash());
            if (cmd.data.fluid) {
                cmd.data.fluid = Uint8Array.from(atob(cmd.data.fluid), c => c.charCodeAt(0));
            }
            this.setChunkState(cmd.data);
        });
        world.server.AddCmdListener([ServerClient.CMD_BLOCK_SET], (cmd) => {
            let pos = cmd.data.pos;
            let item = cmd.data.item;
            let block = BLOCK.fromId(item.id);
            let extra_data = cmd.data.item.extra_data ? cmd.data.item.extra_data : null;
            this.setBlock(pos.x, pos.y, pos.z, block, false, item.power, item.rotate, item.entity_id, extra_data, ServerClient.BLOCK_ACTION_REPLACE);
        });
        world.server.AddCmdListener([ServerClient.CMD_BLOCK_ROLLBACK], (cmd: INetworkMessage<int>) => {
            world.history.rollback(cmd.data)
        });
        world.server.AddCmdListener([ServerClient.CMD_FLUID_UPDATE], (cmd) => {
            this.setChunkFluid(new Vector(cmd.data.addr), Uint8Array.from(atob(cmd.data.buf), c => c.charCodeAt(0)));
        });
        world.server.AddCmdListener([ServerClient.CMD_FLUID_DELTA], (cmd) => {
            this.setChunkFluidDelta(new Vector(cmd.data.addr), Uint8Array.from(atob(cmd.data.buf), c => c.charCodeAt(0)));
        });
        //
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.material;
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
            // if(sizeOf(e.data) > 700000) debugger
            switch(cmd) {
                case 'world_inited':
                case 'worker_inited': {
                    that.worker_inited = --that.worker_counter === 0;
                    break;
                }
                case 'blocks_generated': {
                    const msg = args as TChunkWorkerMessageBlocksGenerated
                    // console.log('4. createChunk: generated', new Vector(args.addr).toHash());
                    const chunk = that.chunks.get(msg.addr);
                    chunk?.onBlocksGenerated(msg);
                    break;
                }
                case 'gen_queue_size': {
                    //nothing, server-only
                    break;
                }
                case 'vertices_generated': {
                    for(let i = 0; i < args.length; i++) {
                        const result = args[i];
                        const chunk = that.chunks.get(result.addr) as Chunk
                        if(chunk) {
                            chunk.onVerticesGenerated(result)
                        }
                    }
                    // console.log(`got chunks count=${args.length}`);
                    break;
                }
                case 'play_disc': {
                    TrackerPlayer.loadAndPlay('/media/disc/' + args.filename, args.pos, args.dt);
                    break;
                }
                case 'add_animated_block': {
                    Qubatch.render.meshes.effects.createBlockEmitter(args);
                    break;
                }
                case 'add_bbmesh': {
                    Qubatch.render.addBBModel(new Vector(args.block_pos).addScalarSelf(.5, 0, .5), args.model, args.rotate, args.animation_name)
                    break
                }
                case 'delete_animated_block': {
                    Qubatch.render.meshes.effects.deleteBlockEmitter(args);
                    break;
                }
                case 'add_beacon_ray': {
                    const meshes = Qubatch.render.meshes;
                    args.pos = new Vector(args.pos);
                    meshes.addForChunk(Vector.toChunkAddr(args.pos), new Mesh_Object_BeaconRay(args), 'beacon/' + args.pos.toHash());
                    break;
                }
                case 'del_beacon_ray': {
                    const render = Qubatch.render;
                    args.pos = new Vector(args.pos);
                    render.meshes.remove('beacon/' + args.pos.toHash(), render);
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
            let worldId = e.data[0];
            let cmd = e.data[1];
            let args = e.data[2];
            switch(cmd) {
                case 'worker_inited': {
                    that.worker_inited = --that.worker_counter === 0;
                    break;
                }
                case 'light_generated': {
                    let chunk = that.chunks.get(args.addr);
                    if(chunk) {
                        if (chunk.uniqId !== args.uniqId) {
                            // This happens occasionally after quick F8.
                            break;
                        }
                        chunk.light.onGenerated(args);
                    }
                    break;
                }
                case 'ground_level_estimated': {
                    that.groundLevelEastimtion = args;
                    break;
                }
            }
        }
        // Init webworkers
        let world_info = world.info;
        const settings = world.settings;

        this.use_light                = settings.use_light != LIGHT_TYPE.NO;
        this.worker_counter           = this.use_light ? 2 : 1;

        const msg: TChunkWorkerMessageInit = {
            generator: world_info.generator,
            world_seed: world_info.seed,
            world_guid: world_info.guid,
            settings,
            is_server: false,
            // bbmodels,
            resource_cache: Helpers.getCache()
        }
        this.postWorkerMessage(['init', msg]);

        this.postLightWorkerMessage(['init', null]);
        this.postLightWorkerMessage([
            'genLayerParams',
            {
                ambientLight: world_info.rules.ambientLight || 0,
            }
        ])

    }

    /**
     * С сервера пришла вода, ее нужно передать чанку, либо куда нить записать если его пока нет
     * @param {Vector} addr
     * @param {Uint8Array} fluid
     */
    setChunkFluid(addr, fluid) {
        const chunk = this.getChunkForSetData(addr);
        if(chunk instanceof Chunk) {
            chunk.setFluid(fluid);
        } else {
            console.debug('no_chunk');
        }
    }

    /**
     * @param {Vector} addr
     * @param {Uint8Array} fluidDelta
     */
    setChunkFluidDelta(addr, fluidDelta) {
        const chunk = this.getChunkForSetData(addr);
        if(chunk instanceof Chunk) {
            chunk.setFluidDelta(fluidDelta);
        }
    }

    /**
     * @param {Vector} addr
     * @returns
     */
    getChunkForSetData(addr) {
        const chunk = this.getChunk(addr);
        if(chunk) {
            return chunk;
        } else if(this.chunks_prepare.has(addr)) {
            return this.chunks_prepare.get(addr);
        } else if(this.nearby) {
            for(let i = 0; i < this.nearby.added.length; i++) {
                const item = this.nearby.added[i];
                if(addr.equal(item.addr)) {
                    if (!this.nearby.deleted.has(addr)) {
                        return this.nearby.added[i];
                    }
                }
            }
        }
        return null;
    }

    /**
     * @param {int} value
     */
    setRenderDist(value) {
        this.#world.server.setRenderDist(value);
    }

    // toggleUpdateChunks
    toggleUpdateChunks() {
        this.update_chunks = !this.update_chunks;
    }

    setLightTexFormat(hasNormals) {
        this.lightProps.depthMul = hasNormals ? 2 : 1;
        this.lightWorker.postMessage([this.worldId, 'initRender', {
            hasTexture: true,
            hasNormals
        }])
    }

    /**
     * highly optimized
     * @param { import("./render.js").Renderer } render
     */
    prepareRenderList(render) {

        if (!this.bufferPool) {
            if (render.renderBackend.multidrawBaseExt) {
                 this.bufferPool = new Basic05GeometryPool(render.renderBackend, {});
            } else {
                this.bufferPool = new TrivialGeometryPool(render.renderBackend);
            }
            this.fluidWorld.mesher.initRenderPool(render.renderBackend);
        }

        const player = render.player;
        const chunk_render_dist = player.state.chunk_render_dist;
        const player_chunk_addr = player.chunkAddr;

        if (this.poses_need_update || !player_chunk_addr.equal(this.poses_chunkPos)) {
            this.poses_need_update = false;

            const msg = {
                pos: player.pos,
                chunk_render_dist: player.state.chunk_render_dist
            };
            this.postWorkerMessage(['setPotentialCenter', msg]);
            this.postLightWorkerMessage(['setPotentialCenter', msg]);

            this.poses_chunkPos.copyFrom(player_chunk_addr);
            const pos               = this.poses_chunkPos;
            const pos_temp          = pos.clone();
            let margin              = Math.max(chunk_render_dist + 1, 1);
            let spiral_moves_3d     = SpiralGenerator.generate3D(new Vector(margin, CHUNK_GENERATE_MARGIN_Y, margin));
            this.poses.length = 0;
            for (let i = 0; i < spiral_moves_3d.length; i++) {
                const item = spiral_moves_3d[i];
                pos_temp.set(pos.x + item.pos.x, pos.y + item.pos.y, pos.z + item.pos.z);
                const chunk = this.chunks.get(pos_temp);
                if (chunk) {
                    this.poses.push(chunk);
                }
            }
        }

        this.fluidWorld.mesher.buildDirtyChunks(MAX_APPLY_VERTICES_COUNT);

        /**
         * please dont re-assign renderList entries
         */
        const {renderList} = this;
        for (let v of renderList.values()) {
            for (let v2 of v.values()) {
                for (let v3 of v2.values()) {
                    v3.clear();
                }
            }
        }
        //
        let applyVerticesCan = MAX_APPLY_VERTICES_COUNT;

        for(let i = 0; i < this.poses.length; i++) {
            const chunk = this.poses[i] as Chunk
            if (!chunk.chunkManager) {
                // destroyed!
                continue;
            }
            if(!chunk.updateInFrustum(render)) {
                continue;
            }
            if(chunk.need_apply_vertices) {
                if(applyVerticesCan-- > 0) {
                    chunk.applyChunkWorkerVertices();
                }
            }
            // actualize light
            chunk.prepareRender(render.renderBackend);
            if(chunk.vertices_length === 0) {
                continue;
            }
            for(let i = 0; i < chunk.verticesList.length; i++) {
                let v = chunk.verticesList[i];
                let rpl = v.rpl;
                if (!rpl) {
                    let key1 = v.resource_pack_id;
                    let key2 = v.material_group;
                    let key3 = v.material_shader;
                    if (!v.buffer) {
                        continue;
                    }
                    let rpList = renderList.get(key1);
                    if (!rpList) {
                        renderList.set(key1, rpList = new Map());
                    }
                    let groupList = rpList.get(key2);
                    if (!groupList) {
                        rpList.set(key2, groupList = new Map());
                    }
                    if (!groupList.get(key3)) {
                        groupList.set(key3, new IvanArray());
                    }
                    rpl = v.rpl = groupList.get(key3);
                }
                rpl.push(chunk);
                rpl.push(v);
                chunk.rendered = 0;
            }
        }
    }

    /**
     * Draw level chunks
     */
    draw(render : Renderer, resource_pack : BaseResourcePack, transparent : boolean) {
        if(!this.worker_inited || !this.nearby) {
            return;
        }
        const rpList = this.renderList.get(resource_pack.id);
        if (!rpList) {
            return true;
        }
        let groups = transparent ? GROUPS_TRANSPARENT : GROUPS_NO_TRANSPARENT;
        for(let group of groups) {
            const groupList = rpList.get(group);
            if (!groupList) {
                continue;
            }
            for (let [mat_shader, list] of groupList.entries()) {
                const {arr, count} = list;
                const shaderName = mat_shader === 'fluid' ? 'fluidShader' : 'shader';
                const mat = resource_pack[shaderName].materials[group];

                if (!mat.opaque && mat.shader.fluidFlags) {
                    // REVERSED!!!
                    for (let i = count - 2; i >= 0; i -= 2) {
                        const chunk = arr[i] as Chunk;
                        const vertices = arr[i + 1];
                        chunk.drawBufferVertices(render.renderBackend, resource_pack, group, mat, vertices);
                        if (!chunk.rendered) {
                            this.rendered_chunks.fact++;
                        }
                        chunk.rendered++;
                    }
                } else {
                    for (let i = 0; i < count; i += 2) {
                        const chunk = arr[i];
                        const vertices = arr[i + 1];
                        chunk.drawBufferVertices(render.renderBackend, resource_pack, group, mat, vertices);
                        if (!chunk.rendered) {
                            this.rendered_chunks.fact++;
                        }
                        chunk.rendered++;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Return chunk by address
     * @param {Vector} addr
     * @returns Chunk
     */
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    getWorld() {
        return this.#world;
    }

    // Add
    loadChunk(item) {
        if(this.chunks.has(item.addr) || this.chunks_prepare.has(item.addr)) {
            return false;
        }
        this.chunks_prepare.add(item.addr, {
            start_time: performance.now(),
        });
        if(item.flags) { // if it has anything to query
            this.#world.server.loadChunk(item.addr);
        }
        if ((item.flags & NEARBY_FLAGS.HAS_MODIFIERS) == 0) {
           if(!this.setChunkState({addr: item.addr, modify_list: null})) {
               return false;
           }
        }
        return true;
    }

    // Установить начальное состояние указанного чанка
    setChunkState(state) {
        const prepare = this.chunks_prepare.get(state.addr);
        if(prepare) {
            const chunk = new Chunk(state.addr, state.modify_list, this);
            chunk.load_time = performance.now() - prepare.start_time;
            this.chunks.add(state.addr, chunk);
            this.chunk_added = true;
            this.rendered_chunks.total++;
            this.chunks_prepare.delete(state.addr);
            if (state.fluid) {
                chunk.setFluid(state.fluid);
            }
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
            data.unshift(this.worldId);
            this.lightWorker.postMessage(data);
        }
    }

    // Remove chunk
    removeChunk(addr) {
        this.chunks_prepare.delete(addr);
        const chunk = this.chunks.get(addr);
        if(chunk) {
            this.vertices_length_total -= chunk.vertices_length;
            // Call chunk destructor
            chunk.destruct();
            this.chunks.delete(addr)
            this.rendered_chunks.total--;
        }
    }

    // Update
    update(player_pos?, delta?) {

        // let p = performance.now();
        // let p2 = performance.now();
        // const stat = {};

        if(!this.update_chunks || !this.worker_inited || !this.nearby) {
            return false;
        }

        // Load chunks
        let can_add = CHUNKS_ADD_PER_UPDATE;
        let j = 0;
        for (let i = 0; i < this.nearby.added.length; i++) {
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
        // stat['Load chunks'] = (performance.now() - p); p = performance.now();

        // Delete chunks
        const deleted_size = this.nearby.deleted.size;
        for(let addr of this.nearby.deleted) {
            this.removeChunk(addr);
        }
        this.destruct_chunks_queue.send();
        this.nearby.deleted.clear();
        // stat['Delete chunks'] = [(performance.now() - p), deleted_size]; p = performance.now();

        // Build dirty chunks
        // this.buildDirtyChunks();
        // stat['Build dirty chunks'] = (performance.now() - p); p = performance.now();

        // Prepare render list
        this.rendered_chunks.fact = 0;
        this.prepareRenderList(Qubatch.render);
        // stat['Prepare render list'] = (performance.now() - p); p = performance.now();

        /*
        // Update animated blocks
        this.timer60fps += delta;
        if(this.timer60fps >= 16.666) {
            this.timer60fps = 0;
            this.animated_blocks.update(player_pos);
        }
        // stat['Update animated blocks'] = (performance.now() - p); p = performance.now();
        */

        // Result
        //p2 = performance.now() - p2;
        //if(p2 > 5) {
        //    stat['Total'] = p2;
        //    console.table(stat);
        //}

    }

    /**
     * Build dirty chunks
     * @deprecated
     */
    buildDirtyChunks() {
        // if(!this.chunk_added) {
        //     return;
        // }
        // this.chunk_added = false;
        // for(let chunk of this.chunks) {
        //     if(chunk.dirty && !chunk.buildVerticesInProgress) {
        //         let ok = true;
        //         if(!chunk.addr_neighbors) {
        //             chunk.addr_neighbors = [];
        //             for(let i = 0; i < CC.length; i++) {
        //                 const c = CC[i];
        //                 chunk.addr_neighbors.push(chunk.addr.add(c));
        //             }
        //         }
        //         for(let i = 0; i < chunk.addr_neighbors.length; i++) {
        //             const neighbour_addr = chunk.addr_neighbors[i];
        //             if(ALLOW_NEGATIVE_Y || neighbour_addr.y >= 0) {
        //                 if(!this.getChunk(neighbour_addr)) {
        //                     ok = false;
        //                     break;
        //                 }
        //             }
        //         }
        //         if(ok) {
        //             chunk.buildVertices();
        //         }
        //     }
        // }
    }

    // Возвращает блок по абслютным координатам
    getBlock(x : int | IVector, y? : int, z? : int, v? : any): TBlock {
        if(x instanceof Vector || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        this.get_block_chunk_addr = getChunkAddr(x as any, y, z, this.get_block_chunk_addr);
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
        // if (this.nearby.deleted.length > 0) {
        if(this.nearby.deleted.list.size > 0) {
            this.update();
        }
        for(let item of data.added) {
            this.nearby.added.push(item);
        }
        for(let addr of data.deleted) {
            this.nearby.deleted.add(addr, new Vector(addr));
        }
        Qubatch.player.state.chunk_render_dist = data.chunk_render_dist;
    }

    //
    setTestBlocks(pos) {
        let d = 16;
        let cnt = 0;
        let startx = pos.x;
        let all_blocks = BLOCK.getAll();
        const set_block_list = [];
        for(let mat of all_blocks) {
            if(mat.deprecated || !mat.spawnable || mat.item || mat.is_fluid || mat.next_part || mat.previous_part || ['extruder', 'text'].includes(mat.style_name)) {
                if(mat.name != 'BEDROCK') {
                    continue;
                }
            }
            if(cnt % d == 0) {
                pos.x = startx;
                pos.z += 2;
            }
            pos.x += 2;
            const item: IBlockItem = {
                id:         mat.id,
                extra_data: null
            };
            if(mat.chest) {
                item.extra_data = { can_destroy: true, slots: {} };
            } else if(mat.tags.includes('sign')) {
                item.extra_data = {
                    text: 'Hello, World!',
                    username: 'Server',
                    dt: new Date().toISOString()
                };
            } else if(mat.extra_data) {
                item.extra_data = mat.extra_data;
            }
            if(mat.can_rotate) {
                item.rotate = new Vector(0, 1, 0);
            }
            set_block_list.push({
                pos:        pos.clone(),
                type:       item,
                is_modify:  false,
                power:      null,
                rotate:     item.rotate,
                extra_data: item.extra_data
            });
            if(mat.has_head) {
                if(item.rotate) {
                    item.rotate.x = 2;
                }
                const head_extra_data = {...item.extra_data};
                head_extra_data.is_head = true;
                set_block_list.push({
                    pos:        pos.clone().addSelf(mat.has_head.pos),
                    type:       item,
                    is_modify:  false,
                    power:      null,
                    rotate:     item.rotate,
                    extra_data: head_extra_data
                });
            }
            cnt++;
        }
        this.postWorkerMessage(['setBlock', set_block_list]);
    }

    // Toggle grid
    toggleDebugGrid() {
        this.draw_debug_grid = !this.draw_debug_grid;
        Qubatch.setSetting('chunks_draw_debug_grid', this.draw_debug_grid);
    }

    // Toggle cluster grid
    toggleDebugClusterGrid() {
        this.cluster_draw_debug_grid = !this.cluster_draw_debug_grid;
        Qubatch.setSetting('cluster_draw_debug_grid', this.cluster_draw_debug_grid);
    }

    // Set debug grid visibility
    setDebugGridVisibility(value) {
        this.draw_debug_grid = !value;
        this.toggleDebugGrid();
    }

    // Set debug cluster grid visibility
    setDebugClusterGridVisibility(value) {
        this.cluster_draw_debug_grid = !value;
        this.toggleDebugClusterGrid();
    }

}