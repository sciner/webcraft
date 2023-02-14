import { alea, Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from "../default.js";
import { IndexedColor } from "../../helpers.js";
import { createNoise2D } from '../../../vendors/simplex-noise.js';
import { ChunkWorkerChunk } from "../../worker/chunk.js";
import { NoiseFactory } from "./NoiseFactory.js";
import { ClusterManager } from "../cluster/manager.js";
import { GENERATOR_OPTIONS } from "./terrain/manager.js";
import { Biome3LayerManager } from "./layer_manager.js";

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

export const DEFAULT_CELL = {
    dirt_color: DEFAULT_DIRT_COLOR,
    water_color: DEFAULT_WATER_COLOR,
    biome: new Default_Terrain_Map_Cell({
    code: 'flat'
})};

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    /**
     * @param { import("../../worker/world.js").WorkerWorld } world 
     * @param { string } seed 
     * @param { string } world_id 
     * @param { object } options 
     */
    constructor(world, seed, world_id, options) {

        const al = new alea(seed)
        const noise2d = createNoise2D(al.double)

        super(seed, world_id, options, noise2d, null)

        this.world          = world
        this.tempAlea       = al
        this.block_manager  = BLOCK
        this.clusterManager = new ClusterManager(world, seed, 2)

    }

    async init() {

        const noiseFactory = new NoiseFactory();
        await super.init();
        await noiseFactory.init({outputSize: 32 * 32 * 48});
        this.noise3d = noiseFactory.createNoise3D({seed: this.seed, randomFunc: this.tempAlea.double });
        this.options = {...GENERATOR_OPTIONS, ...this.options};

        // this.n3d = createNoise3D(new alea(seed))

        this.layers = new Biome3LayerManager(this, [
            {type: 'overworld', bottom: 0, up: 5},
            {type: 'end', bottom: 6, up: 8}
        ])

    }

    /**
     * Generate
     * @param { ChunkWorkerChunk } chunk 
     * @returns 
     */
    generate(chunk) {

        this.noise3d.scoreCounter = 0

        const chunk_seed = this.seed + chunk.id
        const rnd = new alea(chunk_seed)
        const map = this.layers.generateChunk(chunk, chunk_seed, rnd)

        chunk.genValue = this.noise3d.scoreCounter

        return map

    }

    /**
     * @param { ChunkWorkerChunk } chunk 
     * @returns {Default_Terrain_Map}
     */
    generateDefaultMap(chunk) {
        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63},
            Array(chunk.size.x * chunk.size.z).fill(DEFAULT_CELL)
        )
    }

}