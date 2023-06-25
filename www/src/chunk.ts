import {IvanArray, Vector} from "./helpers.js";
import {newTypedBlocks, TBlock} from "./typed_blocks3.js";
import type { TypedBlocks3 } from "./typed_blocks3.js";
import {BLOCK, DBItemBlock} from "./blocks.js";
import {AABB} from './core/AABB.js';
import {ChunkLight} from "./light/ChunkLight.js";
import type { BaseRenderer } from "./renders/BaseRenderer.js";
import type { ChunkManager } from "./chunk_manager.js";
import {BaseGeometryPool} from "./geom/base_geometry_pool.js";
import {ChunkMesh} from "./chunk_mesh.js";
import type { IWorkerChunkCreateArgs } from "./worker/chunk.js";
import {opposite_grid_neib_index} from "./core/ChunkGrid.js";

let global_uniqId = 0;
const _inchunk_pos = new Vector(0, 0, 0)

export interface ClientModifyList {
    compressed          : string    // base-64 encoded
    private_compressed  : undefined
    obj? : {
        [key: string]: DBItemBlock
    }
}

export interface IChunkVertexBuffer {
    list: Array<any>
}

// v.resource_pack_id = temp[0];/*
// v.material_group = temp[1];
// v.material_shader = temp[2];
// v.texture_id = temp[3];
// v.key = key;
// v.buffer = bufferPool.alloc({*/

// Creates a new chunk
export class Chunk {
    [key: string]: any;

    light : ChunkLight
    tblocks: TypedBlocks3

    vertices_args: any = null;
    vertices_args_size: number = 0;
    multiblock_neib_mask = 0;
    multiblock_rev_mask = 0;
    vertices: Map<string, ChunkMesh>;
    verticesList: Array<ChunkMesh>;
    /**
     * в данный момент отрисован на экране
      */
    cullID = -1;
    /**
     * chunk has part of neib multiblock, neib is drawn
     */
    cull_multiblock = -1;

    getChunkManager() : ChunkManager {
        return this.chunkManager;
    }

    constructor(addr, modify_list, chunkManager : ChunkManager) {

        this.addr = new Vector(addr); // относительные координаты чанка
        this.seed = chunkManager.getWorld().info.seed;
        this.uniqId = ++global_uniqId;

        //
        this.tblocks = null;
        this.size = chunkManager.grid.chunkSize.clone(); // размеры чанка
        this.coord = this.addr.mul(this.size);
        this.id = this.addr.toHash();

        this.light = new ChunkLight(this);

        // Fluid
        this.fluid_buf = null;
        this.fluid_deltas = [];

        // Objects & variables
        this.inited = false;
        this.dirty = true;
        this.buildVerticesInProgress = false;
        this.vertices_length = 0;
        this.vertices = new Map();
        this.verticesList = [];
        this.fluid_blocks = [];
        this.gravity_blocks = [];
        this.rendered = 0;
        // save ref on chunk manager
        // strictly after post message, for avoid crash
        this.chunkManager = chunkManager;
        this.aabb = new AABB();
        this.aabb.set(
            this.coord.x,
            this.coord.y,
            this.coord.z,
            this.coord.x + this.size.x,
            this.coord.y + this.size.y,
            this.coord.z + this.size.z
        );
        // Run webworker method
        // console.log('2. createChunk: send', this.addr.toHash());
        chunkManager.postWorkerMessage(['createChunk', [
            {
                addr:        this.addr,
                seed:        this.seed,
                uniqId:      this.uniqId,
                modify_list: modify_list || null,
                dataId:      this.getDataTextureOffset()
            } as IWorkerChunkCreateArgs
        ]]);

        this.packedCells = null;
        this.firstTimeBuilt = false;
        this.need_apply_vertices = false;
        chunkManager.chunks_state.loaded(this)

    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args: TChunkWorkerMessageBlocksGenerated): void {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        if (args.uniqId !== this.uniqId) {
            return;
        }
        this.tblocks = newTypedBlocks(this.coord, chunkManager.dataWorld.grid);
        this.tblocks.light = this.light;
        this.packedCells = args.packedCells || null;
        chunkManager.dataWorld.addChunk(this);
        if (args.tblocks) {
            this.tblocks.restoreState(args.tblocks);
        }
        if (this.fluid_buf) {
            this.fluid.loadDbBuffer(this.fluid_buf);
            this.fluid_buf = null;
        }
        for (let i = 0; i < this.fluid_deltas.length; i++) {
            this.fluid.applyDelta(this.fluid_deltas[i]);
        }
        this.fluid_deltas = null;
        //
        const mods_arr = chunkManager.chunk_modifiers.get(this.addr);
        if (mods_arr) {
            chunkManager.chunk_modifiers.delete(this.addr);
            const set_block_list = [];
            this.newModifiers(mods_arr, set_block_list);
            chunkManager.postWorkerMessage(['setBlock', set_block_list]);
        }
        chunkManager.dataWorld.syncOuter(this);
        chunkManager.chunks_state.blocksGenerated(this)
        this.inited = true;
        this.light.init(args.dayLightDefaultValue)
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
        this.vertices_args_size = BaseGeometryPool.getVerticesMapSize(args.vertices);
        this.need_apply_vertices = true;

        if (!this.firstTimeBuilt && this.fluid) {
            this.firstTimeBuilt = true;
            if (this.fluid) {
                this.chunkManager.fluidWorld.startMeshing(this.fluid);
            }
        }

        if (!this.dirt_colors) {
            this.dirt_colors = args.dirt_colors;
        }
    }

