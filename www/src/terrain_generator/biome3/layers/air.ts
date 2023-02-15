/**
 * Generate underworld infinity air
 */
export default class Biome3LayerAir {
    [key: string]: any;

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

    generate(chunk, seed, rnd) {

        return this.generator.generateDefaultMap(chunk)

    }

}