import { Vector } from "./helpers.js";
import {newTypedBlocks} from "./typed_blocks3.js";
import type { TypedBlocks3 } from "./typed_blocks3.js";
import {Sphere} from "./frustum.js";
import {BLOCK, DBItemBlock, POWER_NO} from "./blocks.js";
import {AABB} from './core/AABB.js';
import {CubeTexturePool} from "./light/CubeTexturePool.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk_const.js";
import {ChunkLight} from "./light/ChunkLight.js";
import type { BaseResourcePack } from "./base_resource_pack.js";
import type { Renderer } from "./render.js";
import type BaseRenderer from "./renders/BaseRenderer.js";

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
    instanceCount?: number
    resource_pack_id?: string
    material_group?: string
    texture_id?: string
    key?: string
    material_shader?: string,
    inputId?: number
    buffer?: any
    customFlag?: boolean
    rpl?: any
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

    getChunkManager() {
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
        this.in_frustum = false; // в данный момент отрисован на экране
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
    }

    // onBlocksGenerated ... Webworker callback method
    onBlocksGenerated(args) {
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
        this.inited = true;
        chunkManager.state.generated.count++
        this.light.init();
    }

    // onVerticesGenerated ... Webworker callback method
    onVerticesGenerated(args) {
        this.vertices_args = args;
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
        const {lightProps} = cm;
        if (!cm.lightPool) {
            cm.lightPool = new CubeTexturePool(render, {
                defWidth: CHUNK_SIZE_X + 2,
                defHeight: CHUNK_SIZE_Z + 2,
                defDepth: (CHUNK_SIZE_Y + 2) * lightProps.depthMul,
                type: lightProps.texFormat,
                filter: 'linear',
            });
        }

        if (!this.light.lightTex) {
            this.light.lightTex = cm.lightPool.alloc({
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

    drawBufferVertices(render : any, resource_pack : BaseResourcePack, group, mat, vertices) {
        const v = vertices, key = v.key;
        let texMat = resource_pack.materials.get(key);
        if (!texMat) {
            texMat = mat.getSubMat(resource_pack.getTexture(v.texture_id).texture);
            resource_pack.materials.set(key, texMat);
        }
        mat = texMat;
        let dist = Qubatch.player.lerpPos.distance(this.coord);
        render.batch.setObjectDrawer(render.chunk);
        if (this.light.lightData && dist < 108) {
            // in case light of chunk is SPECIAL
            this.getLightTexture(render);
            if (this.light.lightTex) {
                const base = this.light.lightTex.baseTexture || this.light.lightTex;
                if (base._poolLocation <= 0) {
                    mat = this.lightMats.get(key);
                    if (!mat) {
                        mat = texMat.getLightMat(this.light.lightTex);
                        this.lightMats.set(key, mat);
                    }
                }
            }
        }
        render.chunk.draw(v.buffer, mat, this);
        return true;
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
            if (v.list.length > 1) {
                let temp = key.split('/');
                let lastBuffer = this.vertices.get(key);
                if (lastBuffer) {
                    lastBuffer = lastBuffer.buffer
                }
                v.instanceCount = v.list[0];
                v.resource_pack_id = temp[0];
                v.material_group = temp[1];
                v.material_shader = temp[2];
                v.texture_id = temp[3];
                v.key = key;
                v.buffer = bufferPool.alloc({
                    lastBuffer,
                    vertices: v.list,
                    chunkId: chunkLightId
                });
                if (lastBuffer && v.buffer !== lastBuffer) {
                    lastBuffer.destroy();
                }
                v.inputId = inputId;
                v.customFlag = false;
                v.rpl = null;
                this.vertices.set(key, v);
                this.verticesList.push(v);
                delete (v.list);
            }
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
        let chunkManager = this.getChunkManager();
        const args = this.vertices_args;
        delete (this['vertices_args']);
        this.need_apply_vertices = false;
        this.buildVerticesInProgress = false;
        this.timers = args.timers
        chunkManager.state.generated.time += this.timers.generate_terrain
        this.gravity_blocks = args.gravity_blocks;
        this.applyVertices('worker', chunkManager.bufferPool, args.vertices);
        this.dirty = false;
    }

    // Destruct chunk
    destruct() {
        const chunkManager = this.getChunkManager();
        if (!chunkManager) {
            return;
        }
        // remove from stat
        if(this.timers) {
            chunkManager.state.generated.time -= this.timers.generate_terrain
        }
        chunkManager.state.generated.count--
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
            chunkManager.lightPool.dealloc(lightTex);
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
    updateInFrustum(render : Renderer) : boolean {
        if (!this.frustum_geometry) {
            this.frustum_geometry = Chunk.createFrustumGeometry(this.coord, this.size);
        }
        this.in_frustum = render.frustum.intersectsGeometryArray(this.frustum_geometry);
        return this.in_frustum;
    }

    //
    static createFrustumGeometry(coord : Vector, size : Vector) {
        let frustum_geometry = [];
        let box_radius = size.x;
        let sphere_radius = (Math.sqrt(3) * box_radius / 2) * 1.05;
        frustum_geometry.push(new Sphere(coord.clone().addScalarSelf(size.x / 2, size.y / 4, size.z / 2), sphere_radius))
        frustum_geometry.push(new Sphere(coord.clone().addScalarSelf(size.x / 2, size.y - size.y / 4, size.z / 2), sphere_radius))
        return frustum_geometry;
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