    /** Compatibility with server API */
    isReady() : boolean {
        return this.tblocks != null
    }

    getDataTextureOffset() {
        return this.light.getDataTextureOffset();
    }

    getLightTexture(render : BaseRenderer) {
        const cm = this.getChunkManager();
        if (!this.light.hasTexture || !cm) {
            return null;
        }
        const {lightProps, lightPool} = cm.renderList;

        if (!this.light.lightTex) {
            this.light.lightTex = lightPool.alloc({
                width: this.size.x + 2,
                height: this.size.z + 2,
                depth: (this.size.y + 2) * lightProps.depthMul,
                type: lightProps.texFormat,
                filter: 'linear',
                data: this.light.lightTexData
            })
            this.light.lightTexData = null;
            this.light.markDirty();
        }

        return this.light.lightTex;
    }

    prepareRender(render : BaseRenderer) {
        if (!render) {
            return;
        }
        //TODO: if dist < 100?
        this.getLightTexture(render);
        this.light.prepareRender();
    }

     applyVertices(inputId, bufferPool, argsVertices: Dict<IChunkVertexBuffer>) {
        let chunkManager = this.getChunkManager();
        chunkManager.vertices_length_total -= this.vertices_length;
        this.vertices_length = 0;
        this.verticesList.length = 0;

        for (let [key, v] of this.vertices) {
            if (v.inputId === inputId) {
                v.customFlag = true;
            }
        }
        const chunkLightId = this.getDataTextureOffset();
        for (let [key, v] of Object.entries(argsVertices)) {
            if (v.list.length < 2) {
                continue;
            }
            let chunkMesh = this.vertices.get(key);
            if (!chunkMesh) {
                chunkMesh = new ChunkMesh(key, inputId, v.list);
                chunkMesh.chunk = this;
                this.vertices.set(key, chunkMesh);
                chunkManager.renderList.addChunkMesh(chunkMesh);
            } else {
                chunkMesh.setList(v.list);
            }
            const lastBuffer = chunkMesh.buffer;
            chunkMesh.buffer = bufferPool.alloc({
                lastBuffer,
                vertices: chunkMesh.list,
                chunkId: chunkLightId
            });
            if (lastBuffer && chunkMesh.buffer !== lastBuffer) {
                lastBuffer.destroy();
            }
            chunkMesh.customFlag = false;
            this.verticesList.push(chunkMesh);
            delete (chunkMesh.list);
        }
        for (let [key, v] of this.vertices) {
            if (v.inputId === inputId) {
                if (v.customFlag) {
                    v.buffer.destroy();
                    this.vertices.delete(key)
                } else {
                    this.vertices_length += v.instanceCount;
                }
            } else {
                this.vertices_length += v.instanceCount;
                this.verticesList.push(v);
            }
        }
        chunkManager.vertices_length_total += this.vertices_length;
    }

