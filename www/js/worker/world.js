import { ChunkManager, Chunk } from "./chunk.js";
import { VectorCollector } from "../helpers.js";

// WorkerWorldManager
export class WorkerWorldManager {

    constructor() {
        this.list = new Map();
    }

    async InitTerrainGenerators(generator_codes) {
        // generator_codes = ['biome2', 'city', 'city2', 'flat'];
        const that = this;
        that.terrainGenerators = new Map();
        const all = [];
        // Load terrain generators
        for(let tg_code of generator_codes) {
            all.push(import(`../terrain_generator/${tg_code}/index.js`).then(module => {
                that.terrainGenerators.set(tg_code, module.default);
            }));
        }
        await Promise.all(all);
    }

    async add(g, seed, world_id) {
        const generator_options = g?.options || {};
        const generator_id = g.id;
        const key = generator_id + '/' + seed;
        if(this.list.has(key)) {
            return this.list.get(key);
        }
        const world = new WorkerWorld();
        const generator_class = this.terrainGenerators.get(generator_id);
        await world.init(seed, world_id, generator_class, generator_options)
        this.list.set(key, world);
        return world;
    }

}

// World
export class WorkerWorld {

    constructor() {}

    async init(seed, world_id, generator_class, generator_options) {
        this.chunkManager = new ChunkManager(this);
        this.chunks = new VectorCollector();
        this.generator = new generator_class(this, seed, world_id, generator_options);
        await this.generator.init();
    }

    createChunk(args) {
        if(this.chunks.has(args.addr)) {
            return this.chunks.get(args.addr);
        }
        let chunk = new Chunk(this.chunkManager, args);
        chunk.init();
        this.chunks.add(args.addr, chunk);
        // console.log(`Actual chunks count: ${this.chunks.size}`);
        // Ticking blocks
        let ticking_blocks = [];
        for(let k of chunk.ticking_blocks.keys()) {
            ticking_blocks.push(k.toHash());
        }
        // Return chunk object
        return {
            key:            chunk.key,
            addr:           chunk.addr,
            tblocks:        chunk.tblocks,
            ticking_blocks: ticking_blocks,
            map:            chunk.map
        };
    }

    destructChunk(addr) {
        const chunk = this.chunks.get(addr);
        if(chunk) {
            this.chunks.delete(addr);
            this.generator.maps.delete(addr);
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

}