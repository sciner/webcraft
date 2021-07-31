importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

function Terrain(seed) {
    this.seed                   = seed;
    this.noisefn                = noise.perlin3;
    this.maps_cache             = {};
    const scale                 = .5;
    // Настройки
    this.options = {
        WATER_LINE:             63, // Ватер-линия
        SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
        SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
        SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
        SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
    };
    noise.seed(this.seed);
}

// generateMap
Terrain.prototype.generateMap = function(chunk, noisefn) {

    if(this.maps_cache.hasOwnProperty(chunk.id)) {
        return this.maps_cache[chunk.id];
    }

    const clamp                 = this.clamp;
    const options               = this.options;
    const SX                    = chunk.coord.x;
    const SZ                    = chunk.coord.z;
    const aleaRandom            = new alea(chunk.seed + '_' + chunk.id);

    // Result map
    var map = {
        options:    options,
        trees:      [],
        plants:     [],
        cells:      Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(null))
    };

    //
    for(var x = 0; x < chunk.size.x; x++) {
        for(var z = 0; z < chunk.size.z; z++) {

            var px = SX + x;
            var pz = SZ + z;
            
            value = noisefn(px / 150, pz / 150, 0) * .4 + 
                noisefn(px / 1650, pz / 1650, 0) * .1 +
                noisefn(px / 650, pz / 650, 0) * .25 +
                noisefn(px / 20, pz / 20, 0) * .05 +
                noisefn(px / 350, pz / 350, 0) * .5;
            value += noisefn(px / 25, pz / 25, 0) * (4 / 255 * noisefn(px / 20, pz / 20, 0));

            // Влажность
            var humidity = clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY, 0) + 0.8) / 2);
            // Экватор
            var equator = clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR, 0) + 0.8) / 1);
            // Get biome
            var biome = BIOMES.getBiome((value * 64 + 68) / 255, humidity, equator);

            value = value * biome.max_height + 68;
            value = parseInt(value);
            value = clamp(value, 4, 255);
            biome = BIOMES.getBiome(value / 255, humidity, equator);

            // Pow
            var diff = value - options.WATER_LINE;
            if(diff < 0) {
                value -= (options.WATER_LINE - value);
            } else {
                value = options.WATER_LINE + Math.pow(diff, 1 + diff / 64);
            }

            var bn = 1;

            // Если наверху блок земли
            if([biome.dirt_block.id].indexOf(biome.dirt_block.id) >= 0) {
                // map.top_dirts.push(new Vector(x, value, z));
                // Динамическая рассадка растений
                var rnd = aleaRandom.double();
                if(rnd > 0 && rnd <= biome.plants.frequency) {
                    var s = 0;
                    var r = rnd / biome.plants.frequency;
                    for(var p of biome.plants.list) {
                        s += p.percent;
                        if(r < s) {
                            map.plants.push({
                                pos: new Vector(x, value, z),
                                block: p.block
                            });
                            break;
                        }
                    }
                }
                // Посадка деревьев
                if(rnd > 0 && rnd <= biome.trees.frequency) {
                    var s = 0;
                    var r = rnd / biome.trees.frequency;
                    for(var type of biome.trees.list) {
                        s += type.percent;
                        if(r < s) {
                            const height = clamp(Math.round(aleaRandom.double() * type.height.max), type.height.min, type.height.max);
                            const rad = Math.max(parseInt(height / 2), 2);
                            map.trees.push({
                                pos:    new Vector(x, value, z),
                                height: height,
                                rad:    rad,
                                type:   type
                            });
                            break;
                        }
                    }
                }
            }

            map.cells[x][z] = {
                value:      value,
                value2:     value,
                humidity:   humidity,
                equator:    equator,
                bn:         bn,
                biome:      {
                    code:           biome.code,
                    color:          biome.color,
                    dirt_color:     biome.dirt_color,
                    title:          biome.title,
                    dirt_block:     biome.dirt_block,
                    block:          biome.block
                },
                block:      biome.dirt_block
            };

            if(biome.code == 'OCEAN') {
                map.cells[x][z].block = blocks.STILL_WATER;
            }

            // @todo: Если это снежный биом, то верхний слой делаем принудительно снегом

        }
    }

    // Clear maps_cache
    var entrs = Object.entries(this.maps_cache);
    var MAX_ENTR = 2000;
    if(entrs.length > MAX_ENTR) {
        var del_count = Math.floor(entrs.length - MAX_ENTR * 0.333);
        console.info('Clear maps_cache, del_count: ' + del_count);
        for(const [k, v] of entrs) {
            if(--del_count == 0) {
                break;
            }
            delete(this.maps_cache[k]);
        }
    }

    //
    return this.maps_cache[chunk.id] = map;

}

