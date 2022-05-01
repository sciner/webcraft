import {impl as alea} from '../../vendors/alea.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "../chunk.js";
import {Color, Vector, Helpers, VectorCollector} from '../helpers.js';
import {BIOMES} from "./biomes.js";

let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

export const SMOOTH_RAD         = 3;
export const SMOOTH_ROW_COUNT   = CHUNK_SIZE_X + SMOOTH_RAD * 4;
export const SMOOTH_XZ_COUNT    = SMOOTH_ROW_COUNT * 2;
export const NO_SMOOTH_BIOMES   = [BIOMES.OCEAN.code, BIOMES.BEACH.code];

// for clusters
export const PLANT_MARGIN       = 0;
export const TREE_MARGIN        = 3;
export const MAP_CLUSTER_MARGIN = 5;

const MAP_SCALE = .5;

export const GENERATOR_OPTIONS = {
    WATER_LINE:             63, // Ватер-линия
    SCALE_EQUATOR:          1280 * MAP_SCALE * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * MAP_SCALE, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * MAP_SCALE, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * MAP_SCALE // Масштаб шума для карты высот
};

// Map manager
export class TerrainMapManager {

    static _temp_vec3 = Vector.ZERO.clone();

    constructor(seed, world_id, noisefn) {
        this.seed = seed;
        this.world_id = world_id;
        this.noisefn = noisefn;
        this.maps_cache = new VectorCollector();
    }

    // Delete map for unused chunk
    delete(addr) {
        return this.maps_cache.delete(addr);
    }

    // Return map
    get(addr) {
        return this.maps_cache.get(addr);
    }

    // Generate maps
    generateAround(chunk_addr, smooth, vegetation, rad = 1) {
        const noisefn               = this.noisefn;
        let maps                    = [];
        let map                     = null;
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                TerrainMapManager._temp_vec3.x = x;
                TerrainMapManager._temp_vec3.y = -chunk_addr.y;
                TerrainMapManager._temp_vec3.z = z;
                let addr = chunk_addr.add(TerrainMapManager._temp_vec3);
                const c = {
                    id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
                    blocks: {},
                    seed:   this.seed,
                    addr:   addr,
                    size:   size,
                    coord:  addr.mul(size),
                };
                let item = {
                    chunk: c,
                    info: this.generateMap(c, noisefn)
                };
                maps.push(item);
                const direct_load = x == 0 && z == 0;
                if(direct_load) {
                    map = item;
                }
            }
        }
        // Options
        smooth = smooth && !map.info.smoothed;
        vegetation = vegetation && !map.info.smoothed;
        // Smooth (for central and part of neighbours)
        if(smooth) {
            map.info.smoothed = true;
            map.info.smooth(this);
        }
        // Generate vegetation
        if(vegetation) {
            for(let map of maps) {
                map.info.generateVegetation();
            }
        }
        return maps;
    }

    //
    makePoint(px, pz, cluster_max_height) {
        const noisefn = this.noisefn;
        const H = 68;
        const HW = 64;
        // Влажность
        let humidity = Helpers.clamp((noisefn(px / GENERATOR_OPTIONS.SCALE_HUMIDITY, pz / GENERATOR_OPTIONS.SCALE_HUMIDITY) + 0.5) / 2, 0, 1);
        // Экватор
        let equator = Helpers.clamp((noisefn(px / GENERATOR_OPTIONS.SCALE_EQUATOR, pz / GENERATOR_OPTIONS.SCALE_EQUATOR) + 0.8), 0, 1);
        // Высота горы в точке
        const octave1 = noisefn(px / 20, pz / 20);
        let value = noisefn(px / 150, pz / 150, 0) * .4 + 
            noisefn(px / 1650, pz / 1650) * .1 +
            noisefn(px / 650, pz / 650) * .25 +
            octave1 * .05 +
            noisefn(px / 350, pz / 350) * .5 +
            noisefn(px / 25, pz / 25) * (0.01568627 * octave1);
        // Get biome
        let biome = BIOMES.getBiome((value * HW + H) / 255, humidity, equator);
        if(biome.code == 'OCEAN' || biome.code == 'BEACH') {
            value = value * biome.max_height + H;
        } else {
            // smooth with clusters
            value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
        }
        value = parseInt(value);
        value = Helpers.clamp(value, 4, 2500);
        biome = BIOMES.getBiome(value / 255, humidity, equator);
        // Pow
        let diff = value - GENERATOR_OPTIONS.WATER_LINE;
        if(diff < 0) {
            value -= (GENERATOR_OPTIONS.WATER_LINE - value) * .65 - 1.5;
        } else {
            value = GENERATOR_OPTIONS.WATER_LINE + Math.pow(diff, 1 + diff / HW);
        }
        value = parseInt(value);
        return {value, biome, humidity, equator};
    }

    // generateMap
    generateMap(chunk, noisefn) {
        let cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }
        // Result map
        const map                   = new TerrainMap(chunk, GENERATOR_OPTIONS);
        const cluster               = ClusterManager.getForCoord(chunk.coord);
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let px = chunk.coord.x + x;
                let pz = chunk.coord.z + z;
                let cluster_max_height = null;
                if(!cluster.is_empty && cluster.cellIsOccupied(px, 0, pz, MAP_CLUSTER_MARGIN)) {
                    cluster_max_height = cluster.max_height;
                }
                const {value, biome, humidity, equator} = this.makePoint(px, pz, cluster_max_height);
                // Different dirt blocks
                let dirt_block_id = biome.dirt_block[0];
                if(biome.dirt_block.length > 1) {
                    const ns = noisefn(px / 5, pz / 5);
                    const index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                    dirt_block_id = biome.dirt_block[index];
                }
                // Create map cell
                map.cells[x][z] = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
            }
        }
        // Clear maps_cache
        // this.maps_cache.reduce(20000);
        this.maps_cache.set(chunk.addr, map);
        return map;
    }

}

