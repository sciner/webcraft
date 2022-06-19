import {impl as alea} from '../../vendors/alea.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, getChunkAddr} from "../chunk_const.js";
import {Color, Vector, Helpers, VectorCollector} from '../helpers.js';
import {BIOMES} from "./biomes.js";
import { Cave3DGenerator } from './cave3d_generator.js';
import { CaveGenerator } from './cave_generator.js';
import { OreGenerator } from './ore_generator.js';

let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

export const SMOOTH_RAD         = 3;
export const SMOOTH_RAD_CNT     = Math.pow(SMOOTH_RAD * 2 + 1, 2);
export const SMOOTH_ROW_COUNT   = CHUNK_SIZE_X + SMOOTH_RAD * 4 + 1;

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

//
// Rivers
const RIVER_SCALE = .5;
const RIVER_NOISE_SCALE = 4.5;
const RIVER_WIDTH = 0.008 * RIVER_SCALE;
const RIVER_OCTAVE_1 = 512 / RIVER_SCALE;
const RIVER_OCTAVE_2 = RIVER_OCTAVE_1 / RIVER_NOISE_SCALE;
const RIVER_OCTAVE_3 = 48 / RIVER_SCALE;

//
const temp_chunk = {
    addr: new Vector(),
    coord: new Vector(),
    size: size
};

// Map manager
export class TerrainMapManager {

    static _temp_vec3 = Vector.ZERO.clone();
    static _temp_vec3_delete = Vector.ZERO.clone();

    //static maps_in_memory = 0;
    //static registry = new FinalizationRegistry(heldValue => {
    //    TerrainMapManager.maps_in_memory--;
    //});;

    constructor(seed, world_id, noisefn, noisefn3d) {
        this.seed = seed;
        this.world_id = world_id;
        this.noisefn = noisefn;
        this.noisefn3d = noisefn3d;
        this.maps_cache = new VectorCollector();
        BIOMES.init();
    }

    // Delete map for unused chunk
    delete(addr) {
        TerrainMapManager._temp_vec3_delete.copyFrom(addr);
        TerrainMapManager._temp_vec3_delete.y = 0;
        this.maps_cache.delete(TerrainMapManager._temp_vec3_delete);
    }

    // Return map
    get(addr) {
        return this.maps_cache.get(addr);
    }

