import { Vector } from "../../../helpers.js";
import { MineGenerator } from "../../mine/mine_generator.js";
import { DENSITY_AIR_THRESHOLD, MapsBlockResult, TerrainMapManager2, UNCERTAIN_ORE_THRESHOLD } from "../terrain/manager.js";
import { CHUNK_SIZE, CHUNK_SIZE_X, CHUNK_SIZE_Y } from "../../../chunk_const.js";
import { AQUIFERA_UP_PADDING } from "../aquifera.js";
import { WorldClientOreGenerator } from "../client_ore_generator.js";
import { DungeonGenerator } from "../../dungeon.js";

import { alea } from "../../default.js";
import { DensityParams, WATER_LEVEL } from "../terrain/manager_vars.js";
import type { TerrainMap2 } from "../terrain/map.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type Terrain_Generator from "../index.js";
import { FLUID_STRIDE } from "../../../fluid/FluidConst.js";
import type { TerrainMapCell } from "../terrain/map_cell.js";
import Biome3LayerBase from "./base.js";
import type { ClusterManager } from "../../cluster/manager.js";
import { BLOCK_FLAG } from "../../../constant.js";

// import BottomCavesGenerator from "../../bottom_caves/index.js";

const BIG_STONE_DESNSITY = 0.6;
const GROUND_PLACE_SIZE = 3
const _ground_places = new Array(CHUNK_SIZE * GROUND_PLACE_SIZE)

export default class Biome3LayerOverworld extends Biome3LayerBase {
    generator:              Terrain_Generator
    maps:                   TerrainMapManager2
    ore_generator:          WorldClientOreGenerator
    clusterManager:         ClusterManager
    dungeon:                DungeonGenerator
    noise2d:                any
    noise3d:                any
    slab_candidates:        any[]
    seed:                   string
    onground_place_index:   any

    constructor(generator : Terrain_Generator) {

        super(generator)

        const seed = generator.seed

        const world_id = generator.world_id
        this.maps = new TerrainMapManager2(seed, world_id, generator.noise2d, generator.noise3d, generator.block_manager, generator.options);

        this.ore_generator = new WorldClientOreGenerator(world_id)
        this.clusterManager = generator.clusterManager
        this.dungeon = new DungeonGenerator(seed)
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {})

    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : TerrainMap2 {

        // Generate maps around chunk
        chunk.timers.start('generate_maps')
        const maps = this.maps.generateAround(chunk, chunk.addr, true, true)
        chunk.timers.stop()

        const map = chunk.map = maps[4]

        // Cluster
        chunk.timers.start('generate_cluster')
        chunk.cluster = this.clusterManager.getForCoord(chunk.coord, this.maps) ?? null
        chunk.timers.stop()

        // Generate chunk data
        chunk.timers.start('generate_chunk_data')
        this.slab_candidates = []
        this.generateChunkData(chunk, seed, rnd)
        chunk.timers.stop()

        chunk.timers.start('process_slab_candidates')
        this.processSlabCandidates(chunk)
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
        chunk.timers.start('fill_cluster')
        chunk.cluster.fillBlocks(this.maps, chunk, map, false, false)
        chunk.timers.stop()

        // Plant trees
        chunk.timers.start('generate_trees')
        this.plantTrees(maps, chunk)
        chunk.timers.stop()

        // Generate ground blocks
        chunk.timers.start('generate_onground_blocks')
        this.generateOnGroundBlocks(maps, chunk, rnd)
        chunk.timers.stop()

        return map

    }

    addSlabCandidate(xyz : Vector, block_id : int, slab_block_id : int) {
        if(this.generator.options.generate_natural_slabs) {
            this.slab_candidates.push(xyz.clone(), block_id, slab_block_id)
        }
    }

