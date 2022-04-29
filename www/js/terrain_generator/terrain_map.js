import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../chunk.js";
import {Vector, Helpers, VectorCollector} from '../helpers.js';
import {Map, MapCell} from './map.js';
import {BIOMES} from "./biomes.js";

const MAP_CLUSTER_MARGIN = 5;
let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

const MAP_SCALE = .5;
export const GENERATOR_OPTIONS = {
    WATER_LINE:             63, // Ватер-линия
    SCALE_EQUATOR:          1280 * MAP_SCALE * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * MAP_SCALE, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * MAP_SCALE, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * MAP_SCALE // Масштаб шума для карты высот
};

export class TerrainMap {

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
                TerrainMap._temp_vec3.x = x;
                TerrainMap._temp_vec3.y = -chunk_addr.y;
                TerrainMap._temp_vec3.z = z;
                let addr = chunk_addr.add(TerrainMap._temp_vec3);
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
                if(x == 0 && z == 0) {
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
        const map                   = new Map(chunk, GENERATOR_OPTIONS);
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
                map.cells[x][z] = new MapCell(value, humidity, equator, biome, dirt_block_id);
            }
        }
        // Clear maps_cache
        // this.maps_cache.reduce(20000);
        this.maps_cache.set(chunk.addr, map);
        return map;
    }

}