    // Apply vertices
    applyChunkWorkerVertices() {
        const chunkManager = this.getChunkManager();
        const args = this.vertices_args
        delete(this['vertices_args'])
        this.need_apply_vertices = false
        this.buildVerticesInProgress = false
        chunkManager.chunks_state.applyVertices(this, args.timers)
        this.timers = args.timers
        this.apply_multiblock_neib_mask(args.multiblock_neib_mask);
        this.gravity_blocks = args.gravity_blocks
        this.applyVertices('worker', chunkManager.renderList.bufferPool, args.vertices)
        this.dirty = false
    }

    apply_multiblock_neib_mask(mask: number) {
        const { dataChunk } = this;
        if (!dataChunk) {
            return;
        }
        const { grid_portals } = dataChunk;
        this.multiblock_neib_mask = mask;
        this.multiblock_rev_mask = 0;

        //TODO: currently rev links aren't needed. Remove it later if we dont find the use
        for (let i = 0; i < 26; i++)
        {
            if (!grid_portals[i]) {
                continue;
            }
            const neib = grid_portals[i].toRegion.rev;
            const rev_ind = opposite_grid_neib_index[i];
            if ((mask & (1 << i)) !== 0)
            {
                neib.multiblock_rev_mask = neib.multiblock_rev_mask | (1 << rev_ind);
            } else
            {
                neib.multiblock_rev_mask = (neib.multiblock_rev_mask & ~(1 << rev_ind));
            }
            if ((neib.multiblock_neib_mask & (1 << rev_ind)) !== 0)
            {
                this.multiblock_rev_mask = this.multiblock_rev_mask | (1 << i);
            }
        }
    }

    uncull_neib_chunks(out_neibs: IvanArray<Chunk>)
    {
        const { grid_portals } = this.dataChunk;
        for (let i = 0; i < 26; i++)
        {
            if ((this.multiblock_neib_mask & (1 << i)) > 0)
            {
                const neib = grid_portals[i]?.toRegion?.rev;
                if (neib && neib.cullID !== this.cullID && neib.cull_multiblock !== this.cullID)
                {
                    neib.cull_multiblock = this.cullID;
                    out_neibs.push(neib);
                }
            }
        }
    }

    // Destruct chunk
    destruct() {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        // remove from stat
        chunkManager.chunks_state.unload(this)
        //
        this.chunkManager = null;
        this.light.dispose();
        chunkManager.dataWorld.removeChunk(this);
        // destroy buffers
        for (let v of this.vertices.values()) {
            if (v.buffer) {
                v.buffer.destroy();
            }
        }
        const {lightTex} = this.light;
        if (lightTex) {
            chunkManager.renderList.lightPool.dealloc(lightTex);
        }
        this.light.lightTex = null;
        // run webworker method
        chunkManager.destruct_chunks_queue.add({addr: this.addr, uniqId: this.uniqId});
        // chunkManager.postWorkerMessage(['destructChunk', [this.addr]]);
        // chunkManager.postLightWorkerMessage(['destructChunk', [this.addr]]);
        // remove particles mesh
        Qubatch.render.meshes.removeForChunk(this.addr, this.aabb);
        // Destroy playing discs
        TrackerPlayer.destroyAllInAABB(this.aabb);
    }

