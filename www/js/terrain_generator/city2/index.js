import {Color, Vector} from '../../helpers.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import { Default_Terrain_Generator } from '../default.js';
import {BLOCK} from '../../blocks.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";

//
let palette = {
    150: BLOCK.OAK_LEAVES,
    80: BLOCK.OAK_TRUNK,
    112: BLOCK.SAND,
    252: BLOCK.CONCRETE,
    192: BLOCK.ICE,
    235: BLOCK.IRON,
    248: BLOCK.SMOOTH_STONE,
    106: BLOCK.BIRCH_PLANK,
    38: BLOCK.TERRACOTTA_RED,
    246: BLOCK.IRON,
    254: BLOCK.WOOL_BLACK,
    236: BLOCK.TERRACOTTA_CYAN,
    103: BLOCK.GOLD,
    253: BLOCK.WOOL_GRAY,
    143: BLOCK.DIRT,
    139: BLOCK.WOOL_GREEN,
    29: BLOCK.TERRACOTTA_GRAY,
    111: BLOCK.CONCRETE_YELLOW,
    198: BLOCK.WOOL_BLUE,
    30: BLOCK.TERRACOTTA_RED, // BRICK
    252: BLOCK.WOOL_GRAY,
    90: BLOCK.CLAY,
    237: BLOCK.WOOL_GRAY,
    165: BLOCK.CONCRETE_CYAN,
    166: BLOCK.WOOL_CYAN,
    174: BLOCK.WOOL_BLUE,
    234: BLOCK.SNOW_BLOCK,
    
    238: BLOCK.TEST,

    // 97: BLOCK.OAK_PLANK,
    // 121: BLOCK.STONE_BRICK,
    // 122: BLOCK.SMOOTH_STONE,
    // 123: BLOCK.GRAVEL,
};

let vox_templates = {};

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super();
        this.setSeed(0);
    }

    async init() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        await Vox_Loader.load(root_dir + '/data/vox/city/City_1.vox', (chunks) => {
            vox_templates.city1 = {chunk: chunks[0], palette: palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/city/City_2.vox', (chunks) => {
            vox_templates.city2 = {chunk: chunks[0], palette: palette};
        });
        // Voxel buildings
        this.voxel_buildings = [
            new Vox_Mesh(vox_templates.city1, new Vector(0, 0, 0), new Vector(0, 0, 0), null, null),
            new Vox_Mesh(vox_templates.city2, new Vector(0, 0, 0), new Vector(0, 0, 0), null, null)
        ];
    }

    /**
     * setSeed
     * @param { string } seed 
     */
    setSeed(seed) {
    }

    /**
     * 
     * @param { Chunk } chunk 
     * @returns 
     */
    generate(chunk) {
    
        // setBlock
        let temp_vec2 = new Vector(0, 0, 0);
        const setBlock = (x, y, z, block_id) => {
            temp_vec2.set(x, y, z);
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            chunk.tblocks.id[index] = block_id;
        };

        if(chunk.addr.y < 5) {

            // только на первом уровне
            if(chunk.addr.y == 0) {
                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        // this.setBlock(chunk, x, 0, z, BLOCK.BEDROCK, false);
                        setBlock(x, 0, z, BLOCK.BEDROCK.id);
                    }
                }
            }

            if(chunk.addr.x < 0 || chunk.addr.z < 0 || chunk.coord.y > 100) {
                // do nothing
            } else {

                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        for (let y = 0; y < chunk.size.y; y++) {
                            let xyz     = new Vector(x, y, z).add(chunk.coord);
                            let index   = (xyz.x / 126 | 0 + xyz.z / 126 | 0) % 2;
                            let vb      = this.voxel_buildings[index];
                            xyz.x = xyz.x % 126;
                            xyz.z = xyz.z % 126;
                            let block   = vb.getBlock(xyz);
                            if(block) {
                                // this.setBlock(chunk, x, y, z, block, false);
                                setBlock(x, y, z, block.id);
                            }
                        }
                    }
                }
            }

        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'City'}};
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