import { BLOCK, POWER_NO, DropItemVertices, FakeVertices } from "../blocks.js";
import { getChunkAddr, PerformanceTimer, Vector, VectorCollector } from "../helpers.js";
import { BlockNeighbours, TBlock, newTypedBlocks, DataWorld, MASK_VERTEX_MOD, MASK_VERTEX_PACK, TypedBlocks3 } from "../typed_blocks3.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import { AABB } from '../core/AABB.js';
import { Worker05GeometryPool } from "../light/Worker05GeometryPool.js";
import { WorkerInstanceBuffer } from "./WorkerInstanceBuffer.js";
import GeometryTerrain from "../geometry_terrain.js";
import { pushTransformed } from '../block_style/extruder.js';
import { decompressWorldModifyChunk } from "../compress/world_modify_chunk.js";
import {FluidWorld} from "../fluid/FluidWorld.js";
import {isFluidId, PACKED_CELL_LENGTH, PACKET_CELL_BIOME_ID, PACKET_CELL_DIRT_COLOR_G, PACKET_CELL_DIRT_COLOR_R, PACKET_CELL_WATER_COLOR_G, PACKET_CELL_WATER_COLOR_R} from "../fluid/FluidConst.js";

// Constants
const BLOCK_CACHE = Array.from({length: 6}, _ => new TBlock(null, new Vector(0,0,0)))

class MaterialBuf {
    [key: string]: any;

    constructor() {
        this.buf = null
        this.matId = null
    }

}

// ChunkManager
export class ChunkWorkerChunkManager {
    [key: string]: any;

    constructor(world) {
        this.world = world;
        this.destroyed = false;
        this.block_manager = BLOCK
        this.DUMMY = {
            id: BLOCK.DUMMY.id,
            shapes: [],
            properties: BLOCK.DUMMY,
            material: BLOCK.DUMMY,
            getProperties: function() {
                return this.properties;
            },
            canReplace: function() {
                return false;
            }
        };
        this.dataWorld = new DataWorld(this);
        this.fluidWorld = new FluidWorld(this);
        this.verticesPool = new Worker05GeometryPool(null, {});

        this.materialToId = new Map();
    }

    // For compatibility with the client API
    getWorld() {
        return this.world;
    }

    // Get
    getChunk(addr) {
        return this.world.chunks.get(addr);
    }

    // Возвращает блок по абсолютным координатам
    getBlock(x, y, z) {
        // определяем относительные координаты чанка
        const chunkAddr = getChunkAddr(x, y, z);
        // обращаемся к чанку
        const chunk = this.getChunk(chunkAddr);
        // если чанк найден
        if(chunk) {
            // просим вернуть блок передав абсолютные координаты
            return chunk.getBlock(x, y, z);
        }
        return this.DUMMY;
    }

}

// Chunk
export class ChunkWorkerChunk {
    [key: string]: any;

    /**
     * @param {ChunkWorkerChunkManager} chunkManager
     * @param {*} args
     */
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
        // 3D clusters
        this.cluster        = chunkManager.world.generator.clusterManager?.getForCoord(this.coord, chunkManager.world.generator.maps) ?? null;
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
        this.inited = false;
        this.buildVerticesInProgress = false;
        this.totalPages = 0;