// generateMaps
Terrain.prototype.generateMaps = function(chunk) {

    const noisefn               = this.noisefn;
    var maps                    = [];
    var map                     = null;

    for(var x = -1; x <= 1; x++) {
        for(var z = -1; z <= 1; z++) {
            const addr = new Vector(
                chunk.addr.x + x,
                chunk.addr.y,
                chunk.addr.z + z
            );
            const c = {
                seed: chunk.seed,
                addr: addr,
                size: new Vector(
                    CHUNK_SIZE_X,
                    CHUNK_SIZE_Y,
                    CHUNK_SIZE_Z
                ),
                coord: new Vector(
                    addr.x * CHUNK_SIZE_X,
                    addr.y * CHUNK_SIZE_Y,
                    addr.z * CHUNK_SIZE_Z
                ),
            };
            c.id = [
                c.addr.x,
                c.addr.y,
                c.addr.z,
                c.size.x,
                c.size.y,
                c.size.z
            ].join('_');
            var item = {
                chunk: c,
                info: this.generateMap(c, noisefn)
            };
            maps.push(item);
            if(x == 0 && z == 0) {
                map = item;
            }            
        }
    }

    // Smoothing | Сглаживание
    for(var x = 0; x < chunk.size.x; x++) {
        for(var z = 0; z < chunk.size.z; z++) {
            const cell = map.info.cells[x][z];
            if(cell.value > this.options.WATER_LINE - 2 && ['OCEAN', 'BEACH'].indexOf(cell.biome.code) >= 0) {
                cell.value2 = cell.value;
                continue;
            }
            cell.value2 = 0;
            const rad   = 6;
            var cnt     = 0;
            var dirt_color = new Color(0, 0, 0, 0);
            for(var i = -rad; i <= rad; i++) {
                for(var j = -rad; j <= rad; j++) {
                    cnt++;
                    var px = x + i;
                    var pz = z + j;
                    var index = -1;
                    if(px < 0) {
                        index = 0;
                        px = chunk.size.x + px;
                    } else if(px < chunk.size.x) {
                        index = 3;
                    } else {
                        index = 6;
                        px = px - chunk.size.x;
                    }
                    if(pz < 0) {
                        // index = 0;
                        pz = chunk.size.z + pz;
                    } else if(pz < chunk.size.z) {
                        index += 1;
                    } else {
                        index += 2;
                        pz = pz - chunk.size.z;
                    }
                    var neighbour_map = maps[index];
                    const neighbour_cell = neighbour_map.info.cells[px][pz];
                    cell.value2 += neighbour_cell.value;
                    dirt_color.add(neighbour_cell.biome.dirt_color);
                }
            }
            var px                = chunk.coord.x + x;
            var pz                = chunk.coord.z + z;
            cell.value2           = parseInt(cell.value2 / cnt);
            cell.biome.dirt_color = dirt_color.divide(new Color(cnt, cnt, cnt, cnt));
        }
    }

    // Fix trees
    for(var tree of map.info.trees) {
        const cell = map.info.cells[tree.pos.x][tree.pos.z];
        tree.pos.y = cell.value2;
    }

    // Fix plants
    for(var plant of map.info.plants) {
        const cell = map.info.cells[plant.pos.x][plant.pos.z];
        plant.pos.y = cell.value2;
    }

    return maps;
}


