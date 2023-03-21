import { impl as alea } from "../../../../vendors/alea.js";
import type { BLOCK } from "../../../blocks.js";
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../../chunk_const.js";
import { Vector } from "../../../helpers.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import { ClusterEndCity } from "../../cluster/end_city.js";
import { ClusterManager } from "../../cluster/manager.js";
import { TerrainMapCell } from "../../terrain_map.js";
import type Terrain_Generator from "../index.js";
import { TerrainMapManagerBase } from "../terrain/manager_base.js";
import { TerrainMap2 } from "../terrain/map.js";
import { Biome3LayerBase } from "./base.js";

class EndTerrainMapManager extends TerrainMapManagerBase {

    declare layer : Biome3LayerEnd

    constructor(seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer : Biome3LayerEnd) {
        super(seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
    }

    // generate map
    generateMap(real_chunk : any, chunk : ChunkWorkerChunk, noisefn) {

        // Result map
        const map = new TerrainMap2(chunk, this.generator_options, this.noise2d)
        const biome = this.biomes.byID.get(500)

        const cell = new TerrainMapCell(80, 0, 0, null, 0)
        cell.biome = biome
        cell.dirt_color = biome.dirt_color
        cell.water_color = biome.water_color

        // create empty cells
        map.cells = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z).fill(cell)

        return map
    
    }

    generateAround(chunk : ChunkWorkerChunk, chunk_addr : Vector, smooth : boolean = false, generate_trees : boolean = false) : any[] {

        const maps = super.generateAround(chunk, chunk_addr, smooth, generate_trees)
        const xyz = new Vector(0, 0, 0)

        for(let i = 0; i < maps.length; i++) {
            const map = maps[i]
            if(!map.rnd) {
                map.rnd = new alea('end_trees_' + map.chunk.addr.toHash())
                for(let j = 0; j < 2; j++) {
                    const x = Math.floor(map.rnd.double() * CHUNK_SIZE_X)
                    const y = 39
                    const z = Math.floor(map.rnd.double() * CHUNK_SIZE_Z)
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

export default class Biome3LayerEnd extends Biome3LayerBase {

    constructor(generator : Terrain_Generator) {
        super(generator)
        this.clusterManager = new ClusterManager(generator.world, generator.seed, this)
        this.clusterManager.registerCluster(.6, ClusterEndCity)
        this.maps = new EndTerrainMapManager(generator.seed, generator.world_id, generator.noise2d, generator.noise3d, generator.block_manager, generator.options, this)
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
        this.generateChunkData(chunk, maps, seed, rnd)
        chunk.timers.stop()

        // Plant trees
        chunk.timers.start('generate_trees')
        if(chunk.addr.y == 1) {
            this.plantTrees(maps, chunk)
        }
        chunk.timers.stop()

        return chunk.map

    }

    getBlock(xyz : Vector) : int {

        const BLOCK = this.generator.block_manager
        const block_id = BLOCK.END_STONE.id

        // const x = xyz.x - Math.floor(xyz.x / CHUNK_SIZE_X) * CHUNK_SIZE_X
        const y = xyz.y - Math.floor(xyz.y / CHUNK_SIZE_Y) * CHUNK_SIZE_Y
        // const z = xyz.z - Math.floor(xyz.z / CHUNK_SIZE_Z) * CHUNK_SIZE_Z

        const n2 = -this.noise2d((xyz.x) / 100, (xyz.z) / 100) * y
        const n1 = this.noise2d((xyz.x) / 100, (xyz.z) / 100) * 36

        if ((n2 > 5 && y < 31) || (-n1 > (y - 26) && y > 30)) {
            return block_id
        }

        return 0

    }

    /**
     */
    generateChunkData(chunk : ChunkWorkerChunk, maps : any[], seed : string, rnd : any) {

        const map = chunk.map = maps[4]
        const { uint16View } = chunk.tblocks.dataChunk
        const xyz = new Vector(0, 0, 0)

        if(chunk.addr.y == 0) {
            for (let x = 0; x < chunk.size.x; x++) {
                for (let z = 0; z < chunk.size.z; z++) {
                    for (let y = 0; y < chunk.size.y; y++) {
                        xyz.copyFrom(chunk.coord).addScalarSelf(x, y, z)
                        const block_id = this.getBlock(xyz)
                        if(block_id > 0) {
                            const index = xyz.worldPosToChunkIndex()
                            uint16View[index] = block_id
                        }
                    }
                }
            }
        }

        return map

    }

}