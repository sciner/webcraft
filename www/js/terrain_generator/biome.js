importScripts(
    '../vendors/perlin.js',
    '../vendors/alea.js'
);

var xxmin = 99999;

function Terrain() {
    this.seed = 0;
    this.noisefn = noise.perlin3;
    this.BIOMES = {};
    this.BIOMES.OCEAN = {
        code:       'OCEAN',
        color:      '#017bbb',
        title:      'ОКЕАН',
        dirt_block: blocks.SAND,
        trees:      {
            frequency: 0,
            list: []
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
    this.BIOMES.BEACH = {
        code:       'BEACH',
        color:      '#ffdc7f',
        title:      'ПЛЯЖ',
        dirt_block: blocks.SAND,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.CACTUS, leaves: null}
            ]
        },
        plants: {
            frequency: .005,
            list: [
                {percent: 1, block: blocks.DEAD_BUSH}
            ]
        }
    };
    this.BIOMES.TEMPERATE_DESERT = {
        code:       'TEMPERATE_DESERT',
        color:      '#f4a460',
        title:      'УМЕРЕННАЯ ПУСТЫНЯ',
        dirt_block: blocks.SAND,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.CACTUS, leaves: null, style: 'cactus'}
            ]
        },
        plants: {
            frequency: .005,
            list: [
                {percent: 1, block: blocks.DEAD_BUSH}
            ]
        }
    };
    this.BIOMES.SUBTROPICAL_DESERT = {
        code:       'SUBTROPICAL_DESERT',
        color:      '#c19a6b',
        title:      'СУБТРОПИЧЕСКАЯ ПУСТЫНЯ',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood'}
            ]
        },
        plants: {
            frequency: .005,
            list: [
                {percent: 1, block: blocks.DEAD_BUSH}
            ]
        }
    };
    this.BIOMES.SCORCHED = {
        code:       'SCORCHED',
        color:      '#ff5500',
        title:      'ОБОГРЕВАЮЩИЙ',
        dirt_block: blocks.SAND,
        trees:      {frequency: 0},
        plants:     {frequency: 0}
    };
    this.BIOMES.BARE = {
        code:       'BARE',
        color:      '#CCCCCC',
        title:      'ПУСТОШЬ',
        dirt_block: blocks.CONCRETE,
        trees:      {},
        plants:     {frequency: 0}
    };
    this.BIOMES.TUNDRA = {
        code:       'TUNDRA',
        color:      '#74883c',
        title:      'ТУНДРА',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce'}
            ]
        },
        plants: {
            frequency: .025,
            list: [
                {percent: 1, block: blocks.BROWN_MUSHROOM}
            ]
        }
    };
    this.BIOMES.TAIGA = {
        code:       'TAIGA',
        color:      '#879b89',
        title:      'ТАЙГА',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce'}
            ]
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
    this.BIOMES.SNOW = {
        code:       'SNOW',
        color:      '#f5f5ff',
        title:      'СНЕГ',
        dirt_block: blocks.SNOW_DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce'}
            ]
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
    this.BIOMES.SHRUBLAND = {
        code:       'SHRUBLAND',
        color:      '#316033',
        title:      'КУСТАРНИКИ',
        dirt_block: blocks.DIRT,
        trees:      {frequency: 0},
        plants: {
            frequency: .3,
            list: [
                {percent: 1, block: blocks.GRASS}
            ]
        }
    };
    this.BIOMES.GRASSLAND = {
        code:       'GRASSLAND',
        color:      '#98a136',
        title:      'ТРАВЯНАЯ ЗЕМЛЯ',
        dirt_block: blocks.DIRT,
        trees:      {frequency: 0},
        plants: {
            frequency: .5,
            list: [
                {percent: .95, block: blocks.GRASS},
                {percent: .025, block: blocks.TULIP},
                {percent: .025, block: blocks.DANDELION}
            ]
        }
    };
    this.BIOMES.TEMPERATE_DECIDUOUS_FOREST = {
        code:       'TEMPERATE_DECIDUOUS_FOREST',
        color:      '#228b22',
        title:      'УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .02,
            list: [
                {percent: 1, trunk: blocks.WOOD_BIRCH, leaves: blocks.WOOD_LEAVES, style: 'wood'}
            ]
        },
        plants: {
            frequency: .3,
            list: [
                {percent: .975, block: blocks.GRASS},
                {percent: .025, block: blocks.RED_MUSHROOM}
            ]
        }
    };
    this.BIOMES.TEMPERATE_RAIN_FOREST = {
        code:       'TEMPERATE_RAIN_FOREST',
        color:      '#00755e',
        title:      'УМЕРЕННЫЙ ДОЖДЬ ЛЕС',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood'}
            ]
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
    this.BIOMES.TROPICAL_SEASONAL_FOREST = {
        code:       'TROPICAL_SEASONAL_FOREST',
        color:      '#008456',
        title:      'ТРОПИЧЕСКИЙ СЕЗОННЫЙ ЛЕС',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.WOOD, leaves: blocks.WOOD_LEAVES, style: 'wood'}
            ]
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
    this.BIOMES.TROPICAL_RAIN_FOREST = {
        code:       'TROPICAL_RAIN_FOREST',
        color:      '#16994f',
        title:      'ТРОПИЧЕСКИЙ ЛЕС',
        dirt_block: blocks.DIRT,
        trees:      {
            frequency: .025,
            list: [
                {percent: 1, trunk: blocks.SPRUCE, leaves: blocks.SPRUCE_LEAVES, style: 'spruce'}
            ]
        },
        plants: {
            frequency: 0,
            list: []
        }
    };
}

