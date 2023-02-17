import type { ChunkWorkerChunk } from "../../../worker/chunk.js"
import type { Terrain_Generator } from "../index.js"

/**
 * Generate underworld infinity stones
 */
export default class Biome3LayerStone {
    [key: string]: any;

    constructor(generator: Terrain_Generator) {

        this.generator = generator

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        this.maps = new Map()

    }

    generate(chunk: ChunkWorkerChunk, seed, rnd) {
        chunk.timers.start('fill stone')
        if(chunk.addr.y < 0)  {
            const BLOCK = this.generator.block_manager
            const block_id = BLOCK.STONE.id
            chunk.tblocks.dataChunk.fillInnerUint16(block_id)
        }
        chunk.timers.stop().start('generateDefaultMap')
        const result = this.generator.generateDefaultMap(chunk)
        chunk.timers.stop()
        return result
    }

}