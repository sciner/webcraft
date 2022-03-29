import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Color, Vector} from '../../helpers.js';
import { Default_Terrain_Generator, alea } from '../default.js';
import {BLOCK} from '../../blocks.js';

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super();
        this.setSeed(0);
    }

    async init() {}

    generate(chunk) {

        let block_id = Math.abs(chunk.addr.x + chunk.addr.z) % 2 == 1 ? BLOCK.GRASS_DIRT.id : BLOCK.DIRT.id;
        const aleaRandom = new alea(chunk.id);

        // setBlock
        let temp_vec2 = new Vector(0, 0, 0);
        const setBlock = (x, y, z, block_id) => {
            temp_vec2.set(x, y, z);
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            chunk.tblocks.id[index] = block_id;
        };

        //
        const tree_height = {min: 5, max: 8};

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < 1; y++) {
                        setBlock(x, y, z, block_id);
                    }
                }
            }
            // Посадка дерева
            this.plantTree(
                {
                    // рандомная высота дерева
                    height: Math.round(aleaRandom.double() * (tree_height.max - tree_height.min) + tree_height.min),
                    type: {
                        trunk: BLOCK.OAK_TRUNK.id,
                        leaves: BLOCK.OAK_LEAVES.id,
                        style: 'test_tree'
                    },
                },
                chunk,
                // XYZ позиция в чанке
                7, 1, 7
            );
        }

        let cell = {biome: {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), code: 'Flat'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        let addr = chunk.addr;
        let size = chunk.size;

        return {
            chunk: {
                id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
                blocks: {},
                seed:   chunk.seed,
                addr:   addr,
                size:   size,
                coord:  addr.mul(size),
            },
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };

    }

}