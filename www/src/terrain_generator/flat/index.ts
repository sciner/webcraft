import { IndexedColor } from '../../helpers.js';
import { Default_Terrain_Generator, Default_Terrain_Map, alea } from '../default.js';
import { BLOCK } from '../../blocks.js';
import type { ChunkWorkerChunk } from '../../worker/chunk.js';
import { Biomes } from '../biome3/biomes.js';
import { createNoise2D } from '@vendors/simplex-noise.js';

export default class Terrain_Generator extends Default_Terrain_Generator {
    [key: string]: any;

    constructor(seed : string, world_id : string, options) {
        super(seed, world_id, options);
        this.setSeed(seed)
        const noiseRandom = new alea(seed)
        const noise2d = createNoise2D(noiseRandom.double)
        this.biomes = new Biomes(noise2d)
        this.biome = this.biomes.byName.get('Березняк')
    }

    async init() {
        if(this.city2) {
            await this.city2.init();
        }
        return true
    }

    generate(chunk : ChunkWorkerChunk) : Default_Terrain_Map {

        const block_id = BLOCK.GRASS_BLOCK.id;

        const { cx, cy, cz, cw } = chunk.dataChunk;

        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < 1; y++) {
                        setBlock(x, y, z, block_id);
                    }
                }
            }
        }

        const cell = {
            dirt_color: this.biome.dirt_color,
            water_color: this.biome.water_color,
            biome: this.biome
        };

        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LEVEL: 63},
            Array(chunk.size.x * chunk.size.z).fill(cell)
        );

    }

}