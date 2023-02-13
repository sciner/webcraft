import { IndexedColor, Vector, Helpers } from '../../helpers.js';
import { Default_Terrain_Map, Default_Terrain_Map_Cell } from '../default.js';
import { BLOCK } from '../../blocks.js';
import { noise, alea } from "../default.js";
import { CHUNK_SIZE_Y } from '../../chunk_const.js';
import {DungeonGenerator} from "../dungeon.js";
import Demo_Map from '../biome2/demo_map.js';

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

export default class Terrain_Generator extends Demo_Map {
    [key: string]: any;

    constructor(world, seed, world_id, options) {
        super(seed, world_id, options);
        this.world = world;
        this.setSeed(seed);
        this.dungeon = new DungeonGenerator(seed);
    }

    async init() {}

    generate(chunk) {

        const { cx, cy, cz, cw } = chunk.dataChunk;

        //
        const generateMap = () => {
            const cell = {
                dirt_color: DEFAULT_DIRT_COLOR,
                water_color: DEFAULT_WATER_COLOR,
                biome: new Default_Terrain_Map_Cell({
                code: 'bottom_caves'
            })};
            return new Default_Terrain_Map(
                chunk.addr,
                chunk.size,
                chunk.addr.mul(chunk.size),
                {WATER_LINE: 63},
                Array(chunk.size.x * chunk.size.z).fill(cell)
            );
        };

        // setBlock
        const setBlock = (x, y, z, block_id, extra_data) => {
            const index = cx * x + cy * y + cz * z + cw;
            chunk.tblocks.id[index] = block_id;
            if(extra_data) {
                chunk.tblocks.setBlockRotateExtra(x, y, z, null, extra_data);
            }
        };

        const dirt_block_id             = BLOCK.DIRT.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const stone_block_id            = BLOCK.STONE.id;
        const noise2d                   = noise.simplex2;
        const noise3d                   = noise.simplex3;
        const height                    = 80;
        const pos                       = new Vector(0, 0, 0);

        let tree_pos = null;
        const rnd = new alea(chunk.addr.toHash());

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let first = true;
                const grass_level = Math.round(noise2d((x + chunk.coord.x) / 10, (z + chunk.coord.z) / 10) * 2);
                for(let y = chunk.size.y - 1; y >= 0; y--) {
                    pos.set(x + chunk.coord.x, chunk.coord.y + y, z + chunk.coord.z);
                    const d = Math.max(Math.min((1 - Math.cos(pos.y / height * (Math.PI * 2))) / 2, 1), 0);
                    if(d > 0) {
                        let r = noise3d(pos.x/100, pos.y / 100, pos.z/100) * 64;
                        r += noise3d(pos.x/50, pos.y / 50, pos.z/50) * 32
                        r += noise3d(pos.x/25, pos.y / 25, pos.z/25) * 16
                        r += noise3d(pos.x/12.5, pos.y / 12.5, pos.z/12.5) * 8
                        r /= 64 + 32 + 16 + 8;
                        r *= d;
                        if(r > 0.25) {
                            if(r < .6) {
                                let block_id = dirt_block_id;
                                if(pos.y > 35) block_id = grass_block_id;
                                if(pos.y < 30 + grass_level) block_id = stone_block_id;
                                if(r > .8) {
                                    block_id = stone_block_id;
                                }
                                if(block_id == grass_block_id && first) {
                                    first = false;
                                    let chance = rnd.double();
                                    if(rnd.double() < .5) {
                                        if(rnd.double() < .2 && y < CHUNK_SIZE_Y - 3) {
                                            setBlock(x, y + 1, z, BLOCK.TALL_GRASS.id);
                                            setBlock(x, y + 2, z, BLOCK.TALL_GRASS.id, {is_head: true});
                                        } else {
                                            let grass_id = BLOCK.GRASS.id
                                            chance *= 2;
                                            if(chance < .1) {
                                                grass_id = BLOCK.DANDELION.id;
                                            } else if(chance < .2) {
                                                grass_id = BLOCK.POPPY.id;
                                            }
                                            setBlock(x, y + 1, z, grass_id);
                                        }
                                        if(x > 7 && x < 11 && z > 7 && z < 11 && !tree_pos) {
                                            tree_pos = new Vector(x, y + 1, z);
                                        }
                                    }
                                }
                                setBlock(x, y, z, block_id);
                            }
                        }
                    }
                }
            }
        }

        // Trees
        if(tree_pos && tree_pos.y < 32) {
            let type = { "percent": 0.99, "trunk": 3, "leaves": 233, "style": "wood", "height": { "min": 4, "max": 8 } };
            const r = rnd.double();
            if(r < .05) {
                type = {"trunk": BLOCK.MUSHROOM_STEM.id, "leaves": BLOCK.RED_MUSHROOM_BLOCK.id, "style": 'red_mushroom', "height": {"min": 5, "max": 12}};
            } else if(r < .5) {
                type = {"trunk": BLOCK.BIRCH_LOG.id, "leaves": BLOCK.BIRCH_LEAVES.id, "style": 'wood', "height": {"min": 4, "max": 8}};
            } else if(r < .55) {
                type = {"trunk": BLOCK.PRISMARINE.id, "leaves": null, "style": 'tundra_stone', "height": {"min": 2, "max": 2}};
            }
            const tree_height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
            this.plantTree(this.world,
                {
                    "biome_code": "TROPICAL_SEASONAL_FOREST", "pos": tree_pos, "height": tree_height, "rad": 3,
                    type
                },
                chunk,
                tree_pos.x, tree_pos.y, tree_pos.z,
                true
            );
        }

        // Dungeon
        this.dungeon.add(chunk);

        return generateMap();

    }

}