// Generate
Terrain.prototype.generate = function(chunk) {

    const seed                  = chunk.id;
    const seedn                 = 0;
    const amplitude             = 24;
    const aleaRandom            = new alea(seed);
    const noisefn               = this.noisefn;

    var maps = this.generateMaps(chunk);
    var map = maps[4];

    //
    for(var x = 0; x < chunk.size.x; x++) {
        for(var z = 0; z < chunk.size.z; z++) {

            // AIR
            chunk.blocks[x][z] = Array(chunk.size.y).fill(null);

            // Bedrock
            chunk.blocks[x][z][0] = blocks.BEDROCK;

            const cell = map.info.cells[x][z];
            const biome = cell.biome;
            const value = cell.value2;

            // chunk.blocks[x][z][2] = biome.block;
            // continue;

            var ar = aleaRandom.double();
            var rnd = ar * cell.bn;

            // Sin wave
            /*
            var px = (x + chunk.coord.x);
            var pz = (z + chunk.coord.z);
            for(var y = 4; y < 4 + Math.abs((Math.sin(px / 8) + Math.cos(pz / 8)) * 3); y++) {
                chunk.blocks[x][z][y] = blocks.CONCRETE;
            }*/

            var center = new Vector(8, 65, 8);

            for(var y = 1; y < value; y++) {

                // Caves | Пещеры
                if(y > 5 && ['OCEAN', 'BEACH'].indexOf(biome.code) < 0) {
                    
                    /*let dist = Helpers.distance(new Vector(x, y, z), center);
                    if(dist < 4 + ar) {
                        continue;
                    }*/

                    var noiseScale  = 15;
                    var px          = (x + chunk.coord.x);
                    var py          = (y + chunk.coord.y);
                    var pz          = (z + chunk.coord.z);
                    let xNoise      = noisefn(py / noiseScale, pz / noiseScale, seedn) * amplitude;
                    let yNoise      = noisefn(px / noiseScale, pz / noiseScale, seedn) * amplitude;
                    let zNoise      = noisefn(px / noiseScale, py / noiseScale, seedn) * amplitude;
                    let density     = xNoise + yNoise + zNoise + (py / 4);
                    if (density > 1 && density < 98) {
                        // 
                    } else {
                        continue;
                    }
                }

                var r = aleaRandom.double() * 1.33;
                if(y < value - (rnd < .005 ? 0 : 3)) {
                    // если это не вода, то заполняем полезными ископаемыми
                    if(r < 0.0025 && y < value - 5) {
                        chunk.blocks[x][z][y] = blocks.DIAMOND_ORE;
                    } else if(r < 0.01) {
                        chunk.blocks[x][z][y] = blocks.COAL_ORE;
                    } else {
                        var norm = true;
                        for(var plant of map.info.plants) {
                            if(plant.pos.x == x && plant.pos.z == z && y == plant.pos.y - 1) {
                                norm = false;
                                break;
                            }
                        }
                        chunk.blocks[x][z][y] = norm ? blocks.CONCRETE : biome.dirt_block;
                    }
                } else {
                    if(biome.code == 'OCEAN' && r < .1) {
                        chunk.blocks[x][z][y] = blocks.GRAVEL;
                    } else {
                        chunk.blocks[x][z][y] = biome.dirt_block;
                    }
                }

            }

            if(biome.code == 'OCEAN') {
                chunk.blocks[x][z][map.info.options.WATER_LINE] = blocks.STILL_WATER;
            }

        }
    }

    /*
    const tree_types = [
        {style: 'spruce', trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, height: 7},
        {style: 'wood', trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, height: 5},
        {style: 'stump', trunk: blocks.WOOD, leaves: blocks.RED_MUSHROOM, height: 1},
        {style: 'cactus', trunk: blocks.CACTUS, leaves: null, height: 5},
    ];

    var x = 8;
    var z = 8;
    var type = tree_types[chunk.addr.x % tree_types.length];
    var tree_options = {
        type: type,
        height: type.height,
        rad: 4,
        pos: new Vector(x, 2, z)
    };
    this.plantTree(
        tree_options,
        chunk,
        tree_options.pos.x,
        tree_options.pos.y,
        tree_options.pos.z,
    );

    return map;
    */

    // Plant plants
    for(var p of map.info.plants) {
        var b = chunk.blocks[p.pos.x][p.pos.z][p.pos.y - 1];
        if(b && b.id == blocks.DIRT.id) {
            chunk.blocks[p.pos.x][p.pos.z][p.pos.y] = p.block;
        }
    }

    // Plant trees
    for(const m of maps) {
        for(var p of m.info.trees) {
            this.plantTree(
                p,
                chunk,
                m.chunk.coord.x + p.pos.x - chunk.coord.x,
                m.chunk.coord.y + p.pos.y - chunk.coord.y,
                m.chunk.coord.z + p.pos.z - chunk.coord.z
            );
        }
    }

    return map;

}

