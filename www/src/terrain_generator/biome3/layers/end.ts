import { impl as alea } from "../../../../vendors/alea.js";
import { Vector } from "../../../helpers.js";
import type Terrain_Generator from "../index.js";

/**
 * Generate underworld infinity stones
 */
const MAX_GEN_DEPTH = 8

export default class Biome3LayerEnd {
    generator: Terrain_Generator;
    noise2d: any;
    noise3d: any;
    block_manager: any;
    clusterManager: any;
    min: float;
    max: float;

    constructor(generator : Terrain_Generator) {
        this.generator = generator
        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        this.clusterManager = generator.clusterManager
        this.min = 100000
        this.max = -10000
    }

    generate(chunk, seed, rnd) {
        const BLOCK = this.generator.block_manager
        const { cx, cy, cz, cw, uint16View } = chunk.tblocks.dataChunk
        const block_id = BLOCK.END_STONE.id
        for (let x = 0; x < chunk.size.x; x++) {
            for (let z = 0; z < chunk.size.z; z++) {
                for (let y = 0; y < chunk.size.y; y++) {
                    const n2 = this.noise2d((chunk.coord.x + x) / 100, (chunk.coord.z + z) / 100) * (y - 12)
                    const n1 = this.noise2d((chunk.coord.x + x) / 100, (chunk.coord.z + z) / 100) * 14
                    const index = cx * x + cy * y + cz * z + cw
                    if (n2 > this.max) {
                        this.max = n2
                    }
                    if (n2 < this.min) {
                        this.min = n2
                    }
                    if ((n2 < 12) && chunk.addr.y == 0 ) {
                        uint16View[index] = block_id
                    }
                }
            }
        }
        console.log('min' + this.min + ' max' + this.max)
        return this.generator.generateDefaultMap(chunk)
    }

}