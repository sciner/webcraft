import type { ChunkWorkerChunk } from "../../../worker/chunk";
import type { Default_Terrain_Map } from "../../default";
import { Biome3LayerBase } from "./base.js";

/**
 * Generate underworld infinity air
 */
export default class Biome3LayerAir extends Biome3LayerBase {

    declare maps: Map<any, any> | any

    init(generator : any) : Biome3LayerAir {
        super.init(generator)
        this.maps = new Map()
        return this
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {
        return this.generator.generateDefaultMap(chunk)
    }

}