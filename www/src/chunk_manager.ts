import {Helpers, Vector, VectorCollector, VectorCollectorFlat, Mth} from "./helpers.js";
import {Chunk} from "./chunk.js";
import {ServerClient} from "./server_client.js";
import {BLOCK} from "./blocks.js";
import {ChunkDataTexture} from "./light/ChunkDataTexture.js";
import {DataWorld, TBlock} from "./typed_blocks3.js";
import { decompressNearby, NEARBY_FLAGS } from "./packet_compressor.js";
import { Mesh_Object_BeaconRay } from "./mesh/object/bn_ray.js";
import { FluidWorld } from "./fluid/FluidWorld.js";
import { FluidMesher } from "./fluid/FluidMesher.js";
import { DEFAULT_TX_SIZE, LIGHT_TYPE, WORKER_MESSAGE } from "./constant.js";
import {ChunkExporter} from "./geom/chunk_exporter.js";
import { Biomes } from "./terrain_generator/biome3/biomes.js";
import {ChunkRenderList} from "./chunk_render_list.js";
import type { World } from "./world.js";
import type { ChunkGrid } from "./core/ChunkGrid.js";
import { AABB } from "./core/AABB.js";
import type { Renderer } from "./render.js";
import { Resources } from "./resources.js";
import type { BaseResourcePack } from "./base_resource_pack.js";
import { FastCompiller } from "./bbmodel/compiler_base.js";
import {TerrainBaseTexture} from "./renders/TerrainBaseTexture.js";

const CHUNKS_ADD_PER_UPDATE     = 8;
const tmpAddr = new Vector()
let billboard_tex_compiler : FastCompiller

export class ChunkManagerState {

    stat = {
        loaded:             0,
        blocks_generated:   0,
        applied_vertices:   0,
        time:               0,
    }

    total = {
        one_chunk_generate_time: 0,
    }

    loaded(chunk : Chunk) {
        this.stat.loaded++
        this.recalc()
    }

    blocksGenerated(chunk : Chunk) {
        if(chunk.inited) {
            this.stat.blocks_generated--
        }
        this.stat.blocks_generated++
        this.recalc()
    }

    applyVertices(chunk : Chunk, timers : any) {
        if(chunk.timers) {
            this.stat.time -= chunk.timers.generate_terrain
            this.stat.applied_vertices--
        }
        this.stat.time += timers.generate_terrain
        this.stat.applied_vertices++
        this.recalc()
    }

    unload(chunk : Chunk) {
        if(chunk.timers) {
            this.stat.time -= chunk.timers.generate_terrain
            this.stat.applied_vertices--
        }
        if(chunk.inited) {
            this.stat.blocks_generated--
        }
        this.stat.loaded--
        this.recalc()
    }

    recalc() {
        this.total.one_chunk_generate_time = 0
        if(this.stat.applied_vertices) {
            this.total.one_chunk_generate_time = Mth.round(this.stat.time / this.stat.applied_vertices, 2)
        }
    }

}

//
export class ChunkManager {

    static instance: ChunkManager;

    chunks: VectorCollectorFlat = new VectorCollectorFlat()
    chunks_prepare: VectorCollector = new VectorCollector()

    #world: World;

    nearby = {
        added:      [] as {flags: int, addr: IVector}[],
        deleted:    new VectorCollector()
    }

    //
    chunks_state = new ChunkManagerState()
    renderList = new ChunkRenderList(this);
    dataWorld: DataWorld = null;
    fluidWorld: FluidWorld = null;
    biomes: Biomes = null;
    chunkDataTexture = new ChunkDataTexture();
    export = new ChunkExporter(this);

    block_sets: number = 0;
    draw_debug_grid = false;
    cluster_draw_debug_grid = false;

    update_chunks = true;
    vertices_length_total = 0;
    worker_inited = false;
    timer60fps = 0;

    chunk_modifiers = new VectorCollector();
    groundLevelEstimation: number | null = null;
    rendered_chunks        = {fact: 0, total: 0};
    DUMMY: any;
    AIR: any;

    worker: Worker;
    lightWorker: Worker;
    worker_counter = 0;
    worldId = 'CLIENT';
    destruct_chunks_queue: any = null;
    use_light = false;
    tech_info: TWorldTechInfo
    grid: ChunkGrid

