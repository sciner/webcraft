import { alea, Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from "../default.js";
// import { IndexedColor } from "../../helpers.js";
import { createNoise2D } from '../../../vendors/simplex-noise.js';
import { NoiseFactory } from "./NoiseFactory.js";
import { ClusterManager } from "../cluster/manager.js";
import { GENERATOR_OPTIONS } from "./terrain/manager.js";
import { Biome3LayerManager } from "./layer_manager.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { TerrainMap2 } from "./terrain/map.js";
import type { WorkerWorld } from "../../worker/world.js";
import { WATER_LEVEL } from "./terrain/manager_vars.js";
import { IndexedColor } from "../../helpers.js";

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

export const DEFAULT_CELL = {
    dirt_color: DEFAULT_DIRT_COLOR,
    water_color: DEFAULT_WATER_COLOR,
    biome: new Default_Terrain_Map_Cell({
    code: 'flat'
})};

const DEFAUL_MAP_OPTIONS = {WATER_LEVEL}

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    defaylt_cells : {} = {}

    /**
     */
    constructor(world : WorkerWorld, seed : string, world_id : string, options : object) {

        const al = new alea(seed)
        const noise2d = createNoise2D(al.double)

        super(seed, world_id, options, noise2d, null)

        this.world          = world
        this.tempAlea       = al
        this.block_manager  = BLOCK
        this.clusterManager = new ClusterManager(world, seed, 2)

    }

    async init() : Promise<boolean> {

        const noiseFactory = new NoiseFactory();
        await super.init();
        await noiseFactory.init({outputSize: 32 * 32 * 48});
        this.noise3d = noiseFactory.createNoise3D({seed: this.seed, randomFunc: this.tempAlea.double });
        this.options = {...GENERATOR_OPTIONS, ...this.options};

        // this.n3d = createNoise3D(new alea(seed))

        this.layers = new Biome3LayerManager(this, [
            {type: 'overworld', bottom: 0, up: 7},
            //{type: 'end', bottom: 17, up: 22}
        ])

        return true

    }

    /**
     */
    generate(chunk : ChunkWorkerChunk) : TerrainMap2 {

        this.noise3d.scoreCounter = 0

        const chunk_seed = this.seed + chunk.id
        const rnd = new alea(chunk_seed)
        const map = this.layers.generateChunk(chunk, chunk_seed, rnd)

        chunk.genValue = this.noise3d.scoreCounter

        return map

    }

    generateDefaultMap(chunk : ChunkWorkerChunk) : Default_Terrain_Map {        
        // chunk.timers.stop().start('generateDefaultMap')
        const resp = new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            DEFAUL_MAP_OPTIONS,
            this.getOrCreateDefaultCells(chunk.size.x * chunk.size.z)
        )
        // chunk.timers.stop()
        return resp
    }

    getOrCreateDefaultCells(cells_count : int) : any[] {
        if(this.defaylt_cells[cells_count]) {
            return this.defaylt_cells[cells_count]
        }
        return this.defaylt_cells[cells_count] = Array(cells_count).fill(DEFAULT_CELL)
    }

}