// Map
export class TerrainMap {

    static _cells;

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = [];
        this.smoothed       = false;
        this.cells          = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(null));
        this.chunk          = {
            size: chunk.size,
            addr: chunk.addr,
            coord: chunk.coord
        };
    }

    static initCells() {
        Map._cells = new Array(SMOOTH_XZ_COUNT);
    }

    static getCell(x, z) {
        return Map._cells[(z * SMOOTH_ROW_COUNT) + x];
    }

    static setCell(x, z, value) {
        Map._cells[(z * SMOOTH_ROW_COUNT) + x] = value;
    }

    // Сглаживание карты высот
    smooth(generator) {
        // 1. Кеширование ячеек
        let map             = null;
        let addr            = new Vector(0, 0, 0);
        let bi              = new Vector(0, 0, 0);
        for(let x = -SMOOTH_RAD * 2; x < CHUNK_SIZE_X + SMOOTH_RAD * 2; x++) {
            for(let z = -SMOOTH_RAD * 2; z < CHUNK_SIZE_Z + SMOOTH_RAD * 2; z++) {
                // absolute cell coord
                let px          = this.chunk.coord.x + x;
                let pz          = this.chunk.coord.z + z;
                addr            = getChunkAddr(px, 0, pz, addr); // calc chunk addr for this cell
                if(!map || map.chunk.addr.x != addr.x || map.chunk.addr.z != addr.z) {
                    map = generator.maps_cache.get(addr); // get chunk map from cache
                }
                bi = BLOCK.getBlockIndex(px, 0, pz, bi);
                TerrainMap.setCell(x, z, map.cells[bi.x][bi.z]);
            }
        }
        // 2. Smoothing | Сглаживание
        let colorComputer   = new Color();
        for(let x = -SMOOTH_RAD; x < CHUNK_SIZE_X + SMOOTH_RAD; x++) {
            for(let z = -SMOOTH_RAD; z < CHUNK_SIZE_Z + SMOOTH_RAD; z++) {
                let cell        = TerrainMap.getCell(x, z);
                let cnt         = 0;
                let height_sum  = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                for(let i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(let j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        let neighbour_cell = TerrainMap.getCell(x + i, z + j);
                        height_sum += neighbour_cell.value;
                        dirt_color.add(neighbour_cell.biome.dirt_color);
                        cnt++;
                    }
                }
                // Не сглаживаем блоки пляжа и океана
                let smooth = !(cell.value > this.options.WATER_LINE - 2 && NO_SMOOTH_BIOMES.indexOf(cell.biome.code) >= 0);
                if(smooth) {
                    cell.value2 = parseInt(height_sum / cnt);
                }
                colorComputer.set(cnt, cnt, cnt, cnt);
                cell.dirt_color = dirt_color.divide(colorComputer);
            }
        }
    }

    // Генерация растительности
    generateVegetation() {
        let chunk           = this.chunk;
        this.trees          = [];
        this.plants         = new VectorCollector();
        let dirt_block_ids  = [];
        let aleaRandom      = null;
        let biome           = null;
        let cluster         = null;
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let cell = this.cells[x][z];
                if(!biome || biome.code != cell.biome.code) {
                    biome = BIOMES[cell.biome.code];
                    dirt_block_ids = biome.dirt_block; // .map(function(item) {return item.id;});
                }
                // Растения, цветы, трава (только если на поверхности блок земли)
                if(dirt_block_ids.indexOf(cell.dirt_block_id) >= 0) {
                    let y = cell.value2;
                    //
                    if(!aleaRandom) {
                        aleaRandom = new alea(chunk.seed + '_' + chunk.coord.toString());
                        cluster = ClusterManager.getForCoord(chunk.coord);
                    }
                    //
                    if(!cluster.is_empty && cluster.cellIsOccupied(x + chunk.coord.x, y + chunk.coord.y - 1, z + chunk.coord.z, PLANT_MARGIN)) {
                        continue;
                    }
                    //
                    let rnd = aleaRandom.double();
                    if(rnd > 0 && rnd <= biome.plants.frequency) {
                        let s = 0;
                        let r = rnd / biome.plants.frequency;
                        for(let p of biome.plants.list) {
                            s += p.percent;
                            if(r < s) {
                                if(p.block) {
                                    this.plants.add(new Vector(x, y, z), p.block);
                                } else if(p.trunk) {
                                    this.plants.add(new Vector(x, y, z), p.trunk);
                                    this.plants.add(new Vector(x, y + 1, z), p.leaves);
                                }
                                break;
                            }
                        }
                    }
                    // Деревья
                    if(rnd > 0 && rnd <= biome.trees.frequency) {
                        let s = 0;
                        let r = rnd / biome.trees.frequency;
                        for(let type of biome.trees.list) {
                            s += type.percent;
                            if(r < s) {
                                if(!cluster.is_empty && cluster.cellIsOccupied(x + chunk.coord.x, y + chunk.coord.y - 1, z + chunk.coord.z, TREE_MARGIN)) {
                                    break;
                                }
                                let r = aleaRandom.double();
                                const height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
                                const rad = Math.max(parseInt(height / 2), 2);
                                this.trees.push({
                                    biome_code: biome.code,
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

// Map cell
export class TerrainMapCell {

    constructor(value, humidity, equator, biome, dirt_block_id) {
        this.value          = value;
        this.value2         = value;
        this.humidity       = Math.round(humidity * 100000) / 100000;
        this.equator        = Math.round(equator * 100000) / 100000;
        this.biome          = biome;
        this.dirt_block_id  = dirt_block_id;
    }

}

TerrainMap.initCells();