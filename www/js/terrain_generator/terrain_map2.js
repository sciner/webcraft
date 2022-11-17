// import { impl as alea } from '../../vendors/alea.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
// import { IndexedColor, getChunkAddr, Vector, Helpers, VectorCollector } from '../helpers.js';
import { BIOMES } from "./biomes.js";
// import { Default_Terrain_Map, Default_Terrain_Map_Cell } from './default.js';
import { GENERATOR_OPTIONS, TerrainMap, TerrainMapCell } from "./terrain_map.js";
import { CaveGenerator } from './cave_generator.js';
import { OreGenerator } from './ore_generator.js';
import { IndexedColor } from "../helpers.js";

// let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

export const SMOOTH_RAD         = 3;
export const SMOOTH_RAD_CNT     = Math.pow(SMOOTH_RAD * 2 + 1, 2);
export const SMOOTH_ROW_COUNT   = CHUNK_SIZE_X + SMOOTH_RAD * 4 + 1;

//
const WATER_START           = 0;
const WATER_STOP            = 1.5;
const WATERFRONT_STOP       = 24.0;
const WATER_PERCENT         = WATER_STOP / (WATERFRONT_STOP - WATER_START);
const RIVER_FULL_WIDTH      = WATERFRONT_STOP - WATER_START;

// Rivers
const RIVER_SCALE = .5;
const RIVER_NOISE_SCALE = 4.5;
const RIVER_OCTAVE_1 = 512 / RIVER_SCALE;
const RIVER_OCTAVE_2 = RIVER_OCTAVE_1 / RIVER_NOISE_SCALE;
const RIVER_OCTAVE_3 = 48 / RIVER_SCALE;


const size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

//
const temp_chunk = {
    addr: new Vector(),
    coord: new Vector(),
    size: size
};

// Map manager
export class TerrainMapManager2 {

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
        TerrainMapManager2._temp_vec3_delete.copyFrom(addr);
        TerrainMapManager2._temp_vec3_delete.y = 0;
        this.maps_cache.delete(TerrainMapManager2._temp_vec3_delete);
    }

    // Return map
    get(addr) {
        return this.maps_cache.get(addr);
    }

    // Generate maps
    generateAround(chunk, chunk_addr, smooth, vegetation) {
        const rad                   = vegetation ? 2 : 1;
        const noisefn               = this.noisefn;
        const maps                  = [];
        let center_map              = null;
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                TerrainMapManager2._temp_vec3.set(x, -chunk_addr.y, z);
                temp_chunk.addr.copyFrom(chunk_addr).addSelf(TerrainMapManager2._temp_vec3);
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
        /*
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
        */
        return maps;
    }

    makeRiverPoint(x, z) {
        let value1 = this.noisefn(x / RIVER_OCTAVE_1, z / RIVER_OCTAVE_1) * 0.7;
        let value2 = this.noisefn(x / RIVER_OCTAVE_2, z / RIVER_OCTAVE_2) * 0.2;
        let value3 = this.noisefn(x / RIVER_OCTAVE_3, z / RIVER_OCTAVE_3) * 0.1;
        const value = Math.abs((value1 + value2 + value3) / 0.004);
        if(value > WATER_START && value < WATERFRONT_STOP) {
            const percent = (value - WATER_START) / RIVER_FULL_WIDTH;
            const river_percent = percent < WATER_PERCENT ? (1 - percent / WATER_PERCENT) : 0;
            const waterfront_percent = (percent - WATER_PERCENT) / (1 - WATER_PERCENT);
            return {value, percent, river_percent, waterfront_percent}
        }
        return null;
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
        // const cluster = real_chunk.chunkManager.clusterManager.getForCoord(chunk.coord);
        const biome = BIOMES['GRASSLAND'];
        map.terrain = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let value = 85;
                //for(let y = chunk.size.y; y >= 0; y--) {
                //}
                // Create map cell
                const humidity = 1;
                const equator = 1;
                const dirt_block_id = biome.dirt_block[0];
                const cell = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
                cell.dirt_color = new IndexedColor(82, 450, 0);
                map.cells[z * CHUNK_SIZE_X + x] = cell;
            }
        }
        this.maps_cache.set(chunk.addr, map);
        // map.caves = new CaveGenerator(chunk.coord, noisefn);
        // map.ores = new OreGenerator(this.seed, noisefn, this.noisefn3d, map);
        // console.log(`Actual maps count: ${this.maps_cache.size}`);
        return map;
    }

    //
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
        // console.log('destroyAroundPlayers', this.maps_cache.size, TerrainMapManager2.maps_in_memory)
    }

}