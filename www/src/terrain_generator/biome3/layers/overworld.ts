import { Vector } from "../../../helpers.js";
import { MineGenerator } from "../../mine/mine_generator.js";
import { DENSITY_AIR_THRESHOLD, UNCERTAIN_ORE_THRESHOLD } from "../terrain/manager_vars.js";
import { AQUIFERA_UP_PADDING } from "../aquifera.js";
import { WorldClientOreGenerator } from "../client_ore_generator.js";
import { DungeonGenerator } from "../../dungeon.js";
import { alea, CANYON } from "../../default.js";
import { DensityParams, WATER_LEVEL } from "../terrain/manager_vars.js";
import { FLUID_STRIDE } from "../../../fluid/FluidConst.js";
import { Biome3LayerBase } from "./base.js";
import { BLOCK_FLAG } from "../../../constant.js";
import { ClusterManager } from "../../cluster/manager.js";
import { ClusterVilage } from "../../cluster/vilage.js";
import { ClusterStructures } from "../../cluster/structures.js";

import type { Biome3TerrainMap } from "../terrain/map.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type Terrain_Generator from "../index.js";
import type { TerrainMapCell } from "../terrain/map_cell.js";
import { MapsBlockResult, TerrainMapManager3 } from "../terrain/manager.js";

// import BottomCavesGenerator from "../../bottom_caves/index.js";

const DEFAULT_CLUSTER_LIST = [
    {chance: .2, class: ClusterVilage},
    {chance: 1, class: ClusterStructures},
]

const slab_up_extra_data = {point: new Vector(0, .5, .0)}

const BIG_STONE_DESNSITY = 0.6;
const GROUND_PLACE_SIZE = 3
let _ground_places = new Array(1)

function ensureSize(sz: number) {
    if (_ground_places.length >= sz * GROUND_PLACE_SIZE) {
        return;
    }
    _ground_places = new Array(sz * GROUND_PLACE_SIZE);
}

export default class Biome3LayerOverworld extends Biome3LayerBase {

    declare maps:           TerrainMapManager3

    ore_generator:          WorldClientOreGenerator
    dungeon:                DungeonGenerator
    slab_candidates:        any[]
    onground_place_index:   any

    filter_biome_list:      int[] = [
        1, 2, 4, 6, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 26, 27,
        28, 29, 30, 31, 35, 36, 37, 38, 39, 129, 130, 132, 134, 140,
        149, 151, 155, 156, 158, 159, 163, 164, 165, 166, 167, 168, 169
    ]

    init(generator : Terrain_Generator, map_manager ?: any, cluster_list? : {chance: float, class: any}[]) : Biome3LayerOverworld {

        super.init(generator)

        const seed = generator.seed
        const world_id = generator.world_id

        this.clusterManager = new ClusterManager(generator.world, generator.seed, this, cluster_list ?? DEFAULT_CLUSTER_LIST)

        if(!map_manager) {
            map_manager = new TerrainMapManager3(generator.world, seed, world_id, generator.noise2d, generator.noise3d, generator.block_manager, generator.options, this)
        }

        this.maps = map_manager
        this.ore_generator = new WorldClientOreGenerator(world_id)
        this.dungeon = new DungeonGenerator(seed)
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {})

