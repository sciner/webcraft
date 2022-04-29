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

    // generateMap
    generateMap(chunk, noisefn) {
        let cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }
        const options               = GENERATOR_OPTIONS;
        // Result map
        let map                     = new Map(chunk, options);
        //
        const SX                    = chunk.coord.x;
        const SZ                    = chunk.coord.z;
        const cluster               = ClusterManager.getForCoord(chunk.coord);
        const H                     = 68;
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let px = SX + x;
                let pz = SZ + z;
                let cluster_max_height = null;
                if(!cluster.is_empty && cluster.cellIsOccupied(px, 0, pz, MAP_CLUSTER_MARGIN)) {
                    cluster_max_height = cluster.max_height;
                }
                // Высота горы в точке
                let value = noisefn(px / 150, pz / 150, 0) * .4 + 
                    noisefn(px / 1650, pz / 1650) * .1 + // 10 | 1650
                    noisefn(px / 650, pz / 650) * .25 + // 65 | 650
                    noisefn(px / 20, pz / 20) * .05 +
                    noisefn(px / 350, pz / 350) * .5;
                value += noisefn(px / 25, pz / 25) * (4 / 255 * noisefn(px / 20, pz / 20));
                // Влажность
                let humidity = Helpers.clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY) + 0.5) / 2, 0, 1);
                // Экватор
                let equator = Helpers.clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR) + 0.8), 0, 1);
                // Get biome
                let biome = BIOMES.getBiome((value * 64 + H) / 255, humidity, equator);
                if(biome.code == 'OCEAN' || biome.code == 'BEACH') {
                    value = value * biome.max_height + H;
                } else {
                    value = value * (cluster_max_height ? Math.min(cluster_max_height - 1, (cluster_max_height + biome.max_height) / 2) : biome.max_height) + H;
                }
                value = parseInt(value);
                value = Helpers.clamp(value, 4, 2500);
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
                let cell = new MapCell(
                    value,
                    humidity,
                    equator,
                    {
                        code:           biome.code,
                        color:          biome.color,
                        dirt_color:     biome.dirt_color,
                        title:          biome.title,
                        dirt_block:     dirt_block.id,
                        block:          biome.block
                    },
                    dirt_block.id
                );
                if(biome.code == 'OCEAN') {
                    cell.block = BLOCK.STILL_WATER.id;
                }
                try {
                    map.cells[x][z] = cell;
                } catch(e) {
                    debugger;
                }
            }
        }
        // Clear maps_cache
        this.maps_cache.reduce(20000);
        return this.maps_cache.add(chunk.addr, map);
    }

}