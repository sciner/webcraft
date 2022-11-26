import { CHUNK_SIZE_X, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { Vector } from '../../helpers.js';
import { BLOCK } from '../../blocks.js';
import { alea, Default_Terrain_Generator } from "../default.js";
import { MineGenerator } from "../mine/mine_generator.js";
import { DungeonGenerator } from "../dungeon.js";
import { GENERATOR_OPTIONS, TerrainMapManager2 } from "./terrain/manager.js";
// import FlyIslands from "../flying_islands/index.js";
import { ClusterManager } from "../cluster/manager.js";
import { createNoise2D, createNoise3D } from '../../../vendors/simplex-noise.js';
import { Chunk } from "../../worker/chunk.js";

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

    constructor(world, seed, world_id, options) {

        const al = new alea(seed);
        const noise2d = createNoise2D(al.double);
        const noise3d = createNoise3D(al.double);

        super(seed, world_id, options, noise2d, noise3d);

        this.clusterManager = new ClusterManager(world.chunkManager, seed, 2);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
        // this.flying_islands = new FlyIslands(world, seed, world_id, {});
    }

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        this.maps           = new TerrainMapManager2(this.seed, this.world_id, this.noise2d, this.noise3d);
    }

    /*
    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const xyz = new Vector(0, 0, 0);
        const CHUNK_START_Y = 25;
        const CHUNK_HEIGHT = 2;
        if(chunk.addr.y >= CHUNK_START_Y && chunk.addr.y < CHUNK_START_Y + CHUNK_HEIGHT) {
            const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
            const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
            coord.y -= chunk.size.y * CHUNK_START_Y;
            addr.y -= CHUNK_START_Y;
            const fake_chunk = {...chunk, coord, addr};
            fake_chunk.setBlockIndirect = chunk.setBlockIndirect;
            return this.flying_islands.generate(fake_chunk);
        };
        return null;
    }
    */

    /**
     * Generate
     * @param {Chunk} chunk 
     * @returns 
     */
    generate(chunk) {

        /*
        // Draw fly islands in the sky
        const resp = this.drawFlyIslands(chunk);
        if(resp) {
            return resp;
        }
        */

        const seed                      = this.seed + chunk.id;
        const rnd                       = new alea(seed);
        const cluster                   = chunk.cluster;
        const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);

        const map = chunk.map = maps[4];

        this.generateChunkData(chunk, seed, rnd);

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        // Dungeon
        this.dungeon.add(chunk);

        // Cluster
        cluster.fillBlocks(this.maps, chunk, map, false, false);

        // Plant trees
        for(let i = 0; i < maps.length; i++) {
            const m = maps[i];
            for(let j = 0; j < m.trees.length; j++) {

                const tree = m.trees[j];

                const x = m.chunk.coord.x + tree.pos.x - chunk.coord.x;
                const y = m.chunk.coord.y + tree.pos.y - chunk.coord.y;
                const z = m.chunk.coord.z + tree.pos.z - chunk.coord.z;

                /*
                if(!tree.type.transparent_trunk) {
                    const yu = y - 1;
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && (yu >= 0) && (yu < chunk.size.y)) {
                        chunk.setBlockIndirect(x, yu, z, dirt_block_id, null, null);
                    }
                }
                */

                this.plantTree(tree, chunk, x, y, z, true);

            }
        }

        return map;

    }

    //
    generateChunkData(chunk, seed, rnd) {
        
        const cluster                   = chunk.cluster;
        const map                       = chunk.map;
        const xyz                       = new Vector(0, 0, 0);

        let not_air_count               = -1;

        //
        const calcBigStoneDensity = (xyz, has_cluster) => {
            if(has_cluster) {
                return 0;
            }
            const n2 = this.noise2d(xyz.x/1000, xyz.z/1000);
            if(n2 > .6825) {
                return this.noise2d(xyz.x/16, xyz.z/16);
            }
            return 0;
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                const cell = map.cells[z * CHUNK_SIZE_X + x];

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                // const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;
                // const river_tunnel = noise2d(xyz.x / 256, xyz.z / 256) / 2 + .5;

                const has_cluster = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);
                const cluster_cell = has_cluster ? cluster.getCell(xyz.x, xyz.y, xyz.z) : null;

                let cluster_drawed = false;

                // big stones
                const big_stone_density = calcBigStoneDensity(xyz, has_cluster);

                /*
                if(!globalThis.used_biomes) {
                    globalThis.used_biomes = new Map();
                }
                if(!globalThis.used_biomes.has(cell.biome.title)) {
                    globalThis.used_biomes.set(cell.biome.title, cell.biome.title);
                    console.table(Array.from(globalThis.used_biomes.values()))
                    console.log(cell.biome.title, xyz.toHash())
                }
                */

                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;
                    // получает плотность в данном блоке (допом приходят коэффициенты, из которых посчитана данная плотность)
                    const density_params = this.maps.calcDensity(xyz, cell);
                    const {d1, d2, d3, d4, density} = density_params;

                    //
                    if(density > .6) {

                        const {dirt_layer, block_id} = this.maps.getBlock(xyz, not_air_count, cell, density_params);

                        // если это самый первый слой поверхности
                        if(not_air_count == 0) {

                            // random joke sign
                            if(d3 >= .2 && d3 <= .20005 && xyz.y > 100 && y < chunk.size.y -2) {
                                chunk.setBlockIndirect(x, y + 1, z, BLOCK.SPRUCE_SIGN.id, new Vector(Math.PI*2*rnd.double(), 1, 0), {"text":'       Hello,\r\n      World!',"username":"Vasya","dt":"2022-11-25T18:01:52.715Z"});
                            }

                            // если это над водой
                            if(xyz.y > GENERATOR_OPTIONS.WATER_LINE) {

                                if(cluster_cell && !cluster_cell.building) {

                                    // прорисовка наземных блоков кластера
                                    if(!cluster_drawed) {
                                        cluster_drawed = true;
                                        if(y < chunk.size.y - cluster_cell.height) {
                                            if(Array.isArray(cluster_cell.block_id)) {
                                                for(let yy = 0; yy < cluster_cell.height; yy++) {
                                                    chunk.setBlockIndirect(x, y + yy + cluster_cell.y_shift, z, cluster_cell.block_id[yy]);
                                                }
                                            } else {
                                                for(let yy = 0; yy < cluster_cell.height; yy++) {
                                                    chunk.setBlockIndirect(x, y + yy + cluster_cell.y_shift, z, cluster_cell.block_id);
                                                }
                                            }
                                        }
                                        if(cluster_cell.y_shift == 0) {
                                            not_air_count++;
                                            continue
                                        }
                                    }

                                } else {

                                    // шапка слоя земли (если есть)
                                    if(y < chunk.size.y && dirt_layer.cap_block_id) {
                                        chunk.setBlockIndirect(x, y + 1, z, dirt_layer.cap_block_id);
                                    }

                                    // Plants and grass (растения и трава)
                                    const {plant_blocks} = cell.genPlantOrGrass(x, y, z, chunk.size, block_id, rnd, density_params);
                                    if(plant_blocks) {
                                        for(let i = 0; i < plant_blocks.length; i++) {
                                            const p = plant_blocks[i];
                                            chunk.setBlockIndirect(x, y + 1 + i, z, p.id, null, p.extra_data || null);
                                            // вообще не помню зачем это, но вроде нужная штука
                                            //if(block.not_transparent) {
                                            //    chunk.setBlockIndirect(pos.x, pos.y - chunk.coord.y + i - 1, pos.z, dirt_block_id, null, null);
                                            //}
                                        }
                                    }

                                    // draw big stones
                                    if(y < chunk.size.y - 2 && big_stone_density > .5) {
                                        chunk.setBlockIndirect(x, y + 1, z, BLOCK.MOSSY_COBBLESTONE.id);
                                        if(big_stone_density > .6) {
                                            chunk.setBlockIndirect(x, y + 2, z, BLOCK.MOSSY_COBBLESTONE.id);
                                        }
                                    }
                                }
                            }
                        }

                        //
                        if(not_air_count == 0 && !cell.dirt_layer) {
                            cell.dirt_layer = dirt_layer;
                        }
                        chunk.setBlockIndirect(x, y, z, block_id);

                        not_air_count++;

                    } else {

                        not_air_count = 0;

                        if(xyz.y <= GENERATOR_OPTIONS.WATER_LINE) {
                            let block_id = BLOCK.STILL_WATER.id;
                            if(cell.temperature * 2 - 1 < 0 && xyz.y == GENERATOR_OPTIONS.WATER_LINE) {
                                if((d3 * .6 + d1 * .2 + d4 * .1) > .12) {
                                    block_id = BLOCK.ICE.id;
                                }
                            }
                            chunk.setBlockIndirect(x, y, z, block_id);
                        }

                        if(xyz.y == GENERATOR_OPTIONS.WATER_LINE + 1 && cell.biome.title == 'Болото') {
                            if(rnd.double() < .07) {
                                chunk.setBlockIndirect(x, y, z, BLOCK.LILY_PAD.id);
                            }
                        }

                    }

                }
            }
        }

    }

}