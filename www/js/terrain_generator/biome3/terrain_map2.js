// import { impl as alea } from '../../vendors/alea.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../chunk_const.js";
// import { IndexedColor, getChunkAddr, Vector, Helpers, VectorCollector } from '../helpers.js';
import { BIOMES } from "../biomes.js";
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell, Default_Terrain_Generator} from "../default.js";
// import { Default_Terrain_Map, Default_Terrain_Map_Cell } from './default.js';
import { GENERATOR_OPTIONS, TerrainMap, TerrainMapCell } from "../terrain_map.js";
import { CaveGenerator } from '../cave_generator.js';
import { OreGenerator } from '../ore_generator.js';
import { IndexedColor, Vector, VectorCollector } from "../../helpers.js";
import { BUILDING_AABB_MARGIN } from "../cluster/building.js";
import { getAheadMove } from "../cluster/vilage.js";

// let size = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

export const SMOOTH_RAD         = 3;
export const SMOOTH_RAD_CNT     = Math.pow(SMOOTH_RAD * 2 + 1, 2);
export const SMOOTH_ROW_COUNT   = CHUNK_SIZE_X + SMOOTH_RAD * 4 + 1;

export const WATER_LEVEL = 80;

export const DEFAULT_DENSITY_COEFF = {
    d1: 0.5333,
    d2: 0.2667,
    d3: 0.1333,
    d4: 0.0667
}

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

