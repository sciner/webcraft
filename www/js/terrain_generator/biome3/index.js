import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Helpers, IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell} from "../default.js";
// import {MineGenerator} from "../mine/mine_generator.js";
// import {DungeonGenerator} from "../dungeon.js";
// import FlyIslands from "../flying_islands/index.js";
import {DungeonGenerator} from "../dungeon.js";

// import { AABB } from '../../core/AABB.js';
import Demo_Map from "./demo_map.js";
import { CaveGenerator } from "../cave_generator.js";
// import BottomCavesGenerator from "../bottom_caves/index.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Terrain generator class
export default class Terrain_Generator extends Demo_Map {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
    }

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        // this.temp_vec       = new Vector(0, 0, 0);
        this.noise2d        = noise.perlin2;
        this.noise3d        = noise.perlin3;
        this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noise2d, this.noise3d);
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const xyz = new Vector(0, 0, 0);
        const CHUNK_START_Y = 25;
        const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
        const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
        coord.y -= chunk.size.y * CHUNK_START_Y;
        addr.y -= CHUNK_START_Y;
        const fake_chunk = {...chunk, coord, addr};
        fake_chunk.setBlockIndirect = chunk.setBlockIndirect;
        return this.flying_islands.generate(fake_chunk);
    }

    // Generate
    generate(chunk) {

        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        // const maps                      = this.maps.generateAround(chunk, chunk.addr, false, true);
        // const map                       = maps[4];
        // const cluster                   = chunk.cluster;

        const xyz                       = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const WATER_LEVEL               = 70;
        // const temp_vec                  = new Vector(0, 0, 0);
        // const ywl                       = map.options.WATER_LINE - chunk.coord.y;

        //
        const water_id                  = BLOCK.STILL_WATER.id;
        const stone_block_id            = BLOCK.STONE.id;
        const grass_id                  = BLOCK.GRASS.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const dirt_block_id             = BLOCK.DIRT.id;

        const noise2d = this.noise2d;
        const noise3d = this.noise3d;

        // Caves
        // const caves = new CaveGenerator(chunk.coord, noise2d);

        //
        const generateMap = () => {
            const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: new Default_Terrain_Map_Cell({
                code: 'Flat'
            })};
            return new Default_Terrain_Map(
                chunk.addr,
                chunk.size,
                chunk.addr.mul(chunk.size),
                {WATER_LINE: 63000},
                Array(chunk.size.x * chunk.size.z).fill(cell)
            );
        };

        if(!globalThis.sdfsdf) {
            globalThis.sdfsdf = true;
            globalThis.m = Infinity;
            globalThis.x = -Infinity;
        }

        //  1  6 16
        // 66 48 32

        const options = {
            // relief - кривизна рельефа
            // mid_level - базовая высота поверхности
            min: {name: 'min', relief: 6, mid_level: 48},
            norm: {name: 'norm', relief: 1, mid_level: 68},
            max: {name: 'max', relief: 12, mid_level: 32}
        };

        let not_air_count = -1;
        let tree_pos = null;
        const rnd = new alea(chunk.addr.toHash());

        // const cell = {value2: 1000};

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                const mh = Math.max(noise2d((chunk.coord.x + x) / 2048, (chunk.coord.z + z) / 2048) * 32, 8);

                // динамическая толщина дерна
                const dirt_level = noise2d((chunk.coord.x + x) / 16, (chunk.coord.z + z) / 16);

                // базовые кривизна рельефа и высота поверхности
                let relief = options.norm.relief;
                let mid_level = options.norm.mid_level;

                xyz.set(chunk.coord.x + x, 0, chunk.coord.z + z);

                // Change relief
                const cx = Math.round((chunk.coord.x + x) / 1024) * 1024;
                const cz = Math.round((chunk.coord.z + z) / 1024) * 1024;
                let lx = cx - (chunk.coord.x + x);
                let lz = cz - (chunk.coord.z + z);
                const dist = Math.sqrt(lx * lx + lz * lz);
                const max_dist = 512;
                const w = 64;
                let op = options.norm;

                if((dist < max_dist)) {
                    const perc = 1 - Math.min( Math.max((dist - (max_dist - w)) / w, 0), 1);
                    const perc_side = noise2d(cx / 2048, cz / 2048);
                    // выбор настроек
                    op = perc_side < .35 ? options.min : options.max;
                    relief += ( (op.relief - options.norm.relief) * perc);
                    mid_level += ((op.mid_level - options.norm.mid_level) * perc);
                }

                //
                let dirt_pattern = dirt_level; // noise2d((chunk.coord.x + x) / 16, (chunk.coord.z + z) / 16);
                let mn = noise2d((chunk.coord.x + x) / 128, (chunk.coord.z + z) / 128);
                mn = (mn / 2 + .5) * relief;

                for(let y = size_y; y >= 0; y--) {

                    xyz.set(chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);

                    const d1 = noise3d(xyz.x/100, xyz.y / 100, xyz.z/100);
                    const d2 = noise3d(xyz.x/50, xyz.y / 50, xyz.z/50);
                    const d3 = noise3d(xyz.x/25, xyz.y / 25, xyz.z/25);
                    const d4 = noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5);

                    //if(xyz.y < WATER_LEVEL) {
                    //    chunk.setBlockIndirect(x, y, z, stone_block_id);
                    //}

                    let h = (mid_level - xyz.y) / mh;
                    h = 1 - Math.min(h, 1) / mn;

                    const d = (
                            ((d1 * 64 + d2 * 32 + d3 * 16 + d4 * 8) / (64 + 32 + 16 + 8))
                            / 2 + .5
                        ) * h;

                    if(d > .15 && d < 1.) {
                        let block_id = grass_block_id;
                        if(d3 > .2 && op.name != 'norm') {
                            // проплешины камня
                            block_id = stone_block_id;
                        } else {
                            // если это самый первый слой поверхности
                            if(not_air_count == 0) {
                                // если это не под водой
                                if(xyz.y >= WATER_LEVEL) {
                                    let r = rnd.double();
                                    let plant_id = grass_id;
                                    if(r < .5) {
                                        if(d4 < .5) {
                                            //
                                            if(r < .1) {
                                                plant_id = BLOCK.TALL_GRASS.id;
                                                chunk.setBlockIndirect(x, y + 2, z, plant_id, null, {is_head: true});
                                            }
                                        } else {
                                            if(r < .1) {
                                                plant_id = r < .03 ? BLOCK.RED_TULIP.id : BLOCK.OXEYE_DAISY.id;
                                            }
                                        }
                                        chunk.setBlockIndirect(x, y + 1, z, plant_id);
                                    }
                                } else {
                                    block_id = dirt_pattern < .0 ? BLOCK.GRAVEL.id : BLOCK.SAND.id;
                                }
                            } else {
                                // dirt_level динамическая толщина дерна
                                block_id = not_air_count < dirt_level * 3 ? dirt_block_id : stone_block_id;
                            }
                        }
                        chunk.setBlockIndirect(x, y, z, block_id);
                        if(block_id == grass_block_id) {
                            if(xyz.y >= WATER_LEVEL && x > 7 && x < 11 && z > 7 && z < 11 && !tree_pos) {
                                tree_pos = new Vector(x, y, z);
                            }
                        }
                        not_air_count++;
                    } else {
                        not_air_count = 0;
                        if(xyz.y <= WATER_LEVEL) {
                            chunk.setBlockIndirect(x, y, z, water_id);
                        }
                    }

                }
            }
        }

        // Plant trees
        if(tree_pos && tree_pos.y < 32) {
            let type = { "percent": 0.99, "trunk": 3, "leaves": 233, "style": "wood", "height": { "min": 4, "max": 8 } };
            const r = rnd.double();
            if(r < .05) {
                // type = {"trunk": BLOCK.MUSHROOM_STEM.id, "leaves": BLOCK.RED_MUSHROOM_BLOCK.id, "style": 'mushroom', "height": {"min": 5, "max": 12}};
            } else if(r < .5) {
                type = {"trunk": BLOCK.BIRCH_LOG.id, "leaves": BLOCK.BIRCH_LEAVES.id, "style": 'wood', "height": {"min": 4, "max": 8}};
            } else if(r < .55) {
                type = {"trunk": BLOCK.MOSS_STONE.id, "leaves": null, "style": 'tundra_stone', "height": {"min": 2, "max": 2}};
            }
            const tree_height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
            this.plantTree({
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