        this.fluid = null;
        this.inQueue = false;
        this.queueDist = -1; // 0 and more means its in queue (build or gen
        this.genValue = 0;
    }

    init() {
        // Variables
        this.vertices_length    = 0;
        this.vertices           = new Map();
        this.dirty              = true;
        this.fluid_blocks       = [];
        this.gravity_blocks     = [];
        //
        this.timers             = new PerformanceTimer()
        // 1. Initialise world array
        this.timers.start('init')
        this.tblocks = newTypedBlocks(this.coord, this.size);
        this.timers.stop()
    }

    doGen() {
        this.tblocks.makeBedrockEdge();
        this.chunkManager.dataWorld.addChunk(this);

        // 2. Generate terrain
        this.timers.start('generate_terrain')
        this.map = this.chunkManager.world.generator.generate(this);
        this.timers.stop()

        // 3. Apply modify_list
        this.timers.start('apply_modify')
        this.applyModifyList();
        //TODO: mark neibs dirty in sync outer
        this.chunkManager.dataWorld.syncOuter(this);
        this.timers.stop()

        this.inited = true

        return {
            key:        this.key,
            addr:       this.addr,
            tblocks:    this.tblocks,
            map:        this.map
        }

    }

    packCells() {
        const {cells} = this.map;
        let len = cells.length;
        let packed = new Int16Array(PACKED_CELL_LENGTH * len);
        const eps = 1e-2;
        for (let i = 0; i < len; i++) {
            const cell = cells[i];
            packed[i * PACKED_CELL_LENGTH + PACKET_CELL_DIRT_COLOR_R] = Math.floor(cell.dirt_color.r + eps);
            packed[i * PACKED_CELL_LENGTH + PACKET_CELL_DIRT_COLOR_G] = Math.floor(cell.dirt_color.g + eps);
            packed[i * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_R] = Math.floor(cell.water_color.r + eps);
            packed[i * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_G] = Math.floor(cell.water_color.g + eps);
            packed[i * PACKED_CELL_LENGTH + PACKET_CELL_BIOME_ID] = Math.floor(cell.biome.id + eps);
        }
        return packed;
    }

    addTickingBlock(pos) {
        this.ticking_blocks.set(pos, pos);
    }

    deleteTickingBlock(pos) {
        this.ticking_blocks.delete(pos);
    }

    //
    applyModifyList() {
        let ml = this.modify_list;
        if(!ml) {
            return;
        }
        // uncompress
        if(ml.obj) {
            ml = ml.obj;
        } else if(ml.compressed) {
            // It's ok to not use ml.private_compressed here, because on the server
            // there is always ml.obj, and on the client there is no ml.private_compressed.
            ml = decompressWorldModifyChunk(Uint8Array.from(atob(ml.compressed), c => c.charCodeAt(0)));
        } else {
            ml = {};
        }
        this.modify_list = ml;
        //
        const pos = new Vector(0, 0, 0);
        const block_vec_index = new Vector(0, 0, 0);
        for(let index in ml) {
            const m = ml[index];
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
        this.modify_list = null;
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

    /**
     * Set block indirect
     * @param {int} x
     * @param {int} y
     * @param {int} z
     * @param {int} block_id
     * @param {*} rotate
     * @param {*} extra_data
     * @param {*} entity_id
     * @param {*} power
     * @param {boolean} check_is_solid - if true, it prevents replacing solid blocks
     * @param {boolean} destroy_fluid
     * @returns
     */
    setBlockIndirect(x, y, z, block_id, rotate, extra_data, entity_id, power, check_is_solid = false, destroy_fluid = false) {

        this.genValue++

        if(isFluidId(block_id)) {
            this.fluid.setFluidIndirect(x, y, z, block_id);
            return
        }

        if(destroy_fluid) {
            this.fluid.setFluidIndirect(x, y, z, 0)
        }

        const { cx, cy, cz, cw, uint16View } = this.tblocks.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;

        //
        if(check_is_solid && BLOCK.isSolidID(uint16View[index])) {
            return
        }

        if (uint16View[index] > 0) {
            this.tblocks.delete(TypedBlocks3._tmp.set(x, y, z))
        }

        uint16View[index] = block_id;
        if (rotate || extra_data) {
            this.tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data, entity_id, power);
        }

    }

    isWater(id) {
        return id == 200 || id == 202;
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
        const {vertices, vertExtraLen} = this.tblocks;
        const {cx, cy, cz, cw, uint16View} = this.tblocks.dataChunk;
        const {BLOCK_BY_ID} = BLOCK;
        const neibMat = ChunkWorkerChunk.neibMat;
        const cache = BLOCK_CACHE;

        const block = this.tblocks.get(new Vector(0, 0, 0), null, cw);

        const matBuf = new MaterialBuf()

        // Process drop item
        const processDropItem = (block, neightbours) => {

            const pos = block.pos;

            for(let material_key in block.vertice_groups) {
                // material.group, material_key
                if (!materialToId.has(material_key)) {
                    materialToId.set(material_key, materialToId.size);
                }

                const matId = materialToId.get(material_key);
                let buf = vertexBuffers.get(matId);
                if (!buf) {
                    vertexBuffers.set(matId, buf = new WorkerInstanceBuffer({
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

        /**
         * @param {string} material_key
         */
        const getMaterialBuf = (material_key) => {

            // material.group, material.material_key
            if (!materialToId.has(material_key)) {
                materialToId.set(material_key, materialToId.size);
            }
            const matId = materialToId.get(material_key);
            let buf = vertexBuffers.get(matId);
            if (!buf) {
                vertexBuffers.set(matId, buf = new WorkerInstanceBuffer({
                    material_key: material_key,
                    geometryPool: verticesPool,
                    chunkDataId: dataId
                }));
            }
            buf.touch()
            buf.skipCache(0)

            matBuf.buf = buf
            matBuf.matId = matId

            return matBuf

        }

        /**
         * @param {FakeVertices} fv
         */
        const processFakeVertices = (fv) => {
            const matBuf = getMaterialBuf(fv.material_key)
            matBuf.buf.vertices.push(...fv.vertices)
        }

        // Process block
        const processBlock = (block, neighbours, biome, dirt_color, matrix, pivot, useCache) => {

            const material = block.material;

            if(!material) {
                return
            }

            const matBuf = getMaterialBuf(material.material_key)

            const {buf, matId} = matBuf
            const last = buf.vertices.filled

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
            )

            if (useCache) {
                if (last === buf.vertices.filled) {
                    vertices[block.index * 2] = 0
                    vertices[block.index * 2 + 1] = 0
                } else {
                    let quads = buf.vertices.filled - last
                    if (quads >= 255) {
                        vertExtraLen.push(quads)
                        quads = 255
                    }
                    vertices[block.index * 2] = quads
                    vertices[block.index * 2 + 1] = matId
                }
            }

            return resp

        }

        // inline cycle
        // TODO: move it out later
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
                        if (BLOCK.isSolidID(id)
                            && BLOCK.isSolidID(neib0) && BLOCK.isSolidID(neib1)
                            && BLOCK.isSolidID(neib2) && BLOCK.isSolidID(neib3)
                            && BLOCK.isSolidID(neib4) && BLOCK.isSolidID(neib5)) {
                            empty = true;
                        } else {
                            // getNeighbours from typedBlocks
                            material = BLOCK_BY_ID[id];
                            let pcnt = 6;
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
                                if (!properties || properties.transparent) {
                                    pcnt--;
                                }
                            }
                            empty = pcnt === 6;
                        }
                    }

                    if (!material || material.item) {
                        // ???
                        if (this.emitted_blocks.has(block.index)) {
                            this.emitted_blocks.delete(block.index);
                        }
                    }

                    let cachedQuads = vertices[index * 2];
                    const cachedPack = vertices[index * 2 + 1] & MASK_VERTEX_PACK;
                    const useCache = enableCache && (vertices[index * 2 + 1] & MASK_VERTEX_MOD) === 0;

                    if (cachedQuads === 255) {
                        cachedQuads = vertExtraLen.shift() || 0;
                    }

                    if (useCache) {
                        if (cachedQuads > 0) {
                            const vb = vertexBuffers.get(cachedPack);
                            vb.touch();
                            vb.copyCache(cachedQuads);
                            if (cachedQuads >= 255) {
                                cachedQuads = vertExtraLen.push(cachedQuads) || 0;
                            }
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
                        eb.index = index
                        processDropItem(eb, fake_neighbours)
                    } else if (eb instanceof FakeVertices) {
                        processFakeVertices(eb)
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
        const removedEntries = ChunkWorkerChunk.removedEntries;

        this.totalPages = 0;
        for (let entry of this.vertexBuffers) {
            const vb = entry[1];
            if (vb.touched && (vb.vertices.filled + vb.cacheCopy > 0)) {
                vb.skipCache(0);
                serializedVertices[vb.material_key] = vb.getSerialized();
                vb.markClear();

                this.totalPages += vb.vertices.pages.length;
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
        this.chunkManager = null;
        this.destroyed = true;
        for (let entries of this.vertexBuffers) {
            entries[1].clear();
        }
    }

}
