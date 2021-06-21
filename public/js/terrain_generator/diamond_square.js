'use strict'

importScripts(
    '../vendors/perlin.js',
    '../vendors/random-seed.js',
    '../vendors/alea.js',
    '../vendors/stringify.js'
);

const theFlattening = ['1.13', '1.14', '1.15', '1.16']
const rand = uheprng;

class DiamondSquare {

    constructor(size, roughness, seed) {
        // public fields
        this.size = size
        this.roughness = roughness
        this.seed = seed
        this.opCountN = 0
        // private field
        this.data = []
    }

    // public methods
    value(x, y, v) {
        x = parseInt(x)
        y = parseInt(y)
        if (typeof (v) !== 'undefined') { this.val(x, y, v) } else { return this.val(x, y) }
    };

    // private methods
    val(x, y, v) {
        if(typeof (v) !== 'undefined') {
            this.data[x + '_' + y] = Math.max(0.0, Math.min(1.0, v))
        } else {
            if(x <= 0 || x >= this.size || y <= 0 || y >= this.size) {
                return 0.0
            }
            if(this.data[x + '_' + y] == null) {
                this.opCountN++
                let base = 1
                while(((x & base) === 0) && ((y & base) === 0)) {
                    base <<= 1;
                }
                if(((x & base) !== 0) && ((y & base) !== 0)) {
                    this.squareStep(x, y, base);
                } else {
                    this.diamondStep(x, y, base);
                }
            }
            return this.data[x + '_' + y]
        }
    }

    randFromPair(x, y) {
        let xm7, xm13, xm1301081, ym8461, ym105467, ym105943
        for (let i = 0; i < 80; i++) {
            xm7 = x % 7
            xm13 = x % 13
            xm1301081 = x % 1301081
            ym8461 = y % 8461
            ym105467 = y % 105467
            ym105943 = y % 105943
            // y = (i < 40 ? seed : x);
            y = x + this.seed
            x += (xm7 + xm13 + xm1301081 + ym8461 + ym105467 + ym105943)
        }
        return (xm7 + xm13 + xm1301081 + ym8461 + ym105467 + ym105943) / 1520972.0
    }

    displace (v, blockSize, x, y) {
        return (v + (this.randFromPair(x, y, this.seed) - 0.5) * blockSize * 2 / this.size * this.roughness)
    }

    squareStep (x, y, blockSize) {
        if (this.data[x + '_' + y] == null) {
            this.val(x, y,
            this.displace((this.val(x - blockSize, y - blockSize) +
            this.val(x + blockSize, y - blockSize) +
            this.val(x - blockSize, y + blockSize) +
            this.val(x + blockSize, y + blockSize)) / 4, blockSize, x, y))
        }
    }

    diamondStep (x, y, blockSize) {
        if (this.data[x + '_' + y] == null) {
            this.val(x, y,
            this.displace((this.val(x - blockSize, y) +
            this.val(x + blockSize, y) +
            this.val(x, y - blockSize) +
            this.val(x, y + blockSize)) / 4, blockSize, x, y))
        }
    }
}

// Selected empirically
const size  = 10000000;
const seed  = '28382941983245';
const space = new DiamondSquare(size, size / 500, seed);

function Terrain() {
    this.noisefn = noise.perlin3;
}

Terrain.prototype.isFlatteningVersion = function(version) {
    return theFlattening.indexOf(version) > -1;
}


