import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Helpers, IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell, Default_Terrain_Generator} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";
import {DungeonGenerator} from "../dungeon.js";
import { DEFAULT_DENSITY_COEFF, TerrainMapManager2, WATER_LEVEL } from "../terrain_map2.js";
import { GENERATOR_OPTIONS } from "../terrain_map.js";

// import {DungeonGenerator} from "../dungeon.js";
// import FlyIslands from "../flying_islands/index.js";
// import { AABB } from '../../core/AABB.js';
// import { CaveGenerator } from "../cave_generator.js";
// import BottomCavesGenerator from "../bottom_caves/index.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

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
        this.noise2d        = noise.simplex2;
        this.noise3d        = noise.simplex3;
        this.maps           = new TerrainMapManager2(this.seed, this.world_id, this.noise2d, this.noise3d);
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const CHUNK_START_Y = 25;
        const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
        const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
        coord.y -= chunk.size.y * CHUNK_START_Y;
        addr.y -= CHUNK_START_Y;
        const fake_chunk = {...chunk, coord, addr};
        fake_chunk.setBlockIndirect = chunk.setBlockIndirect;
        return this.flying_islands.generate(fake_chunk);
    }

    // Шум для гор
    mountainFractalNoise(x, y, octaves, lacunarity, persistence, scale) {
        // The sum of our octaves
        let value = 0 
        // These coordinates will be scaled the lacunarity
        let x1 = x 
        let y1 = y
        // Determines the effect of each octave on the previous sum
        let amplitude = 1
        for (let i = 1; i < octaves; i++) {
            // Multiply the noise output by the amplitude and add it to our sum
            value += this.noise2d(x1 / scale, y1 / scale) * amplitude
            
            // Scale up our perlin noise by multiplying the coordinates by lacunarity
            y1 *= lacunarity
            x1 *= lacunarity

            // Reduce our amplitude by multiplying it by persistence
            amplitude *= persistence
        }
        // It is possible to have an output value outside of the range [-1,1]
        // For consistency let's clamp it to that range
        return Math.abs(value); // Helpers.clamp(value, -1, 1)
    }

    // Generate
    generate(chunk) {

        const seed                      = this.seed + chunk.id;
        const rnd                       = new alea(seed);
        // const noise2d                   = this.noise2d;
        // const noise3d                   = this.noise3d;

        const cluster                   = chunk.cluster;
        const maps                      = this.maps.generateAround(chunk, chunk.addr, false, true);
        const map                       = maps[4];

        const xyz                       = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;

        // blocks
        const water_id                  = BLOCK.STILL_WATER.id;
        const stone_block_id            = BLOCK.STONE.id;
        const grass_id                  = BLOCK.GRASS.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const dirt_block_id             = BLOCK.DIRT.id;

        let not_air_count               = -1;
        let tree_pos                    = null;

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                const cell = map.cells[z * CHUNK_SIZE_X + x];

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;
                const dirt_level = cell.dirt_level; // динамическая толщина дерна
                // const river_tunnel = noise2d(xyz.x / 256, xyz.z / 256) / 2 + .5;

                const has_cluster = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);
                const cluster_cell = has_cluster ? cluster.getCell(xyz.x, xyz.y, xyz.z) : null;

                // let max_height = null;

                /*if(op.id == 'gori') {
                    const NOISE_SCALE = 100
                    const HEIGHT_SCALE = 164 * dist_percent;
                    max_height = WATER_LEVEL + this.fractalNoise(xyz.x/3, xyz.z/3,
                        4, // -- Octaves (Integer that is >1)
                        3, // -- Lacunarity (Number that is >1)
                        0.35, // -- Persistence (Number that is >0 and <1)
                        NOISE_SCALE,
                    ) * HEIGHT_SCALE;
                }
                */

                for(let y = size_y; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;
                    const {d1, d2, d3, d4, density} = this.maps.makePoint(xyz, cell);

                    //
                    if(density > .6) {
                        let block_id = op.grass_block_id;
                        if(op.second_grass_block_id && dist_percent * d2 > op.second_grass_block_threshold) {
                            block_id = op.second_grass_block_id;
                        }
                        // проплешины с камнем
                        if(d3 * dist_percent > .1 && !op.is_plain) {
                            // dist_percent влияет на то, что чем ближе к краю области, тем проплешин меньше,
                            // чтобы они плавно сходили на нет и не было заметно резких границ каменных проплешин
                            block_id = stone_block_id;
                        } else {
                            // если это самый первый слой поверхности
                            if(not_air_count == 0) {

                                // если это не под водой
                                if(xyz.y > WATER_LEVEL + (dirt_level + 2) * 1.15) {
                                    if(cluster_cell && cluster_cell.height == 1 && !cluster_cell.building) {
                                        block_id = cluster_cell.block_id;
                                    } else {
                                            // растения
                                        let r = rnd.double();
                                        if(r < .5) {
                                            let plant_id = grass_id;
                                            if(block_id == BLOCK.PODZOL.id) {
                                                plant_id = r < .005 ? BLOCK.DEAD_BUSH.id : null;
                                            } else {
                                                if(d4 < .5) {
                                                    if(r < .1) {
                                                        plant_id = BLOCK.TALL_GRASS.id;
                                                        chunk.setBlockIndirect(x, y + 2, z, plant_id, null, {is_head: true});
                                                    }
                                                } else if(r < .1) {
                                                    plant_id = r < .03 ? BLOCK.RED_TULIP.id : BLOCK.OXEYE_DAISY.id;
                                                }
                                            }
                                            if(plant_id) {
                                                chunk.setBlockIndirect(x, y + 1, z, plant_id);
                                            }
                                        }
                                    }
                                } else {
                                    if(xyz.y >= WATER_LEVEL) {
                                        block_id = d2 < -.5 ? BLOCK.SAND.id : grass_block_id;
                                    } else {
                                        block_id = dirt_level < .0 ? BLOCK.GRAVEL.id : BLOCK.SAND.id;
                                        if(dirt_level < -.3) {
                                            block_id = xyz.y < WATER_LEVEL ? dirt_block_id : grass_block_id;
                                        }
                                    }
                                }
                            } else {
                                block_id = not_air_count < dirt_level * 4 ? (dirt_block_id) : stone_block_id;
                            }
                        }
                        chunk.setBlockIndirect(x, y, z, block_id);
                        if(block_id == grass_block_id && !tree_pos) {
                            let r = rnd.double();
                            if(r < .01) {
                                if(xyz.y >= WATER_LEVEL && x > 1 && x < 14 && z > 1 && z < 14 && !tree_pos) {
                                    tree_pos = new Vector(x, y + 1, z);
                                }
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

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        // Dungeon
        this.dungeon.add(chunk);

        // Cluster
        //if(chunk.addr.y == 2) {
            for(const [_, building] of cluster.buildings.entries()) {
                building.door_bottom.y = 90;
                building.entrance.y = 90;
            }
            cluster.fillBlocks(this.maps, chunk, map, false);
       // }

        return map;

    }

}