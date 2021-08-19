import {impl as alea} from '../../vendors/alea.js';
import noise from '../../vendors/perlin.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE_Y_MAX} from "../blocks.js";
import {Vector, Helpers, Color} from '../helpers.js';
import {blocks, BIOMES} from '../biomes.js';
import {CaveGenerator} from '../caves.js';

// Terrain generator class
export default class Terrain_Generator {

    constructor(seed) {
        const scale                 = .5;
        // Настройки
        this.options = {
            WATER_LINE:             63, // Ватер-линия
            SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
            SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
            SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
            SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
        };
        //
        this.noisefn                = noise.perlin2;
        this.maps_cache             = {};
        this.setSeed(seed);
        // Сaves manager
        this.caveManager            = new CaveGenerator(seed);
    }

    setSeed(seed) {
        this.seed = seed;
        noise.seed(this.seed);
    }

    // generateMap
    generateMap(chunk, noisefn) {
        let addr_string = chunk.addr.toString();
        if(this.maps_cache.hasOwnProperty(addr_string)) {
            // return this.maps_cache[addr_string];
        }
        const options               = this.options;
        const SX                    = chunk.coord.x;
        const SZ                    = chunk.coord.z;
        // Result map
        let map                     = new Map(chunk, this.options);
        this.caveManager.addSpiral(chunk.addr);
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let px = SX + x;
                let pz = SZ + z;
                // высота горы в точке
                let value = noisefn(px / 150, pz / 150, 0) * .4 + 
                    noisefn(px / 1650, pz / 1650) * .1 +
                    noisefn(px / 650, pz / 650) * .25 +
                    noisefn(px / 20, pz / 20) * .05 +
                    noisefn(px / 350, pz / 350) * .5;
                value += noisefn(px / 25, pz / 25) * (4 / 255 * noisefn(px / 20, pz / 20));
                // Влажность
                let humidity = Helpers.clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY) + 0.8) / 2);
                // Экватор
                let equator = Helpers.clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR) + 0.8) / 1);
                // Get biome
                let biome = BIOMES.getBiome((value * 64 + 68) / 255, humidity, equator);
                value = value * biome.max_height + 68;
                value = parseInt(value);
                value = Helpers.clamp(value, 4, 255);
                biome = BIOMES.getBiome(value / 255, humidity, equator);
                // Pow
                let diff = value - options.WATER_LINE;
                if(diff < 0) {
                    value -= (options.WATER_LINE - value) * .65 - 1.5;
                } else {
                    value = options.WATER_LINE + Math.pow(diff, 1 + diff / 64);
                }
                value = parseInt(value);
                // Different dirt blocks
                let ns = noisefn(px / 5, pz / 5);
                let index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                let dirt_block = biome.dirt_block[index];
                // Create map cell
                map.cells[x][z] = new MapCell(
                    value,
                    humidity,
                    equator,
                    {
                        code:           biome.code,
                        color:          biome.color,
                        dirt_color:     biome.dirt_color,
                        title:          biome.title,
                        dirt_block:     dirt_block,
                        block:          biome.block
                    },
                    dirt_block
                );
                if(biome.code == 'OCEAN') {
                    map.cells[x][z].block = blocks.STILL_WATER;
                }

            }
        }
        // Clear maps_cache
        let keys = Object.keys(this.maps_cache);
        let MAX_ENTR = 20000;
        if(keys.length > MAX_ENTR) {
            let del_count = Math.floor(keys.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(let key of keys) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[key]);
            }
        }
        //
        return this.maps_cache[addr_string] = map;
    }

    // generateMaps
    generateMaps(chunk) {

        const noisefn               = this.noisefn;
        let maps                    = [];
        let map                     = null;

        for(let x = -1; x <= 1; x++) {
            for(let z = -1; z <= 1; z++) {
                const addr = new Vector(chunk.addr.x + x, 0 /*chunk.addr.y*/, chunk.addr.z + z);
                const c = {
                    blocks: {},
                    seed: chunk.seed,
                    addr: addr,
                    size: new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z),
                    coord: new Vector(addr.x * CHUNK_SIZE_X, addr.y * CHUNK_SIZE_Y, addr.z * CHUNK_SIZE_Z),
                };
                c.id = [c.addr.x, c.addr.y, c.addr.z, c.size.x, c.size.y, c.size.z].join('_');
                let item = {
                    chunk: c,
                    info: this.generateMap(c, noisefn)
                };
                maps.push(item);
                if(x == 0 && z == 0) {
                    map = item;
                }            
            }
        }

        // Smooth (for central and part of neighboors)
        // @todo Временно закрыто (#3dchunk)
        map.info.smooth(this);

        // Generate vegetation
        for(let map of maps) {
            map.info.generateVegetation();
        }

        return maps;
    }

    // Generate
    generate(chunk) {

        let maps                    = this.generateMaps(chunk);
        let map                     = maps[4];

        const seed                  = chunk.id;
        const aleaRandom            = new alea(seed);

        // Проверяем соседние чанки в указанном радиусе, на наличие начала(головы) пещер
        let neighboors_caves        = this.caveManager.getNeighboors(chunk.addr);

        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                const cell  = map.info.cells[x][z];
                const biome = cell.biome;
                const value = cell.value2;

                let ar      = aleaRandom.double();
                let rnd     = ar;
                let min_y   = 0;

                // Bedrock
                if(chunk.coord.y == 0) {
                    chunk.blocks[x][z][0] = blocks.BEDROCK;
                    min_y++;
                }

                for(let y = min_y; y < chunk.size.y; y++) {

                    if(chunk.coord.y + y >= value) {
                        continue;
                    }

                    // Caves | Пещеры
                    if(['OCEAN', 'BEACH'].indexOf(biome.code) < 0) {
                        let vec = new Vector(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);
                        // Проверка не является ли этот блок пещерой
                        let is_cave_block = false;
                        for(let map_cave of neighboors_caves) {
                            for(let cave_point of map_cave.points) {
                                if(vec.distance(cave_point.pos) < cave_point.rad) {
                                    is_cave_block = true;
                                    break;
                                }
                            }
                            if(is_cave_block) {
                                break;
                            }
                        }
                        // Проверка того, чтобы под деревьями не удалялась земля (в радиусе 5 блоков)
                        if(is_cave_block) {
                            let px          = x + chunk.coord.x;
                            let py          = y + chunk.coord.y;
                            let pz          = z + chunk.coord.z;
                            // Чтобы не удалять землю из под деревьев
                            let near_tree = false;
                            for(let m of maps) {
                                for(let tree of m.info.trees) {
                                    if(tree.pos.distance(new Vector(px - m.chunk.coord.x, py - m.chunk.coord.y, pz - m.chunk.coord.z)) < 5) {
                                        near_tree = true;
                                        break;
                                    }
                                }
                            }
                            if(!near_tree) {
                                continue;
                            }
                        }
                    }

                    // Ores (если это не вода, то заполняем полезными ископаемыми)
                    if(y + chunk.coord.y < value - (rnd < .005 ? 0 : 3)) {
                        let r = aleaRandom.double() * 1.33;
                        if(r < 0.0025 && y + chunk.coord.y < value - 5) {
                            chunk.blocks[x][z][y] = blocks.DIAMOND_ORE;
                        } else if(r < 0.01) {
                            chunk.blocks[x][z][y] = blocks.COAL_ORE;
                        } else {
                            let norm = true;
                            for(let plant of map.info.plants) {
                                if(plant.pos.x == x && plant.pos.z == z && y == plant.pos.y - 1) {
                                    norm = false;
                                    break;
                                }
                            }
                            chunk.blocks[x][z][y] = norm ? blocks.CONCRETE : biome.dirt_block;
                        }
                    } else {
                        chunk.blocks[x][z][y] = biome.dirt_block;
                    }
                }
                // `Y` of waterline
                let ywl = map.info.options.WATER_LINE - chunk.coord.y;
                if(biome.code == 'OCEAN' && ywl >= 0 && ywl < chunk.size.y) {
                    chunk.blocks[x][z][ywl] = blocks.STILL_WATER;
                }

            }
        }

        // Plant herbs
        for(let p of map.info.plants) {
            if(p.pos.y >= chunk.coord.y && p.pos.y < chunk.coord.y + CHUNK_SIZE_Y) {
                let b = chunk.blocks[p.pos.x][p.pos.z][p.pos.y - chunk.coord.y - 1];
                if(b && b.id == blocks.DIRT.id) {
                    chunk.blocks[p.pos.x][p.pos.z][p.pos.y - chunk.coord.y] = p.block;
                }
            }
        }

        // Plant trees
        for(const m of maps) {
            for(let p of m.info.trees) {
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
    plantTree(options, chunk, x, y, z) {
        const height        = options.height;
        const type          = options.type;
        let ystart = y + height;
        // ствол
        for(let p = y; p < ystart; p++) {
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
                let py = y + height;
                for(let rad of [1, 1, 2, 2]) {
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                let m = (i == x - rad && j == z - rad) ||
                                    (i == x + rad && j == z + rad) || 
                                    (i == x - rad && j == z + rad) ||
                                    (i == x + rad && j == z - rad);
                                    let m2 = (py == y + height) ||
                                    (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                                if(m && m2) {
                                    continue;
                                }
                                let b = chunk.blocks[i][j][py];
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
            case 'acacia': {
                // акация
                let py = y + height;
                for(let rad of [2, 3]) {
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(Helpers.distance(new Vector(x, 0, z), new Vector(i, 0, j)) > rad) {
                                    continue;
                                }
                                let b = chunk.blocks[i][j][py];
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
                let r = 1;
                let rad = Math.round(r);
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][ystart] = type.leaves;
                }
                let step = 0;
                for(let y = ystart - 1; y > ystart - (height - 1); y--) {
                    if(step++ % 2 == 0) {
                        rad = Math.min(Math.round(r), 3);
                    } else {
                        rad = 1;
                    }
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(rad == 1 || Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                                    let b = chunk.getBlock(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
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

}

class Map {

    // Private properties
    #aleaRandom = null;
    #chunk      = null;

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = [];
        this.cells          = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(null));
        this.#aleaRandom    = new alea(chunk.seed + '_' + chunk.id);
        this.#chunk         = chunk;
    }

    smooth(generator) {

        const SMOOTH_RAD    = 3;

        let neighbour_map   = null;
        let map             = null;
        let chunk_coord     = this.#chunk.coord;

        let z_min = -SMOOTH_RAD;
        let z_max = CHUNK_SIZE_Z + SMOOTH_RAD;

        if(chunk_coord.z < 0) {
            z_min = (CHUNK_SIZE_Z + SMOOTH_RAD) * -1;
            z_max = SMOOTH_RAD;
        }

        // Smoothing | Сглаживание
        for(let x = -SMOOTH_RAD; x < CHUNK_SIZE_X + SMOOTH_RAD; x++) {
            for(let z = z_min; z < z_max; z++) {
                // absolute cell coord
                let px      = chunk_coord.x + x;
                let pz      = chunk_coord.z + z;
                // calc chunk addr for this cell
                let addr    = new Vector(parseInt(px / CHUNK_SIZE_X), 0, parseInt(pz / CHUNK_SIZE_Z));
                // get chunk map from cache
                let map_addr_ok = map && (map.#chunk.addr.x == addr.x) && (map.#chunk.addr.z == addr.z);
                if(!map || !map_addr_ok) {
                    map = generator.maps_cache[addr.toString()];
                }
                let cell = map.cells[px - map.#chunk.coord.x][pz - map.#chunk.coord.z];
                if(!cell) {
                    continue;
                }
                // Не сглаживаем блоки пляжа и океана
                if(cell.value > this.options.WATER_LINE - 2 && [BIOMES.OCEAN.code, BIOMES.BEACH.code].indexOf(cell.biome.code) >= 0) {
                    continue;
                }
                let height_sum  = 0;
                let cnt         = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                for(let i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(let j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        // calc chunk addr for this cell
                        let neighbour_addr  = new Vector(parseInt((px + i) / CHUNK_SIZE_X), 0, parseInt((pz + j) / CHUNK_SIZE_Z));
                        let addr_ok = neighbour_map &&
                                      (neighbour_map.#chunk.addr.x == neighbour_addr.x) &&
                                      (neighbour_map.#chunk.addr.z == neighbour_addr.z);
                        if(!neighbour_map || !addr_ok) {
                            neighbour_map = generator.maps_cache[neighbour_addr.toString()];
                        }
                        if(!neighbour_map) {
                            debugger;
                        }
                        let neighbour_cell = neighbour_map.cells[px + i - neighbour_map.#chunk.coord.x][pz + j - neighbour_map.#chunk.coord.z];
                        if(neighbour_cell) {
                            height_sum += neighbour_cell.value;
                            dirt_color.add(neighbour_cell.biome.dirt_color);
                            cnt++;
                        }
                    }
                }
                cell.value2           = parseInt(height_sum / cnt);
                cell.biome.dirt_color = dirt_color.divide(new Color(cnt, cnt, cnt, cnt));
            }
        }

    }

    // Генерация растительности
    generateVegetation() {
        let chunk       = this.#chunk;
        let aleaRandom  = this.#aleaRandom;
        this.trees      = [];
        this.plants     = [];
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let cell = this.cells[x][z];
                let biome = BIOMES[cell.biome.code];
                let y = cell.value2;
                // Если наверху блок земли
                let dirt_block_ids = biome.dirt_block.map(function(item) {return item.id;});
                if(dirt_block_ids.indexOf(cell.block.id) >= 0) {
                    // Динамическая рассадка растений
                    let rnd = aleaRandom.double();
                    if(rnd > 0 && rnd <= biome.plants.frequency) {
                        let s = 0;
                        let r = rnd / biome.plants.frequency;
                        for(let p of biome.plants.list) {
                            s += p.percent;
                            if(r < s) {
                                this.plants.push({
                                    pos: new Vector(x, y, z),
                                    block: p.block
                                });
                                break;
                            }
                        }
                    }
                    // Посадка деревьев
                    if(rnd > 0 && rnd <= biome.trees.frequency) {   
                        let s = 0;
                        let r = rnd / biome.trees.frequency;
                        for(let type of biome.trees.list) {
                            s += type.percent;
                            if(r < s) {
                                const height = Helpers.clamp(Math.round(aleaRandom.double() * type.height.max), type.height.min, type.height.max);
                                const rad = Math.max(parseInt(height / 2), 2);
                                this.trees.push({
                                    pos:    new Vector(x, y, z),
                                    height: height,
                                    rad:    rad,
                                    type:   type
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

}

class MapCell {

    constructor(value, humidity, equator, biome, block) {
        this.value      = value;
        this.value2     = value;
        this.humidity   = humidity;
        this.equator    = equator;
        this.biome      = biome;
        this.block      = block;
    }

}