import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../../chunk_const.js";
import { alea } from "../../default.js";
import { Vector, VectorCollector } from "../../../helpers.js";
import { BLOCK } from '../../../blocks.js';

import { Biomes } from "./../biomes.js";
import { TerrainMap2 } from "./map.js";
import { TerrainMapCell } from "./map_cell.js";
import { Aquifera, AquiferaParams } from "../aquifera.js";
import { getAheadMove } from "../../cluster/building_cluster_base.js";

export const TREE_BETWEEN_DIST          = 2; // минимальное расстояние между деревьями
export const TREE_MARGIN                = 3; // Минимальное расстояние от сгенерированной постройки до сгенерированного дерева
export const MAX_TREES_PER_CHUNK        = 16; // Максимальное число деревьев в чанке
export const TREE_MIN_Y_SPACE           = 5; // Минимальное число блоков воздуха для посадки любого типа дерева
export const BUILDING_MIN_Y_SPACE       = 10; // Минимальное число блоков воздуха для устновки дома
export const WATER_LEVEL                = 80;
export const DENSITY_AIR_THRESHOLD      = .6; // всё что больше этого значения - камень
export const UNCERTAIN_ORE_THRESHOLD    = .025;

let mountain_desert_mats = [];

function initMats() {
    mountain_desert_mats = [
        BLOCK.ORANGE_TERRACOTTA.id,
        BLOCK.LIGHT_GRAY_TERRACOTTA.id,
        BLOCK.BROWN_TERRACOTTA.id,
        BLOCK.TERRACOTTA.id,
        BLOCK.WHITE_TERRACOTTA.id,
        BLOCK.WHITE_TERRACOTTA.id,
        // BLOCK.PINK_TERRACOTTA.id,
        // BLOCK.YELLOW_TERRACOTTA.id,
    ];
}

const _aquifera_params = new AquiferaParams()

//
class RiverPoint {

    constructor(value) {
        this.value = value;
        this.percent = (value - WATER_START) / RIVER_FULL_WIDTH;
        this.percent_sqrt = Math.sqrt(this.percent);
        this.river_percent = this.percent < WATER_PERCENT ? (1 - this.percent / WATER_PERCENT) : 0;
        this.waterfront_percent = (this.percent - WATER_PERCENT) / (1 - WATER_PERCENT);
    }

}

export class MapsBlockResult {

    constructor(dirt_layer, block_id) {
        this.set(dirt_layer, block_id)
    }

    set(dirt_layer, block_id) {
        this.dirt_layer = dirt_layer
        this.block_id = block_id
        return this
    }

}

//
export class DensityParams {

    /**
     * @param {float} d1
     * @param {float} d2
     * @param {float} d3
     * @param {float} d4
     * @param {float} density
     * @param {float} dcaves
     * @param {boolean} in_aquifera
     * @param {int} local_water_line
     */
    constructor(d1, d2, d3, d4, density, dcaves = 0, in_aquifera = false, local_water_line = WATER_LEVEL) {
        return this.set(d1, d2, d3, d4, density, dcaves, in_aquifera, local_water_line)
    }

    /**
     * @param {float} d1
     * @param {float} d2
     * @param {float} d3
     * @param {float} d4
     * @param {float} density
     * @param {float} dcaves
     * @param {boolean} in_aquifera
     * @param {int} local_water_line
     */
    set(d1, d2, d3, d4, density, dcaves = 0, in_aquifera = false, local_water_line = WATER_LEVEL) {
        this.d1 = d1;
        this.d2 = d2;
        this.d3 = d3;
        this.d4 = d4;
        this.density = density;
        this.dcaves = dcaves || 0;
        this.in_aquifera = !!in_aquifera
        this.local_water_line = local_water_line ?? WATER_LEVEL
        return this;
    }

    reset() {
        return this.set(0, 0, 0, 0, 0, 0);
    }

}

const ZeroDensity = new DensityParams(0, 0, 0, 0, 0, 0);

