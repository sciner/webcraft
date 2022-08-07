import { BLOCK, POWER_NO, DropItemVertices } from "../blocks.js";
import { getChunkAddr, Vector, VectorCollector } from "../helpers.js";
import { BlockNeighbours, TBlock, newTypedBlocks, DataWorld, MASK_VERTEX_MOD, MASK_VERTEX_PACK } from "../typed_blocks3.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import { AABB } from '../core/AABB.js';
import { ClusterManager } from '../terrain_generator/cluster/manager.js';
import { Worker05GeometryPool } from "../light/Worker05GeometryPool.js";
import { WorkerInstanceBuffer } from "./WorkerInstanceBuffer.js";
import GeometryTerrain from "../geometry_terrain.js";
import { pushTransformed } from '../block_style/extruder.js';

// Constants
const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)));

// ChunkManager
export class ChunkManager {

    constructor(world) {
        this.world = world;
        this.clusterManager = new ClusterManager(this, world.generator.seed);
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            }
        };
        this.dataWorld = new DataWorld();
        this.verticesPool = new Worker05GeometryPool(null, {});

        this.materialToId = new Map();
    }

    // Get
    getChunk(addr) {
        return this.world.chunks.get(addr);
    }

    // Возвращает блок по абсолютным координатам
    getBlock(x, y, z) {
        // определяем относительные координаты чанка
        let chunkAddr = getChunkAddr(x, y, z);
        // обращаемся к чанку
        let chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(chunk) {
            // просим вернуть блок передав абсолютные координаты
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

}

// Chunk
export class Chunk {

    constructor(chunkManager, args) {
        this.chunkManager   = chunkManager;
        Object.assign(this, args);
        this.addr           = new Vector(this.addr.x, this.addr.y, this.addr.z);
        this.size           = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        this.coord          = new Vector(this.addr.x * CHUNK_SIZE_X, this.addr.y * CHUNK_SIZE_Y, this.addr.z * CHUNK_SIZE_Z);
        this.id             = this.addr.toHash();
        this.ticking_blocks = new VectorCollector();
        this.emitted_blocks = new Map();
        this.temp_vec       = new Vector(0, 0, 0);
        this.cluster        = chunkManager.clusterManager.getForCoord(this.coord);
        this.aabb           = new AABB();
        this.aabb.set(
            this.coord.x,
            this.coord.y,
            this.coord.z,
            this.coord.x + this.size.x,
            this.coord.y + this.size.y,
            this.coord.z + this.size.z
        );

        this.vertexBuffers = new Map();
        this.serializedVertices = null;
    }

    init() {
        // Variables
        this.vertices_length    = 0;
        this.vertices           = new Map();
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        this.timers             = {
            init:               null,
            generate_terrain:   null,
            apply_modify:       null,
            build_vertices:     null
        };
        // 1. Initialise world array
        this.timers.init = performance.now();

        this.tblocks = newTypedBlocks(this.coord, this.size);
        this.chunkManager.dataWorld.addChunk(this);
        //
        this.timers.init = Math.round((performance.now() - this.timers.init) * 1000) / 1000;
        // 2. Generate terrain
        this.timers.generate_terrain = performance.now();
        this.map = this.chunkManager.world.generator.generate(this);
        this.chunkManager.dataWorld.syncOuter(this);
        this.timers.generate_terrain = Math.round((performance.now() - this.timers.generate_terrain) * 1000) / 1000;
        // 3. Apply modify_list
        this.timers.apply_modify = performance.now();
        this.applyModifyList();
        this.timers.apply_modify = Math.round((performance.now() - this.timers.apply_modify) * 1000) / 1000;
        // 4. Result
        return {
            key:        this.key,
            addr:       this.addr,
            tblocks:    this.tblocks,
            map:        this.map
        };
    }

    addTickingBlock(pos) {
        this.ticking_blocks.set(pos, pos);
    }

    deleteTickingBlock(pos) {
        this.ticking_blocks.delete(pos);
    }

    //
    applyModifyList() {
        if(!this.modify_list) {
            return;
        }
        const pos = new Vector(0, 0, 0);
        const block_vec_index = new Vector(0, 0, 0);
        for(let index in this.modify_list) {
            const m = this.modify_list[index];
            if(!m) continue;
            pos.fromFlatChunkIndex(index);
            if(m.id < 1) {
                BLOCK.getBlockIndex(pos, null, null, block_vec_index);
                this.tblocks.delete(block_vec_index);
                continue;
            }
            // setBlock
            this.setBlockIndirect(pos.x, pos.y, pos.z, m.id, m.rotate, m.extra_data);
            this.emitted_blocks.delete(index);

        }
        this.modify_list = [];
    }

    // Get the type of the block at the specified position.
    // Mostly for neatness, since accessing the array
    // directly is easier and faster.
    getBlock(ox, oy, oz) {
        let x = ox - this.coord.x;
        let y = oy - this.coord.y;
        let z = oz - this.coord.z;
        if(x < 0 || y < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return world.chunkManager.DUMMY;
        };
        if(z < 0 || z >= this.size.y) {
            return world.chunkManager.DUMMY;
        }
        let block = null;
        try {
            // block = this.blocks[x][z][y];
            block = this.tblocks.get(new Vector(x, y, z));
        } catch(e) {
            console.error(e);
            console.log(x, y, z);
            debugger;
        }
        if(block == null) {
            return BLOCK.AIR;
        }
        return block || world.chunkManager.DUMMY;
    }

    // setBlock
    setBlock(x, y, z, orig_type, is_modify, power, rotate, entity_id, extra_data) {
        //TODO: take liquid into account
        // fix rotate
        if(rotate && typeof rotate === 'object') {
            rotate = new Vector(rotate).roundSelf(1);
        } else {
            rotate = null;
        }
        // fix power
        if(typeof power === 'undefined' || power === null) {
            power = POWER_NO;
        }
        if(power === 0) {
            power = null;
        }
        this.temp_vec.set(x, y, z);
        //
        if(is_modify) {
            const modify_item = {
                id:     orig_type.id,
                power:  power,
                rotate: rotate
            };
            this.modify_list[this.temp_vec.getFlatIndexInChunk()] = modify_item;
        }
        BLOCK.getBlockIndex(this.temp_vec, null, null, this.temp_vec);
        x = this.temp_vec.x;
        y = this.temp_vec.y;
        z = this.temp_vec.z;
        if(x < 0 || y < 0 || z < 0 || x > this.size.x - 1 || y > this.size.y - 1 || z > this.size.z - 1) {
            return;
        }
        const block        = this.tblocks.get(this.temp_vec);
        block.id         = orig_type.id;
        block.power      = power;
        block.rotate     = rotate;
        block.entity_id  = entity_id;
        block.texture    = null;
        block.extra_data = extra_data;
        this.emitted_blocks.delete(block.index);
    }

    // Return block ID
    getBlockID(x, y, z) {
        const { cx, cy, cz, cw, uint16View } = this.tblocks.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return uint16View[index];
    }

    // Set block indirect
    setBlockIndirect(x, y, z, block_id, rotate, extra_data) {
        const { cx, cy, cz, cw, uint16View } = this.tblocks.dataChunk;
        const { liquid } = this.tblocks;
        const index = cx * x + cy * y + cz * z + cw;
        if (this.isLiquid(block_id)) {
            uint16View[index] = block_id;
            liquid[index] = 0;
        } else {
            uint16View[index] = 0;
            liquid[index] = block_id;
        }
        if (rotate || extra_data) {
            this.tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
        }
    }

    isFilled(id) {
        return (id >= 2 && id <= 3) ||
            id == 9 || id == 56 || id == 73 ||
            (id >= 14 && id <= 16) ||
            (id >= 545 && id <= 550);
    }

    isWater(id) {
        return id == 200 || id == 202;
    }

    isLiquid(id) {
        return id == 200 || id == 202 || id == 170 || id == 171;
    }

    static neibMat = [null, null, null, null, null, null];
    static removedEntries = [];

    // buildVertices
    buildVertices({ enableCache }) {
        if (!this.dirty || !this.tblocks || !this.coord) {
            return false;
        }

        // Create map of lowest blocks that are still lit
        let tm = performance.now();

        if (this.tblocks.ensureVertices()) {
            enableCache = false;
        }

        const {materialToId, verticesPool} = this.chunkManager;
        const {dataId, size, vertexBuffers} = this;
        const {vertices} = this.tblocks;
        const {cx, cy, cz, cw, uint16View} = this.tblocks.dataChunk;
        const {BLOCK_BY_ID} = BLOCK;
        const neibMat = Chunk.neibMat;
        const cache = BLOCK_CACHE;

        const block = this.tblocks.get(new Vector(0, 0, 0), null, cw);

        // Process drop item
        const processDropItem = (block, neightbours) => {

            const pos = block.pos;

            for(let material_key in block.vertice_groups) {

                const tmp = material_key.split('/');
                const material_group = tmp[1];

                // material.group, material_key
                if (!materialToId.has(material_key)) {
                    materialToId.set(material_key, materialToId.size);
                }

                const matId = materialToId.get(material_key);
                let buf = vertexBuffers.get(matId);
                if (!buf) {
                    vertexBuffers.set(matId, buf = new WorkerInstanceBuffer({
                        material_group: material_group,
                        material_key: material_key,
                        geometryPool: verticesPool,
                        chunkDataId: dataId
                    }));
                }
                buf.touch();
                buf.skipCache(0);

                // Push vertices
                const vertices = block.vertice_groups[material_key];
                const zeroVector = [0, 0, 0];
                for(let i = 0; i < vertices.length; i += GeometryTerrain.strideFloats) {
                    pushTransformed(buf.vertices, block.matrix, zeroVector,
                        pos.x + 0.5, pos.z + 0.5, pos.y + 0.5,
                        vertices[i] + 0,
                        vertices[i + 1] + 1.5,
                        vertices[i + 2] + 0,
                        ...vertices.slice(i + 3, i + GeometryTerrain.strideFloats));
                }
            }

            return null;

        }

        // Process block
        const processBlock = (block, neighbours, biome, dirt_color, matrix, pivot, useCache) => {
            const material = block.material;

            // material.group, material.material_key
            if (!materialToId.has(material.material_key)) {
                materialToId.set(material.material_key, materialToId.size);
            }
            const matId = materialToId.get(material.material_key);
            let buf = vertexBuffers.get(matId);
            if (!buf) {
                vertexBuffers.set(matId, buf = new WorkerInstanceBuffer({
                    material_group: material.group,
                    material_key: material.material_key,
                    geometryPool: verticesPool,
                    chunkDataId: dataId
                }));
            }
            buf.touch();
            buf.skipCache(0);

            const last = buf.vertices.filled;

            const resp = material.resource_pack.pushVertices(
                buf.vertices,
                block, // UNSAFE! If you need unique block, use clone
                this,
                block.pos,
                neighbours,
                biome,
                dirt_color,
                undefined,
                undefined,
                matrix,
                pivot,
            );

            if (useCache) {
                if (last === buf.vertices.filled) {
                    vertices[block.index * 2] = 0;
                    vertices[block.index * 2 + 1] = 0;
                } else {
                    vertices[block.index * 2] = buf.vertices.filled - last;
                    vertices[block.index * 2 + 1] = matId;
                }
            }

            return resp;
        }

        // inline cycle
        //TODO: move it out later
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x = 0; x < size.x; x++) {
                    block.vec.set(x, y, z);
                    const index = block.index = cx * x + cy * y + cz * z + cw;
                    const id = uint16View[index];

                    let material = null;
                    let empty = false;
                    if (!id) {
                        empty = true;
                    } else {
                        const neib0 = uint16View[index + cy], neib1 = uint16View[index - cy],
                            neib2 = uint16View[index - cz], neib3 = uint16View[index + cz],
                            neib4 = uint16View[index + cx], neib5 = uint16View[index - cx];
                        // blockIsClosed from typedBlocks
                        if ((this.isFilled(id) || this.isWater(id))
                            && this.isFilled(neib0) && this.isFilled(neib1)
                            && this.isFilled(neib2) && this.isFilled(neib3)
                            && this.isFilled(neib4) && this.isFilled(neib5)) {
                            empty = true;
                        } else {
                            // getNeighbours from typedBlocks
                            material = BLOCK_BY_ID[id];
                            let pcnt = 6, waterCount = material && material.is_water ? 1 : 0;
                            // inlining neighbours
                            // direction of CC from TypedBlocks
                            neibMat[0] = BLOCK_BY_ID[neib0];
                            neibMat[1] = BLOCK_BY_ID[neib1];
                            neibMat[2] = BLOCK_BY_ID[neib2];
                            neibMat[3] = BLOCK_BY_ID[neib3];
                            neibMat[4] = BLOCK_BY_ID[neib4];
                            neibMat[5] = BLOCK_BY_ID[neib5];
                            for (let i = 0; i < 6; i++) {
                                const properties = neibMat[i];
                                if (!properties || properties.transparent || properties.fluid) {
                                    pcnt--;
                                }
                                if (waterCount > 0 && properties && properties.is_water) {
                                    waterCount++;
                                }
                            }
                            empty = pcnt === 6 || waterCount === 7;
                        }
                    }

                    if (!material || material.item) {
                        // ???
                        if (this.emitted_blocks.has(block.index)) {
                            this.emitted_blocks.delete(block.index);
                        }
                    }

                    const cachedQuads = vertices[index * 2];
                    const cachedPack = vertices[index * 2 + 1] & MASK_VERTEX_PACK;
                    const useCache = enableCache && (vertices[index * 2 + 1] & MASK_VERTEX_MOD) === 0;
                    if (useCache) {
                        if (cachedQuads > 0) {
                            const vb = vertexBuffers.get(cachedPack);
                            vb.touch();
                            vb.copyCache(cachedQuads);
                        }
                        continue;
                    }
                    if (cachedQuads > 0) {
                        vertexBuffers.get(cachedPack).skipCache(cachedQuads);
                    }
                    if (empty) {
                        vertices[index * 2] = 0;
                        vertices[index * 2 + 1] = 0;
                        continue;
                    }
                    const neighbours = block.getNeighbours(world, cache);
                    const cell = this.map.cells[block.pos.z * CHUNK_SIZE_X + block.pos.x];
                    const resp = processBlock(block, neighbours,
                        cell.biome, cell.dirt_color,
                        undefined, undefined,
                        true);

                    if (Array.isArray(resp)) {
                        this.emitted_blocks.set(block.index, resp);
                    } else if (this.emitted_blocks.size > 0) {
                        this.emitted_blocks.delete(block.index);
                    }
                }

        // Emmited blocks
        if (this.emitted_blocks.size > 0) {
            const fake_neighbours = new BlockNeighbours();
            for (let [index, eblocks] of this.emitted_blocks) {
                for (let eb of eblocks) {
                    if(eb instanceof DropItemVertices) {
                        eb.index = index;
                        processDropItem(eb, fake_neighbours);
                    } else {
                        processBlock(eb, fake_neighbours,
                            eb.biome, eb.dirt_color,
                            eb.matrix, eb.pivot,
                            false);
                    }
                }
            }
        }

        const serializedVertices = this.serializedVertices = {}
        const removedEntries = Chunk.removedEntries;

        for (let entry of this.vertexBuffers) {
            const vb = entry[1];
            if (vb.touched && (vb.vertices.filled + vb.cacheCopy > 0)) {
                vb.skipCache(0);
                serializedVertices[vb.material_key] = vb.getSerialized();
                vb.markClear();
            } else {
                removedEntries.push(entry[0]);
            }
        }

        for (let i = 0; i < removedEntries.length; i++) {
            this.vertexBuffers.delete(removedEntries[i]);
        }
        removedEntries.length = 0;

        this.dirty = false;
        this.tm = performance.now() - tm;
        return true;

    }

    // setDirtyBlocks
    // Вызывается, когда какой нибудь блок уничтожили (вокруг него все блоки делаем испорченными)
    setDirtyBlocks(pos) {
        this.tblocks.setDirtyBlocks(pos.x, pos.y, pos.z);
    }

    destroy() {
        this.chunkManager.dataWorld.removeChunk(this);
        for (let entries of this.vertexBuffers) {
            entries[1].clear();
        }
    }

}
