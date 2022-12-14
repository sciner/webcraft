import { Vector } from "./helpers.js";
import {newTypedBlocks} from "./typed_blocks3.js";
import {Sphere} from "./frustum.js";
import {BLOCK, POWER_NO} from "./blocks.js";
import {AABB} from './core/AABB.js';
import {CubeTexturePool} from "./light/CubeTexturePool.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./chunk_const.js";
import {fluidLightPower, FLUID_TYPE_MASK} from "./fluid/FluidConst.js";

let global_uniqId = 0;

// Creates a new chunk
export class Chunk {

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

        // Light
        this.lightTex = null;
        this.lightData = null;
        this.lightMats = new Map();
        this._tempLightSource = null;

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

        this._dataTextureOffset = 0;
        this._dataTexture = null;
        this._dataTextureDirty = false;
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
        this.tblocks = newTypedBlocks(this.coord, this.size);
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
        this.initLights();
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

    onLightGenerated(args) {
        const chunkManager = this.getChunkManager();
        const lp = chunkManager.lightProps;
        const arrClass = lp.texFormat === 'rgb565unorm' || lp.texFormat === 'rgba4unorm'
            ? Uint16Array : Uint8Array;
        this.lightData = args.lightmap_buffer ? new arrClass(args.lightmap_buffer) : null;
        this.tblocks.lightData = this.lightData;
        if (this.lightTex !== null) {
            this.lightTex.update(this.lightData)
        }
    }

