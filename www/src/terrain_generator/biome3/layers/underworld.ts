import type { TerrainMap2 } from "../terrain/map.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type Terrain_Generator from "../index.js";
import Biome3LayerOverworld from "./overworld.js";
import { MapCellPresetResult, TerrainMapManager3 } from "../terrain/manager.js";
import type { Vector } from "../../../helpers.js";
import type { Biome } from "../biomes.js";
import type { BLOCK } from "../../../blocks.js";
import type { Biome3LayerBase } from "./base.js";
import { ClusterVilage } from "../../cluster/vilage.js";
import { NetherClusterStructures } from "../../cluster/nether_structures.js";
import type { WorkerWorld } from "../../../worker/world.js";

export declare type IClusterList = {chance: float, class: any}[]

const UNDERWORLD_CLUSTER_LIST : IClusterList = [
    {chance: .2, class: ClusterVilage},
    {chance: 1, class: NetherClusterStructures},
] 

class UnderworldTerrainMapManager extends TerrainMapManager3 {

    _biome : Biome

    constructor(world: WorkerWorld, seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer : Biome3LayerBase) {
        generator_options = JSON.parse(JSON.stringify(generator_options))
        generator_options.generate_big_caves = true
        super(world, seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
        this._biome = this.biomes.byName.get('Эреб')
    }

    calcBiome(xz : Vector, preset? : MapCellPresetResult) : Biome {
        return this._biome
    }

}

export default class Biome3LayerUnderworld extends Biome3LayerOverworld {

    filter_biome_list: int[] = [501]

    init(generator : Terrain_Generator) : Biome3LayerUnderworld {
        const {seed, world_id, noise2d, noise3d, block_manager, options} = generator
        const map_manager = new UnderworldTerrainMapManager(generator.world, `${seed}underworld`, world_id, noise2d, noise3d, block_manager, options, this)
        super.init(generator, map_manager, UNDERWORLD_CLUSTER_LIST)
        return this
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any, is_lowest?: boolean, is_highest ?: boolean) : TerrainMap2 {
        const resp = super.generate(chunk, seed, rnd, is_lowest, is_highest)
        
        if(is_highest) {

            const stone_block_id = 9
            const block_id = 87
            const sz = chunk.size.y

            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    const hx = (chunk.coord.x + x)
                    const hz = (chunk.coord.z + z)
                    let n = this.noise2d(hx/32, hz/32) * .667
                    let n2 = Math.ceil((n / .667 + 1) * 3)
                    n += this.noise2d(hx/16, hz/16) * 0.333
                    n += 1
                    const h = Math.round(n * 10 + 3)
                    for(let y = chunk.size.y - h; y < chunk.size.y; y++) {
                        chunk.setBlockIndirect(x, y, z, y > sz - n2 ? stone_block_id : block_id)
                    }
                }
            }
        }

        return resp
    }

}