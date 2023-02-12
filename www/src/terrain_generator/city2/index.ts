import {IndexedColor, Vector} from '../../helpers.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import { Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from '../default.js';
import {BLOCK} from '../../blocks.js';

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

//
let vox_templates = {};

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(world, seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
    }

    async init() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        //
        this.initPallette();
        //
        await Vox_Loader.load(root_dir + '/data/vox/city/City_1.vox', (chunks) => {
            vox_templates.city1 = {chunk: chunks[0], palette: this.palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/city/City_2.vox', (chunks) => {
            vox_templates.city2 = {chunk: chunks[0], palette: this.palette};
        });
        // Voxel buildings
        this.voxel_buildings = [
            new Vox_Mesh(vox_templates.city1, new Vector(0, 0, 0), new Vector(0, 0, 0), null, null),
            new Vox_Mesh(vox_templates.city2, new Vector(0, 0, 0), new Vector(0, 0, 0), null, null)
        ];
    }

    initPallette() {
        if(this.palette) {
            return false;
        }
        this.palette = {
            150: BLOCK.OAK_LEAVES,
            80: BLOCK.OAK_LOG,
            112: BLOCK.SAND,
            192: BLOCK.ICE,
            235: BLOCK.IRON_BLOCK,
            248: BLOCK.SMOOTH_STONE,
            106: BLOCK.BIRCH_PLANKS,
            38: BLOCK.RED_TERRACOTTA,
            236: BLOCK.CYAN_TERRACOTTA,
            29: BLOCK.GRAY_TERRACOTTA,
            30: BLOCK.RED_TERRACOTTA, // BRICK
            246: BLOCK.IRON_BLOCK,
            254: BLOCK.BLACK_WOOL,
            103: BLOCK.GLOWSTONE,
            253: BLOCK.GRAY_WOOL,
            143: BLOCK.GRASS_BLOCK,
            139: BLOCK.GREEN_WOOL,
            111: BLOCK.YELLOW_CONCRETE,
            198: BLOCK.BLUE_WOOL,
            252: BLOCK.GRAY_WOOL,
            90: BLOCK.CLAY,
            237: BLOCK.GRAY_WOOL,
            165: BLOCK.CYAN_CONCRETE,
            166: BLOCK.CYAN_WOOL,
            174: BLOCK.BLUE_WOOL,
            234: BLOCK.POWDER_SNOW,

            238: BLOCK.TEST,

            // 97: BLOCK.OAK_PLANKS,
            // 121: BLOCK.STONE_BRICKS,
            // 122: BLOCK.SMOOTH_STONE,
            // 123: BLOCK.GRAVEL,
        };
    }

    /**
     * setSeed
     * @param { string } seed
     */
    setSeed(seed) {
    }

    /**
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @returns
     */
    generate(chunk) {
        const { cx, cy, cz, cw } = chunk.dataChunk;
        // setBlock
        const setBlock = (x, y, z, block_id) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
        };

        if(chunk.addr.y < 5) {

            // только на первом уровне
            if(chunk.addr.y == 0) {
                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        setBlock(x, 0, z, BLOCK.BEDROCK.id);
                    }
                }
            }

            if(chunk.coord.y > 100) {
                // do nothing
            } else {

                const SZ = 126;
                const xyz = new Vector(0, 0, 0);

                for(let x = 0; x < chunk.size.x; x++) {
                    for (let z = 0; z < chunk.size.z; z++) {
                        for (let y = 0; y < chunk.size.y; y++) {
                            xyz.set(x, y, z).addSelf(chunk.coord);
                            const model_x = Math.floor(xyz.x / SZ);
                            const model_z = Math.floor(xyz.z / SZ);
                            const index = (Math.abs(model_x) + Math.abs(model_z)) % 2;
                            const vb = this.voxel_buildings[index];
                            //
                            xyz.x = (xyz.x - (model_x * SZ)) % SZ;
                            xyz.z = (xyz.z - (model_z * SZ)) % SZ;
                            const block = vb.getBlock(xyz);
                            if(block) {
                                setBlock(x, y, z, block.id);
                            }
                        }
                    }
                }

            }

        }

        const cell = {
            dirt_color: DEFAULT_DIRT_COLOR,
            water_color: DEFAULT_WATER_COLOR,
            biome: new Default_Terrain_Map_Cell({
            code: 'city2'
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