        return this

    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any, is_lowest : boolean, is_highest : boolean) : Biome3TerrainMap {

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
            const mine = MineGenerator.getForCoord(this, chunk.coord, chunk.size)
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

    generateOnGroundBlocks(maps : Biome3TerrainMap[], chunk : ChunkWorkerChunk, rnd : alea) {
        const {fromFlatChunkIndex, relativePosToChunkIndex, CHUNK_SIZE} = chunk.chunkManager.grid.math;
        const ids = chunk.tblocks.id
        const _vec = new Vector(0, 0, 0)
        const xyz = new Vector(0, 0, 0)
        const map = chunk.map as Biome3TerrainMap
        const bm = chunk.chunkManager.block_manager
        const blockFlags = bm.flags
        ensureSize(CHUNK_SIZE)

        for(let i = 0; i < this.onground_place_index; i += GROUND_PLACE_SIZE) {
            const flat_index = _ground_places[i]
            fromFlatChunkIndex(_vec, flat_index)
            if(_vec.y < 1) continue
            _vec.y--
            const under_index = relativePosToChunkIndex(_vec)
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
        const CHUNK_SIZE_X = chunk.size.x;
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = chunk.map.cells[z * CHUNK_SIZE_X + x]
                maxY = Math.max(maxY, (this.maps as TerrainMapManager3).getMaxY(cell))
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
        const map                       = chunk.map as Biome3TerrainMap;
        const xyz                       = new Vector(0, 0, 0);
        const xyz_temp                  = new Vector(0, 0, 0);
        const density_params            = new DensityParams(0, 0, 0, 0, 0, 0);
        const over_density_params       = new DensityParams(0, 0, 0, 0, 0, 0);
        const over2_density_params      = new DensityParams(0, 0, 0, 0, 0, 0);
        const cluster                   = chunk.cluster; // 3D clusters
        const dirt_block_id             = bm.DIRT.id
        const grass_block_id            = bm.GRASS_BLOCK.id
        const sand_block_id             = bm.SAND.id
        const podzol_block_id           = bm.PODZOL.id
        const gravel_id                 = bm.GRAVEL.id
        const fire_block_id             = bm.FIRE.id
        const blockFlags                = bm.flags
        const block_result              = new MapsBlockResult()
        const rand_lava                 = new alea('random_lava_source_' + this.seed)
        const map_manager               = this.maps as TerrainMapManager3
        const {relativePosToFlatIndexInChunk_s} = chunk.chunkManager.grid.math;

        const cell = map.getCell(0, 0)
        const is_ice_picks = cell.biome.title == 'Ледяные пики'
        const is_ereb = cell.biome.title == 'Эреб'

        const bridge_blocks = {
            TORCH:   bm.TORCH.id, // is_ereb ? bm.SHROOMLIGHT.id : bm.TORCH.id,
            FENCE:   is_ereb ? (bm.CRIMSON_FENCE.id) : (is_ice_picks ? bm.SPRUCE_FENCE.id : bm.DARK_OAK_FENCE.id),
            PLANKS:  is_ereb ? (bm.NETHER_BRICKS.id) : (is_ice_picks ? bm.ICE.id : bm.SPRUCE_PLANKS.id),
            SLAB:    is_ereb ? (bm.NETHER_BRICK_SLAB.id) : (is_ice_picks ? bm.ICE.id : bm.SPRUCE_SLAB.id),
        }

        // generate densisiy values for column
        chunk.timers.start('generate_noise3d')
        const sz = this.calcColumnNoiseSize(chunk)
        const crd = chunk.coord.clone()
        sz.y+=2
        crd.y--
        // TODO: for air, ignore this all?
        this.generator.noise3d.generate4(crd, sz);
        chunk.timers.stop()

        this.onground_place_index = 0

        //
        const plantGrass = (x : int, y : int, z : int, xyz : Vector, block_id : int, cell : TerrainMapCell, density_params : DensityParams) : boolean => {
            const plant_blocks = cell.genPlantOrGrass(x, y, z, xyz, chunk.size, block_id, rnd, density_params, chunk)
            _ground_places[this.onground_place_index++] = relativePosToFlatIndexInChunk_s(x, y, z)
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
                    if(!p.is_leaves || !cell.inCanyon(CANYON.FLOOR_DENSITY)) {
                        chunk.setBlockIndirect(x, y + i, z, p.id, rotate, extra_data)
                    }
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

                const cell                      = map.getCell(x, z)
                const has_cluster               = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.z, 2);
                const cluster_cell              = has_cluster ? cluster.getCell(xyz.x, xyz.z) : null;
                const big_stone_density         = this.calcBigStoneDensity(xyz, has_cluster)
                const in_canyon                 = cell.inCanyon(CANYON.FLOOR_DENSITY)
                const bridge_in_canyon          = cell.inCanyon(CANYON.BRIDGE_DIST)
                const bridge_fence_in_canyon    = cell.inCanyon(CANYON.BRIDGE_FENCE_DIST)

                // const {dist_percent, op /*, relief, mid_level, radius, dist, density_coeff*/ } = cell.preset;
                // const hanging_foliage_block_id = cell.biome.blocks.hanging_foliage.id

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
                    map_manager.calcDensity(xyz, cell, density_params, map)
                    let {d1, d2, d3, d4, density, in_aquifera, local_water_line} = density_params

                    // Make canyon bridge
                    if(bridge_in_canyon && d4 < .7) {
                        const by = xyz.y - 80
                        if(by == 0 || by == 1 || by == 2) {
                            const bridge_pos = Math.abs(xyz.x + xyz.z)
                            const bridge = bridge_pos % 240
                            if(bridge_pos > 10 && bridge < 6) {
                                const edge_of_bridge = bridge == 0 || bridge == 5
                                const inside_edge_of_bridge = bridge == 1 || bridge == 4
                                if(by == 0) {
                                    if(bridge == 0 || bridge == 5) {
                                        if(bridge_fence_in_canyon) {
                                            chunk.setBlockIndirect(x, y, z, bridge_blocks.FENCE)
                                        }
                                    } else {
                                        if(inside_edge_of_bridge) {
                                            chunk.setBlockIndirect(x, y, z, bridge_blocks.PLANKS)
                                        } else {
                                            const r = rnd.double()
                                            const slab_threshold = .8
                                            if(r < slab_threshold) {
                                                chunk.setBlockIndirect(x, y, z, bridge_blocks.SLAB, null, slab_up_extra_data)
                                                const {dirt_layer, block_id} = map_manager.getBlock(xyz, 1, cell, density_params, block_result)
                                                if(dirt_layer.cap_block_id) {
                                                    if((r/slab_threshold < .75)) {
                                                        chunk.setBlockIndirect(x, y + 1, z, dirt_layer.cap_block_id)
                                                    }
                                                } else if((r/slab_threshold < 1/2000)) {
                                                    chunk.setBlockIndirect(x, y + 1, z, fire_block_id)
                                                }
                                            }
                                        }
                                    }
                                } else if(by == 1 && bridge_fence_in_canyon) {
                                    if(edge_of_bridge || bridge == 1 || bridge == 4) {
                                        chunk.setBlockIndirect(x, y, z, bridge_blocks.FENCE)
                                    }
                                } else if(by == 2 && bridge_fence_in_canyon) {
                                    if(bridge == 0 || bridge == 5) {
                                        if(xyz.x % 5 == 0 && xyz.z % 5 == 0) {
                                            if(cell.inCanyon(0.05)) {
                                                chunk.setBlockIndirect(x, y, z, bridge_blocks.TORCH)
                                                chunk.setBlockIndirect(x, y - 1, z, bridge_blocks.FENCE)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

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
                            not_air_count = 1
                            if(over_density_params.density > DENSITY_AIR_THRESHOLD) {
                                not_air_count++
                                xyz.y += 2
                                map_manager.calcDensity(xyz, cell, over2_density_params, map)
                                xyz.y -= 2
                                if(over2_density_params.density > DENSITY_AIR_THRESHOLD) {
                                    not_air_count++
                                }
                            }
                        }

                        // get block
                        let {dirt_layer, block_id} = map_manager.getBlock(xyz, not_air_count, cell, density_params, block_result)

                        if(block_id == grass_block_id && !cell.biome.is_snowy) {
                            if(xyz.y - WATER_LEVEL < 2 && !in_canyon) {
                                if(d4 * .3 + d3 * .7 < 0) {
                                    block_id = cell.biome.is_swamp ? podzol_block_id : sand_block_id
                                }
                            }
                        }

                        if(blockFlags[block_id] & BLOCK_FLAG.STONE) {
                            // generating a small amount of ore on the surface of the walls
                            if(density < DENSITY_AIR_THRESHOLD + UNCERTAIN_ORE_THRESHOLD) {
                                block_id = this.ore_generator.generate(xyz, block_id);
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
                                        let big_stone_block_id = cell.biome.getBigStoneBlock(density_params)
                                        chunk.setBlockIndirect(x, y + 1, z, big_stone_block_id)
                                        if(big_stone_density > BIG_STONE_DESNSITY) {
                                            // chunk.setGroundInColumIndirect(columnIndex, x, y + 2, z, big_stone_block_id);
                                            chunk.setBlockIndirect(x, y + 2, z, big_stone_block_id)
                                        }
                                    }

                                }

                            } else {

                                // первый слой поверхности под водой (дно)

                                // Plants and grass (растения и трава в каньонах)
                                if(in_canyon) {
                                    // шапка слоя земли (если есть)
                                    if(xyz.y > 41 && dirt_layer.cap_block_id) {
                                        // chunk.setGroundInColumIndirect(columnIndex, x, y + 1, z, dirt_layer.cap_block_id);
                                        chunk.setBlockIndirect(x, y + 1, z, dirt_layer.cap_block_id)
                                    }
                                    if(plantGrass(x, y + 1, z, xyz, block_id, cell, density_params)) {
                                        // замена блока травы на землю, чтобы потом это не делал тикер (например арбуз)
                                        block_id = dirt_block_id
                                    }
                                }

                                // если это не пещера
                                if(dcaves_over === 0) {

                                    block_id = cell.biome.getRiverBottomBlock(density_params)

                                    // ламинария | kelp
                                    if((chunk.size.y - y == air_height + 1) && !cell.biome.is_snowy && !cell.biome.is_underworld) {
                                        if((block_id != gravel_id) && (rnd.double() < .15)) {
                                            if((d3 > 0)) {
                                                for(let i = 0; i < air_height - d3 * 2; i++) {
                                                    chunk.setBlockIndirect(x, y + 1 + i, z, bm.KELP.id)
                                                }
                                            } else {
                                                for(let i = 0; i < 2; i++) {
                                                    chunk.setBlockIndirect(x, y + 1 + i, z, bm.SEAGRASS.id)
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

                                chunk.fluid.setFluidIndirect(x, y, z, local_fluid_block_id)

                                if(xyz.y == local_water_line) {
                                    // поверхность воды
                                    // льдины на поверхности воды / свисающие растения над водой и прочее
                                    has_overfluid_block = this.drawFluidSurface(chunk, cell, x, y, z, xyz, local_fluid_block_id, dcaves_over, air_count, local_water_line, density_params, rnd)
                                } else {
                                    // под водой
                                    // льдины под поверхностью воды
                                    this.drawUnderFluidSurface(chunk, cell, x, y, z, local_fluid_block_id, density_params)
                                }

                            }

                            // чтобы на самом нижнем уровне блоков чанка тоже росла трава
                            if(y == 0 && !cell.biome.is_underworld) {
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
                                            chunk.setBlockIndirect(x, y, z, (cell.biome.blocks.caves_second ?? bm.MOSS_BLOCK).id);
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

    // Например льдины на поверхности воды
    drawFluidSurface(chunk : ChunkWorkerChunk, cell : TerrainMapCell, x : int, y : int, z : int, xyz : Vector, local_fluid_block_id : int, dcaves_over : float, air_count : int, local_water_line : int, density_params : DensityParams, rnd : any) : boolean {
        const bm = this.block_manager
        let has_overfluid_block = false
        const CHUNK_SIZE_Y = chunk.size.y;
        // if inside water
        if(local_fluid_block_id == bm.STILL_WATER.id) {
            const {dist_percent, op} = cell.preset
            const {d1, d2, d3, d4} = density_params
            const hanging_foliage_block_id = cell.biome.blocks.hanging_foliage.id
            // 1. если холодно, то рисуем рандомные льдины
            const water_cap_ice = (cell.temperature * 2 - 1 < 0) ? (d3 * .6 + d1 * .2 + d4 * .1) : 0;
            if(water_cap_ice > .12) {
                const block_id = bm.ICE.id
                chunk.setBlockIndirect(x, y, z, block_id, undefined, undefined, undefined, undefined, false, true)
                has_overfluid_block = true
                // в еще более рандомных случаях на льдине рисует пику
                if(dist_percent < .7 && d1 > 0 && d3 > .65 && op.id != 'norm') {
                    const peekh = Math.floor(CHUNK_SIZE_Y * .75 * d3 * d4)
                    for(let ph = 0; ph < peekh; ph++) {
                        chunk.setBlockIndirect(x, y + ph, z, block_id)
                    }
                }
            }
            // 2. hanging foliage | свисающая столбом листва
            if((d4 > .4 && d4 < .8) && air_count > 5 && air_count < CHUNK_SIZE_Y / 2) {
                if(xyz.y == local_water_line) {
                    if(rnd.double() < .1) {
                        for(let i = 0; i < 8 * d4 + 2; i++) {
                            chunk.setBlockIndirect(x, y + air_count - i, z, hanging_foliage_block_id)
                        }
                    }
                }
            }
            // 3. water lily leaf on the water surface | лист кувшинки на водной глади
            if(dcaves_over == 0 && cell.biome.is_swamp) {
                if(rnd.double() < .07) {
                    chunk.setBlockIndirect(x, y + 1, z, bm.LILY_PAD.id)
                    has_overfluid_block = true
                }
            }
        }
        return has_overfluid_block
    }

    // Например льдины под поверхностью воды
    drawUnderFluidSurface(chunk : ChunkWorkerChunk, cell : TerrainMapCell, x : int, y : int, z : int, local_fluid_block_id : int, density_params : DensityParams) {
        const bm = this.block_manager
        const {dist_percent, op} = cell.preset;
        const {d1, d2, d3, d4} = density_params
        const CHUNK_SIZE_Y = chunk.size.y;
        if(local_fluid_block_id == bm.STILL_WATER.id) {
            // если холодно, то рисуем рандомные льдины
            const water_cap_ice = (cell.temperature * 2 - 1 < 0) ? (d3 * .6 + d1 * .2 + d4 * .1) : 0;
            if(water_cap_ice > .12) {
                // в еще более рандомных случаях под льдиной рисуем пики
                if(dist_percent < .7 && d1 > 0 && d3 > .65 && op.id != 'norm') {
                    const peekh = Math.floor(CHUNK_SIZE_Y * .5 * d3 * d4);
                    const block_id = bm.ICE.id
                    for(let ph = 0; ph < peekh; ph++) {
                        chunk.setBlockIndirect(x, y - ph, z, block_id)
                    }
                }
            }
        }
    }

}