    generateOnGroundBlocks(maps : TerrainMap2[], chunk : ChunkWorkerChunk, rnd : alea) {
        const ids = chunk.tblocks.id
        const _vec = new Vector(0, 0, 0)
        const xyz = new Vector(0, 0, 0)
        const map = chunk.map as TerrainMap2
        const bm = chunk.chunkManager.block_manager
        const blockFlags = bm.flags

        for(let i = 0; i < this.onground_place_index; i += GROUND_PLACE_SIZE) {
            const flat_index = _ground_places[i]
            _vec.fromFlatChunkIndex(flat_index)
            // const index = _vec.relativePosToChunkIndex()
            if(_vec.y < 1) continue
            _vec.y--
            const under_index = _vec.relativePosToChunkIndex()
            _vec.y++
            const under_block_id = ids[under_index]
            if(!(blockFlags[under_block_id] & BLOCK_FLAG.SOLID)) {
                 continue
            }
            const density_params = _ground_places[i + 2]
            const cell = map.getCell(_vec.x, _vec.z)
            const ground_block_generators = cell.biome.ground_block_generators
            if(!ground_block_generators) {
                continue
            }
            let r = rnd.double()
            if(r > ground_block_generators.frequency) {
                continue
            }
            r /= ground_block_generators.frequency
            let freq = 0
            for(let j = 0; j < ground_block_generators.list.length; j++) {
                const g = ground_block_generators.list[j]
                freq += g.percent
                if(freq >= r) {
                    xyz.copyFrom(chunk.coord).addSelf(_vec)
                    if(cell.checkWhen(g.when, xyz, density_params, under_block_id, bm)) {
                        const blocks = g.generate(xyz, chunk, rnd.double())
                        if(blocks) {
                            for(let y = 0; y < blocks.length; y++) {
                                const b = blocks[y]
                                chunk.setBlockIndirect(_vec.x, _vec.y, _vec.z, b.id, null, b.extra_data ?? null)
                                _vec.y++
                            }
                        }
                    }
                    break
                }
            }
        }
    }

    /**
     * Replace few blocks with his slab variant
     */
    processSlabCandidates(chunk : ChunkWorkerChunk) {
        const bm = chunk.chunkManager.block_manager
        const blockFlags = bm.flags
        const { cx, cy, cz, cw } = chunk.dataChunk
        const ids = chunk.tblocks.id
        const fids = chunk.fluid.uint8View

        const neighbourIsTransparent = (x : int, y : int, z : int) : boolean => {
            if(x < 0 || z < 0 || x >= chunk.size.x || z >= chunk.size.z) {
                return false
            }
            const index = cx * x + cy * y + cz * z + cw
            const id = ids[index]
            const fluid = fids[index * FLUID_STRIDE]
            if(fluid != 0) {
                return false
            }
            if((blockFlags[id] & BLOCK_FLAG.SOLID) || (blockFlags[id] & BLOCK_FLAG.OPAQUE_FOR_NATURAL_SLAB)) {
                return false
            }
            return true
        }

        for(let i = 0; i < this.slab_candidates.length; i += 3) {
            const xyz = this.slab_candidates[i]
            this.slab_candidates[i] = null
            const x = xyz.x - chunk.coord.x
            const y = xyz.y - chunk.coord.y
            const z = xyz.z - chunk.coord.z
            let transparent_count = 0
            if(neighbourIsTransparent(x - 1, y, z)) transparent_count++
            if(neighbourIsTransparent(x + 1, y, z)) transparent_count++
            if(neighbourIsTransparent(x, y, z - 1)) transparent_count++
            if(neighbourIsTransparent(x, y, z + 1)) transparent_count++
            if(transparent_count > 0) {
                const index_up = cx * x + cy * (y + 1) + cz * z + cw
                if((blockFlags[ids[index_up]] & BLOCK_FLAG.SOLID) != BLOCK_FLAG.SOLID) {
                    const index_bottom = cx * x + cy * (y - 1) + cz * z + cw
                    if(blockFlags[ids[index_bottom]] & BLOCK_FLAG.SOLID) {
                        this.slab_candidates[i] = xyz
                    }
                }
            }
        }
        
        for(let i = 0; i < this.slab_candidates.length; i += 3) {
            const xyz = this.slab_candidates[i]
            if(xyz) {
                const x = xyz.x - chunk.coord.x
                const y = xyz.y - chunk.coord.y
                const z = xyz.z - chunk.coord.z
                const new_block_id = this.slab_candidates[i + 2]
                chunk.tblocks.setBlockId(x, y, z, new_block_id)
            }
        }

    }

    calcBigStoneDensity(xyz : Vector, has_cluster : boolean) : float {
        if(has_cluster) {
            return 0.;
        }
        const n2 = this.noise2d(xyz.x/1000, xyz.z/1000);
        if(n2 > .6825) {
            return this.noise2d(xyz.x/16, xyz.z/16);
        }
        return 0.;
    }

