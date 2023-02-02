import { IndexedColor, Vector } from "../../../helpers.js";
import { MineGenerator } from "../../mine/mine_generator.js";
import { BLOCK } from '../../../blocks.js';
import { DensityParams, DENSITY_AIR_THRESHOLD, MapsBlockResult, TerrainMapManager2, UNCERTAIN_ORE_THRESHOLD, WATER_LEVEL } from "../terrain/manager.js";
import { TerrainMapCell } from "../terrain/map_cell.js";
import { TerrainMap2 } from "../terrain/map.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y } from "../../../chunk_const.js";
import { Biome } from "../biomes.js";
import { AQUIFERA_UP_PADDING } from "../aquifera.js";
import { WorldClientOreGenerator } from "../client_ore_generator.js";
import { DungeonGenerator } from "../../dungeon.js";

import { alea } from "../../default.js";

// import BottomCavesGenerator from "../../bottom_caves/index.js";

const BIG_STONE_DESNSITY = 0.6;

export default class Biome3LayerOverworld {

    /**
     * @param { import("../index.js").Terrain_Generator } generator
     */
    constructor(generator) {

        this.generator = generator

        const world = generator.world
        const world_id = generator.world_id
        const seed = generator.seed

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d

        this.maps = new TerrainMapManager2(seed, world_id, generator.noise2d, generator.noise3d);

        this.ore_generator = new WorldClientOreGenerator(world_id)
        this.clusterManager = generator.clusterManager
        this.dungeon = new DungeonGenerator(seed)
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {})

    }

    /**
     * @param {Vector} xyz 
     * @param {boolean} has_cluster 
     * @returns {float}
     */
    calcBigStoneDensity(xyz, has_cluster) {
        if(has_cluster) {
            return 0.;
        }
        const n2 = this.noise2d(xyz.x/1000, xyz.z/1000);
        if(n2 > .6825) {
            return this.noise2d(xyz.x/16, xyz.z/16);
        }
        return 0.;
    }

    /**
     * @param {object} chunk 
     * @param {string} seed 
     * @param {*} rnd 
     * @returns {TerrainMap2}
     */
    generate(chunk, seed, rnd) {

        const cluster = chunk.cluster

        // Generate maps around chunk
        chunk.timers.start('generate_maps')
        const maps = this.maps.generateAround(chunk, chunk.addr, true, true)
        chunk.timers.stop()

        const map = chunk.map = maps[4]

        // Generate chunk data
        chunk.timers.start('generate_chunk_data')
        this.generateChunkData(chunk, seed, rnd)
        chunk.timers.stop()

        // Mines
        chunk.timers.start('generate_mines')
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord)
            mine.fillBlocks(chunk);
        }
        chunk.timers.stop()

        // Dungeon
        chunk.timers.start('generate_dungeon')
        this.dungeon.add(chunk)
        chunk.timers.stop()

        // Cluster
        chunk.timers.start('generate_cluster')
        cluster.fillBlocks(this.maps, chunk, map, false, false)
        chunk.timers.stop()

        // Plant trees
        chunk.timers.start('generate_trees')
        this.plantTrees(maps, chunk)
        chunk.timers.stop()

        return map

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

                // Replace grass_block with dirt under trees
                if(chunk.addr.x == m.chunk.addr.x && chunk.addr.z == m.chunk.addr.z) {
                    const yu = y - 1
                    if(yu >= 0 && yu < chunk.size.y) {
                        const cell = m.getCell(tree.pos.x, tree.pos.z)
                        if(!cell.is_sand && !tree.type.transparent_trunk) {
                            chunk.setBlockIndirect(x, yu, z, BLOCK.DIRT.id)
                        }
                    }
                }

                // Draw tree blocks into chunk
                this.generator.plantTree(this.world, tree, chunk, x, y, z, true);

            }
        }
    }

    /**
     * @param {Chunk} chunk 
     * @returns 
     */
     calcColumnNoiseSize(chunk) {
        let maxY = WATER_LEVEL
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = chunk.map.cells[z * CHUNK_SIZE_X + x];
                maxY = Math.max(maxY, this.maps.getMaxY(cell));
            }
        }
        if(chunk.map.aquifera && !chunk.map.aquifera.is_empty) {
            maxY = Math.max(maxY, chunk.map.aquifera.pos.y + AQUIFERA_UP_PADDING)
        }

        maxY = Math.ceil(maxY + 1e-3);
        const resp = chunk.size.clone();
        resp.y = Math.min(resp.y, Math.max(1, maxY - chunk.coord.y));
        resp.y++;
        return resp
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
        const dirt_block_id             = BLOCK.DIRT.id
        const STONE_BLOCKS              = [BLOCK.STONE.id, BLOCK.ANDESITE.id, BLOCK.DIORITE.id, BLOCK.GRANITE.id]
        const block_result              = new MapsBlockResult()

        const rand_lava = new alea('random_lava_source_' + this.seed);

        // generate densisiy values for column
        chunk.timers.start('generate_noise3d')
        const sz = this.calcColumnNoiseSize(chunk)
        // TODO: for air, ignore this all?
        this.generator.noise3d.generate4(chunk.coord, sz);
        chunk.timers.stop()

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                /**
                 * @type {TerrainMapCell}
                 */
                const cell                  = map.getCell(x, z)
                const has_cluster           = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);
                const cluster_cell          = has_cluster ? cluster.getCell(xyz.x, xyz.y, xyz.z) : null;
                const big_stone_density     = this.calcBigStoneDensity(xyz, has_cluster);

                const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;

                let cluster_drawed = false;
                let not_air_count = 0;

                // Debug biomes
                // this.dumpBiome(xyz, cell.biome)

                // Each y-column
                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;

                    // получает плотность в данном блоке (допом приходят коэффициенты, из которых посчитана данная плотность)
                    this.maps.calcDensity(xyz, cell, density_params, map);
                    let {d1, d2, d3, d4, density, dcaves, in_aquifera, local_water_line} = density_params;

                    // Блоки камня
                    if(density > DENSITY_AIR_THRESHOLD) {

                        // убираем баг с полосой земли на границах чанков по высоте
                        if(y == chunk.size.y - 1) {
                            xyz.y++
                            this.maps.calcDensity(xyz, cell, over_density_params, map);
                            xyz.y--
                            if(over_density_params.density > DENSITY_AIR_THRESHOLD) {
                                not_air_count = 100;
                            }
                        }

                        // get block
                        let {dirt_layer, block_id} = this.maps.getBlock(xyz, not_air_count, cell, density_params, block_result)

                        if(STONE_BLOCKS.includes(block_id)) {
                            if(density < DENSITY_AIR_THRESHOLD + UNCERTAIN_ORE_THRESHOLD) {
                                // generating a small amount of ore on the surface of the walls
                                block_id = this.ore_generator.generate(xyz, block_id);
                            } else {
                                block_id = BLOCK.UNCERTAIN_STONE.id
                            }
                        }

                        // если это самый первый слой поверхности
                        if(not_air_count == 0) {

                            // нужно обязательно проверить ватерлинию над текущим блоком
                            // (чтобы не сажать траву в аквиферах)
                            xyz.y++
                            this.maps.calcDensity(xyz, cell, over_density_params, map);
                            xyz.y--

                            // если это над водой
                            if(xyz.y > over_density_params.local_water_line) {

                                // random joke sign
                                if(d3 >= .2 && d3 <= .20005 && xyz.y > 100 && y < chunk.size.y -2) {
                                    chunk.setBlockIndirect(x, y + 1, z, BLOCK.SPRUCE_SIGN.id, new Vector(Math.PI*2*rnd.double(), 1, 0), {"text":'       Hello,\r\n      World!',"username":"username","dt":"2022-11-25T18:01:52.715Z"});
                                }

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
                                    if(xyz.y > WATER_LEVEL && y < chunk.size.y && dirt_layer.cap_block_id) {
                                        chunk.setBlockIndirect(x, y + 1, z, dirt_layer.cap_block_id);
                                    }

                                    // Plants and grass (растения и трава)
                                    const plant_blocks = cell.genPlantOrGrass(x, y, z, chunk.size, block_id, rnd, density_params)
                                    if(plant_blocks) {
                                        for(let i = 0; i < plant_blocks.length; i++) {
                                            const p = plant_blocks[i];
                                            chunk.setBlockIndirect(x, y + 1 + i, z, p.id, null, p.extra_data || null);
                                        }
                                        // замена блока травы на землю, чтобы потом это не делал тикер (например арбуз)
                                        if(plant_blocks[0].not_transparent) {
                                            block_id = null
                                            chunk.setBlockIndirect(x, y, z, dirt_block_id, null, null);
                                        }
                                    }

                                    // draw big stones
                                    if(y < chunk.size.y - 2 && big_stone_density > .5) {
                                        if(!cell.biome.is_sand) {
                                            block_id = null
                                            chunk.setBlockIndirect(x, y, z, dirt_block_id, null, null)
                                        }
                                        chunk.setBlockIndirect(x, y + 1, z, BLOCK.MOSSY_COBBLESTONE.id);
                                        if(big_stone_density > BIG_STONE_DESNSITY) {
                                            chunk.setBlockIndirect(x, y + 2, z, BLOCK.MOSSY_COBBLESTONE.id);
                                        }
                                    }
                                }

                            } else {

                                // рандомный блок лавы
                                //if((xyz.y < local_water_line - 5) && (rand_lava.double() < .0015)) {
                                //    chunk.setBlockIndirect(x, y + 1, z, BLOCK.STILL_LAVA.id);
                                //}

                            }
                        }

                        //
                        if(not_air_count == 0 && !cell.dirt_layer) {
                            cell.dirt_layer = dirt_layer;
                        }

                        if(block_id) {
                            chunk.setBlockIndirect(x, y, z, block_id);
                        }
                        not_air_count++;

                    } else {

                        // Блоки воздуха/воды

                        const is_ceil = not_air_count > 0

                        not_air_count = 0;

                        // чтобы в пещерах не было воды
                        if(dcaves == 0 || in_aquifera) {

                            const local_fluid_block_id = in_aquifera ? map.aquifera.block_id : BLOCK.STILL_WATER.id

                            // если это уровень воды
                            if(xyz.y <= local_water_line) {
                                let block_id = local_fluid_block_id;
                                // поверхность воды
                                if(xyz.y == local_water_line) {
                                    if(local_fluid_block_id == BLOCK.STILL_WATER.id) {
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
                                }
                                chunk.setBlockIndirect(x, y, z, block_id);
                            }

                            if(xyz.y == local_water_line + 1 && cell.biome.title == 'Болото') {
                                if(rnd.double() < .07) {
                                    chunk.setBlockIndirect(x, y, z, BLOCK.LILY_PAD.id);
                                }
                            }

                        } else {

                            // внутренность пещеры

                            // потолок и часть стен
                            if(is_ceil) {

                                // если не песчаный
                                if(!cell.biome.is_sand) {
                                    if(d1 > .25) {
                                        if(d3 > .25) {
                                            chunk.setBlockIndirect(x, y, z, BLOCK.MOSS_BLOCK.id)
                                            continue
                                        }
                                    }
                                }

                                // рандомный светящийся лишайник на потолке
                                if((xyz.y < local_water_line - 5) && (rand_lava.double() < .015)) {
                                    chunk.setBlockIndirect(x, y, z, BLOCK.GLOW_LICHEN.id, null, {down: true, rotate: false});
                                }

                            }

                        }

                    }

                }

            }
        }

    }

    /**
     * Dump biome
     * @param {Vector} xyz 
     * @param {Biome} biome 
     */
     dumpBiome(xyz, biome) {
        if(!globalThis.used_biomes) {
            globalThis.used_biomes = new Map();
        }
        if(!globalThis.used_biomes.has(biome.title)) {
            globalThis.used_biomes.set(biome.title, biome.title);
            console.table(Array.from(globalThis.used_biomes.values()))
            console.log(biome.title, xyz.toHash())
        }
    }

}