// Generate
Terrain.prototype.generate = function(chunk) {

    // Top dirts
    var top_dirts = new Array(chunk.size.x);
    for(var x = 0; x < chunk.size.x; x++) {
        top_dirts[x] = new Array(chunk.size.y);
        for(var y = 0; y < chunk.size.y; y++) {
            top_dirts[x][y] = 0;
        }
    }

    const seed                  = chunk.id;
    const signal                = this.makeSignal(115, 10);
    const aleaRandom            = new alea(seed);
    const noisefn               = this.noisefn;
    const clamp                 = this.clamp;
    noise.seed(this.seed);

    const SX                    = chunk.coord.x;
    const SY                    = chunk.coord.y;
    
    var scale = .5;

    // Настройки
    const options = {
        WATER_LINE:             63, // Ватер-линия
        SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
        SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
        SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
        SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
    };

    //
    for(var x = 0; x < chunk.size.x; x++) {
        for(var y = 0; y < chunk.size.y; y++) {

            // Bedrock
            chunk.blocks[x][y][0] = blocks.BEDROCK;

            // AIR
            for(var z = 1; z < chunk.size.z; z++) {
                chunk.blocks[x][y][z] = blocks.AIR;
            }

            var px = (x + SX);
            var py = (y + SY);

            // Влажность
            var humidity = clamp(noisefn(px / options.SCALE_HUMIDITY, py / options.SCALE_HUMIDITY, 0) + 0.6);
            // Экватор
            var equator = clamp(noisefn(px / options.SCALE_EQUATOR, py / options.SCALE_EQUATOR, 0) + 0.6);

            // Высота
            var value = (
                noisefn(px / options.SCALE_VALUE, py / options.SCALE_VALUE, 0) + // равнины
                noisefn(px / (options.SCALE_VALUE / 2), py / (options.SCALE_VALUE / 2), 0)
                // noisefn(px / options.SCALE_BIOM, py / options.SCALE_BIOM, 0)
            ) / 2;

            // Шум биома
            var mh = clamp(noisefn(px / (options.SCALE_VALUE * 8), py / (options.SCALE_VALUE * 8), 0) + 0.6, 0.1, 1);
            value *= (1. + mh / 2);

            if(value < 0) {
                value /= 6;
            }
            value += 0.2;
            value = parseInt(value * 255) + 4;
            value = clamp(value, 4, 255);
            value = signal[value];
            
            if(value < options.WATER_LINE) {
                value = Math.round(options.WATER_LINE - (options.WATER_LINE - value) * 0.5);
            }

            // Get biome
            var biome = this.getBiome(value / 255, humidity, equator);
            
            var rnd = aleaRandom.double() * mh;

            for(var z = 1; z < value; z++) {
                var r = aleaRandom.double() * 1.33;
                if(z < value - (rnd < .005 ? 0 : 2)) {
                    // если это не вода, то заполняем полезными ископаемыми
                    if(r < 0.0025 && z < value - 5) {
                        // chunk.blocks[x][y][z] = blocks.DIAMOND_ORE;
                        chunk.blocks[x][y][z] = {id: blocks.DIAMOND_ORE.id, name: blocks.DIAMOND_ORE.name};
                    } else if(r < 0.01) {
                        // chunk.blocks[x][y][z] = blocks.COAL_ORE;
                        chunk.blocks[x][y][z] = {id: blocks.COAL_ORE.id, name: blocks.COAL_ORE.name};
                    } else {
                        // chunk.blocks[x][y][z] = blocks.CONCRETE;
                        chunk.blocks[x][y][z] = {id: blocks.CONCRETE.id, name: blocks.CONCRETE.name};
                    }
                } else {
                    if(biome.code == 'OCEAN' && r < .1) {
                        // chunk.blocks[x][y][z] = blocks.GRAVEL;
                        chunk.blocks[x][y][z] = {id: blocks.GRAVEL.id, name: blocks.GRAVEL.name};
                    } else {
                        // chunk.blocks[x][y][z] = biome.dirt_block;
                        chunk.blocks[x][y][z] = {id: biome.dirt_block.id, name: biome.dirt_block.name};
                        if(z == value - 1 && biome.dirt_block.id == blocks.DIRT.id) {
                            top_dirts[x][y] = value;
                        }
                    }
                }
                // chunk.blocks[x][y][z] = Object.assign({}, chunk.blocks[x][y][z]);
                // chunk.blocks[x][y][z] = JSON.parse(JSON.stringify(chunk.blocks[x][y][z]));
                // chunk.blocks[x][y][z] = {...chunk.blocks[x][y][z]};
                // Fastest method
                /*
                var b = chunk.blocks[x][y][z];
                chunk.blocks[x][y][z] = {
                    id:             b.id,
                    name:           b.name
                };
                */
            }

            if(biome.code == 'OCEAN') {
                chunk.blocks[x][y][options.WATER_LINE] = blocks.STILL_WATER;
            }

            // Если это снежный биом, то верхний слой делаем принудительно снегом
            /*
                if(biome.code == 'SNOW') {
                    if(block_type.id == blocks.CONCRETE.id) {
                        chunk.blocks[x][y][value] = blocks.SNOW_BLOCK;
                    }
                }
            */

        }
    }

    // Plant trees
    for(var x = 0; x < chunk.size.x; x++) {
        for(var y = 0; y < chunk.size.y; y++) {
            var z = top_dirts[x][y];
            if(z > 2) {
                // Динамическая рассадка растений
                var rnd = aleaRandom.double();
                if(rnd > 0 && rnd <= biome.plants.frequency) {
                    var s = 0;
                    var r = rnd / biome.plants.frequency;
                    for(var p of biome.plants.list) {
                        s += p.percent;
                        if(r < s) {
                            chunk.blocks[x][y][z] = p.block;
                            break;
                        }
                    }
                }

                // Посадка деревьев
                if(rnd > 0 && rnd <= biome.trees.frequency) {
                    var s = 0;
                    var r = rnd / biome.trees.frequency;
                    for(var tree of biome.trees.list) {
                        s += tree.percent;
                        if(r < s) {
                            this.plantTree(biome, tree, chunk, aleaRandom, chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);
                            break;
                        }
                    }
                }
            }
        }
    }

}