const MAP_PRESETS = {
    // relief - кривизна рельефа
    // mid_level - базовая высота поверхности
    norm:               {id: 'norm', chance: 7, relief: 4, mid_level: 6, is_plain: true, grass_block_id: BLOCK.GRASS_BLOCK.id},
    mountains:          {id: 'mountains', chance: 4, relief: 48, mid_level: 8, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id},
    high_noise:         {id: 'high_noise', chance: 4, relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id},
    high_coarse_noise:  {id: 'high_coarse_noise', chance: 4, relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id, density_coeff: {d1: 0.5333, d2: 0.7, d3: 0.1333, d4: 0.0667}, second_grass_block_threshold: .1, second_grass_block_id: BLOCK.PODZOL.id},
    // gori:               {id: 'gori', chance: 40, relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id, density_coeff: {d1: 0.5333, d2: 0.7, d3: 0.1333, d4: 0.0667}, second_grass_block_threshold: .1, second_grass_block_id: BLOCK.PODZOL.id}
};

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

    constructor(seed, world_id, noise2d, noise3d) {
        this.seed = seed;
        this.world_id = world_id;
        this.noise2d = noise2d;
        this.noise3d = noise3d;
        this.maps_cache = new VectorCollector();
        BIOMES.init();
        // Presets by chances
        this.presets = [];
        for(const k in MAP_PRESETS) {
            const op = MAP_PRESETS[k];
            for(let i = 0; i < op.chance; i++) {
                this.presets.push(op);
            }
        }
        this.rnd_presets = new alea(seed);
        this.presets.sort(() => .5 - this.rnd_presets.double());
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
        const noisefn               = this.noise2d;
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

    // угол между точками на плоскости
    angleTo(xyz, tx, tz) {
        const angle = Math.atan2(tx - xyz.x, tz - xyz.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    //
    getPreset(xyz) {

        const RAD = 1000; // радиус области
        const TRANSITION_WIDTH = 64; // ширина перехода межу обалстью и равниной

        // центр области
        const center_x = Math.round(xyz.x / RAD) * RAD;
        const center_z = Math.round(xyz.z / RAD) * RAD;

        // базовые кривизна рельефа и высота поверхности
        let op                  = MAP_PRESETS.norm;
        let relief              = op.relief;
        let mid_level           = op.mid_level;

        // частичное занижение общего уровня, чтобы равнины становились ближе к воде
        let deform_mid_level = -Math.abs(this.noise2d(xyz.x/500, xyz.z/500) * 4);
        if(deform_mid_level > 0) deform_mid_level /= 3;
        mid_level += deform_mid_level;

        // угол к центру области
        const angle = this.angleTo(xyz, center_x, center_z);

        // Формируем неровное очертание области вокруг его центра
        // https://www.benfrederickson.com/flowers-from-simplex-noise/
        const circle_radius = RAD * 0.25;
        const frequency = 1.25;
        const magnitude = .5;
        // Figure out the x/y coordinates for the given angle
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        // Randomly deform the radius of the circle at this point
        const deformation = this.noise2d(x * frequency, y * frequency) + 1;
        const radius = circle_radius * (1 + magnitude * deformation);
        const max_dist = radius;

        // Расстояние до центра области
        const lenx = center_x - xyz.x;
        const lenz = center_z - xyz.z;
        const dist = Math.sqrt(lenx * lenx + lenz * lenz);

        if((dist < max_dist)) {
            // выбор типа области настроек
            const index = Math.abs(Math.round(center_x * 654 + center_x + center_z)) % this.presets.length;
            op = this.presets[index];
            // "перетекание" ландшафта
            const perc = 1 - Math.min(Math.max((dist - (max_dist - TRANSITION_WIDTH)) / TRANSITION_WIDTH, 0), 1);
            relief += ( (op.relief - MAP_PRESETS.norm.relief) * perc);
            mid_level += (op.mid_level - MAP_PRESETS.norm.mid_level) * perc;
        }

        const dist_percent = 1 - Math.min(dist/radius, 1); // 1 in center
        const density_coeff = op.density_coeff ?? DEFAULT_DENSITY_COEFF;

        return {relief, mid_level, radius, dist, dist_percent, op, density_coeff}

    }

    calcDensity(xyz, cell) {

        let density;
        let d1;
        let d2;
        let d3;
        let d4;

        /*
        if(!globalThis.fffx) {
            globalThis.fffx = 0;
        }
        globalThis.fffx++;
        if(globalThis.fffx%1000==0) console.log(globalThis.fffx)
        */

        //if(max_height !== null) {
        //    density = xyz.y < max_height ? 1 : 0;
        //    d3 = .2;
        //    river_point = null;
        //
        //} else {

            const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;

            // waterfront/берег
            const under_waterline = xyz.y < WATER_LEVEL;
            const under_waterline_density = under_waterline ? 1.025 : 1; // немного пологая часть суши в части находящейся под водой в непосредственной близости к берегу
            const h = (1 - (xyz.y - mid_level * 2 - WATER_LEVEL) / relief) * under_waterline_density; // уменьшение либо увеличение плотности в зависимости от высоты над/под уровнем моря (чтобы выше моря суша стремилась к воздуху, а ниже уровня моря к камню)

            if(h < 0.333) {
                d1 = 0;
                d2 = 0;
                d3 = 0;
                d4 = 0;
                density = 0;

            } else {

                d1 = this.noise3d(xyz.x/100, xyz.y / 100, xyz.z/100);
                d2 = this.noise3d(xyz.x/50, xyz.y / 50, xyz.z/50);
                d3 = this.noise3d(xyz.x/25, xyz.y / 25, xyz.z/25);
                d4 = this.noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5);

                density = (
                    // 64/120 + 32/120 + 16/120 + 8/120
                    (d1 * density_coeff.d1 + d2 * density_coeff.d2 + d3 * density_coeff.d3 + d4 * density_coeff.d4)
                    / 2 + .5
                ) * h;

                // rivers/реки
                if(cell.river_point) {
                    const {value, percent, river_percent, waterfront_percent} = cell.river_point;
                    const river_vert_dist = WATER_LEVEL - xyz.y;
                    const river_density = Math.max(percent, river_vert_dist / (10 * (1 - Math.abs(d3 / 2)) * (1 - Math.sqrt(percent))) / Math.PI);
                    density = Math.min(density, density * river_density);
                }

            }

        //}

        return {d1, d2, d3, d4, density};

    }

    makeRiverPoint(x, z) {
        let value1 = this.noise2d(x / RIVER_OCTAVE_1, z / RIVER_OCTAVE_1) * 0.7;
        let value2 = this.noise2d(x / RIVER_OCTAVE_2, z / RIVER_OCTAVE_2) * 0.2;
        let value3 = this.noise2d(x / RIVER_OCTAVE_3, z / RIVER_OCTAVE_3) * 0.1;
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

        const xyz = new Vector(0, 0, 0);
        const cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }

        // Result map
        const map = new TerrainMap(chunk, GENERATOR_OPTIONS);
        if(!real_chunk.chunkManager) {
            debugger
        }
        
        map.cluster = real_chunk.chunkManager.world.generator.clusterManager.getForCoord(chunk.coord);

        if(!map.cluster.is_empty) {
            for(const [_, building] of map.cluster.buildings.entries()) {
                if(building.door_bottom && building.door_bottom.y == Infinity) {
                    xyz.copyFrom(building.door_bottom).addSelf(getAheadMove(building.door_direction))
                    const river_point = this.makeRiverPoint(xyz.x, xyz.z);
                    for(let y = CHUNK_SIZE_Y; y >= 0; y--) {
                        xyz.y = map.cluster.y_base + y;
                        const preset = this.getPreset(xyz);
                        const {d1, d2, d3, d4, density} = this.calcDensity(xyz, {river_point, preset});
                        if(density > .6) {
                            building.setY(xyz.y + 1);
                            break;
                        }
                    }
                }
            }
        }

        const biome = BIOMES['GRASSLAND'];
        map.terrain = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Y * CHUNK_SIZE_Z);

        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);
                // Create map cell
                let value = 85;
                const humidity = 1;
                const equator = 1;
                const dirt_block_id = biome.dirt_block[0];
                const cell = new TerrainMapCell(value, humidity, equator, biome, dirt_block_id);
                cell.river_point = this.makeRiverPoint(xyz.x, xyz.z);
                cell.preset = this.getPreset(xyz);
                cell.dirt_level = this.noise2d(xyz.x / 16, xyz.z / 16); // динамическая толщина дерна
                //for(let y = chunk.size.y; y >= 0; y--) {
                //}
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