export const GENERATOR_OPTIONS = {
    WATER_LINE:             80, // Ватер-линия
    SCALE_EQUATOR:          1280 * .5 * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * .5, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * .5, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * .5 // Масштаб шума для карты высот
};

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
    norm:               {id: 'norm', chance: 7, relief: 4, mid_level: 6, is_plain: true/*, grass_block_id: BLOCK.GRASS_BLOCK.id*/},
    mountains:          {id: 'mountains', chance: 4, relief: 48, mid_level: 8/*, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id*/},
    high_noise:         {id: 'high_noise', chance: 4, relief: 128, mid_level: 24/*, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id*/},
    high_coarse_noise:  {id: 'high_coarse_noise', chance: 4, relief: 128, mid_level: 24/*, grass_block_id: BLOCK.GRASS_BLOCK.id, density_coeff: {d1: 0.5333, d2: 0.7, d3: 0.1333, d4: 0.0667}, second_grass_block_threshold: .1, second_grass_block_id: BLOCK.PODZOL.id*/},
    // gori:               {id: 'gori', chance: 40, relief: 128, mid_level: 24/*, grass_block_id: BLOCK.GRASS_BLOCK.id, density_coeff: {d1: 0.5333, d2: 0.7, d3: 0.1333, d4: 0.0667}, second_grass_block_threshold: .1, second_grass_block_id: BLOCK.PODZOL.id*/}
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
        this.biomes = new Biomes(noise2d);
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

        this.noise3d?.setScale4(1/ 100, 1/50, 1/25, 1/12.5);
        initMats();
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
    generateAround(chunk, chunk_addr, smooth, generate_trees) {

        const rad                   = generate_trees ? 2 : 1;
        const noisefn               = this.noise2d;
        const maps                  = [];

        /**
         * @type {TerrainMap2}
         */
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

        // Smooth (for central and part of neighbours)
        if(smooth && !center_map.smoothed) {
            center_map.smooth(this);
        }

        // Generate trees
        if(generate_trees) {
            for (let i = 0; i < maps.length; i++) {
                const map = maps[i];
                if(!map.vegetable_generated) {
                    map.generateTrees(chunk, this.seed, this);
                }
            }
        }

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
        const TRANSITION_WIDTH = 64; // ширина перехода межу областью и равниной

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

    // Шум для гор
    mountainFractalNoise(x, y, octaves, lacunarity, persistence, scale) {
        // The sum of our octaves
        let value = 0
        // These coordinates will be scaled the lacunarity
        let x1 = x
        let y1 = y
        // Determines the effect of each octave on the previous sum
        let amplitude = 1
        for (let i = 1; i < octaves; i++) {
            // Multiply the noise output by the amplitude and add it to our sum
            value += this.noise2d(x1 / scale, y1 / scale) * amplitude;
            // Scale up our perlin noise by multiplying the coordinates by lacunarity
            y1 *= lacunarity
            x1 *= lacunarity
            // Reduce our amplitude by multiplying it by persistence
            amplitude *= persistence
        }
        // It is possible to have an output value outside of the range [-1,1]
        // For consistency let's clamp it to that range
        return Math.abs(value); // Helpers.clamp(value, -1, 1)
    }

    getMaxY(cell) {
        const {relief, mid_level} = cell.preset;
        return Math.max(0, (1 - DENSITY_AIR_THRESHOLD) * relief + mid_level * 2) + WATER_LEVEL;
    }

    /**
     * Calculate totsl density in block and return all variables
     * 
     * @param {Vector} xyz
     * @param {*} cell
     * @param {?DensityParams} out_density_params
     * @param {TerrainMap2} map
     * 
     * @returns {DensityParams}
     */
    calcDensity(xyz, cell, out_density_params = null, map) {

        const {relief, mid_level, radius, dist, dist_percent, op, density_coeff} = cell.preset;

        // TODO: GENERATOR_OPTIONS.WATER_LINE or WATER_LEVEL ?

        /*
        if(op.id == 'gori') {

            if(!cell.mountain_density) {
                const NOISE_SCALE = 100
                const HEIGHT_SCALE = 164 * dist_percent;
                const max_height = GENERATOR_OPTIONS.WATER_LINE + this.mountainFractalNoise(xyz.x/3, xyz.z/3,
                    4, // -- Octaves (Integer that is >1)
                    3, // -- Lacunarity (Number that is >1)
                    0.35, // -- Persistence (Number that is >0 and <1)
                    NOISE_SCALE,
                ) * HEIGHT_SCALE;
                // const density = xyz.y < max_height ? 1 : 0;
                const d1 = 0;
                const d2 = 0;
                const d3 = (
                    this.noise2d(xyz.x/25, xyz.z/25) +
                    this.noise2d((xyz.x + 1000) / 25, (xyz.z + 1000) / 25)
                ) / 2;
                const d4 = 0;
                cell.mountain_density = new DensityParams(d1, d2, d3, d4, 1);
                cell.mountain_density.max_height = max_height;
                cell.mountain_density_zero = new DensityParams(d1, d2, d3, d4, 0);
            }

            return xyz.y < cell.mountain_density.max_height ? cell.mountain_density : cell.mountain_density_zero;

        }
        */

        // Aquifera
        map.aquifera.calcInside(xyz, _aquifera_params)

        // waterfront/берег
        const under_waterline = xyz.y < WATER_LEVEL;
        const under_waterline_density = under_waterline ? 1.025 : 1; // немного пологая часть суши в части находящейся под водой в непосредственной близости к берегу
        const under_earth_height = WATER_LEVEL - xyz.y
        const under_earth_coeff = under_earth_height > 0 ? Math.min(under_earth_height/64, 1) : 0
        const h = (1 - (xyz.y - mid_level * 2 - WATER_LEVEL) / relief) * under_waterline_density; // уменьшение либо увеличение плотности в зависимости от высоты над/под уровнем моря (чтобы выше моря суша стремилась к воздуху, а ниже уровня моря к камню)

        //
        if(!_aquifera_params.inside) {
            // Если это блок воздуха
            if(h + under_earth_coeff < DENSITY_AIR_THRESHOLD) {
                if(out_density_params) {
                    return out_density_params.reset()
                }
                return ZeroDensity;
            }
        }

        //
        const res = out_density_params || new DensityParams(0, 0, 0, 0, 0, 0);
        res.reset()
        this.noise3d.fetchGlobal4(xyz, res);

        // Check if inside aquifera
        if(_aquifera_params.inside) {
            res.in_aquifera = true
            res.local_water_line = map.aquifera.pos.y
            if(_aquifera_params.in_wall) {
                res.density = _aquifera_params.density
                return res
            }
        }

        const {d1, d2, d3, d4} = res;

        let density = (
            // 64/120 + 32/120 + 16/120 + 8/120
            (d1 * density_coeff.d1 + d2 * density_coeff.d2 + d3 * density_coeff.d3 + d4 * density_coeff.d4)
            / 2 + .5
        ) * h + under_earth_coeff;

        // rivers/реки
        if(cell.river_point) {
            const {value, percent, percent_sqrt, river_percent, waterfront_percent} = cell.river_point;
            const river_vert_dist = WATER_LEVEL - xyz.y;
            const river_density = Math.max(percent, river_vert_dist / (10 * (1 - Math.abs(d3 / 2)) * (1 - percent_sqrt)) / Math.PI);
            density = Math.min(density, density * river_density + (d3 * .1) * percent_sqrt);
        }

        // Если это твердый камень, то попробуем превратить его в пещеру
        const cave_density_threshold = DENSITY_AIR_THRESHOLD * (d1 > .05 && (xyz.y > (WATER_LEVEL + Math.abs(d3) * 4)) ? 1 : 1.5)
        if(density > cave_density_threshold) {
            const caveDensity = map.caves.getPoint(xyz, cell, false, res);
            if(caveDensity !== null) {
                res.dcaves = caveDensity
                density = caveDensity
            }
        }

        // Total density
        res.density = density;
        return res;

    }

    /**
     *
     * @param {Vector} xyz
     * @param {int} not_air_count
     * @param {TerrainMapCell} cell
     * @param {DensityParams} density_params
     * @param {MapsBlockResult} block_result
     * 
     * @returns {MapsBlockResult}
     */
    getBlock(xyz, not_air_count, cell, density_params, block_result) {

        const dirt_layers = cell.biome.dirt_layers;
        const dist_percent = cell.preset.dist_percent;
        const {d1, d2, d3, d4, density} = density_params;

        // 1. select dirt layer
        let dirt_layer = dirt_layers[0];
        if(dirt_layers.length > 1) {
            if(dist_percent * d2 > .2) {
                dirt_layer = dirt_layers[1];
                if(dirt_layers.length > 2 && d3 < 0) {
                    dirt_layer = dirt_layers[2];
                }
            }
        }

        let block_id = null;

        if(cell.biome.title == 'Пустыня' && cell.preset.op.id == 'high_noise' && cell.preset.dist_percent + d3 * .25 > .5 ) {
            const v = (d3 + 1) / 2;
            const index = xyz.y % mountain_desert_mats.length
            const dd = Math.floor(index * v);
            block_id = mountain_desert_mats[dd % mountain_desert_mats.length];

        } else {
            // 2. select block in dirt layer
            block_id = dirt_layer.blocks[0];
            const local_water_line = WATER_LEVEL // density_params.local_water_line
            if(xyz.y < local_water_line && dirt_layer.blocks.length > 1) {
                block_id = dirt_layer.blocks[dirt_layer.blocks.length - 1];
            }
            const dirt_layer_blocks_count = dirt_layer.blocks.length;
            if(not_air_count > 0 && dirt_layer_blocks_count > 1) {
                switch(dirt_layer_blocks_count) {
                    case 2: {
                        block_id = dirt_layer.blocks[1];
                        break;
                    }
                    case 3: {
                        block_id = not_air_count <= cell.dirt_level ? dirt_layer.blocks[1] : dirt_layer.blocks[2];
                        break;
                    }
                }
            }

        }

        if(block_id == BLOCK.STONE.id) {
            if(d1 > .5) block_id = BLOCK.ANDESITE.id
            if(d4 > .5) block_id = BLOCK.DIORITE.id
            if(d3 > .55 && xyz.y < WATER_LEVEL - d2 * 5) block_id = BLOCK.GRANITE.id
        }
        
        if(!block_result) {
            return block_result = new MapsBlockResult(dirt_layer, block_id)
        }

        return block_result.set(dirt_layer, block_id)

    }

    makeRiverPoint(x, z) {
        x += 91234;
        z -= 95678;
        const value1 = this.noise2d((x + 10) / RIVER_OCTAVE_1, (z + 10) / RIVER_OCTAVE_1) * 0.7;
        const value2 = this.noise2d((x) / RIVER_OCTAVE_2, (z) / RIVER_OCTAVE_2) * 0.2;
        const value3 = this.noise2d((x - 10) / RIVER_OCTAVE_3, (z - 10) / RIVER_OCTAVE_3) * 0.1;
        const value = Math.abs((value1 + value2 + value3) / 0.004);
        if(value > WATER_START && value < WATERFRONT_STOP) {
            return new RiverPoint(value);
        }
        return null;
    }

    calcBiome(xz) {

        // Create map cell
        const temperature = this.biomes.calcNoise(xz.x / 1.15, xz.z / 1.15, 3, .9);
        const humidity = this.biomes.calcNoise(xz.x * .5, xz.z * .5, 2);
        const biome = this.biomes.getBiome(temperature, humidity);

        return biome; // {biome, temperature, humidity};

    }

    // generateMap
    generateMap(real_chunk, chunk, noisefn) {

        const cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }

        if(!real_chunk.chunkManager) {
            debugger
        }

        const value = 85;
        const xyz = new Vector(0, 0, 0);
        const _density_params = new DensityParams(0, 0, 0, 0, 0, 0);

        // Result map
        const map = new TerrainMap2(chunk, GENERATOR_OPTIONS, this.noise2d);

        const doorSearchSize = new Vector(1, 2 * CHUNK_SIZE_Y, 1);

        // 1. Fill cells
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                // Create map cell
                const biome = this.calcBiome(xyz);
                const dirt_block_id = biome.dirt_layers[0];
                const cell = new TerrainMapCell(value, biome.humidity, biome.temperature, biome, dirt_block_id);
                cell.river_point = this.makeRiverPoint(xyz.x, xyz.z);
                cell.preset = this.getPreset(xyz);
                cell.dirt_level = Math.floor((this.noise2d(xyz.x / 16, xyz.z / 16) + 2)); // динамическая толщина дерна
                map.cells[z * CHUNK_SIZE_X + x] = cell;

            }
        }

        // 2. Create cluster
        const map_manager = real_chunk.chunkManager.world.generator.maps
        map.cluster = real_chunk.chunkManager.world.generator.clusterManager.getForCoord(chunk.coord, map_manager);

        // Aquifera
        map.aquifera = new Aquifera(chunk.coord)

        // 3. Find door Y position for cluster buildings
        if(!map.cluster.is_empty && map.cluster.buildings) {

            for(const [_, building] of map.cluster.buildings.entries()) {

                if(!building.entrance || building.entrance.y != Infinity) {
                    continue
                }

                xyz.copyFrom(building.ahead_entrance)

                const river_point = this.makeRiverPoint(xyz.x, xyz.z);
                let free_height = 0;
                const preset = this.getPreset(xyz);
                const cell = {river_point, preset};

                xyz.y = map.cluster.y_base
                this.noise3d.generate4(xyz, doorSearchSize)

                for(let y = doorSearchSize.y - 1; y >= 0; y--) {

                    xyz.y = map.cluster.y_base + y
                    const {density} = this.calcDensity(xyz, cell, _density_params, map)

                    // если это камень
                    if(density > DENSITY_AIR_THRESHOLD) {
                        if(free_height >= BUILDING_MIN_Y_SPACE) {
                            // set Y for door
                            building.setY(xyz.y)
                            // set building cell for biome info
                            // const x = xyz.x - Math.floor(xyz.x / CHUNK_SIZE_X) * CHUNK_SIZE_X;
                            // const z = xyz.z - Math.floor(xyz.z / CHUNK_SIZE_Z) * CHUNK_SIZE_Z;
                            const biome = this.calcBiome(xyz)
                            building.setBiome(biome, biome.temperature, biome.humidity)
                            break
                        }
                        free_height = 0
                    }

                    free_height++

                }

            }
        }

        this.maps_cache.set(chunk.addr, map);
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