// plantTree...
Terrain.prototype.plantTree = function(biome, tree, chunk, aleaRandom, x, y, z) {

    //if(x - chunk.coord.x < 4 || y - chunk.coord.y < 4 || x - chunk.coord.x > 12 || y - chunk.coord.y > 12) {
    //    return;
    //}

    if(aleaRandom.double() < 0.01) {
        chunk.setBlock(x, y, z, tree.trunk, false);
        chunk.setBlock(x, y, z + 1, blocks.RED_MUSHROOM, false);
    } else {

        // var height = Math.round(this.clamp(aleaRandom.double() * 9, 2, 9));
        var height = Math.round(aleaRandom.double() * 7 + 2);
        var zstart = z + height;

        // ствол
        for(var p = z; p < zstart; p++) {
            if(chunk.getBlock(x, y, p).id >= 0) {
                chunk.setBlock(x, y, p, tree.trunk, false);
            }
        }

        // листва над стволом
        switch(tree.style) {
            case 'cactus': {
                break;
            }
            case 'wood': {
                if(tree.leaves) {
                    const leaves_rad = Math.max(parseInt(height / 2), 2);
                    for(var k = zstart - leaves_rad; k <= zstart + leaves_rad; k++) {
                        // радиус листвы
                        var rad = leaves_rad;
                        if(tree.trunk.id == tree.trunk.id) {
                            var max = leaves_rad * 2;
                            var perc = (k - (zstart - leaves_rad)) / max;
                            rad = parseInt(Math.abs(Math.sin(perc * Math.PI * 2) * (leaves_rad * (1-perc))));
                            rad = Math.max(rad, 2);
                        }
                        for(var i = x - rad; i <= x + rad; i++) {
                            for(var j = y - rad; j <= y + rad; j++) {
                                if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(y - j, 2) + Math.pow(zstart - k, 2)) <= rad) {
                                    var b = chunk.getBlock(i, j, k);
                                    if(b.id >= 0 && b.id != tree.trunk.id) {
                                        chunk.setBlock(i, j, k, tree.leaves, false);
                                    }
                                }
                            }
                        }
                    }
                }
                break;
            }
            case 'spruce': {
                if(tree.leaves) {
                    var max_rad = Math.max(parseInt(height / 2), 2);
                    chunk.setBlock(x, y, zstart, tree.leaves, false);
                    zstart -= parseInt(height * .75);
                    for(var r = 0; r < 3; r++) {
                        var rad = max_rad--;
                        if(rad < 1) {
                            break;
                        }
                        for(var l = 0; l < 2; l++) {
                            for(var i = x - rad; i <= x + rad; i++) {
                                for(var j = y - rad; j <= y + rad; j++) {
                                    if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(y - j, 2)) <= rad) {
                                        var b = chunk.getBlock(i, j, zstart + l);
                                        if(b.id >= 0 && b.id != tree.trunk.id) {
                                            chunk.setBlock(i, j, zstart + l, tree.leaves, false);
                                        }
                                    }
                                }
                            }
                            rad -= 2;
                        }
                        zstart += 2;
                    }
                }
                break;
            }
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
    return Math.max(Math.min(x, max), min);
}
    
