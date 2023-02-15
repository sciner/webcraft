import { IndexedColor } from '../../helpers.js';
import { Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from '../default.js';
import { BLOCK } from '../../blocks.js';
import type { ChunkWorkerChunk } from '../../worker/chunk.js';

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

export default class Terrain_Generator extends Default_Terrain_Generator {
    [key: string]: any;

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
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
            dirt_color: DEFAULT_DIRT_COLOR,
            water_color: DEFAULT_WATER_COLOR,
            biome: new Default_Terrain_Map_Cell({
            code: 'flat'
        })};

        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63},
            Array(chunk.size.x * chunk.size.z).fill(cell)
        );

    }

}