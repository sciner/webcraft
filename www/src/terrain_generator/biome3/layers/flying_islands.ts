import {noise, alea} from "../../default.js";
import type { BLOCK } from "../../../blocks.js";
import type { ChunkGrid } from "../../../core/ChunkGrid.js";
import { Vector } from "../../../helpers.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { WorkerWorld } from "../../../worker/world.js";
import { ClusterEndCity } from "../../cluster/end_city.js";
import { ClusterManager } from "../../cluster/manager.js";
import { TerrainMapCell } from "../../terrain_map.js";
import type { Biome } from "../biomes.js";
import type Terrain_Generator from "../index.js";
import { TerrainMapManagerBase } from "../terrain/manager_base.js";
import { Biome3TerrainMap } from "../terrain/map.js";
import { Biome3LayerBase } from "./base.js";
import {DungeonGenerator} from "../../dungeon.js";

class FlyingIslandsTerrainMapManager extends TerrainMapManagerBase {

    declare layer : Biome3LayerFlyingIslands
    _biome : Biome

    constructor(world: WorkerWorld, seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer : Biome3LayerFlyingIslands) {
        super(world, seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
        this._biome = this.biomes.byName.get('Летающие острова')
    }

    // generate map
    generateMap(real_chunk : any, chunk : ChunkWorkerChunk, noisefn) {

        // Result map
        const map = new Biome3TerrainMap(chunk, this.generator_options, this.noise2d)
        const biome = this._biome

        const cell = new TerrainMapCell(80, 0, 0, null, 0)
        cell.biome = biome
        cell.dirt_color = biome.dirt_color
        cell.water_color = biome.water_color

        // create empty cells
        map.cells = new Array(chunk.size.x * chunk.size.z).fill(cell)

        return map

    }

    generateAround(chunk : ChunkWorkerChunk, chunk_addr : Vector, smooth : boolean = false, generate_trees : boolean = false) : any[] {

        const maps = super.generateAround(chunk, chunk_addr, smooth, generate_trees)
        const xyz = new Vector(0, 0, 0)

        for(let i = 0; i < maps.length; i++) {
            const map = maps[i]
            if(!map.rnd) {
                map.rnd = new alea('end_trees_' + map.chunk.addr.toHash())
                for(let j = 0; j < 4; j++) {
                    const x = Math.floor(map.rnd.double() * chunk.size.x)
                    const y = 39
                    const z = Math.floor(map.rnd.double() * chunk.size.z)
                    xyz.copyFrom(map.chunk.coord).addScalarSelf(x, y, z)
                    const block_id = this.layer.getBlock(xyz)
                    if(block_id > 0) {
                        const tree = {
                            "height": 20,
                            "rad": 10,
                            "type": {
                                "percent": 1,
                                "trunk": 1043,
                                "leaves": 1042,
                                "style": "chorus",
                                "height": {
                                    "min": 16,
                                    "max": 22
                                },
                                "transparent_trunk": true
                            },
                            "pos": new Vector(x, y, z)
                        }
                        map.trees.push(tree)
                    }
                }
            }
        }

        return maps

    }

}

export default class Biome3LayerFlyingIslands extends Biome3LayerBase {
    filter_biome_list: int[] = [500]
    grid: ChunkGrid
    dungeon: DungeonGenerator

    init(generator : Terrain_Generator) : Biome3LayerFlyingIslands {
        super.init(generator)
        this.grid = generator.world.chunkManager.grid;
        this.clusterManager = new ClusterManager(generator.world, generator.seed, this, [{chance: .6, class: ClusterEndCity}])
        this.dungeon = new DungeonGenerator(generator.seed);
        this.maps = new FlyingIslandsTerrainMapManager(generator.world, generator.seed, generator.world_id, generator.noise2d, generator.noise3d, generator.block_manager, generator.options, this)
        return this
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : alea) {

        // Generate maps around chunk
        chunk.timers.start('generate_maps')
        const maps = this.maps.generateAround(chunk, chunk.addr, false, false)
        chunk.timers.stop()

        // Cluster
        chunk.timers.start('generate_cluster')
        const map = chunk.map = maps[4]
        chunk.cluster = this.clusterManager.getForCoord(chunk.coord, null) ?? null
        chunk.cluster.fillBlocks(null, chunk, map, false, false)
        chunk.timers.stop()

        // Generate chunk data
        chunk.timers.start('generate_chunk_data')
        if(chunk.addr.y < 2) {
            this.generateChunkData(chunk, maps, seed, rnd)
        }
        chunk.timers.stop()

        // Plant trees
        chunk.timers.start('generate_trees')
        if(chunk.addr.y == 1) {
            this.plantTrees(maps, chunk)
        }
        chunk.timers.stop()

        return chunk.map

    }

    getGrassLevel(xz : Vector) : int {
        const noise2d = noise.simplex2
        return Math.round(noise2d((xz.x) / 10, (xz.z) / 10) * 2)
    }

    getBlock(xyz : Vector, grass_level ?: int) : int {

        const bm             = this.block_manager
        const dirt_block_id  = bm.END_STONE.id
        const grass_block_id = bm.END_STONE.id
        const stone_block_id = bm.STONE.id
        const noise2d        = noise.simplex2
        const noise3d        = noise.simplex3
        const height         = 80

        let block_id : int = 0

        if(grass_level === undefined) {
            grass_level = this.getGrassLevel(xyz)
        }

        const d = Math.max(Math.min((1 - Math.cos(xyz.y / height * (Math.PI * 2))) / 2, 1), 0)
        if(d > 0) {
            let r = noise3d(xyz.x/100, xyz.y / 100, xyz.z/100) * 64
            // r += noise3d(xyz.x/50, xyz.y / 50, xyz.z/50) * 32
            // r += noise3d(xyz.x/25, xyz.y / 25, xyz.z/25) * 16
            r += noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5) * 8
            r /= 64 + /*32 + 16* + */ 8
            r *= d
            if(r > 0.25) {
                if(r < .6) {
                    block_id = dirt_block_id
                    if(xyz.y > 35) block_id = grass_block_id
                    if(xyz.y < 30 + grass_level) block_id = stone_block_id
                    if(r > .8) {
                        block_id = stone_block_id
                    }
                }
            }
        }

        return block_id

    }

    generateChunkData(chunk : ChunkWorkerChunk, maps : any[], seed : string, rnd : any) {

        const { cx, cy, cz, cw } = chunk.dataChunk

        // setBlock
        const setBlock = (x : int, y : int, z : int, block_id : int, extra_data? : any) => {
            const index = cx * x + cy * y + cz * z + cw
            chunk.tblocks.id[index] = block_id
            if(extra_data) {
                chunk.tblocks.setBlockRotateExtra(x, y, z, null, extra_data)
            }
        }

        const xyz = new Vector(0, 0, 0)

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                xyz.copyFrom(chunk.coord).addScalarSelf(x, 0, z)
                const grass_level = this.getGrassLevel(xyz)
                for(let y = chunk.size.y - 1; y >= 0; y--) {
                    xyz.y = chunk.coord.y + y
                    const block_id = this.getBlock(xyz, grass_level )
                    if(block_id > 0) {
                        setBlock(x, y, z, block_id)
                    }
                }
            }
        }

    }

}