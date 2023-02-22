import type { ChunkWorkerChunk } from "../../../worker/chunk";
import type { Default_Terrain_Map } from "../../default";

/**
 * Generate underworld infinity air
 */
export default class Biome3LayerAir {
    generator: any;
    noise2d: any;
    noise3d: any;
    block_manager: any;
    maps: Map<any, any>;

    /**
     * @param { import("../index.js").default } generator
     */
    constructor(generator) {

        this.generator = generator

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        this.maps = new Map()

    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {

        return this.generator.generateDefaultMap(chunk)

    }

}