    // Generate maps
    generateAround(chunk, chunk_addr, smooth, vegetation) {
        const rad                   = vegetation ? 2 : 1;
        const noisefn               = this.noisefn;
        let maps                    = [];
        let center_map              = null;
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                TerrainMapManager._temp_vec3.set(x, -chunk_addr.y, z);
                temp_chunk.addr.copyFrom(chunk_addr).addSelf(TerrainMapManager._temp_vec3);
                temp_chunk.coord.copyFrom(temp_chunk.addr).multiplyVecSelf(size);
                const map = this.generateMap(chunk, temp_chunk, noisefn);
                if(Math.abs(x) < 2 && Math.abs(z) < 2) {
                    maps.push(map);
                }
                if(x == 0 && z == 0) {
                    center_map = map;
                }
            }
        }

        // Smooth (for central and part of neighbours)
        if(smooth && !center_map.smoothed) {
            center_map.smooth(this);
        }
        // Generate vegetation
        if(vegetation) {
            for (let i = 0; i < maps.length; i++) {
                const map = maps[i];
                if(!map.vegetable_generated) {
                    if(smooth && !map.smoothed) {
                        map.smooth(this);
                    }
                    map.generateVegetation(chunk, this.seed);
                }
            }
        }
        return maps;
    }

    //
    makePoint(px, pz, cluster_is_empty, cluster_max_height) {
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

        const is_ocean = biome.code == 'OCEAN';

        if(is_ocean) {
            cluster_max_height = null;
        }

        const river_point = this.makeRiverPoint(px, pz);
        if(river_point) {
            if(cluster_is_empty) {
                // smooth with clusters
                if(cluster_max_height) {
                    value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
                    value = parseInt(value);
                    return {value, biome, humidity, equator};
                } else {
                    if(!is_ocean) {
                        biome = BIOMES.RIVER;
                        value = -0.127;
                    }
                }
            } else {
                if(!is_ocean) {
                    biome = BIOMES.RIVER;
                    value = -0.22 * (river_point / 1.5);
                }
            }
        }

        if(biome.no_smooth) {
            value = value * biome.max_height + H;
        } else {
            // smooth with clusters
            value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
        }
        value = parseInt(value);
        // value = Helpers.clamp(value, 4, 2500);
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

    // rivers
    makeRiverPoint(x, z) {

        let m = this.noisefn(x / 64, z / 64) * 2;
        if(m < 0) m*= -1;
        m++;

        const s = 1;

        const rw = RIVER_WIDTH * m;
        const o1 = RIVER_OCTAVE_1 / s;
        let value = this.noisefn(x / o1, z / o1) * 0.7 +
                    this.noisefn(x / RIVER_OCTAVE_2, z / RIVER_OCTAVE_2) * 0.2 +
                    this.noisefn(x / RIVER_OCTAVE_3, z / RIVER_OCTAVE_3) * 0.1;
        if(value < 0) {
            value *= -1;
        }
        if(value > rw) {
            return null;
        }
        value = 1 - value / rw;
        return value;
    }

    // generateMap
    generateMap(real_chunk, chunk, noisefn) {
        const cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }
        // Result map
        const map = new TerrainMap(chunk, GENERATOR_OPTIONS);
        if(!real_chunk.chunkManager) {
            debugger
        }
        const cluster = real_chunk.chunkManager.clusterManager.getForCoord(chunk.coord);
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const px = chunk.coord.x + x;
                const pz = chunk.coord.z + z;
                let cluster_max_height = null;
                if(!cluster.is_empty && cluster.cellIsOccupied(px, 0, pz, MAP_CLUSTER_MARGIN)) {
                    cluster_max_height = cluster.max_height;
                }
                const {value, biome, humidity, equator} = this.makePoint(px, pz, cluster.is_empty, cluster_max_height);
                // Different dirt blocks
                let dirt_block_id = biome.dirt_block[0];
                if(biome.dirt_block.length > 1) {
                    const ns = noisefn(px / 5, pz / 5);
                    const index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                    dirt_block_id = biome.dirt_block[index];
                }
                // Create map cell
                map.cells[z * CHUNK_SIZE_X + x] = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
            }
        }
        this.maps_cache.set(chunk.addr, map);
        map.caves = new Cave3DGenerator(this.noisefn3d);
        // map.caves = new CaveGenerator(chunk.coord,noisefn);
        map.ores = new OreGenerator(this.seed, chunk.addr, noisefn, this.noisefn3d, map);
        
        // console.log(`Actual maps count: ${this.maps_cache.size}`);
        return map;
    }

    destroyAroundPlayers(players) {
        let cnt_destroyed = 0;
        for(let [map_addr, _] of this.maps_cache.entries()) {
            let can_destroy = true;
            for(let player of players) {
                const {chunk_render_dist, chunk_addr} = player;
                if(map_addr.distance(chunk_addr) < chunk_render_dist + 3) {
                    can_destroy = false;
                }
            }
            if(can_destroy) {
                this.maps_cache.delete(map_addr);
                cnt_destroyed++;
            }
        }
        // console.log('destroyAroundPlayers', this.maps_cache.size, TerrainMapManager.maps_in_memory)
    }

}

// Map
export class TerrainMap {

