import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";
import {DungeonGenerator} from "../dungeon.js";
import FlyIslands from "../flying_islands/index.js";

import { AABB } from '../../core/AABB.js';
import Demo_Map from "./demo_map.js";
import BottomCavesGenerator from "../bottom_caves/index.js";
import { ClusterManager } from "../cluster/manager.js";
import type { WorkerWorld } from "../../worker/world.js";
import type { ChunkWorkerChunk } from "../../worker/chunk.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

// Terrain generator class
export default class Terrain_Generator extends Demo_Map {
    [key: string]: any;

    constructor(world : WorkerWorld, seed : string, world_id : string, options : object) {
        super(seed, world_id, options);
        this.world = world;
        this.clusterManager = new ClusterManager(world, seed, 1);
        this._createBlockAABB = new AABB();
        this._createBlockAABB_second = new AABB();
        this.temp_set_block = null;
        this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        this.bottomCavesGenerator = new BottomCavesGenerator(world, seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
        this.flying_islands = new FlyIslands(world, seed, world_id, {});
    }

    async init() : Promise<boolean> {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        this.temp_vec       = new Vector(0, 0, 0);
        this.noisefn        = noise.perlin2;
        this.noisefn3d      = noise.perlin3;
        this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noisefn, this.noisefn3d);
        return true
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk : ChunkWorkerChunk) {
        if(!this.flying_islands) {
            return null;
        }
        const xyz = new Vector(0, 0, 0);
        const CHUNK_START_Y = 25;
        const CHUNK_HEIGHT = 2;
        if(chunk.addr.y >= CHUNK_START_Y && chunk.addr.y < CHUNK_START_Y + CHUNK_HEIGHT) {
            //
            const has_spiral_stairs = this.intersectSpiralStairs(chunk);
            if(has_spiral_stairs) {
                this.drawSpiralStaircases(chunk);
            }
            //
            const has_islands = this.intersectChunkWithIslands(chunk.aabb);
            if(has_islands) {
                const noise2d = noise.simplex2;
                for(let x = 0; x < chunk.size.x; x++) {
                    for(let z = 0; z < chunk.size.z; z++) {
                        const grass_level = Math.round(noise2d((x + chunk.coord.x) / 7, (z + chunk.coord.z) / 7) * 1.5);
                        for(let y = 0; y < chunk.size.y; y++) {
                            xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);
                            this.drawIsland(xyz, x, y, z, chunk, grass_level);
                        }
                    }
                }
            }
            //
            const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
            const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
            coord.y -= chunk.size.y * CHUNK_START_Y;
            addr.y -= CHUNK_START_Y;
            const fake_chunk = {...chunk, coord, addr, setBlockIndirect: chunk.setBlockIndirect};
            return this.flying_islands.generate(fake_chunk);
        };
        return null;
    }

    // Generate
    generate(chunk) {

        // Draw fly islands in the sky
        const resp = this.drawFlyIslands(chunk);
        if(resp) {
            return resp;
        }

        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);
        const map                       = maps[4];
        const cluster                   = chunk.cluster;

        chunk.map = map;
        chunk.genValue = 0;

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {
            this.bottomCavesGenerator.generate(chunk, aleaRandom, false);
            return map;
        }

        const xyz                       = new Vector(0, 0, 0);
        const temp_vec                  = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const BLOCK_WATER_ID            = BLOCK.STILL_WATER.id;
        const ywl                       = map.options.WATER_LINE - chunk.coord.y;
        const stone_block               = BLOCK.STONE.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const dirt_block_id             = BLOCK.DIRT.id;

        const has_voxel_buildings       = this.intersectChunkWithVoxelBuildings(chunk.aabb);
        const has_islands               = this.intersectChunkWithIslands(chunk.aabb);
        const has_extruders             = this.intersectChunkWithExtruders(chunk.aabb);
        const has_spiral_stairs         = this.intersectSpiralStairs(chunk);

        if(has_spiral_stairs) {
            this.drawSpiralStaircases(chunk);
        }

        //
        let dirt_block_mat = null;
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

                if(!dirt_block_mat || dirt_block_mat.id != dirt_block) {
                    dirt_block_mat = BLOCK.fromId(dirt_block);
                }

                cell.can_plant = false;

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
                        if(has_islands && this.drawIsland(xyz, x, y, z, chunk, 0)) {
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
                    let block_id = xyz.y < local_dirt_level ? stone_block : dirt_block;
                    if((grass_block_id == block_id || BLOCK.SNOW_DIRT.id == block_id) && xyz.y < value - 1) {
                        block_id = dirt_block_id;
                    }
                    chunk.setBlockIndirect(x, y, z, block_id);

                    // check if herbs planted
                    if(block_id == dirt_block && xyz.y == value - 1) {
                        cell.can_plant = dirt_block_mat.material.id == 'dirt' || dirt_block_mat.material.id == 'sand';
                    }

                }

                // Water and ice
                if(has_ocean_blocks) {
                    temp_vec.set(x, 0, z);
                    // water
                    for(let y = value; y <= map.options.WATER_LINE; y++) {
                        if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = y - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK_WATER_ID);
                        }
                    }
                    // ice
                    let iced = false;
                    if(cell.equator < .6 && cell.humidity > .4) {
                        const vl = map.options.WATER_LINE;
                        if(vl >= chunk.coord.y && vl < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = vl - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.ICE.id);
                            iced = true;
                        }
                    }
                    // LILI_PAD
                    if(!iced) {
                        const water_depth = map.options.WATER_LINE - value;
                        if(water_depth < 2 && rnd < .025) {
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y + 1, temp_vec.z, BLOCK.LILY_PAD.id);
                        }
                    }
                }

            }
        }

        // Hebrs and grass
        for(const [pos, blocks] of map.plants.entries()) {
            const cell = map.cells[pos.z * CHUNK_SIZE_X + pos.x];
            if(cell.can_plant) {
                for(let i = 0; i < blocks.length; i++) {
                    const block = blocks[i];
                    chunk.setBlockIndirect(pos.x, pos.y - chunk.coord.y + i, pos.z, block.id, null, block.extra_data || null);
                    if(block.not_transparent) {
                        chunk.setBlockIndirect(pos.x, pos.y - chunk.coord.y + i - 1, pos.z, dirt_block_id, null, null);
                    }
                }
            }
        }

        // Cluster
        chunk.cluster.fillBlocks(this.maps, chunk, map);

        // if(!globalThis.ggg) globalThis.ggg = 0;

        // Plant trees
        for(let i = 0; i < maps.length; i++) {
            const m = maps[i];
            for(let j = 0; j < m.trees.length; j++) {
                const tree = m.trees[j];
                //if(!('c' in tree)) {
                //    tree.c = true;
                //    // globalThis.ggg++;
                //}
                //if(tree.aabb && !chunk.aabb.intersect(tree.aabb)) {
                //    continue;
                //}
                // globalThis.ggg++;

                const x = m.chunk.coord.x + tree.pos.x - chunk.coord.x;
                const y = m.chunk.coord.y + tree.pos.y - chunk.coord.y;
                const z = m.chunk.coord.z + tree.pos.z - chunk.coord.z;

                if(!tree.type.transparent_trunk) {
                    const yu = y - 1;
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && (yu >= 0) && (yu < chunk.size.y)) {
                        chunk.setBlockIndirect(x, yu, z, dirt_block_id, null, null);
                    }
                }

                this.plantTree(this.world, tree, chunk, x, y, z, true);

            }
        }

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        // Dungeon
        this.dungeon.add(chunk);

        map.ores.draw(chunk);

        return map;

    }


}