/**
 * Generate underworld infinity lava
 */
export default class Biome3LayerLava {
    [key: string]: any;

    /**
     * @param { import("../index.js").Terrain_Generator } generator
     */
    constructor(generator) {

        this.generator = generator

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        this.maps = new Map()

    }

    generate(chunk, seed, rnd) {

        if(chunk.addr.y < 0)  {
            const BLOCK = this.generator.block_manager
            const { cx, cy, cz, cw, uint16View } = chunk.tblocks.dataChunk
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