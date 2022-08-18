import { IndexedColor } from '../../helpers.js';
import { Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from '../default.js';
import { BLOCK } from '../../blocks.js';

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
    }

    async init() {
        if(this.city2) {
            await this.city2.init();
        }
    }

    generate(chunk) {

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

        const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: new Default_Terrain_Map_Cell({
            code: 'Flat'
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