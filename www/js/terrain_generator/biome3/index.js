import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { BLOCK } from '../../blocks.js';
import { alea, Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from "../default.js";

import { GENERATOR_OPTIONS, TerrainMapManager2 } from "./terrain/manager.js";

import { createNoise2D } from '../../../vendors/simplex-noise.js';
import { Chunk } from "../../worker/chunk.js";
import { NoiseFactory } from "./NoiseFactory.js";

import Biome3LayerOverworld from "./layers/overworld.js";
import { ClusterManager } from "../cluster/manager.js";
import { IndexedColor } from "../../helpers.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

const DEFAULT_CELL = {
    dirt_color: DEFAULT_DIRT_COLOR,
    water_color: DEFAULT_WATER_COLOR,
    biome: new Default_Terrain_Map_Cell({
    code: 'flat'
})};

const EMPTY_LAYER = {maps: new Map()}

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    /**
     * @type {TerrainMapManager2}
     */
    maps;

    constructor(world, seed, world_id, options) {

        const al = new alea(seed)
        const noise2d = createNoise2D(al.double)

        super(seed, world_id, options, noise2d, null)
        this.world = world
        this.tempAlea = al

        this.clusterManager = new ClusterManager(world.chunkManager, seed, 2)

    }

    async init() {

        const noiseFactory = new NoiseFactory();
        await super.init();
        await noiseFactory.init({outputSize: 32 * 32 * 48});
        this.noise3d = noiseFactory.createNoise3D({seed: this.seed, randomFunc: this.tempAlea.double });
        this.options = {...GENERATOR_OPTIONS, ...this.options};

        // this.n3d = createNoise3D(new alea(seed))

        this.layers = []
        this.layers.push({bottom: -5, up: 0, obj: new Biome3LayerOverworld(this)})
        this.layers.push({bottom: 0, up: 5, obj: new Biome3LayerOverworld(this)})
    }

    /**
     * Generate
     * @param {Chunk} chunk 
     * @returns 
     */
    generate(chunk) {

        this.noise3d.scoreCounter = 0;

        const seed = this.seed + chunk.id;
        const rnd = new alea(seed);

        let generated = false
        let map = null

        chunk.layer = EMPTY_LAYER

        for(let layer of this.layers) {
            if(chunk.addr.y >= layer.bottom && chunk.addr.y < layer.up) {
                chunk.addr.y -= layer.bottom
                chunk.coord.y -= layer.bottom * CHUNK_SIZE_Y
                map = layer.obj.generate(chunk, seed, rnd)
                chunk.layer = layer.obj
                chunk.addr.y += layer.bottom
                chunk.coord.y += layer.bottom * CHUNK_SIZE_Y
                generated = true
                break
            }
        }

        if(!generated) {
            if(chunk.addr.y < 0)  {
                for(let x = 0; x < chunk.size.x; x++) {
                    for(let z = 0; z < chunk.size.z; z++) {
                        for(let y = 0; y < chunk.size.y; y++) {
                            chunk.setBlockIndirect(x, y, z, BLOCK.STONE.id)
                        }
                    }
                }
            }
        }

        chunk.genValue = this.noise3d.scoreCounter

        return map || new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63},
            Array(chunk.size.x * chunk.size.z).fill(DEFAULT_CELL)
        )

    }

}