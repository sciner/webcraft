import {impl as alea} from '../../vendors/alea.js';
import { MySmooth } from '../../vendors/my-smooth.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "../chunk.js";
import {Color, Vector, Helpers, VectorCollector} from '../helpers.js';
import {BIOMES} from "./biomes.js";
import { CaveGenerator } from './cave_generator.js';
import { OreGenerator } from './ore_generator.js';

let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

// for clusters
export const PLANT_MARGIN       = 0;
export const TREE_MARGIN        = 3;
export const MAP_CLUSTER_MARGIN = 5;

const MAP_SCALE = .5;

export const GENERATOR_OPTIONS = {
    WATER_LINE:             80, // Ватер-линия
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

    constructor(seed, world_id, noisefn, noisefn3d) {
        this.seed = seed;
        this.world_id = world_id;
        this.noisefn = noisefn;
        this.noisefn3d = noisefn3d;
        this.maps_cache = new VectorCollector();

        // new a Spline object
        // const xs = [-1, 0.3, 0.4, 1];
        // const ys = [50, 100, 150, 150];
        // this.spline = new CubicSpline(xs, ys);

        // new a Spline object
        const xs = [-1, 0.3, 0.4, 1];
        const ys = [50, 100, 150, 150];
        this.mySmooth = new MySmooth(xs, ys);

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

        // Generate vegetation
        if(vegetation) {
            for (let i = 0; i < maps.length; i++) {
                const map = maps[i];
                if(!map.vegetable_generated) {
                    map.generateVegetation(chunk, this.seed);
                }
            }
        }
        return maps;
    }

    // https://youtu.be/CSa5O6knuwI?t=738
    makePoint(px, pz, cluster_is_empty, cluster_max_height) {

        const noisefn = this.noisefn;

        const freq = 640;
        const octaves = 4;

        let value = 0;

        for(let i = 0; i < octaves; i++) {
            const f = freq / (1 << i);
            const y = noisefn(px / f, pz / f, 0);
            value += y;
        }

        // continentalness
        const f = freq * (1 << 3); // 8
        const continentalness = noisefn(px / f, pz / f, 0);
        value = (value + continentalness) / 2;

        value = this.mySmooth.at(value);

        /*
        // add some noise
        const noise_freq = 40;
        for(let i = 0; i < octaves; i++) {
            const f = noise_freq / (1 << i);
            const a = 4 / (1 << i);
            const y = noisefn(px / f, pz / f, 0) * a;
            value += y;
        }*/

        const humidity = 1;
        const equator = 1;

        // Helpers.clamp
        const biome = BIOMES.TEMPERATE_RAIN_FOREST;
        value |= 0;

        return {value, biome, humidity, equator};
        
        /*
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
        */

        // value = value * biome.max_height + H;
        // value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;

        /*
        if(biome.no_smooth) {
            value = value * biome.max_height + H;
        } else {
            // smooth with clusters
            value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
        }*/

        // value = parseInt(value);
        // value = Helpers.clamp(value, 4, 2500);
        // biome = BIOMES.getBiome(value / 255, humidity, equator);

        /*
        // Pow
        let diff = value - GENERATOR_OPTIONS.WATER_LINE;
        if(diff < 0) {
            value -= (GENERATOR_OPTIONS.WATER_LINE - value) * .65 - 1.5;
        } else {
            value = GENERATOR_OPTIONS.WATER_LINE + Math.pow(diff, 1 + diff / HW);
        }
        value = parseInt(value);
        return {value, biome, humidity, equator};
        */

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
                /*
                if(biome.dirt_block.length > 1) {
                    const ns = noisefn(px / 5, pz / 5);
                    const index = parseInt(biome.dirt_block.length * Helpers.clamp(Math.abs(ns + .3), 0, .999));
                    dirt_block_id = biome.dirt_block[index];
                }
                */
                // Create map cell
                map.cells[z * CHUNK_SIZE_X + x] = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
            }
        }
        this.maps_cache.set(chunk.addr, map);
        map.caves = new CaveGenerator(chunk.coord, noisefn);
        map.ores = new OreGenerator(this.seed, chunk.addr, noisefn, this.noisefn3d, map);
        
        // console.log(`Actual maps count: ${this.maps_cache.size}`);
        return map;
    }

    destroyAroundPlayers(players) {
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
            }
        }
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
        this.vegetable_generated = false;
        this.cells          = Array(chunk.size.x * chunk.size.z); // .fill(null);
        this.chunk          = {
            size: chunk.size,
            addr: chunk.addr.clone(),
            coord: chunk.coord.clone()
        };
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
        this.dirt_color     = biome.dirt_color.clone()
    }

}
