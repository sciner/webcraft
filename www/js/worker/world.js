import { ChunkWorkerChunkManager, Chunk } from "./chunk.js";
import { VectorCollector } from "../helpers.js";
import {ChunkWorkQueue} from "./ChunkWorkQueue.js";

// WorkerWorldManager
export class WorkerWorldManager {

    constructor() {
        this.all = new Map();
        this.list = [];
        this.curIndex = 0;
    }

    async InitTerrainGenerators(generator_codes) {
        // generator_codes = ['biome2', 'city', 'city2', 'flat'];
        const that = this;
        that.terrainGenerators = new Map();
        const genPromises = [];
        // Load terrain generators
        for(let tg_code of generator_codes) {
            genPromises.push(import(`../terrain_generator/${tg_code}/index.js`).then(module => {
                that.terrainGenerators.set(tg_code, module.default);
            }));
        }
        await Promise.all(genPromises);
    }

    async add(g, seed, world_id) {
        const generator_options = g?.options || {};
        const generator_id = g.id;
        const key = generator_id + '/' + seed;
        if(this.all.has(key)) {
            return this.all.get(key);
        }
        const world = new WorkerWorld();
        const generator_class = this.terrainGenerators.get(generator_id);
        await world.init(seed, world_id, generator_class, generator_options)
        this.all.set(key, world);
        this.list.push(world);
        return world;
    }

    process({maxMs = 20}) {
        const {list} = this;
        let ind = this.curIndex;
        let looped = 0;
        let start = performance.now();
        let passed = 0;

        if (list.length === 0) {
            return;
        }

        while (passed < maxMs && looped < list.length) {
            let world = list[ind];
            if (world.process({maxMs: maxMs - passed}) > 1) {
                looped = 0;
            } else {
                looped++;
            }
            ind = (ind + 1) % list.length;
            passed = performance.now() - start;
        }
        this.curIndex = ind;
    }
}

// World
export class WorkerWorld {

    constructor() {
        this.chunks = new VectorCollector();
        this.genQueue = new ChunkWorkQueue(this);
        this.buildQueue = null;
        this.chunkManager = new ChunkWorkerChunkManager(this);
        this.generator = null;
        this.activePotentialCenter = null;
    }

    async init(seed, world_id, generator_class, generator_options) {
        this.generator = new generator_class(this, seed, world_id, generator_options);
        await this.generator.init();
    }

    ensureBuildQueue() {
        if (this.buildQueue) {
            return;
        }
        this.buildQueue = new ChunkWorkQueue(this);
        for (let chunk of this.chunks.values()) {
            if (chunk.inited) {
                chunk.buildVerticesInProgress = true;
                this.buildQueue.push(chunk);
            }
        }
    }

    createChunk(args) {
        if(this.chunks.has(args.addr)) {
            return this.chunks.get(args.addr);
        }
        let chunk = new Chunk(this.chunkManager, args);
        this.chunks.add(args.addr, chunk);
        chunk.init();
        this.genQueue.push(chunk);
        // console.log(`Actual chunks count: ${this.chunks.size}`);
    }

    destructChunk(props) {
        const {addr, uniqId} = props;
        const chunk = this.chunks.get(addr);
        if(chunk && chunk.uniqId === uniqId) {
            this.chunks.delete(addr);
            if(chunk.layer) {
                chunk.layer.maps.delete(addr);
            } else {
                this.generator.maps?.delete(addr);
            }
            chunk.destroy();
            return true;
        }
        return false;
    }

    getChunk(addr) {
        return this.chunks.get(addr) || null;
    }

    // Return generator options
    getGeneratorOptions(key, default_value) {
        const generator_options = this.generator.options;
        if(generator_options) {
            if(key in generator_options) {
                return generator_options[key];
            }
        }
        return default_value;
    }

    checkPotential(npc) {
        // potential was changed, reorder everything
        this.activePotentialCenter = npc;
        this.buildQueue.potentialCenter = npc;
        this.genQueue.potentialCenter = npc;

        this.buildQueue.needSort = true;
        this.genQueue.needSort = true;
    }