    genLightSourceBuf() {
        const {size} = this;
        const sz = size.x * size.y * size.z;
        const light_source = new Uint8Array(sz);

        let ind = 0;
        let prev_block_id = Infinity, prev_fluid = Infinity;
        let light_power_number = 0;
        let block_material = null;

        const {cx, cy, cz, cw} = this.dataChunk;
        const {id} = this.tblocks;
        const fluid = this.fluid.uint16View;

        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    const index = cx * x + cy * y + cz * z + cw;
                    const block_id = id[index];
                    const fluid_type = fluid[index] & FLUID_TYPE_MASK;
                    if (block_id !== prev_block_id || fluid_type !== prev_fluid) {
                        block_material = BLOCK.BLOCK_BY_ID[block_id]
                        if (block_material) {
                            light_power_number = block_material.light_power_number;
                        } else {
                            console.error(`Block not found ${block_id}`);
                        }
                        if (fluid_type > 0) {
                            light_power_number |= fluidLightPower(fluid_type);
                        }

                        prev_block_id = block_id;
                        prev_fluid = fluid_type;
                    }

                    // dynamic light
                    if (block_material && block_material.is_dynamic_light) {
                        const tblock = this.getBlock(this.coord.x + x, this.coord.y + y, this.coord.z + z);
                        if (tblock) {
                            light_power_number = tblock.lightSource;
                        }
                    }

                    light_source[ind++] = light_power_number;
                }
        return light_source;
    }

    initLights() {
        if (!this.chunkManager.use_light) {
            return false;
        }
        this.getChunkManager().postLightWorkerMessage(['createChunk',
            {
                addr: this.addr,
                size: this.size,
                uniqId: this.uniqId,
                light_buffer: this.genLightSourceBuf().buffer,
                dataId: this.getDataTextureOffset()
            }]);
    }

    getLightTexture(render) {
        const cm = this.getChunkManager();
        if (!this.lightData || !cm) {
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

        if (!this.lightTex) {
            const lightTex = this.lightTex = cm.lightPool.alloc({
                width: this.size.x + 2,
                height: this.size.z + 2,
                depth: (this.size.y + 2) * lightProps.depthMul,
                type: lightProps.texFormat,
                filter: 'linear',
                data: this.lightData
            })
            this._dataTextureDirty = true;
        }

        return this.lightTex;
    }

    getDataTextureOffset() {
        if (!this._dataTexture) {
            const cm = this.getChunkManager();
            cm.chunkDataTexture.add(this);
        }

        return this._dataTextureOffset;
    }

    prepareRender(render) {
        if (!render) {
            return;
        }
        //TODO: if dist < 100?
        this.getLightTexture(render);

        if (!this._dataTexture) {
            const cm = this.getChunkManager();
            cm.chunkDataTexture.add(this);
        }

        if (this._dataTextureDirty) {
            this._dataTexture.writeChunkData(this);
        }
    }

    drawBufferVertices(render, resource_pack, group, mat, vertices) {
        const v = vertices, key = v.key;
        let texMat = resource_pack.materials.get(key);
        if (!texMat) {
            texMat = mat.getSubMat(resource_pack.getTexture(v.texture_id).texture);
            resource_pack.materials.set(key, texMat);
        }
        mat = texMat;
        let dist = Qubatch.player.lerpPos.distance(this.coord);
        render.batch.setObjectDrawer(render.chunk);
        if (this.lightData && dist < 108) {
            // in case light of chunk is SPECIAL
            this.getLightTexture(render);
            if (this.lightTex) {
                const base = this.lightTex.baseTexture || this.lightTex;
                if (base._poolLocation <= 0) {
                    mat = this.lightMats.get(key);
                    if (!mat) {
                        mat = texMat.getLightMat(this.lightTex);
                        this.lightMats.set(key, mat);
                    }
                }
            }
        }
        render.chunk.draw(v.buffer, mat, this);
        return true;
    }

    applyVertices(inputId, bufferPool, argsVertices) {
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
        this.timers = args.timers;
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
        this.chunkManager = null;
        if (this._dataTexture) {
            this._dataTexture.remove(this);
        }
        chunkManager.dataWorld.removeChunk(this);
        // destroy buffers
        for (let [_, v] of this.vertices) {
            if (v.buffer) {
                v.buffer.destroy();
            }
        }
        const {lightTex} = this;
        if (lightTex) {
            chunkManager.lightPool.dealloc(lightTex);
        }
        this.lightTex = null;
        // run webworker method
        chunkManager.destruct_chunks_queue.add(this.addr);
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
            offsets: [this.getDataTextureOffset()]
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
    updateInFrustum(render) {
        if (!this.frustum_geometry) {
            this.frustum_geometry = Chunk.createFrustumGeometry(this.coord, this.size);
        }
        this.in_frustum = render.frustum.intersectsGeometryArray(this.frustum_geometry);
        return this.in_frustum;
    }

    //
    static createFrustumGeometry(coord, size) {
        let frustum_geometry = [];
        let box_radius = size.x;
        let sphere_radius = (Math.sqrt(3) * box_radius / 2) * 1.05;
        frustum_geometry.push(new Sphere(coord.add(new Vector(size.x / 2, size.y / 4, size.z / 2)), sphere_radius));
        frustum_geometry.push(new Sphere(coord.add(new Vector(size.x / 2, size.y - size.y / 4, size.z / 2)), sphere_radius));
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

    beginLightChanges() {
        if (!this.chunkManager.use_light) {
            return;
        }
        this._tempLightSource = this.genLightSourceBuf();
    }

    endLightChanges() {
        if (!this.chunkManager.use_light) {
            return;
        }
        const oldBuf = this._tempLightSource;
        this._tempLightSource = null;
        const newBuf = this.genLightSourceBuf();

        const {size} = this;
        let diff = [];
        let ind = 0;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    if (oldBuf[ind] !== newBuf[ind]) {
                        diff.push(x, y, z, newBuf[ind]);
                    }
                    ind++;
                }
        this.chunkManager.postLightWorkerMessage(['setChunkBlock', {
            addr: this.addr,
            dataId: this.getDataTextureOffset(),
            list: diff
        }]);
    }

    setFluid(buf) {
        if (this.inited) {
            this.fluid.markDirtyMesh();
            this.beginLightChanges();
            this.fluid.loadDbBuffer(buf, false);
            this.endLightChanges();
            this.chunkManager.dataWorld.syncOuter(this);
        } else {
            this.fluid_buf = buf;
        }
    }

    setFluidDelta(buf) {
        if (this.inited) {
            this.beginLightChanges();
            //TODO: make it diff!
            this.fluid.applyDelta(buf, true);
            this.endLightChanges();
        } else {
            this.fluid_deltas.push(buf);
        }
    }
}