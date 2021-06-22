importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

function Terrain() {
    this.seed = 0;
    this.noisefn = noise.perlin3;
}

Terrain.prototype.generate = function(chunk) {

    const seed = chunk.id;
    noise.seed(this.seed);
    
    var aleaRandom = new alea(seed);
    
    var r = aleaRandom.double();

    for(var x = 0; x < chunk.size.x; x++) {
        for(var y = 0; y < chunk.size.y; y++) {
            // AIR
            for(var z = 0; z < chunk.size.z; z++) {
                chunk.blocks[x][y][z] = blocks.AIR;
            }
            // BEDROCK
            for(var z = 0; z < 1; z++) {
                var ax = x + chunk.coord.x;
                var ay = y + chunk.coord.y;
                chunk.blocks[x][y][z] = blocks.BEDROCK;
            }

            var value = this.noisefn((chunk.coord.x + x) / 64, (chunk.coord.y + y) / 64, 0);

        }
    }

}
