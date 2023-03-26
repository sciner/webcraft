import type { TerrainMap2 } from "../terrain/map.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type Terrain_Generator from "../index.js";
import Biome3LayerOverworld from "./overworld.js";
import { MapCellPresetResult, TerrainMapManager3 } from "../terrain/manager.js";
import type { Vector } from "../../../helpers.js";
import type { Biome } from "../biomes.js";
import type { BLOCK } from "../../../blocks.js";
import type { Biome3LayerBase } from "./base.js";

class UnderworldTerrainMapManager extends TerrainMapManager3 {

    _biome : Biome

    constructor(seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer? : Biome3LayerBase) {
        super(seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
        this._biome = this.biomes.byName.get('Эреб')
    }

    calcBiome(xz : Vector, preset? : MapCellPresetResult) : Biome {
        return this._biome
    }

}

export default class Biome3LayerUnderworld extends Biome3LayerOverworld {

    constructor(generator : Terrain_Generator) {

        const options = JSON.parse(JSON.stringify(generator.options))
        options.generate_big_caves = true

        const map_manager = new UnderworldTerrainMapManager(generator.seed + 'underworld', generator.world_id, generator.noise2d, generator.noise3d, generator.block_manager, options)

        super(generator, map_manager)

        map_manager.layer = this

    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : TerrainMap2 {

        return super.generate(chunk, seed, rnd)

    }

}