import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Color, Vector} from '../../helpers.js';
import { Default_Terrain_Generator, alea } from '../default.js';
import {BLOCK} from '../../blocks.js';
import {TREES} from '../../terrain_generator/biomes.js';

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(0);
        TREES.init();
    }

    async init() {}

    generate(chunk) {

        let block_id = Math.abs(chunk.addr.x + chunk.addr.z) % 2 == 1 ? BLOCK.GRASS_BLOCK.id : BLOCK.DIRT.id;
        const aleaRandom = new alea(chunk.id);

        // setBlock
        const { cx, cy, cz, cw } = chunk.dataChunk;
        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        //
        const tree_height = {min: 5, max: 8};
        const tree_types = Object.keys(TREES);
        const tree_type_index = Math.floor(aleaRandom.double() * tree_types.length);
        const tree_type_key = tree_types[tree_type_index];
        const tree_type = TREES[tree_type_key];

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
                    height: Math.round(aleaRandom.double() * (tree_type.height.max - tree_type.height.min) + tree_type.height.min),
                    type: tree_type
                },
                chunk,
                // XYZ позиция в чанке
                7, 1, 7
            );
        }

        const cell = {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), biome: {
            code: 'Flat'
        }};

        let addr = chunk.addr;
        let size = chunk.size;

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