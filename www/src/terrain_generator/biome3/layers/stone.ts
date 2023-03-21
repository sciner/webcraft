import type { ChunkWorkerChunk } from "../../../worker/chunk.js"
import type { Default_Terrain_Map } from "../../default.js";
import type Terrain_Generator from "../index.js"
import { Biome3LayerBase } from "./base.js";

/**
 * Generate underworld infinity stones
 */
export default class Biome3LayerStone extends Biome3LayerBase {

    declare maps: Map<any, any> | any

    constructor(generator : Terrain_Generator) {
        super(generator)
        this.maps = new Map()
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {
        chunk.timers.start('fill stone')
        if(chunk.addr.y < 0)  {
            const BLOCK = this.generator.block_manager
            const block_id = BLOCK.STONE.id
            chunk.tblocks.dataChunk.fillInnerUint16(block_id)
        }
        const result = this.generator.generateDefaultMap(chunk)
        chunk.timers.stop()
        return result
    }

}