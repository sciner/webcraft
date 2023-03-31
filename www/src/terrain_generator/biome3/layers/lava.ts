import type { ChunkWorkerChunk } from "../../../worker/chunk";
import type { Default_Terrain_Map } from "../../default";
import { Biome3LayerBase } from "./base.js";

/**
 * Generate underworld infinity lava
 */
export default class Biome3LayerLava extends Biome3LayerBase {

    declare maps: Map<any, any> | any

    init(generator : any) : Biome3LayerLava {
        super.init(generator)
        this.maps = new Map()
        return this
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {

        const BLOCK = this.generator.block_manager
        const block_id = BLOCK.STILL_LAVA.id
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                for(let y = 0; y < chunk.size.y; y++) {
                    chunk.fluid.setFluidIndirect(x, y, z, block_id);
                }
            }
        }

        return this.generator.generateDefaultMap(chunk)

    }

}