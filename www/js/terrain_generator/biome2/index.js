import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";

import { AABB } from '../../core/AABB.js';
import Demo_Map from "./demo_map.js";
import { generateBottomCaves } from "./bottom_caves.js";

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
        this._createBlockAABB = new AABB();
        this._createBlockAABB_second = new AABB();
        this.temp_set_block = null;
        this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        this.generateBottomCaves = generateBottomCaves.bind(this);
    }

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        this.temp_vec       = new Vector(0, 0, 0);
        this.noisefn        = noise.perlin2;
        this.noisefn3d      = noise.perlin3;
        this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noisefn, this.noisefn3d);
    }

    // Generate
    generate(chunk) {

        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);
        const map                       = maps[4];
        const cluster                   = chunk.cluster;

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {
            this.generateBottomCaves(chunk, aleaRandom);
            return map;
        }

        const xyz                       = new Vector(0, 0, 0);
        const temp_vec                  = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const BLOCK_WATER_ID            = BLOCK.STILL_WATER.id;
        const ywl                       = map.options.WATER_LINE - chunk.coord.y;
        const plant_pos                 = new Vector(0, 0, 0);
        
        let plant_index = 0;

        const has_voxel_buildings       = this.intersectChunkWithVoxelBuildings(chunk.aabb);
        const has_islands               = this.intersectChunkWithIslands(chunk.aabb);
        const has_extruders             = this.intersectChunkWithExtruders(chunk.aabb);
        const has_spiral_staircaes      = this.world_id == 'demo' && chunk.addr.x == 180 && chunk.addr.z == 174;

        if(has_spiral_staircaes) {
            this.drawSpiralStaircases(chunk);
        }

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                xyz.set(x + chunk.coord.x, chunk.coord.y, z + chunk.coord.z);

                const cell              = map.cells[z * CHUNK_SIZE_X + x];
                const biome             = cell.biome;
                const value             = cell.value2;
                const rnd               = aleaRandom.double();
                const local_dirt_level  = value - (rnd < .005 ? 1 : 3);
                const in_ocean          = this.OCEAN_BIOMES.indexOf(biome.code) >= 0;
                const dirt_block        = cell.dirt_block_id;
                const has_ocean_blocks  = biome.code == 'OCEAN' && ywl >= 0;
                const has_cluster       = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);
                const has_modificator   = true; // has_voxel_buildings || has_islands || has_extruders;

                let can_plant = false;

                if(!has_ocean_blocks && chunk.coord.y > value && !has_modificator) {
                    continue;
                }

                for(let y = 0; y < size_y; y++) {

                    xyz.y = chunk.coord.y + y;

                    if(has_modificator) {
                        // Draw voxel buildings
                        if(has_voxel_buildings && this.drawBuilding(xyz, x, y, z, chunk)) {
                            continue;
                        }
                        // Islands
                        if(has_islands && this.drawIsland(xyz, x, y, z, chunk)) {
                            continue;
                        }
                        // Remove volume from terrain
                        if(has_extruders && this.extrude(xyz)) {
                            continue;
                        }
                    }

                    // Exit
                    if(xyz.y >= value) {
                        continue;
                    }

                    // Clusters
                    const cluster_padding = 5;
                    const cellIsOccupied = has_cluster &&
                        (xyz.y > value - cluster_padding && xyz.y < value + 1);

                    // Caves | Пещеры
                    if(!cellIsOccupied) {
                        const caveDensity = map.caves.getPoint(xyz, cell, in_ocean);
                        if(caveDensity !== null) {
                            continue;
                        }
                    }

                    // this.drawTreasureRoom(chunk, line, xyz, x, y, z);

                    // Ores (if this is not water, fill by ores)
                    const block_id = xyz.y < local_dirt_level ? map.ores.get(xyz, value) : dirt_block;
                    chunk.setBlockIndirect(x, y, z, block_id);

                    // check if herbs planted
                    if(block_id == dirt_block && xyz.y == value - 1) {
                        can_plant = true;
                    }

                }

                // Hebrs and grass
                if(can_plant) {
                    plant_pos.x = x;
                    plant_pos.z = z;
                    plant_pos.y = value;
                    const plants = map.plants.get(plant_pos);
                    if(plants) {
                        if(Array.isArray(plants)) {
                            for(let i = 0; i < plants.length; i++) {
                                const plant = plants[i];
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y - chunk.coord.y + i, plant_pos.z, plant.id, null, plant.extra_data || null);
                            }
                        } else {
                            const plant = plants;
                            const block_id = plant.id;
                            plant_pos.y -= chunk.coord.y;
                            if(plant_index++ % 7 == 0 && plant_pos.y < CHUNK_SIZE_Y - 2 && block_id == BLOCK.GRASS.id) {
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y, plant_pos.z, BLOCK.TALL_GRASS.id);
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y + 1, plant_pos.z, BLOCK.TALL_GRASS.id, null, {is_head: true});
                            } else {
                                const extra_data = plant.extra_data || null;
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y, plant_pos.z, block_id, null, extra_data);
                            }
                        }
                    }
                }

                // Water and ice
                if(has_ocean_blocks) {
                    temp_vec.set(x, 0, z);
                    for(let y = value; y <= map.options.WATER_LINE; y++) {
                        if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = y - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK_WATER_ID);
                        }
                    }
                    if(cell.equator < .6 && cell.humidity > .4) {
                        const vl = map.options.WATER_LINE;
                        if(vl >= chunk.coord.y && vl < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = vl - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.ICE.id);
                        }
                    }
                }

            }
        }

        // Cluster
        if(!chunk.cluster.is_empty) {
            chunk.cluster.fillBlocks(this.maps, chunk, map);
        }

        // Plant trees
        for(let i = 0; i < maps.length; i++) {
            const m = maps[i];
            for(let j = 0; j < m.trees.length; j++) {
                const tree = m.trees[j];
                this.plantTree(
                    tree,
                    chunk,
                    m.chunk.coord.x + tree.pos.x - chunk.coord.x,
                    m.chunk.coord.y + tree.pos.y - chunk.coord.y,
                    m.chunk.coord.z + tree.pos.z - chunk.coord.z
                );
            }
        }

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        return map;

    }


}