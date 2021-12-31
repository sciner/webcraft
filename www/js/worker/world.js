import {ChunkManager, Chunk} from "./chunk.js";
import { VectorCollector } from "../helpers.js";

// WorkerWorldManager
export class WorkerWorldManager {

    constructor() {
        this.list = new Map();
    }

    async InitTerrainGenerators(generator_codes) {
        // generator_codes = ['biome2', 'city', 'city2', 'flat'];
        let that = this;
        that.terrainGenerators = new Map();
        let all = [];
        // Load terrain generators
        for(let tg_code of generator_codes) {
            all.push(import('../terrain_generator/' + tg_code + '/index.js').then((module) => {
                that.terrainGenerators.set(tg_code, module.default);
            }));
        }
        await Promise.all(all);
    }

    async add(generator_code, seed, world_id) {
        let key = generator_code + '/' + seed;
        if(this.list.has(key)) {
            return this.list.get(key);
        }
        let generator = this.terrainGenerators.get(generator_code);
        generator = new generator(seed, world_id);
        await generator.init();
        let world = new WorkerWorld(generator);
        this.list.set(key, world);
        return world;
    }

}

// World
export class WorkerWorld {
    
    constructor(generator) {
        this.generator = generator;
        this.chunkManager = new ChunkManager(this);
        this.chunks = new VectorCollector();
    }

    createChunk(args) {
        if(this.chunks.has(args.addr)) {
            return this.chunks.get(args.addr);
        }
        let chunk = new Chunk(this.chunkManager, args);
        chunk.init();
        this.chunks.add(args.addr, chunk);
        return {
            key:        chunk.key,
            addr:       chunk.addr,
            tblocks:    chunk.tblocks,
            map:        chunk.map
        };
    }

    destructChunk(addr) {
        if(this.chunks.has(addr)) {
            this.chunks.delete(addr);
            this.generator.deleteMap(addr);
            return true;
        }
        return false;
    }

    getChunk(addr) {
        return this.chunks.get(addr) || null;
    }

}