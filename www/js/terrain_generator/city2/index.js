import {blocks} from '../../biomes.js';
import {Color, Vector} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';
import {BLOCK} from '../../blocks.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";

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
await Vox_Loader.load('/vox/city/City_1.vox', (chunks) => {
    vox_templates.city1 = {chunk: chunks[0], palette: palette};
});
await Vox_Loader.load('/vox/city/City_2.vox', (chunks) => {
    vox_templates.city2 = {chunk: chunks[0], palette: palette};
});

export default class Terrain_Generator {

    constructor() {
        this.seed = 0;
        //
        const blocks = this.blocks1 = [];
        for(let key in BLOCK) {
            if (key.substring(0, 4) === 'TERR' || key.substring(0, 4) === 'WOOL') {
                blocks.push(BLOCK[key]);
            }
        }
        //
        for(let key of Object.keys(blocks)) {
            let b = blocks[key];
            b = {...b};
            delete(b.texture);
            blocks[key] = b;
        }
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

        if(chunk.addr.y < 5) {

            //
            let setBlock = (x, y, z, block) => {
                chunk.blocks[x][z][y] = block;
            };

            // только на первом уровне
            if(chunk.addr.y == 0) {
                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        setBlock(x, 0, z, blocks.BEDROCK);
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
                                setBlock(x, y, z, block.id);
                            }
                        }
                    }
                }
            }

        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'City'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        return {
            chunk: chunk,
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };

    }

    plantTree(options, chunk, x, y, z) {
        const height        = options.height;
        const type        = options.type;
        let ystart = y + height;
        // ствол
        for(let p = y; p < ystart; p++) {
            if(chunk.getBlock(x + chunk.coord.x, p + chunk.coord.y, z + chunk.coord.z).id >= 0) {
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][p] = type.trunk;
                }
            }
        }
        // дуб, берёза
        let py = y + height;
        for(let rad of [1, 1, 2, 2]) {
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                        let m = (i == x - rad && j == z - rad) ||
                            (i == x + rad && j == z + rad) ||
                            (i == x - rad && j == z + rad) ||
                            (i == x + rad && j == z - rad);
                        let m2 = (py == y + height) ||
                            (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                        if(m && m2) {
                            continue;
                        }
                        let b = chunk.blocks[i][j][py];
                        if(!b || b.id >= 0 && b.id != type.trunk.id) {
                            chunk.blocks[i][j][py] = type.leaves;
                        }
                    }
                }
            }
            py--;
        }
    }

}