    static _cells;

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = new VectorCollector();
        this.smoothed       = false;
        this.vegetable_generated = false;
        this.cells          = Array(chunk.size.x * chunk.size.z); // .fill(null);
        this.chunk          = {
            size: chunk.size,
            addr: chunk.addr.clone(),
            coord: chunk.coord.clone()
        };
        // TerrainMapManager.maps_in_memory++;
        // TerrainMapManager.registry.register(this, chunk.addr.toHash());
    }

    static initCells() {
        TerrainMap._cells = new Array(SMOOTH_ROW_COUNT);
        TerrainMap._vals = new Array(SMOOTH_ROW_COUNT * 3);
        TerrainMap._sums = new Array(SMOOTH_ROW_COUNT * 3);
    }

    static getCell(x, z) {
        return TerrainMap._cells[(z * SMOOTH_ROW_COUNT) + x];
    }

    static setCell(x, z, value) {
        TerrainMap._cells[(z * SMOOTH_ROW_COUNT) + x] = value;
    }

    static setPartial(x, z, cell) {
        x += SMOOTH_RAD * 2;
        z += SMOOTH_RAD * 2;
        const ind = ((z * SMOOTH_ROW_COUNT) + x)
        TerrainMap._cells[ind] = cell;
        TerrainMap._vals[ind * 3] = cell.value;
        TerrainMap._vals[ind * 3 + 1] = cell.biome.dirt_color.r;
        TerrainMap._vals[ind * 3 + 2] = cell.biome.dirt_color.g;
    }

    static calcSum() {
        const vals = TerrainMap._vals;
        const sums = TerrainMap._sums;
        sums[0] = 0;
        sums[1] = 0;
        sums[2] = 0;
        const ROW3 = SMOOTH_ROW_COUNT * 3;
        const COL3 = 3;
        for (let x = 1; x < SMOOTH_ROW_COUNT; x++) {
            const ind = x * 3;
            sums[ind] = sums[ind - COL3] + vals[ind - COL3];
            sums[ind + 1] = sums[ind - COL3 + 1] + vals[ind - COL3 + 1];
            sums[ind + 2] = sums[ind - COL3 + 2] + vals[ind - COL3 + 2];
        }
        for (let z = 1; z < SMOOTH_ROW_COUNT; z++) {
            const ind = z * (ROW3);
            sums[ind] = sums[ind - ROW3] + vals[ind - ROW3]
            sums[ind + 1] = sums[ind - ROW3 + 1] + vals[ind - ROW3 + 1];
            sums[ind + 2] = sums[ind - ROW3 + 2] + vals[ind - ROW3 + 2];

            for (let x = 1; x < SMOOTH_ROW_COUNT; x++) {
                for (let k = 0; k < 3; k++) {
                    const ind = ((z * SMOOTH_ROW_COUNT) + x) * 3 + k;
                    sums[ind] = sums[ind - ROW3] + sums[ind - COL3]
                        - sums[ind - ROW3 - COL3]
                        + vals[ind - ROW3 - COL3];
                }
            }
        }
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
                const cell = map.cells[bi.z * CHUNK_SIZE_X + bi.x];
                TerrainMap.setPartial(x, z, cell);
            }
        }
        // 2. Smoothing | Сглаживание
        let colorComputer = new Color(SMOOTH_RAD_CNT, SMOOTH_RAD_CNT, SMOOTH_RAD_CNT, SMOOTH_RAD_CNT);

        TerrainMap.calcSum();
        const sums = TerrainMap._sums, cells = TerrainMap._cells;
        for(let x = 0; x < CHUNK_SIZE_X; x++) {
            for(let z = 0; z < CHUNK_SIZE_Z; z++) {
                const ind = (z + SMOOTH_RAD * 2) * SMOOTH_ROW_COUNT + (x + SMOOTH_RAD * 2);
                let cell        = cells[ind];

                const ind1 = ind - SMOOTH_RAD * SMOOTH_ROW_COUNT - SMOOTH_RAD;
                const ind2 = ind - SMOOTH_RAD * SMOOTH_ROW_COUNT + (SMOOTH_RAD + 1);
                const ind3 = ind + (SMOOTH_RAD + 1) * SMOOTH_ROW_COUNT - SMOOTH_RAD;
                const ind4 = ind + (SMOOTH_RAD + 1) * SMOOTH_ROW_COUNT + (SMOOTH_RAD + 1);
                let height_sum  = sums[ind1 * 3] + sums[ind4 * 3] - sums[ind2 * 3] - sums[ind3 * 3];
                let dirt_color  = new Color(
                    sums[ind1 * 3 + 1] + sums[ind4 * 3 + 1] - sums[ind2 * 3 + 1] - sums[ind3 * 3 + 1],
                sums[ind1 * 3 + 2] + sums[ind4 * 3 + 2] - sums[ind2 * 3 + 2] - sums[ind3 * 3 + 2],
                    0, 0);
                // Не сглаживаем блоки пляжа и океана
                let smooth = !(cell.value > this.options.WATER_LINE - 2 && cell.biome.no_smooth);
                if(smooth) {
                    cell.value2 = Math.floor(height_sum / SMOOTH_RAD_CNT);
                    if(cell.value2 <= this.options.WATER_LINE) {
                        cell.biome = BIOMES.OCEAN;
                    }
                }
                cell.dirt_color = dirt_color.divide(colorComputer);
            }
        }

        this.smoothed = true;

    }

    // Генерация растительности
    generateVegetation(real_chunk, seed) {
        let chunk                   = this.chunk;
        this.vegetable_generated    = true;
        this.trees                  = [];
        this.plants                 = new VectorCollector();
        let aleaRandom              = null;
        let biome                   = null;
        let cluster                 = null;
        const plant_pos             = new Vector(0, 0, 0);
        //
        const addPlant = (rnd, x, y, z) => {

            const xyz = new Vector(
                x + chunk.coord.x,
                y + chunk.coord.y - 1,
                z + chunk.coord.z
            );

            const caveDensity = this.caves.getPoint(xyz, null, false);
            if(caveDensity !== null) {
                return;
            }

            let s = 0;
            let r = rnd / biome.plants.frequency;
            plant_pos.x = x;
            plant_pos.y = y;
            plant_pos.z = z;
            for (let i = 0; i < biome.plants.list.length; i++) {
                const p = biome.plants.list[i];
                s += p.percent;
                if(r < s) {
                    if(p.block) {
                        this.plants.set(plant_pos, p.block);
                    } else if(p.trunk) {
                        this.plants.set(plant_pos, p.trunk);
                        plant_pos.y++;
                        this.plants.set(plant_pos, p.leaves);
                    }
                    break;
                }
            }
        };
        //
        const addTree = (rnd, x, y, z) => {

            const xyz = new Vector(
                x + chunk.coord.x,
                y + chunk.coord.y - 1,
                z + chunk.coord.z
            );

            const caveDensity = this.caves.getPoint(xyz, null, false);
            if(caveDensity !== null) {
                return;
            }

            let s = 0;
            let r = rnd / biome.trees.frequency;
            for(let type of biome.trees.list) {
                s += type.percent;
                if(r < s) {
                    if(!cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, TREE_MARGIN)) {
                        break;
                    }
                    let r = aleaRandom.double();
                    const height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
                    const rad = Math.max(parseInt(height / 2), 2);
                    this.trees.push({
                        biome_code: biome.code,
                        pos:        new Vector(x, y, z),
                        height:     height,
                        rad:        rad,
                        type:       type
                    });
                    return true;
                }
            }
            return false;
        };
        //
        const initAleaAndCluster = () => {
            if(aleaRandom) {
                return false;
            }
            aleaRandom = new alea(seed + '_' + chunk.coord.toString());
            cluster = real_chunk.chunkManager.clusterManager.getForCoord(chunk.coord);
            return true;
        };
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                const cell = this.cells[z * CHUNK_SIZE_X + x];
                biome = cell.biome;
                if(biome.plants.frequency == 0 && biome.trees.frequency == 0) {
                    continue;
                }
                // Растения, цветы, трава (только если на поверхности блок земли)
                if(biome.dirt_block.indexOf(cell.dirt_block_id) < 0) {
                    continue;
                }
                //
                initAleaAndCluster();
                const y = cell.value2;
                if(!cluster.is_empty && cluster.cellIsOccupied(x + chunk.coord.x, y + chunk.coord.y - 1, z + chunk.coord.z, PLANT_MARGIN)) {
                    continue;
                }
                //
                const rnd = aleaRandom.double();
                if(rnd <= 0) {
                    continue;
                }
                if(rnd <= biome.trees.frequency) {
                    // Деревья
                    if(addTree(rnd, x, y, z)) {
                        continue;
                    }
                }
                if(rnd <= biome.plants.frequency) {
                    // Трава
                    addPlant(rnd, x, y, z);
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