/**
* Функция определения биома в зависимости от возвышенности, влажности и отдаленности от экватора
*/
Terrain.prototype.getBiome = function(height, humidity, equator) {
    
    function _(humidity, height, equator) {
        /*
        if(equator > .7) {
            if (equator < .9) return 'OCEAN';
            if (equator < .92 && humidity < .5) return 'TUNDRA';
            return 'SNOW';
        }
        */
        // if (h < 0.1) return 'OCEAN';
        // if (h < 0.12) return 'BEACH';
        if (height < 0.248) return 'OCEAN';
        if (height < 0.265) return 'BEACH';
        if (height > 0.8) {
            if (humidity < 0.1) return 'SCORCHED';
            if (humidity < 0.2) return 'BARE';
            if (humidity < 0.5) return 'TUNDRA';
            return 'SNOW';
        }
        if (height > 0.6) {
            if (humidity < 0.33) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
            if (humidity < 0.66) return 'SHRUBLAND'; // кустарник
            return 'TAIGA';
        }
        if (height > 0.3) {
            if (humidity < 0.16) return 'TEMPERATE_DESERT'; // УМЕРЕННАЯ ПУСТЫНЯ
            if (humidity < 0.50) return 'GRASSLAND';
            if (humidity < 0.83) return 'TEMPERATE_DECIDUOUS_FOREST'; // УМЕРЕННЫЙ ЛИСТЫЙ ЛЕС
            return 'TEMPERATE_RAIN_FOREST'; // УМЕРЕННЫЙ ДОЖДЬ ЛЕС
        }
        if (humidity < 0.16) return 'SUBTROPICAL_DESERT';
        if (humidity < 0.33) return 'GRASSLAND';
        if (humidity < 0.66) return 'TROPICAL_SEASONAL_FOREST';
        return 'TROPICAL_RAIN_FOREST';
    }

    var b = _(humidity, height, equator);
    return this.BIOMES[b];

}