Terrain.prototype.generate = function(chunk) {

    /*
    for(var x = 0; x < chunk.size.x; x++) {
        for(var y = 0; y < chunk.size.y; y++) {
            chunk.blocks[x][y] = Array(chunk.size.z).fill(blocks.AIR);
            //for(var z = 0; z < chunk.size.z; z++) {
            //    chunk.blocks[x][y][z] = blocks.AIR;
            //}
        }
    }*/

    var version     = '1.8';
    var worldHeight = 110;
    var waterline   = 20;

    // const Chunk = require('prismarine-chunk')(version)
    // const mcData = require('minecraft-data')(version)
    const majorVersion = '1.8'; //mcData.version.majorVersion
    var isFlatteningVersion = this.isFlatteningVersion(majorVersion);
    isFlatteningVersion = false;

    const chunkX = chunk.addr.x;
    const chunkZ = chunk.addr.y;

    const seedRand = rand.create(seed + ':' + chunkX + ':' + chunkZ);
    const worldX = chunk.coord.x + size / 2;
    const worldZ = chunk.coord.y + size / 2;
    
    var aleaRandom = new alea(chunk.id);

    for (let x = 0; x < 16; x++) {
        for (let z = 0; z < 16; z++) {
            var wh = Math.max(this.noisefn((chunk.coord.x + x) / 128, (chunk.coord.y + z) / 128, 0), 0);
            var level = Math.round(space.value(worldX + x, worldZ + z) * worldHeight + wh * 100);
            // var level = Math.round(space.value(worldX + x, worldZ + z) * worldHeight);
            const dirtheight = level - 4 + seedRand(3);
            const bedrockheight = 1 + seedRand(4);
            var ar = aleaRandom.double();
            for (let y = 0; y < 256; y++) {
                let block;
                let data;
                const surfaceblock = level <= waterline ? blocks.SAND : (isFlatteningVersion ? blocks.GRASS_BLOCK : null) // Sand below water, grass
                const sr = seedRand(5);
                const belowblock = level <= waterline ? blocks.SAND : (wh > 0.05 ? (sr === 0 ? (ar < .05 ? blocks.COAL_ORE : blocks.GRAVEL) : blocks.STONE) : blocks.DIRT) // 3-5 blocks below surface
                if (y < bedrockheight) {
                    block = blocks.BEDROCK // Solid bedrock at bottom
                } else if (y < level && y >= dirtheight) {
                    block = belowblock // Dirt/sand below surface
                    if (isFlatteningVersion) {
                        data = level < waterline ? 0 : 1
                    }
                } else if (y < level) {
                    // block = blocks.STONE // Set stone inbetween
                    if(ar < 0.0025) {
                        block = blocks.DIAMOND_ORE;
                    } else if(ar < 0.01) {
                        block = blocks.COAL_ORE;
                    } else {
                        block = blocks.CONCRETE;
                    }
                } else if (y === level - 1) {
                    block = surfaceblock // Set surface sand/grass
                    if (isFlatteningVersion) {
                        if (level < waterline) data = 0 // Default sand data is 0
                        else data = 1 // Default dirt data is 1, 0 is snowy
                    }
                } else if (y < waterline) {
                    block = blocks.STILL_WATER // Set the water
                } else if (y === level && level >= waterline && seedRand(5) === 0) {
                    if(belowblock.id == blocks.DIRT.id) {
                        // 1/5 chance of grass
                        if (isFlatteningVersion) {
                            block = blocks.GRASS
                            data = 0
                        } else {
                            if(ar < .8) {
                                block = blocks.TALLGRASS;
                            } else if(ar < .88 && x > 2 && z > 2 && x < 14 && z < 14) {
                                this.plantTree(chunk, aleaRandom, chunk.coord.x + x, chunk.coord.y + z, chunk.coord.z + y);
                            } else {
                                block = plant_blocks[
                                    parseInt(aleaRandom.double() * plant_blocks.length)
                                ];
                            }
                            data = 1
                        }
                    }
                }
                const pos = new Vector(x, y, z)
                if (block) {
                    // chunk.blocks[pos.x][pos.z][pos.y] = block;
                    chunk.blocks[pos.x][pos.z][pos.y] = block;
                }
                //if (data) {
                //    if (isFlatteningVersion) chunk.setBlockData(pos, data)
                //    else chunk.setBlockData(pos, data)
                //}
                // chunk.setSkyLight(pos, 15)
            }
        }
    }

}

// plantTree...
Terrain.prototype.plantTree = function(chunk, aleaRandom, x, y, z) {

    if(aleaRandom.double() < 0.01) {
        chunk.setBlock(x, y, z, blocks.WOOD, false);
        chunk.setBlock(x, y, z + 1, blocks.RED_MUSHROOM, false);
    } else {
        var height = Math.round(aleaRandom.double() * 7 + 2);

        const zstart = z + height;

        // ствол
        if(aleaRandom.double() < 0.2) {
            var block_trunk = blocks.WOOD_BIRCH;
        } else {
            var block_trunk = blocks.WOOD;
        }
        for(var p = z; p < zstart; p++) {
            if(chunk.getBlock(x, y, p).id >= 0) {
                chunk.setBlock(x, y, p, block_trunk, false);
            }
        }

        // листва над стволом
        const leaves_rad = Math.max(parseInt(height / 2), 2);

        for(var k = zstart - leaves_rad; k <= zstart + leaves_rad; k++) {
            // радиус листвы
            var rad = leaves_rad;
            if(block_trunk.id == blocks.WOOD.id) {
                var max = leaves_rad * 2;
                var perc = (k - (zstart - leaves_rad)) / max;
                rad = parseInt(Math.abs(Math.sin(perc * Math.PI * 2) * (leaves_rad * (1-perc))));
                rad = Math.max(rad, 2);
            }
            for(var i = x - rad; i <= x + rad; i++) {
                for(var j = y - rad; j <= y + rad; j++) {
                    if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(y - j, 2) + Math.pow(zstart - k, 2)) <= rad) {
                        var b = chunk.getBlock(i, j, k);
                        if(b.id >= 0 && b.id != block_trunk.id) {
                            chunk.setBlock(i, j, k, blocks.WOOD_LEAVES, false);
                        }
                    }
                }
            }
        }
    }

}