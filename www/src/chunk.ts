import { Vector } from "./helpers.js";
import {newTypedBlocks} from "./typed_blocks3.js";
import type { TypedBlocks3 } from "./typed_blocks3.js";
import {Sphere} from "./frustum.js";
import {BLOCK, DBItemBlock, POWER_NO} from "./blocks.js";
import {AABB} from './core/AABB.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk_const.js";
import {ChunkLight} from "./light/ChunkLight.js";
import type { Renderer } from "./render.js";
import type BaseRenderer from "./renders/BaseRenderer.js";
import type { ChunkManager } from "./chunk_manager.js";
import {GeometryPool} from "./light/GeometryPool.js";
import {ChunkMesh} from "./chunk_mesh.js";

let global_uniqId = 0;

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
    vertices: Map<string, ChunkMesh>;
    verticesList: Array<ChunkMesh>;
    /**
     * в данный момент отрисован на экране
      */
    cullID = -1;

    getChunkManager() : ChunkManager {
        return this.chunkManager;
    }

    constructor(addr, modify_list, chunkManager) {

        this.addr = new Vector(addr); // относительные координаты чанка
        this.seed = chunkManager.getWorld().info.seed;
        this.uniqId = ++global_uniqId;

        //
        this.tblocks = null;
        this.size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z); // размеры чанка
        this.coord = this.addr.mul(this.size);
        this.id = this.addr.toHash();

        this.light = new ChunkLight(this);
        this.lightMats = new Map();

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
                addr: this.addr,
                seed: this.seed,
                uniqId: this.uniqId,
                modify_list: modify_list || null,
                dataId: this.getDataTextureOffset()
            }
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
        this.light.init();
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
        this.vertices_args_size = GeometryPool.getVerticesMapSize(args.vertices);
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
            this.light._dataTextureDirty = true;
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
        this.gravity_blocks = args.gravity_blocks
        this.applyVertices('worker', chunkManager.renderList.bufferPool, args.vertices)
        this.dirty = false
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
    setBlock(x, y, z, item, is_modify, power, rotate, entity_id, extra_data) {
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        if (x < 0 || y < 0 || z < 0 || x >= this.size.x || y >= this.size.y || z >= this.size.z) {
            return;
        }
        ;
        // fix rotate
        if (rotate && typeof rotate === 'object') {
            rotate = new Vector(rotate).roundSelf(1);
        } else {
            rotate = new Vector(0, 0, 0);
        }
        // fix power
        if (typeof power === 'undefined' || power === null) {
            power = 100;
        }
        if (power <= 0) {
            return;
        }
        let update_vertices = true;
        let chunkManager = this.getChunkManager();

        //
        if (!is_modify) {
            let oldLight = 0;
            let material = BLOCK.BLOCK_BY_ID[item.id];
            let pos = new Vector(x, y, z);
            let tblock = this.tblocks.get(pos);

            if (this.chunkManager.use_light) {
                oldLight = tblock.lightSource;
            }

            this.tblocks.delete(pos);

            tblock.id = material.id;
            tblock.extra_data = extra_data;
            tblock.entity_id = entity_id;
            tblock.power = power;
            tblock.rotate = rotate;
            tblock.falling = !!material.gravity;
            update_vertices = true;
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
            this.fluid.syncBlockProps(tblock.index, item.id);
        }
        // Run webworker method
        if (update_vertices) {
            let set_block_list = [];
            set_block_list.push({
                pos: new Vector(x + this.coord.x, y + this.coord.y, z + this.coord.z),
                type: item,
                is_modify: is_modify,
                power: power,
                rotate: rotate,
                extra_data: extra_data
            });
            chunkManager.postWorkerMessage(['setBlock', set_block_list]);
        }
    }

    //
    newModifiers(mods_arr, set_block_list) {
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
            const power = ('power' in type) ? type.power : POWER_NO;
            if (extra_data) tblock.extra_data = extra_data;
            if (entity_id) tblock.entity_id = entity_id;
            if (rotate) tblock.rotate = rotate;
            if (power) tblock.power = power;
            //
            set_block_list.push({pos, type, power, rotate, extra_data, is_modify});
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