    constructor(world: World) {

        ChunkManager.instance = this;

        this.#world                     = world;
        this.draw_debug_grid            = world.settings.chunks_draw_debug_grid;
        this.cluster_draw_debug_grid    = world.settings.cluster_draw_debug_grid;

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
                const player_state = Qubatch.player.state
                const grid = that.grid
                if(this.list.length > 0) {
                    //
                    that.postWorkerMessage(['destructChunk', this.list]);
                    //
                    that.postWorkerMessage(['destroyMap', {
                        players: [{
                            chunk_render_dist: player_state.chunk_render_dist,
                            chunk_addr: grid.toChunkAddr(player_state.pos)
                        }]
                    }]);
                    //
                    that.postLightWorkerMessage(['destructChunk', this.list]);
                    this.clear();
                }
            }
        };
    }

    init() {

        const world                 = this.#world;
        const that                  = this;

        this.tech_info              = world.info.tech_info
        this.grid                   = world.grid
        this.dataWorld              = new DataWorld(this);
        this.fluidWorld             = new FluidWorld(this);
        this.fluidWorld.mesher      = new FluidMesher(this.fluidWorld);
        this.biomes                 = new Biomes(null);

        // Add listeners for server commands
        world.server.AddCmdListener([ServerClient.CMD_NEARBY_CHUNKS], (cmd) => {this.updateNearby(decompressNearby(cmd.data))});
        world.server.AddCmdListener([ServerClient.CMD_CHUNK_LOADED], (cmd) => {
            if (cmd.data.fluid) {
                cmd.data.fluid = Uint8Array.from(atob(cmd.data.fluid), c => c.charCodeAt(0));
            }
            this.setChunkState(cmd.data);
        });
        world.server.AddCmdListener([ServerClient.CMD_BLOCK_SET], (cmd) => {
            let pos = cmd.data.pos;
            let item = cmd.data.item;
            // let block = BLOCK.fromId(item.id)
            if(cmd.data.item.extra_data)  {
                item.extra_data = cmd.data.item.extra_data
            }
            this.setBlock(pos, item)
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
        const dummy = BLOCK.DUMMY
        this.DUMMY = {
            id:             dummy.id,
            properties:     dummy,
            material:       dummy,
            fluid:          0,
            getProperties: function() {
                return this.material;
            }
        }

        this.AIR = {
            id: BLOCK.AIR.id,
            properties: BLOCK.AIR
        }

        const grid = this.grid

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
                case '_debug_aabb': {
                    const aabb = new AABB()
                    aabb.copyFrom(args)
                    Qubatch.render._debug_aabb.push(aabb)
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
                case 'create_block_emitter': {
                    Qubatch.render.meshes.effects.createBlockEmitter(args);
                    break;
                }
                case 'create_billboard_texture': {
                    const process = async (args) => {
                        //TODO: move to chunk_render_list , this.render_list
                        const item = args.item
                        const extra_data = item.extra_data
                        const url = extra_data.texture.url
                        const render = Qubatch.render as Renderer
                        const resource_pack : BaseResourcePack = render.world.block_manager.resource_pack_manager.get('bbmodel')
                        //
                        if(!billboard_tex_compiler) {
                            const options = {
                                resolution: DEFAULT_TX_SIZE,
                                tx_cnt: resource_pack.conf.textures.bbmodel_texture_1.tx_cnt
                            }
                            billboard_tex_compiler = new FastCompiller(options)
                            billboard_tex_compiler.billboard_textures = new Map()
                        }
                        //
                        let billboard_texture_info = billboard_tex_compiler.billboard_textures.get(url)
                        if (!billboard_texture_info) {
                            billboard_texture_info = Resources.loadImage(url, false).then(async (image) => {
                                const textures = [{
                                    id: url,
                                    name: url,
                                    image
                                }]
                                const tx_size = 1
                                const options = billboard_tex_compiler.options
                                const {places, spritesheet} = await billboard_tex_compiler.findPlaces(textures, true, options.resolution, options.tx_cnt, options)
                                const place = places[0]
                                const spritesheet_id = spritesheet.id
                                const {x, y, image_width, image_height} = place
                                const doubleface = false
                                const material_key = `bbmodel/${doubleface ? 'doubleface_transparent' : 'transparent'}/terrain/${spritesheet_id}`
                                await spritesheet.drawTexture(image, place.x, place.y)
                                if(!resource_pack.materials.has(material_key)) {
                                    const spritesheet_canvas = spritesheet.ctx.canvas
                                    const settings_for_canvas = {
                                        mipmap: false
                                    }
                                    const renderBackend = render.renderBackend
                                    const texture = new TerrainBaseTexture({
                                        source:     spritesheet_canvas,
                                        style:      resource_pack.genTextureStyle(spritesheet_canvas, settings_for_canvas, DEFAULT_TX_SIZE),
                                        minFilter:  'nearest',
                                        magFilter:  'nearest',
                                    })
                                    const textureInfo = {
                                        texture:    texture,
                                        width:      spritesheet.width,
                                        height:     spritesheet.height,
                                        texture_n:  null
                                    }
                                    resource_pack.textures.set(spritesheet_id, textureInfo)
                                    resource_pack.getMaterial(material_key)
                                } else {
                                    const tex = resource_pack.textures.get(spritesheet_id)
                                    if(tex) {
                                        tex.texture.update();
                                        // Helpers.downloadImage(spritesheet.canvases.get('').cnv, 'banner.png')
                                    }
                                }
                                const uv = [
                                    (x * spritesheet.tx_sz + image_width / 2) / spritesheet.width,
                                    (y * spritesheet.tx_sz + image_height / 2) / spritesheet.height,
                                    image_width / spritesheet.width,
                                    image_height / spritesheet.height,
                                ]
                                return {spritesheet_id, tx_size, w: image_width, h: image_height, material_key, uv}
                            })

                            billboard_tex_compiler.billboard_textures.set(url, billboard_texture_info)
                        }

                        const info = await billboard_texture_info
                        extra_data.texture = {...extra_data.texture, ...info}
                        world.chunkManager.setBlock(args.pos, item)

                    }
                    process(args)
                    break
                }
                case 'add_bbmesh': {
                    const a = args as IAddMeshArgs
                    const pos = new Vector().copyFrom(a.block_pos)
                    const key = `block_bbmesh_${pos.toHash()}`
                    const render = Qubatch.render as Renderer
                    render.addBBModelForChunk(pos.addScalarSelf(.5, 0, .5), a.model, new Vector().copyFrom(a.rotate), a.animation_name, a.hide_groups, key, true, a.matrix, a.item_block)
                    break
                }
                case 'remove_bbmesh': {
                    const pos = new Vector().copyFrom(args.block_pos)
                    const key = `block_bbmesh_${pos.toHash()}`;
                    (Qubatch.render as Renderer).meshes.remove(key, Qubatch.render)
                    break
                }
                case 'delete_animated_block': {
                    Qubatch.render.meshes.effects.deleteBlockEmitter(args);
                    break;
                }
                case 'add_beacon_ray': {
                    const meshes = Qubatch.render.meshes;
                    args.pos = new Vector(args.pos);
                    meshes.addForChunk(grid.toChunkAddr(args.pos), new Mesh_Object_BeaconRay(args, world), 'beacon/' + args.pos.toHash());
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
                    that.groundLevelEstimation = args;
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
            generator:          world_info.generator,
            world_seed:         world_info.seed,
            world_guid:         world_info.guid,
            is_server:          false,
            settings:           settings,
            resource_cache:     Helpers.getCache(),
            world_tech_info:    world_info.tech_info
        }
        this.postWorkerMessage([WORKER_MESSAGE.CHUNK_WORKER_INIT, msg]);

        this.postLightWorkerMessage([WORKER_MESSAGE.LIGHT_WORKER_INIT, null])
        this.postLightWorkerMessage([WORKER_MESSAGE.LIGHT_WORKER_INIT_WORLD, world_info])
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

    /**
     * Return chunk by address
     */
    getChunk(addr: IVector): Chunk | null {
        return this.chunks.get(addr);
    }

    getByPos(pos: IVector): Chunk | null {
        this.grid.getChunkAddr(pos.x, pos.y, pos.z, tmpAddr)
        return this.chunks.get(tmpAddr)
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
            this.rendered_chunks.total++;
            this.chunks_prepare.delete(state.addr);
            if (state.fluid) {
                chunk.setFluid(state.fluid);
            }
            this.renderList.chunkAlive(chunk);
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
        // const deleted_size = this.nearby.deleted.size;
        for(let addr of this.nearby.deleted) {
            this.removeChunk(addr);
        }
        this.destruct_chunks_queue.send();
        this.nearby.deleted.clear();
        // stat['Delete chunks'] = [(performance.now() - p), deleted_size]; p = performance.now();

        // Prepare render list
        this.rendered_chunks.fact = 0;
        if (!this.renderList.render) {
            this.renderList.init(Qubatch.render);
        }
        this.renderList.prepareRenderList();
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

    get_block_chunk_addr: Vector = null;
    // Возвращает блок по абслютным координатам
    getBlock(x : int | IVector, y? : int, z? : int, v? : any): TBlock {
        if(x instanceof Vector || typeof x == 'object') {
            y = x.y;
            z = x.z;
            x = x.x;
        }
        this.get_block_chunk_addr = this.grid.getChunkAddr(x as any, y, z, this.get_block_chunk_addr);
        let chunk = this.chunks.get(this.get_block_chunk_addr);
        if(chunk) {
            return chunk.getBlock(x, y, z, v);
        }
        return this.DUMMY;
    }

    // setBlock
    setBlock(pos: Vector, item : IBlockItem) {
        // определяем относительные координаты чанка
        const chunkAddr = this.grid.getChunkAddr(pos.x, pos.y, pos.z)
        // обращаемся к чанку
        const chunk = this.getChunk(chunkAddr)
        // если чанк не найден
        if(!chunk) {
            return null
        }
        // устанавливаем блок
        return chunk.setBlock(pos, item)
    }

    // Set nearby chunks
    updateNearby(data) {
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
            if(mat.deprecated || !mat.spawnable || mat.item || mat.is_fluid || mat.previous_part || ['extruder', 'text'].includes(mat.style_name)) {
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