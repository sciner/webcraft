importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

function Terrain_Generator() {
    this.seed = 0;
    this.noisefn = noise.perlin2;
}

Terrain_Generator.prototype.generate = function(chunk) {

    var dirt_height_half        = Math.round(DIRT_HEIGHT * 0.5);
    const threshold_dirt        = -.25;
    const threshold_concrete    = -.5;
    var top_dirts = new Array(chunk.size.x);
    for(var x = 0; x < chunk.size.x; x++) {
        top_dirts[x] = new Array(chunk.size.y);
        for(var y = 0; y < chunk.size.y; y++) {
            top_dirts[x][y] = 0;
        }
    }

    const seed = chunk.id;
    noise.seed(this.seed);
    
    var aleaRandom = new alea(seed);

    if(chunk.addr.x >= 128 && chunk.addr.y >= 128 && chunk.addr.x < 168 && chunk.addr.y < 147) {
        for(var x = 0; x < chunk.size.x; x++) {
            for(var y = 0; y < chunk.size.y; y++) {
                for(var z = 0; z < chunk.size.z - 10; z++) {
                    if(z == 0) {
                        chunk.blocks[x][y][z] = blocks.BEDROCK;
                        continue;
                    }
                    while(true) {
                        var index = parseInt((all_blocks.length - 1) * aleaRandom.double());
                        var mat = all_blocks[index];
                        if(!mat) {
                            continue;
                        }
                        if(mat.fluid) {
                            continue;
                        }
                        if(mat.gravity) {
                            continue;
                        }
                        if(aleaRandom.double() > 0.3) {
                            mat = blocks.AIR;
                        }
                        if(banned_blocks.indexOf(mat.id) >= 0) {
                            continue;
                        }
                        chunk.blocks[x][y][z] = mat;
                        break;
                    }
                }
            }
        }
        return;
    }    

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

            // HILLS
            var value = this.noisefn((chunk.coord.x + x) / 64, (chunk.coord.y + y) / 64, 0);
            value = value * DIRT_HEIGHT * 1.5;

            if(value < 0) {
                value *= 0.2;
            }
            value += dirt_height_half;
            for(var z = 1; z <= DIRT_HEIGHT; z++) {
                var block_type = z < value ? blocks.DIRT : blocks.AIR;
                chunk.blocks[x][y][z] = block_type
                if(block_type.id == blocks.DIRT.id) {
                    top_dirts[x][y] = Math.max(top_dirts[x][y], z);
                }
            }
            // CAVES
            for(var z = 1; z < DIRT_HEIGHT - 16; z++) {
                if(chunk.getBlock(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z).id != blocks.DIRT.id) {
                    continue;
                }
                var block_type = blocks.AIR;
                if(z < DIRT_HEIGHT * 0.85) {
                    var value = this.noisefn((chunk.coord.x + x) / 10, (chunk.coord.y + y) / 10, (chunk.coord.z + z) / 2);
                    var r = aleaRandom.double();
                    if(value >= threshold_dirt) {
                        if(z < 4) {
                            if(r < 0.0025) {
                                block_type = blocks.DIAMOND_ORE;
                            } else if(r < 0.01) {
                                block_type = blocks.COAL_ORE;
                            } else {
                                block_type = blocks.CONCRETE;
                            }
                        } else {
                            block_type = blocks.DIRT;
                        }
                    } else if(value >= threshold_concrete) {
                        if(r < 0.025) {
                            block_type = blocks.COAL_ORE;
                        } else {
                            block_type = blocks.CONCRETE;
                        }
                    }
                }
                chunk.blocks[x][y][z] = block_type;
                if(block_type.id == blocks.DIRT.id) {
                    top_dirts[x][y] = Math.max(top_dirts[x][y], z);
                } else if(top_dirts[x][y] > 0) {
                    top_dirts[x][y] = 0;
                }
            }

        }
    }
    
    // Plant trees
    const leaves_rad = 4;
    for(var x = 0; x < chunk.size.x; x++) {
        for(var y = 0; y < chunk.size.y; y++) {
            var z = top_dirts[x][y] + 1;
            if(z > 2) {
                var block_type = null;
                var rnd = aleaRandom.double();
                if(rnd < 0.05) {
                    block_type = plant_blocks[
                        parseInt(aleaRandom.double() * plant_blocks.length)
                    ];
                } else if(rnd < .35) {
                    block_type = blocks.GRASS;
                }
                if(block_type) {
                    chunk.blocks[x][y][z] = block_type;
                }
                // Plant trees
                if(x >= leaves_rad && x < chunk.size.x - leaves_rad) {
                    if(y >= leaves_rad && y < chunk.size.y - leaves_rad) {
                        var value = this.noisefn((chunk.coord.x + x) / 2, (chunk.coord.y + x) / 2, 0);
                        if(value < -0.1) {
                            this.plantTree(chunk, aleaRandom, chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);
                            continue;
                        }
                    }
                }
            }
        }
    }
}

// plantTree...
Terrain_Generator.prototype.plantTree = function(chunk, aleaRandom, x, y, z) {

    // проверка на достаточность земли вокруг дерева

    var normal_conditions = true;
    const margin = 2;
    for(var i = -margin; i <= margin; i++) {
        for(var j = -margin; j <= margin; j++) {
            for(var k = -1; k < 1; k++) {
                var block = chunk.getBlock(x + i, y + j, z + k);
                if([blocks.DIRT.id, blocks.AIR.id].indexOf(block.id) < 0 && block.passable !== 1) {
                    normal_conditions = false;
                    break;
                }
            }
        }
    }

    if(!normal_conditions) {
        return;
    }
    
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