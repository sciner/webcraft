import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../chunk_const.js";
import { Vector } from '../../helpers.js';
import { BLOCK } from '../../blocks.js';
import { alea, Default_Terrain_Generator } from "../default.js";
import { MineGenerator } from "../mine/mine_generator.js";
import { DungeonGenerator } from "../dungeon.js";
import { DensityParams, DENSITY_THRESHOLD, GENERATOR_OPTIONS, ORE_THRESHOLD, TerrainMapManager2, WATER_LEVEL } from "./terrain/manager.js";
// import FlyIslands from "../flying_islands/index.js";
import { ClusterManager } from "../cluster/manager.js";
import { createNoise2D, createNoise3D } from '../../../vendors/simplex-noise.js';
import { Chunk } from "../../worker/chunk.js";
import { NoiseFactory } from "./NoiseFactory.js";
import { TerrainMapCell } from "./terrain/map_cell.js";
import { TerrainMap2 } from "./terrain/map.js";
import { WorldClientOreGenerator } from "./client_ore_generator.js";
import BottomCavesGenerator from "../bottom_caves/index.js";

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

    /**
     * @type {TerrainMapManager2}
     */
    maps;

    constructor(world, seed, world_id, options) {

        const al = new alea(seed);
        const noise2d = createNoise2D(al.double);

        super(seed, world_id, options, noise2d, null);
        this.tempAlea = al;

        this.ore_generator = new WorldClientOreGenerator(world_id);

        this.n3d = createNoise3D(new alea(seed));

        this.clusterManager = new ClusterManager(world.chunkManager, seed, 2);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
        // this.flying_islands = new FlyIslands(world, seed, world_id, {});
    }

    async init() {
        const noiseFactory = new NoiseFactory();
        await super.init();
        await noiseFactory.init({outputSize: 32 * 32 * 48});

        this.noise3d = noiseFactory.createNoise3D({seed: this.seed, randomFunc: this.tempAlea.double });

        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        this.maps    = new TerrainMapManager2(this.seed, this.world_id, this.noise2d, this.noise3d);
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

        this.noise3d.scoreCounter = 0;

        const seed                      = this.seed + chunk.id;
        const rnd                       = new alea(seed);
        const cluster                   = chunk.cluster;

        chunk.timers.generate_maps = performance.now();
        const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);
        chunk.timers.generate_maps = performance.now() - chunk.timers.generate_maps;

        const map = chunk.map = maps[4];

        chunk.timers.generate_chunk_data = performance.now();
        this.generateChunkData(chunk, seed, rnd);
        chunk.timers.generate_chunk_data = performance.now() - chunk.timers.generate_chunk_data;

        // Mines
        chunk.timers.generate_mines = performance.now();
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }
        chunk.timers.generate_mines = performance.now() - chunk.timers.generate_mines;

        // Dungeon
        chunk.timers.generate_dungeon = performance.now();
        this.dungeon.add(chunk);
        chunk.timers.generate_dungeon = performance.now() - chunk.timers.generate_dungeon;

        // Cluster
        chunk.timers.generate_cluster = performance.now();
        cluster.fillBlocks(this.maps, chunk, map, false, false);
        chunk.timers.generate_cluster = performance.now() - chunk.timers.generate_cluster;

        // Plant trees
        chunk.timers.generate_trees = performance.now();
        this.plantTrees(maps, chunk);
        chunk.timers.generate_trees = performance.now() - chunk.timers.generate_trees;

        chunk.genValue = this.noise3d.scoreCounter;

        return map;

    }

    /**
     * Plant chunk trees
     * @param {[]TerrainMap2} maps 
     */
    plantTrees(maps, chunk) {
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
    }

    //
    generateChunkData(chunk, seed, rnd) {

        /**
         * @type {TerrainMap2}
         */
        const map                       = chunk.map;
        const xyz                       = new Vector(0, 0, 0);
        const density_params            = new DensityParams(0, 0, 0, 0, 0, 0);
        const over_density_params       = new DensityParams(0, 0, 0, 0, 0, 0);
        const cluster                   = chunk.cluster; // 3D clusters

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

        let maxY = WATER_LEVEL;
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = map.cells[z * CHUNK_SIZE_X + x];
                maxY = Math.max(maxY, this.maps.getMaxY(cell));
            }
        }
        maxY = Math.ceil(maxY + 1e-3);
        const sz = chunk.size.clone();
        sz.y = Math.min(sz.y, Math.max(1, maxY - chunk.coord.y));
        sz.y++;

        chunk.timers.generate_noise3d = performance.now();
        //TODO: for air, ignore this all?
        this.noise3d.generate4(chunk.coord, sz);
        chunk.timers.generate_noise3d = performance.now() - chunk.timers.generate_noise3d;

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                // const river_tunnel = noise2d(xyz.x / 256, xyz.z / 256) / 2 + .5;

                /**
                 * @type {TerrainMapCell}
                 */
                const cell                  = map.cells[z * CHUNK_SIZE_X + x];
                const has_cluster           = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);
                const cluster_cell          = has_cluster ? cluster.getCell(xyz.x, xyz.y, xyz.z) : null;
                const big_stone_density     = calcBigStoneDensity(xyz, has_cluster);

                const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;

                let cluster_drawed = false;
                let not_air_count = 0;

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

                // Calculate caves
                /*
                const cave_middle_level = 100;
                const cave_amplitude = 16;
                const cave_base_freq = 75
                const cave_width = .25 / (cave_base_freq / 64);
                const cave_rad = 4;
                const caves = [];
                for(let i = 0; i < 3; i++) {
                    const shift = 10000 * i;
                    const cave_x = xyz.x + shift;
                    const cave_z = xyz.z + shift;
                    const cave_density = Math.abs((this.noise2d(cave_x / cave_base_freq, cave_z / cave_base_freq)));
                    if(cave_density < cave_width) {
                        const cave_y_density = this.noise2d((cave_x + 10000) / 64, (cave_z + 10000) / 64);
                        const cave_y_pos = cave_middle_level - (cave_amplitude * 1.5 * i) + cave_y_density * cave_amplitude;
                        caves.push({cave_y_pos, cave_density});
                    }
                }
                */

                // Each y-column
                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;

                    // получает плотность в данном блоке (допом приходят коэффициенты, из которых посчитана данная плотность)
                    this.maps.calcDensity(xyz, cell, density_params, map);
                    let {d1, d2, d3, d4, density, dcaves} = density_params;

                    //
                    if(density > DENSITY_THRESHOLD) {

                        // Remove caves
                        /*
                        if(density > DENSITY_THRESHOLD) { // + (xyz.y <= WATER_LEVEL ? d3 * 2 + 3 : 0)) {
                            for(let cave of caves) {
                                const cave_height = (1 - cave.cave_density / cave_width) * cave_rad;
                                const y_diff = xyz.y - cave.cave_y_pos;
                                const dynamic_cave_height = y_diff > 0 ? d4 * 15 : 0;
                                if(Math.abs(y_diff) < cave_height + dynamic_cave_height) {
                                    density = 0;
                                }
                            }
                        }
                        */

                        if(density > 0) {

                            // убираем баг с полосой земли на границах чанков по высоте
                            if(y == chunk.size.y - 1) {
                                xyz.y++
                                this.maps.calcDensity(xyz, cell, over_density_params, map);
                                xyz.y--
                                if(over_density_params.density > DENSITY_THRESHOLD) {
                                    not_air_count = 100;
                                }
                            }

                            // get block
                            let {dirt_layer, block_id} = this.maps.getBlock(xyz, not_air_count, cell, density_params);

                            if(block_id == BLOCK.STONE.id) {
                                if(density < DENSITY_THRESHOLD + ORE_THRESHOLD) {
                                    // generating a small amount of ore on the surface of the walls
                                    block_id = this.ore_generator.generate(xyz);
                                } else {
                                    block_id = BLOCK.UNCERTAIN_STONE.id
                                }
                            }

                            // если это самый первый слой поверхности
                            if(not_air_count == 0) {

                                // random joke sign
                                if(d3 >= .2 && d3 <= .20005 && xyz.y > 100 && y < chunk.size.y -2) {
                                    chunk.setBlockIndirect(x, y + 1, z, BLOCK.SPRUCE_SIGN.id, new Vector(Math.PI*2*rnd.double(), 1, 0), {"text":'       Hello,\r\n      World!',"username":"username","dt":"2022-11-25T18:01:52.715Z"});
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

                        }

                        not_air_count++;

                    } else {

                        not_air_count = 0;

                        // чтобы в пещерах не было воды
                        if(dcaves === 0) {

                            // если это уровень воды
                            if(xyz.y <= GENERATOR_OPTIONS.WATER_LINE) {
                                let block_id = BLOCK.STILL_WATER.id;
                                // поверхность воды
                                if(xyz.y == GENERATOR_OPTIONS.WATER_LINE) {
                                    // если холодно, то рисуем рандомные льдины
                                    const water_cap_ice = (cell.temperature * 2 - 1 < 0) ? (d3 * .6 + d1 * .2 + d4 * .1) : 0;
                                    if(water_cap_ice > .12) {
                                        block_id = BLOCK.ICE.id;
                                        // в еще более рандомных случаях на льдине рисует пику
                                        if(dist_percent < .7 && d1 > 0 && d3 > .65 && op.id != 'norm') {
                                            const peekh = Math.floor(CHUNK_SIZE_Y * .75 * d3 * d4);
                                            for(let ph = 0; ph < peekh; ph++) {
                                                chunk.setBlockIndirect(x, y + ph, z, block_id);
                                            }
                                        }
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

}