    process({maxMs = 20, genPerIter = 16 * 16 * 40 * 2, buildPerIter = 40}) {
        const {buildQueue, genQueue} = this;
        genQueue.relaxEntries();
        const start = performance.now();
        const buildResults = [];

        let loops = 0;
        let totalTimes = 0, totalPages = 0, minGenDist = 10000, minBuildDist = 10000;
        while (performance.now() - start < maxMs && (buildQueue ? buildQueue.size() : 0) + genQueue.size() > 0)
        {
            loops++;
            let times = 0;
            while (times < genPerIter) {
                const chunk = genQueue.pop();
                if (!chunk) {
                    break;
                }

                chunk.doGen();
                times += chunk.genValue || genPerIter;
                minGenDist = Math.min(minGenDist, chunk.queueDist);
                // Ticking blocks
                let ticking_blocks = [];
                for(let k of chunk.ticking_blocks.keys()) {
                    ticking_blocks.push(k.toHash());
                }

                if (buildQueue) {
                    buildQueue.push(chunk);
                    chunk.buildVerticesInProgress = true;
                }

                // Return chunk object
                const ci = {
                    key:            chunk.key,
                    addr:           chunk.addr,
                    tblocks:        chunk.tblocks,
                    ticking_blocks: ticking_blocks,
                    map:            chunk.map
                };

                const non_zero = ci.tblocks.refreshNonZero();
                const ci2 = {
                    addr: ci.addr,
                    uniqId: chunk.uniqId,
                    // key: ci.key,
                    tblocks: non_zero > 0 ? ci.tblocks.saveState() : null,
                    ticking_blocks: ci.ticking_blocks,
                    packedCells: chunk.packCells(),
                    genQueueSize: genQueue.size()
                }

                globalThis.worker.postMessage(['blocks_generated', ci2]);
            }

            totalTimes += times;

            if (!buildQueue) {
                continue;
            }

            buildQueue.relaxEntries();

            let pages = 0;
            while (pages < buildPerIter) {
                const chunk = buildQueue.pop();
                if (!chunk) {
                    break;
                }
                minBuildDist = Math.min(minBuildDist, chunk.queueDist);
                chunk.buildVerticesInProgress = false;
                const CHUNK_SIZE_X = chunk.size.x;
                const item = buildVertices(chunk, false);
                pages += chunk.totalPages + 4; // 4 is const for build value generation
                if(item) {
                    item.dirt_colors = new Float32Array(chunk.size.x * chunk.size.z * 2);
                    let index = 0;
                    for(let z = 0; z < chunk.size.z; z++) {
                        for(let x = 0; x < chunk.size.x; x++) {
                            item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X + x].dirt_color.r;
                            item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X + x].dirt_color.g;
                        }
                    }
                    buildResults.push(item);
                    chunk.vertices = null;
                }
            }

            totalPages += pages;
        }
        // if (totalPages + totalTimes > 0) {
            // console.log(`Worker Iter gen=${totalTimes} buildPages=${totalPages}, genMin = ${minGenDist}, buildMin=${minBuildDist}`);
        // }

        if (buildResults.length > 0) {
            worker.postMessage(['vertices_generated', buildResults]);
        }
        if (genQueue.size() === 0) {
            if (!genQueue.hitZero) {
                genQueue.hitZero = true;
            } else {
                worker.postMessage(['gen_queue_size', {genQueueSize: 0}]);
            }
        }
        return loops;
    }
}

const buildSettings = {
    enableCache : true,
}

function buildVertices(chunk, return_map) {
    let prev_dirty = chunk.dirty;
    chunk.timers.start('build_vertices')
    chunk.dirty = true;
    let is_builded = chunk.buildVertices(buildSettings);
    if(!is_builded) {
        chunk.dirty = prev_dirty;
        return null;
    }
    chunk.timers.stop()
    let resp = {
        key:                    chunk.key,
        addr:                   chunk.addr,
        vertices:               chunk.serializedVertices,
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
    };
    if(return_map) {
        resp.map = chunk.map;
    }
    return resp;
}