// Make signal
Terrain.prototype.makeSignal = function(w, h) {
    // minimum two points
    var myPoints = [
        0.01,   0,
        0.3,    0,
        0.35,   0,
        0.45,   0,
        1.0,    0,
    ];
    const tension = 0.5;
    var curve = this.getCurvePoints(myPoints, 0, false, 63);
    var signal = [];
    for(var i = 0; i < 256; i++) {
        signal.push(parseInt(curve[i * 2] * 255));
    }
    return signal;
}

// getCurvePoints
Terrain.prototype.getCurvePoints = function(pts, tension, isClosed, numOfSegments) {
    // use input value if provided, or use a default value   
    tension = (typeof tension != 'undefined') ? tension : 0.5;
    isClosed = isClosed ? isClosed : false;
    numOfSegments = numOfSegments ? numOfSegments : 16;
    var _pts = [], res = [],    // clone array
        x, y,           // our x,y coords
        t1x, t2x, t1y, t2y, // tension vectors
        c1, c2, c3, c4,     // cardinal points
        st, t, i;       // steps based on num. of segments

    // clone array so we don't change the original
    //
    _pts = pts.slice(0);
    // The algorithm require a previous and next point to the actual point array.
    // Check if we will draw closed or open curve.
    // If closed, copy end points to beginning and first points to end
    // If open, duplicate first points to befinning, end points to end
    if (isClosed) {
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.unshift(pts[pts.length - 1]);
        _pts.unshift(pts[pts.length - 2]);
        _pts.push(pts[0]);
        _pts.push(pts[1]);
    } else {
        _pts.unshift(pts[1]);   //copy 1. point and insert at beginning
        _pts.unshift(pts[0]);
        _pts.push(pts[pts.length - 2]); //copy last point and append
        _pts.push(pts[pts.length - 1]);
    }
    // ok, lets start..
    // 1. loop goes through point array
    // 2. loop goes through each segment between the 2 pts + 1e point before and after
    for (i=2; i < (_pts.length - 4); i+=2) {
        for (t=0; t <= numOfSegments; t++) {

            // calc tension vectors
            t1x = (_pts[i+2] - _pts[i-2]) * tension;
            t2x = (_pts[i+4] - _pts[i]) * tension;

            t1y = (_pts[i+3] - _pts[i-1]) * tension;
            t2y = (_pts[i+5] - _pts[i+1]) * tension;

            // calc step
            st = t / numOfSegments;

            // calc cardinals
            c1 =   2 * Math.pow(st, 3)  - 3 * Math.pow(st, 2) + 1; 
            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2); 
            c3 =       Math.pow(st, 3)  - 2 * Math.pow(st, 2) + st; 
            c4 =       Math.pow(st, 3)  -     Math.pow(st, 2);

            // calc x and y cords with common control vectors
            x = c1 * _pts[i]    + c2 * _pts[i+2] + c3 * t1x + c4 * t2x;
            y = c1 * _pts[i+1]  + c2 * _pts[i+3] + c3 * t1y + c4 * t2y;

            //store points in array
            res.push(x);
            res.push(y);

        }
    }
    return res;
}
