import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Color, Vector} from '../../helpers.js';
import { Default_Terrain_Generator } from '../default.js';
import {BLOCK} from '../../blocks.js';

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
    }

    async init() {}

    generate(chunk) {

        // let block_id = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.DARK_OAK_PLANKS.id : BLOCK.BIRCH_PLANKS.id;
        let block_id = BLOCK.GRASS_BLOCK.id;

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

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'Flat'
        }};

        const addr = chunk.addr;
        const size = chunk.size;

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }

}