    // Build vertices
    buildVertices() {
        if (this.buildVerticesInProgress) {
            return;
        }
        this.buildVerticesInProgress = true;
        // run webworker method
        this.getChunkManager().postWorkerMessage(['buildVertices', {
            addrs: [this.addr],
            offsets: [this.light.getDataTextureOffset()]
        }]);
        return true;
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(x, y, z, v) {
        if (!this.inited) {
            return this.getChunkManager().DUMMY;
        }
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        if (x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            console.log(888)
            return this.getChunkManager().DUMMY;
        }
        if (v instanceof Vector) {
            v.set(x, y, z);
        } else {
            v = new Vector(x, y, z);
        }
        const block = this.tblocks.get(v);
        return block;
    }

    // setBlock
    setBlock(pos : Vector, item : IBlockItem) {

        const chunkManager = this.getChunkManager()

        // Check pos
        let {x, y, z} = pos
        x -= this.coord.x
        y -= this.coord.y
        z -= this.coord.z
        if (x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            return
        }

        // Fix rotate
        if(item.rotate && typeof item.rotate === 'object') {
            if(!(item.rotate instanceof Vector)) {
                item.rotate = new Vector().copyFrom(item.rotate)
            }
            (item.rotate as Vector).roundSelf(1)
        }

        // Remember old light value
        _inchunk_pos.set(x, y, z)
        let oldLight = 0
        const tblock : TBlock = this.tblocks.get(_inchunk_pos)
        if (this.chunkManager.use_light) {
            oldLight = tblock.lightSource
        }

        // Update tblock
        this.tblocks.delete(_inchunk_pos);
        tblock.copyPropsFromPOJO(item)

        // Update light
        if (this.chunkManager.use_light) {
            const light = tblock.lightSource;
            if (oldLight !== light) {
                chunkManager.postLightWorkerMessage(['setChunkBlock', {
                    addr: this.addr,
                    dataId: this.getDataTextureOffset(),
                    list: [x, y, z, light]
                }]);
            }
        }

        // Update fluids
        this.fluid.syncBlockProps(tblock.index, item.id);

        // Update vertices (run webworker method)
        const set_block_list = [{
            pos:        pos,
            type:       item,
            is_modify:  false,
            power:      item.power,
            rotate:     item.rotate,
            extra_data: item.extra_data
        }]
        chunkManager.postWorkerMessage(['setBlock', set_block_list])

    }

    //
    newModifiers(mods_arr, set_block_list : {pos : Vector, type : any, rotate? : Vector, extra_data ? :any, is_modify : boolean}[]) {
        const chunkManager = this.getChunkManager();
        const blockModifierListeners = chunkManager.getWorld().blockModifierListeners;
        const use_light = this.inited && chunkManager.use_light;
        const tblock_pos = new Vector(Infinity, Infinity, Infinity);
        let material = null;
        let tblock = null;
        const is_modify = false;
        const lightList = [];

        for (let i = 0; i < mods_arr.length; i++) {
            const pos = mods_arr[i].pos;
            const type = mods_arr[i].item;
            if (!material || material.id != type.id) {
                material = BLOCK.fromId(type.id);
            }
            //
            tblock_pos.set(pos.x - this.coord.x, pos.y - this.coord.y, pos.z - this.coord.z);
            tblock = this.tblocks.get(tblock_pos, tblock);
            // light
            let oldLight = 0;
            if (use_light) {
                if (!tblock.material) {
                    debugger
                }
                oldLight = tblock.lightSource;
            }
            this.tblocks.delete(tblock_pos);
            // fill properties
            tblock.id = type.id;
            const extra_data = ('extra_data' in type) ? type.extra_data : null;
            const entity_id = ('entity_id' in type) ? type.entity_id : null;
            const rotate = ('rotate' in type) ? type.rotate : null;
            if (extra_data) tblock.extra_data = extra_data;
            if (entity_id) tblock.entity_id = entity_id;
            if (rotate) tblock.rotate = rotate;
            //
            set_block_list.push({pos, type, rotate, extra_data, is_modify});
            Qubatch.render.meshes.effects.deleteBlockEmitter(pos);
            // light
            if (use_light) {
                const light = tblock.lightSource;
                if (oldLight !== light) {
                    lightList.push(tblock_pos.x, tblock_pos.y, tblock_pos.z, light);
                    // updating light here
                }
            }
            for(let listener of blockModifierListeners) {
                listener(tblock);
            }
        }
        if (lightList.length > 0) {
            chunkManager.postLightWorkerMessage(['setChunkBlock', {
                addr: this.addr,
                dataId: this.getDataTextureOffset(),
                list: lightList
            }]);
        }
    }

    setFluid(buf) {
        if (this.inited) {
            this.fluid.markDirtyMesh();
            let diffFluidType = [];
            this.fluid.loadDbBuffer(buf, false, diffFluidType);
            this.light.applyDiffToLight(diffFluidType);
            this.chunkManager.fluidWorld.syncOuter(this.fluid);
        } else {
            this.fluid_buf = buf;
        }
    }

    setFluidDelta(buf) {
        if (this.inited) {
            let diffFluidType = [];
            this.fluid.applyDelta(buf, true, diffFluidType);
            this.light.applyDiffToLight(diffFluidType);
        } else {
            this.fluid_deltas.push(buf);
        }
    }
}