    calcColumnNoiseSize(chunk : ChunkWorkerChunk) : Vector {
        let maxY = WATER_LEVEL
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = chunk.map.cells[z * CHUNK_SIZE_X + x]
                maxY = Math.max(maxY, (this.maps as TerrainMapManager2).getMaxY(cell))
            }
        }
        if(chunk.map.aquifera && !chunk.map.aquifera.is_empty) {
            maxY = Math.max(maxY, chunk.map.aquifera.pos.y + AQUIFERA_UP_PADDING)
        }

        maxY = Math.ceil(maxY + 1e-3);
        const resp = chunk.size.clone();
        resp.y = Math.min(resp.y, Math.max(1, maxY - chunk.coord.y))
        resp.y++
        return resp
    }

    /**
     */
    generateChunkData(chunk : ChunkWorkerChunk, seed : string, rnd : any) {

        const bm                        = chunk.chunkManager.block_manager
        const map                       = chunk.map as TerrainMap2;
        const xyz                       = new Vector(0, 0, 0);
        const xyz_temp                  = new Vector(0, 0, 0);
        const density_params            = new DensityParams(0, 0, 0, 0, 0, 0);
        const over_density_params       = new DensityParams(0, 0, 0, 0, 0, 0);
        const cluster                   = chunk.cluster; // 3D clusters
        const dirt_block_id             = bm.DIRT.id
        const grass_block_id            = bm.GRASS_BLOCK.id
        const sand_block_id             = bm.SAND.id
        const podzol_block_id           = bm.PODZOL.id
        const gravel_id                 = bm.GRAVEL.id
        const blockFlags                = bm.flags
        const block_result              = new MapsBlockResult()
        const rand_lava                 = new alea('random_lava_source_' + this.seed)
        const map_manager               = this.maps as TerrainMapManager2

        // generate densisiy values for column
        chunk.timers.start('generate_noise3d')
        const sz = this.calcColumnNoiseSize(chunk)
        const crd = chunk.coord.clone()
        sz.y++
        crd.y--
        // TODO: for air, ignore this all?
        this.generator.noise3d.generate4(crd, sz);
        chunk.timers.stop()

        this.onground_place_index = 0

        //
        const plantGrass = (x : int, y : int, z : int, xyz : Vector, block_id : int, cell : TerrainMapCell, density_params : DensityParams) : boolean => {
            const plant_blocks = cell.genPlantOrGrass(x, y, z, xyz, chunk.size, block_id, rnd, density_params, chunk)
            _ground_places[this.onground_place_index++] = Vector.relativePosToFlatIndexInChunk(x, y, z)
            _ground_places[this.onground_place_index++] = block_id
            _ground_places[this.onground_place_index++] = density_params
            if(plant_blocks) {
                for(let i = 0; i < plant_blocks.length; i++) {
                    const p = plant_blocks[i];
                    let rotate = null
                    let extra_data = p.extra_data || null
                    if(p.is_petals) {
                        let petals = Math.floor(rnd.double() * 4) + 1
                        if(petals > 1) {
                            extra_data = {petals}
                        }
                        rotate = new Vector(Math.floor(rnd.double() * 4), 1, 0)
                    }
                    chunk.setBlockIndirect(x, y + i, z, p.id, rotate, extra_data);
                }
                return !!plant_blocks[0].not_transparent
            }
            return false
        }

        chunk.timers.start('blocks')

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);
                // const columnIndex = chunk.getColumnIndex(x, z)

                const cell                  = map.getCell(x, z)
                const has_cluster           = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.z, 2);
                const cluster_cell          = has_cluster ? cluster.getCell(xyz.x, xyz.z) : null;
                const big_stone_density     = this.calcBigStoneDensity(xyz, has_cluster);

                const {dist_percent, op /*, relief, mid_level, radius, dist, density_coeff*/ } = cell.preset;
                const hanging_foliage_block_id = cell.biome.is_snowy ? bm.ICE.id : bm.OAK_LEAVES.id

                let cluster_drawed = false;
                let not_air_count = 0;
                let air_count = 0
                let has_overfluid_block = false

                let dcaves = 0
                let dcaves_over = 0

                // Debug biomes
                // this.dumpBiome(xyz, cell.biome)

                // Each y-column
                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;

                    // получает плотность в данном блоке (допом приходят коэффициенты, из которых посчитана данная плотность)
                    map_manager.calcDensity(xyz, cell, density_params, map);
                    let {d1, d2, d3, d4, density, in_aquifera, local_water_line} = density_params;

                    dcaves_over = dcaves
                    dcaves = density_params.dcaves

                    // Блоки камня
                    if(density > DENSITY_AIR_THRESHOLD) {

                        const air_height = air_count
                        air_count = 0

                        // убираем баг с полосой земли на границах чанков по высоте
                        if(y == chunk.size.y - 1) {
                            xyz.y++
                            map_manager.calcDensity(xyz, cell, over_density_params, map);
                            xyz.y--
                            if(over_density_params.density > DENSITY_AIR_THRESHOLD) {
                                not_air_count = 100;
                            }
                        }

                        // get block
                        let {dirt_layer, block_id} = map_manager.getBlock(xyz, not_air_count, cell, density_params, block_result)

                        if(block_id == grass_block_id && !cell.biome.is_snowy) {
                            if(xyz.y - WATER_LEVEL < 2) {
                                if(d4 * .3 + d3 * .7 < 0) {
                                    block_id = cell.biome.is_swamp ? podzol_block_id : sand_block_id
                                }
                            }
                        }

                        if(blockFlags[block_id] & BLOCK_FLAG.STONE) {
                            if(density < DENSITY_AIR_THRESHOLD + UNCERTAIN_ORE_THRESHOLD) {
                                // generating a small amount of ore on the surface of the walls
                                block_id = this.ore_generator.generate(xyz, block_id);
                            } else {
                                block_id = bm.UNCERTAIN_STONE.id
                            }
                        }

                        // если это самый первый слой поверхности
                        if(not_air_count == 0) {

                            // нужно обязательно проверить ватерлинию над текущим блоком
                            // (чтобы не сажать траву в аквиферах)
                            xyz.y++
                            map_manager.calcDensity(xyz, cell, over_density_params, map);
                            xyz.y--

                            // если это над водой
                            if(xyz.y >= over_density_params.local_water_line) {

                                // random joke sign
                                if(d3 >= .2 && d3 <= .20005 && xyz.y > 100 && y < chunk.size.y -2) {
                                    chunk.setBlockIndirect(x, y + 1, z, bm.SPRUCE_SIGN.id, new Vector(Math.PI*2*rnd.double(), 1, 0), {"text":'       Hello,\r\n      World!',"username":"username","dt":"2022-11-25T18:01:52.715Z"});
                                }

                                if(cluster_cell && !cluster_cell.building) {

                                    // прорисовка наземных блоков кластера
                                    if(!cluster_drawed && dcaves_over == 0) {
                                        cluster_drawed = true;
                                        if(y < chunk.size.y - cluster_cell.height) {
                                            if(cluster_cell.block_id.length != null) { // fast check Array.isArray(cluster_cell.block_id)
                                                for(let yy = 0; yy < cluster_cell.height; yy++) {
                                                    const block_id = cluster_cell.block_id[yy]
                                                    // chunk.setGroundInColumIndirect(columnIndex, x, y + yy + cluster_cell.y_shift, z, cluster_cell.block_id[yy]);
                                                    chunk.setBlockIndirect(x, y + yy + cluster_cell.y_shift, z, block_id)
                                                    //
                                                    if(yy == cluster_cell.height - 1) {
                                                        const slab_block_id = bm.REPLACE_TO_SLAB[block_id]
                                                        if(slab_block_id) {
                                                            xyz_temp.copyFrom(xyz)
                                                            xyz_temp.y = chunk.coord.y + y + yy + cluster_cell.y_shift
                                                            this.addSlabCandidate(xyz_temp, block_id, slab_block_id)
                                                        }
                                                    }
                                                }
                                            } else {
                                                for(let yy = 0; yy < cluster_cell.height; yy++) {
                                                    const block_id = cluster_cell.block_id
                                                    // chunk.setGroundInColumIndirect(columnIndex, x, y + yy + cluster_cell.y_shift, z, cluster_cell.block_id);
                                                    chunk.setBlockIndirect(x, y + yy + cluster_cell.y_shift, z, cluster_cell.block_id)
                                                    //
                                                    if(yy == cluster_cell.height - 1) {
                                                        const slab_block_id = bm.REPLACE_TO_SLAB[block_id]
                                                        if(slab_block_id) {
                                                            xyz_temp.copyFrom(xyz)
                                                            xyz_temp.y = chunk.coord.y + y + yy + cluster_cell.y_shift
                                                            this.addSlabCandidate(xyz_temp, block_id, slab_block_id)
                                                        }
                                                    }
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
                                        // chunk.setGroundInColumIndirect(columnIndex, x, y + 1, z, dirt_layer.cap_block_id);
                                        chunk.setBlockIndirect(x, y + 1, z, dirt_layer.cap_block_id)
                                    }

                                    // Plants and grass (растения и трава)
                                    if(dcaves_over === 0) {
                                        if(plantGrass(x, y + 1, z, xyz, block_id, cell, density_params)) {
                                            // замена блока травы на землю, чтобы потом это не делал тикер (например арбуз)
                                            block_id = dirt_block_id
                                        }
                                    }

                                    const slab_block_id = bm.REPLACE_TO_SLAB[block_id]
                                    if(slab_block_id) {
                                        this.addSlabCandidate(xyz, block_id, slab_block_id)
                                    }

                                    // draw big stones
                                    if(y < chunk.size.y - 2 && big_stone_density > .5) {
                                        if(cell.biome.is_grassy_surface) {
                                            block_id = null
                                            // chunk.setGroundInColumIndirect(columnIndex, x, y, z, dirt_block_id)
                                            chunk.setBlockIndirect(x, y, z, dirt_block_id)
                                        }
                                        // chunk.setGroundInColumIndirect(columnIndex, x, y + 1, z, bm.MOSSY_COBBLESTONE.id);
                                        let big_stone_block_id = bm.MOSSY_COBBLESTONE.id
                                        if(d4 < 0) {
                                            big_stone_block_id = bm.TUFF.id
                                        } else if (d4 > .5) {
                                            big_stone_block_id = bm.STONE.id
                                        }
                                        chunk.setBlockIndirect(x, y + 1, z, big_stone_block_id)
                                        if(big_stone_density > BIG_STONE_DESNSITY) {
                                            // chunk.setGroundInColumIndirect(columnIndex, x, y + 2, z, bm.MOSSY_COBBLESTONE.id);
                                            chunk.setBlockIndirect(x, y + 2, z, big_stone_block_id)
                                        }
                                    }

                                }

                            } else {

                                // первый слой поверхности под водой (дно)

                                if(dcaves == 0) {
 
                                    // поверхность дна водоемов
                                    if(d4 < 0) {
                                        block_id = dirt_block_id
                                    } else if(d4 < .3) {
                                        block_id = gravel_id
                                    } else {
                                        block_id = sand_block_id
                                    }

                                    // ламинария | kelp
                                    if((chunk.size.y - y == air_height + 1) && !cell.biome.is_snowy) {
                                        if((block_id != gravel_id) && (rnd.double() < .15)) {
                                            if((d3 > 0)) {
                                                for(let i = 0; i <= air_height - d3 * 2; i++) {
                                                    chunk.setBlockIndirect(x, y + i, z, bm.KELP.id)
                                                }
                                            } else {
                                                for(let i = 0; i <= 2; i++) {
                                                    chunk.setBlockIndirect(x, y + i, z, bm.SEAGRASS.id)
                                                }
                                            }
                                        }
                                    }

                                }

                            }
                        }

                        //
                        if(not_air_count == 0 && !cell.dirt_layer) {
                            cell.dirt_layer = dirt_layer;
                        }

                        if(block_id) {
                            // chunk.setInitialGroundInColumnIndirect(columnIndex, y, block_id);
                            chunk.setBlockIndirect(x, y, z, block_id);
                        }
                        not_air_count++;

                    } else {

                        // Блоки воздуха/воды

                        const is_ceil = not_air_count > 0

                        not_air_count = 0
                        air_count++

                        // чтобы в пещерах не было воды
                        if(dcaves == 0 || in_aquifera) {

                            const local_fluid_block_id = in_aquifera ? map.aquifera.block_id : bm.STILL_WATER.id

                            // если это уровень воды
                            if(xyz.y <= local_water_line) {

                                let block_id = local_fluid_block_id;

                                // поверхность воды
                                if(xyz.y == local_water_line) {

                                    if(local_fluid_block_id == bm.STILL_WATER.id) {
                                        // если холодно, то рисуем рандомные льдины
                                        const water_cap_ice = (cell.temperature * 2 - 1 < 0) ? (d3 * .6 + d1 * .2 + d4 * .1) : 0;
                                        if(water_cap_ice > .12) {
                                            block_id = bm.ICE.id;
                                            // в еще более рандомных случаях на льдине рисует пику
                                            if(dist_percent < .7 && d1 > 0 && d3 > .65 && op.id != 'norm') {
                                                const peekh = Math.floor(CHUNK_SIZE_Y * .75 * d3 * d4);
                                                for(let ph = 0; ph < peekh; ph++) {
                                                    chunk.setBlockIndirect(x, y + ph, z, block_id)
                                                }
                                            }
                                        }
                                    }

                                    // if inside water
                                    if(local_fluid_block_id == bm.STILL_WATER.id) {

                                        // hanging foliage | свисающая столбом листва
                                        if((d4 > .4 && d4 < .8) && air_count > 5 && air_count < CHUNK_SIZE_Y / 2) {
                                            if(xyz.y == local_water_line) {
                                                if(rnd.double() < .1) {
                                                    for(let i = 0; i < 8 * d4 + 2; i++) {
                                                        chunk.setBlockIndirect(x, y + air_count - i, z, hanging_foliage_block_id)
                                                    }
                                                }
                                            }
                                        }

                                        // water lily leaf on the water surface | лист кувшинки на водной глади
                                        if(dcaves_over == 0 && cell.biome.is_swamp) {
                                            if(rnd.double() < .07) {
                                                chunk.setBlockIndirect(x, y + 1, z, bm.LILY_PAD.id)
                                                has_overfluid_block = true
                                            }
                                        }

                                    }

                                    chunk.setBlockIndirect(x, y, z, block_id);
                                } else {
                                    chunk.fluid.setFluidIndirect(x, y, z, block_id);

                                    if(local_fluid_block_id == bm.STILL_WATER.id) {
                                        // если холодно, то рисуем рандомные льдины
                                        const water_cap_ice = (cell.temperature * 2 - 1 < 0) ? (d3 * .6 + d1 * .2 + d4 * .1) : 0;
                                        if(water_cap_ice > .12) {
                                            block_id = bm.ICE.id;
                                            // в еще более рандомных случаях под льдиной рисуем пики
                                            if(dist_percent < .7 && d1 > 0 && d3 > .65 && op.id != 'norm') {
                                                const peekh = Math.floor(CHUNK_SIZE_Y * .5 * d3 * d4);
                                                for(let ph = 0; ph < peekh; ph++) {
                                                    chunk.setBlockIndirect(x, y - ph, z, block_id)
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // чтобы на самом нижнем уровне блоков чанка тоже росла трава
                            if(y == 0) {
                                xyz.y--
                                map_manager.calcDensity(xyz, cell, over_density_params, map)
                                xyz.y++
                                if(over_density_params.density > DENSITY_AIR_THRESHOLD) {
                                    // CATTAIL | РОГОЗ
                                    if(!has_overfluid_block && chunk.addr.y == 2 && !cell.biome.is_snowy) {
                                        if(d4 > .4 && d4 < .8) {
                                            if(cell.biome.is_swamp || ((d1 < .1 && d2 < .1) && !cell.biome.is_snowy && !cell.biome.is_sand && !cell.biome.is_desert)) {
                                                const r2 = rnd.double()
                                                if(r2 < .25) {
                                                    chunk.setBlockIndirect(x, y, z, r2 < 0.125 ? bm.CATTAIL.id : bm.REED.id)
                                                }
                                            }
                                        }
                                    }
                                    if(chunk.addr.y > 2) {
                                        let {block_id} = map_manager.getBlock(xyz, not_air_count, cell, density_params, block_result)
                                        // Plants and grass (растения и трава)
                                        plantGrass(x, y, z, xyz, block_id, cell, density_params)
                                    }
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
                                            // chunk.setInitialGroundInColumnIndirect(columnIndex, y, bm.MOSS_BLOCK.id)
                                            chunk.setBlockIndirect(x, y, z, bm.MOSS_BLOCK.id);
                                            continue
                                        }
                                    }
                                }

                                // рандомный светящийся лишайник на потолке
                                if((xyz.y < local_water_line - 5) && (rand_lava.double() < .015)) {
                                    chunk.setBlockIndirect(x, y, z, bm.GLOW_LICHEN.id, null, {down: true, rotate: false});
                                }

                            }

                        }

                    }

                }

            }
        }

        chunk.timers.stop()

    }

}