// plantTree...
Terrain.prototype.plantTree = function(options, chunk, x, y, z) {

    const height        = options.height;
    const type          = options.type;
    var ystart = y + height;

    // ствол
    for(var p = y; p < ystart; p++) {
        if(chunk.getBlock(x + chunk.coord.x, p + chunk.coord.y, z + chunk.coord.z).id >= 0) {
            if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                chunk.blocks[x][z][p] = type.trunk;
            }
        }
    }

    // листва над стволом
    switch(type.style) {
        case 'cactus': {
            // кактус
            break;
        }
        case 'stump': {
            // пенёк
            if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                chunk.blocks[x][z][ystart] = type.leaves;
            }
            break;
        }
        case 'wood': {
            // дуб, берёза

            var py = y + height;
            for(var rad of [1, 1, 2, 2]) {
                for(var i = x - rad; i <= x + rad; i++) {
                    for(var j = z - rad; j <= z + rad; j++) {
                        if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                            var m = (i == x - rad && j == z - rad) ||
                                (i == x + rad && j == z + rad) || 
                                (i == x - rad && j == z + rad) ||
                                (i == x + rad && j == z - rad);
                            var m2 = (py == y + height) ||
                                (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                            if(m && m2) {
                                    continue;
                            }
                            var b = chunk.blocks[i][j][py];
                            if(!b || b.id >= 0 && b.id != type.trunk.id) {
                                chunk.blocks[i][j][py] = type.leaves;
                            }
                        }
                    }
                }
                py--;
            }
            break;
        }
        case 'spruce': {
            
            // ель
            var r = 1;
            var rad = Math.round(r);
            if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                chunk.blocks[x][z][ystart] = type.leaves;
            }
            var step = 0;
            for(var y = ystart - 1; y > ystart - (height - 1); y--) {
                if(step++ % 2 == 0) {
                    rad = Math.min(Math.round(r), 3);
                } else {
                    rad = 1;
                }
                for(var i = x - rad; i <= x + rad; i++) {
                    for(var j = z - rad; j <= z + rad; j++) {
                        if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                            if(rad == 1 || Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                                var b = chunk.getBlock(i + chunk.coord.x, p + chunk.coord.y, j + chunk.coord.z);
                                if(b.id == blocks.AIR.id) {
                                    chunk.blocks[i][j][y] = type.leaves;
                                }
                            }
                        }
                    }
                }
                r += .9;
            }
            break;
        }
    }

}

// clamp
Terrain.prototype.clamp = function(x, min, max) {
    if(!min) {
        min = 0;
    }
    if(!max) {
        max = 1;
    }
    if(x < min) return min;
    if(x > max) return max;
    return x;
}