import type { ChunkWorkerChunk } from "../../../worker/chunk";
import type { Default_Terrain_Map } from "../../default";
import { Biome3LayerBase } from "./base.js";

/**
 * Generate underworld infinity lava
 */
export default class Biome3LayerLava extends Biome3LayerBase {

    declare maps: Map<any, any> | any

    constructor(generator : any) {
        super(generator)
        this.maps = new Map()
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {

        if(chunk.addr.y < 0)  {
            const BLOCK = this.generator.block_manager
            // const { cx, cy, cz, cw, uint16View } = chunk.tblocks.dataChunk
            const block_id = BLOCK.STILL_LAVA.id
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < chunk.size.y; y++) {
                        // const index = cx * x + cy * y + cz * z + cw
                        // uint16View[index] = block_id
                        chunk.fluid.setFluidIndirect(x, y, z, block_id);
                    }
                }
            }
        }

        return this.generator.generateDefaultMap(chunk)

    }

}