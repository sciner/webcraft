importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

class Terrain_Generator {

    constructor() {
        this.seed = 0;
        this.noisefn = noise.perlin2;
    }

    generate(chunk) {

        const seed = chunk.id;
        noise.seed(this.seed);

        for(var x = 0; x < chunk.size.x; x++) {
            for(var y = 0; y < chunk.size.y; y++) {
                // AIR
                for(var z = 0; z < chunk.size.z; z++) {
                    chunk.blocks[x][y][z] = blocks.AIR;
                }
                // BEDROCK
                for(var z = 0; z < 1; z++) {
                    chunk.blocks[x][y][z] = blocks.BEDROCK;
                }

            }
        }
    
    }

}