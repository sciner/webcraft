import { CHUNK_SIZE_X, CHUNK_SIZE_Y } from "../../../chunk_const.js";
import { alea } from "../../default.js";
import { ArrayHelpers, Helpers, Vector } from "../../../helpers.js";
import type { Biome, BiomeDirtLayer } from "./../biomes.js";
import { TerrainMap2 } from "./map.js";
import { TerrainMapCell } from "./map_cell.js";
import { Aquifera, AquiferaParams } from "../aquifera.js";
import { WATER_LEVEL, DensityParams, MapCellPreset, ClimateParams, DENSITY_AIR_THRESHOLD, BUILDING_MIN_Y_SPACE } from "./manager_vars.js";

// Presets
import { MapCellPreset_Mountains } from "./map_preset/mountains.js";
import { MapCellPreset_SnowCoveredMountains } from "./map_preset/snow_covered_mountains.js";
import { MapCellPreset_Swamp } from "./map_preset/swamp.js";
import { MapCellPreset_Ices } from "./map_preset/ices.js";
import type { BLOCK } from "../../../blocks.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import { TerrainMapManagerBase } from "./manager_base.js";
import type { Biome3LayerBase } from "../layers/base.js";

// Water
const WATER_START                       = 0;
const WATER_STOP                        = 1.5;
const WATERFRONT_STOP                   = 24.0;
const WATER_PERCENT                     = WATER_STOP / (WATERFRONT_STOP - WATER_START);
const RIVER_FULL_WIDTH                  = WATERFRONT_STOP - WATER_START;

// Rivers
const RIVER_SCALE                       = .5;
const RIVER_NOISE_SCALE                 = 4.5;
const RIVER_OCTAVE_1                    = 512 / RIVER_SCALE;
const RIVER_OCTAVE_2                    = RIVER_OCTAVE_1 / RIVER_NOISE_SCALE;
const RIVER_OCTAVE_3                    = 48 / RIVER_SCALE;

//
class RiverPoint {
    value:                  any
    percent:                number
    // percent_sqrt:           number
    river_percent:          number
    waterfront_percent:     number

    constructor(value) {
        this.value = value;
        this.percent = (value - WATER_START) / RIVER_FULL_WIDTH;
        // this.percent_sqrt = Math.sqrt(this.percent);
        this.river_percent = this.percent < WATER_PERCENT ? (1 - this.percent / WATER_PERCENT) : 0;
        this.waterfront_percent = (this.percent - WATER_PERCENT) / (1 - WATER_PERCENT);
    }

}

export class MapsBlockResult {
    block_id:       int
    dirt_layer:     BiomeDirtLayer

    constructor(dirt_layer : BiomeDirtLayer = null, block_id : int = 0) {
        this.set(dirt_layer, block_id)
    }

    set(dirt_layer : BiomeDirtLayer, block_id : int) {
        this.dirt_layer = dirt_layer
        this.block_id = block_id
        return this
    }

}

class MapCellPresetResult {
    relief: float;
    mid_level: float;
    radius: float;
    dist: float;
    dist_percent: float;
    op: any;
    density_coeff: any;

    constructor(relief: float, mid_level: float, radius: float, dist: float, dist_percent: float, op: any, density_coeff: any) {
        this.relief = relief;
        this.mid_level = mid_level;
        this.radius = radius;
        this.dist = dist;
        this.dist_percent = dist_percent;
        this.op = op;
        this.density_coeff = density_coeff;
    }

}

export const GENERATOR_OPTIONS = {
    WATER_LEVEL:            WATER_LEVEL, // Ватер-линия
    SCALE_EQUATOR:          1280 * .5 * 3, // Масштаб для карты экватора
    SCALE_BIOM:             640  * .5, // Масштаб для карты шума биомов
    SCALE_HUMIDITY:         320  * .5, // Масштаб для карты шума влажности
    SCALE_VALUE:            250  * .5 // Масштаб шума для карты высот
};

const DEFAULT_DENSITY_COEFF = {
    d1: 0.5333,
    d2: 0.2667,
    d3: 0.1333,
    d4: 0.0667
}

const MAP_PRESETS = {
    norm:                       new MapCellPreset('norm',               { chance: 7, relief: 4, mid_level: 4}),
    small_mountains:            new MapCellPreset('small_mountains',    { chance: 4, relief: 48, mid_level: 8 }),
    high_noise:                 new MapCellPreset('high_noise',         { chance: 4, relief: 128, mid_level: 24 }),
    high_coarse_noise:          new MapCellPreset('high_coarse_noise',  { chance: 4, relief: 128, mid_level: 24 }),
    mountains:                  new MapCellPreset_Mountains(),
    snow_covered_mountains:     new MapCellPreset_SnowCoveredMountains(),
    swamp:                      new MapCellPreset_Swamp(),
    ices:                       new MapCellPreset_Ices()
};

const ZeroDensity = new DensityParams(0, 0, 0, 0, 0, 0);
const _aquifera_params = new AquiferaParams()

// Map manager
export class TerrainMapManager3 extends TerrainMapManagerBase {
    mountain_desert_mats:   any[]
    presets:                any[]

    static _climateParams = new ClimateParams();

    constructor(seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer : Biome3LayerBase) {
        super(seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
        this.makePresetsList(seed)
        this.noise3d?.setScale4(1/ 100, 1/50, 1/25, 1/12.5);
        this.initMats();
    }

    // Presets by chances
    makePresetsList(seed: string) {
        const rnd_presets = new alea(seed);
        this.float_seed = rnd_presets.double()
        this.presets = [];
        for(const k in MAP_PRESETS) {
            const op = MAP_PRESETS[k];
            for(let i = 0; i < op.chance; i++) {
                this.presets.push(op);
            }
        }
        ArrayHelpers.shuffle(this.presets, rnd_presets.double)
    }

    initMats() {
        this.mountain_desert_mats = []
        for(let name of ['ORANGE_TERRACOTTA', 'LIGHT_GRAY_TERRACOTTA',
            'BROWN_TERRACOTTA',
            'TERRACOTTA',
            'WHITE_TERRACOTTA',
            'WHITE_TERRACOTTA',
            // 'PINK_TERRACOTTA',
            // 'YELLOW_TERRACOTTA'
        ]) {
            this.mountain_desert_mats.push(this.block_manager.fromName(name).id)
        }
    }

    // Generate maps
    generateAround(chunk : ChunkWorkerChunk, chunk_addr : Vector, smooth : boolean = false, generate_trees : boolean = false) {

        const maps = super.generateAround(chunk, chunk_addr, smooth, generate_trees)

        let center_map: TerrainMap2 = maps[4]

        // Smooth (for central and part of neighbours)
        if(smooth && !center_map.smoothed) {
            (center_map as any).smooth(this)
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
    angleTo(xyz : Vector, tx : number, tz : number) {
        const angle = Math.atan2(tx - xyz.x, tz - xyz.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    rnd(x : int, z : int) {
        const resp = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 + this.float_seed
        return resp - Math.floor(resp)
    }

    /**
     * Return cell preset
     */
    getPreset(xz : Vector) : MapCellPresetResult {

        const RAD = 1000; // радиус области
        const TRANSITION_WIDTH = 256; // ширина перехода межу областью и равниной

        // центр области
        const center_x = Math.round(xz.x / RAD) * RAD;
        const center_z = Math.round(xz.z / RAD) * RAD;

        // базовые кривизна рельефа и высота поверхности
        let op                  = MAP_PRESETS.norm;
        let relief              = op.relief;
        let mid_level           = op.mid_level;

        // частичное занижение общего уровня, чтобы равнины становились ближе к воде
        let deform_mid_level = -Math.abs(this.noise2d(xz.x/500, xz.z/500) * 4);
        if(deform_mid_level > 0) deform_mid_level /= 3;
        mid_level += deform_mid_level;

        // угол к центру области
        const angle = this.angleTo(xz, center_x, center_z);

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
        const lenx = center_x - xz.x;
        const lenz = center_z - xz.z;
        const dist = Math.sqrt(lenx * lenx + lenz * lenz);
        const dist_percent = 1 - Math.min(dist/radius, 1); // 1 in center

        if((dist < max_dist)) {
            // выбор типа области настроек
            const index = Math.floor(this.rnd(center_x / RAD, center_z / RAD) * this.presets.length)
            op = this.presets[index];
            // "перетекание" ландшафта
            let perc = 1 - Helpers.clamp((dist - (max_dist - TRANSITION_WIDTH)) / TRANSITION_WIDTH, 0, 1);
            relief += ( (op.relief - MAP_PRESETS.norm.relief) * perc);
            // relief += Mth.lerp(perc, MAP_PRESETS.norm.relief, op.relief/2 + op.relief/2*perc);
            mid_level += (op.mid_level - MAP_PRESETS.norm.mid_level) * perc;
        }
        const density_coeff = op.density_coeff ?? DEFAULT_DENSITY_COEFF;

        return new MapCellPresetResult(relief, mid_level, radius, dist, dist_percent, op, density_coeff)

    }

    getMaxY(cell) : int {
        const {relief, mid_level, op} = cell.preset;
        let val = (1 - DENSITY_AIR_THRESHOLD) * relief + mid_level * 2;
        if (op.max_height !== undefined) {
            val = Math.max(val, op.max_height + 1);
        }
        return val + WATER_LEVEL;
    }

    /**
     * Calculate totsl density in block and return all variables
     */
    calcDensity(xyz : Vector, cell, out_density_params : DensityParams | null, map : TerrainMap2) : DensityParams {

        let {relief, mid_level, dist_percent, op, density_coeff} = cell.preset;

        if(xyz.y <= WATER_LEVEL) {
            relief *= 20
            mid_level *= 20
            // relief /= 20
            // mid_level /= 20
        }

        // Aquifera
        map.aquifera.calcInside(xyz, _aquifera_params)

        // waterfront/берег
        const under_waterline = xyz.y < WATER_LEVEL;
        const under_waterline_density = under_waterline ? 1.025 : 1; // немного пологая часть суши в части находящейся под водой в непосредственной близости к берегу
        const under_earth_height = WATER_LEVEL - xyz.y
        const under_earth_coeff = under_earth_height > 0 ? Math.min(under_earth_height/64, 1) : 0 // затухание естественных пещер от 3д шума

        let h = (1 - (xyz.y - mid_level * 2 - WATER_LEVEL) / relief) * under_waterline_density; // уменьшение либо увеличение плотности в зависимости от высоты над/под уровнем моря (чтобы выше моря суша стремилась к воздуху, а ниже уровня моря к камню)

        //
        if(!_aquifera_params.inside) {
            let height_check = h + under_earth_coeff < DENSITY_AIR_THRESHOLD;
            // Если это блок воздуха
            if (height_check) {
                if (op.max_height !== undefined) {
                    height_check = xyz.y - WATER_LEVEL >= op.max_height + 1;
                }
            }
            if (height_check) {
                if(out_density_params) {
                    return out_density_params.reset()
                }
                return ZeroDensity;
            }
        }
        //
        const res = out_density_params || new DensityParams(0, 0, 0, 0, 0, 0);
        res.reset()

        // Check if inside aquifera
        if(_aquifera_params.inside) {
            res.in_aquifera = true
            res.local_water_line = map.aquifera.pos.y
            if(_aquifera_params.in_wall) {
                res.density = _aquifera_params.density
                return res
            }
        }

        let density = 0;
        this.noise3d.fetchGlobal4(xyz, res);

        const {d1, d2, d3, d4} = res;
        density = (
            // 64/120 + 32/120 + 16/120 + 8/120
            (d1 * density_coeff.d1 + d2 * density_coeff.d2 + d3 * density_coeff.d3 + d4 * density_coeff.d4)
            / 2 + .5
        ) * h + under_earth_coeff;

        if (op.calcDensity && dist_percent > 1e-3) {
            res.density = density;
            op.calcDensity(xyz, cell, dist_percent, this.noise2d, GENERATOR_OPTIONS, res)
            let mountmul = 500 / 100 * dist_percent;
            if (mountmul < 1) {
                if (mountmul > 0) {
                    density += (res.density - density) * mountmul;
                }
            } else {
                density = res.density;
            }
        }

        // rivers/реки
        if(cell.river_point) {
            const {value, percent, river_percent, waterfront_percent} = cell.river_point;
            const river_vert_dist = WATER_LEVEL - xyz.y;
            const river_density = Math.max(percent, river_vert_dist / (10 * (1 - Math.abs(d3 / 2)) * (1 - percent)) / Math.PI);
            density = Math.min(density, density * river_density + (d3 * .1) * percent);
        }

        // Если это твердый камень, то попробуем превратить его в пещеру
        if(density > DENSITY_AIR_THRESHOLD) {
            const cave_density_threshold = DENSITY_AIR_THRESHOLD * (d1 > .05 && (xyz.y > (WATER_LEVEL + Math.abs(d3) * 4)) ? 1 : 1.5)
            if(density > cave_density_threshold) {
                const caveDensity = map.caves.getPoint(xyz, cell, false, res);
                if(caveDensity !== null) {
                    density = caveDensity
                    res.dcaves = density
                }
            }
        }

        // Total density
        res.density = density;
        return res;

    }

    getBlock(xyz: Vector, not_air_count: number, cell: TerrainMapCell, density_params: DensityParams, block_result?: MapsBlockResult): MapsBlockResult {

        const dirt_layers = cell.biome.dirt_layers;
        const dist_percent = cell.preset.dist_percent;
        const {d1, d2, d3, d4, density} = density_params;
        const bm = this.block_manager

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
            const index = xyz.y % this.mountain_desert_mats.length
            const dd = Math.floor(index * v);
            block_id = this.mountain_desert_mats[dd % this.mountain_desert_mats.length];

        } else {
            // 2. select block in dirt layer
            const dirt_layer_blocks = dirt_layer.blocks;
            const dirt_layer_blocks_count = dirt_layer_blocks.length;
            
            if(not_air_count > 0 && dirt_layer_blocks_count > 1) {
                switch(dirt_layer_blocks_count) {
                    case 2: {
                        block_id = dirt_layer_blocks[1];
                        break;
                    }
                    default: {
                        /* Ранее здесь было "case 3:".
                        Похоже, больше чем 3 блока не используется.
                        Если мы сделаем тут "default", то это гарантирует что какой-то id будет присвоен,
                        и тогда можно код, выполнявшийся пред этим, перенести в ветку else - оптимизация.
                        В любом случае, для 4-х блоков нужно будет добавлять другой код. */
                        block_id = not_air_count <= cell.dirt_level ? dirt_layer_blocks[1] : dirt_layer_blocks[2];
                        break;
                    }
                }
            } else {
                const local_water_line = WATER_LEVEL // density_params.local_water_line
                if(xyz.y < local_water_line && dirt_layer_blocks_count > 1) {
                    block_id = dirt_layer_blocks[dirt_layer_blocks_count - 1];
                } else {
                    block_id = dirt_layer_blocks[0];
                }
            }

        }

        if(block_id == bm.STONE.id) {
            /* Old equivalent code
            if(d1 > .5) block_id = bm.ANDESITE.id
            if(d4 > .5) block_id = bm.DIORITE.id
            if(d3 > .55 && xyz.y < WATER_LEVEL - d2 * 5) block_id = bm.GRANITE.id
            */
            if(d3 > .55 && xyz.y < WATER_LEVEL - d2 * 5) block_id = bm.GRANITE.id
            else if(d4 > .5) block_id = bm.DIORITE.id
            else if(d1 > .5) block_id = bm.ANDESITE.id
        }
        
        if(!block_result) {
            return new MapsBlockResult(dirt_layer, block_id)
        }

        return block_result.set(dirt_layer, block_id)

    }

    makeRiverPoint(x : int, z : int) : RiverPoint | null {
        x += 91234;
        z -= 95678;
        const value1 = this.noise2d((x + 10) / RIVER_OCTAVE_1, (z + 10) / RIVER_OCTAVE_1) * 0.7;
        const value2 = this.noise2d((x) / RIVER_OCTAVE_2, (z) / RIVER_OCTAVE_2) * 0.2;
        const value3 = this.noise2d((x - 10) / RIVER_OCTAVE_3, (z - 10) / RIVER_OCTAVE_3) * 0.1;
        const value = Math.abs((value1 + value2 + value3) / 0.004);
        if(value > WATER_START && value < WATERFRONT_STOP) {
            return new RiverPoint(value)
        }
        return null
    }
    
    /**
     * Return biome for coords and modify by preset
     */
    calcBiome(xz : Vector, preset? : MapCellPresetResult ) : Biome {

        const params = TerrainMapManager3._climateParams

        // Create map cell
        params.set(
            this.biomes.calcNoise(xz.x / 1.15, xz.z / 1.15, 3, .9),
            this.biomes.calcNoise(xz.x * .5, xz.z * .5, 2)
        );

        if(preset && preset.op?.modifyClimate) {
            preset.op.modifyClimate(xz, params)
        }

        const biome = this.biomes.getBiome(params);

        return biome

    }

    // generate map
    generateMap(real_chunk, chunk, noisefn) {

        if(!real_chunk.chunkManager) {
            throw 'error_no_chunk_manager'
        }

        const value = 85;
        const xyz = new Vector(0, 0, 0);
        const _density_params = new DensityParams(0, 0, 0, 0, 0, 0);

        // Result map
        const map = new TerrainMap2(chunk, this.generator_options, this.noise2d);

        const doorSearchSize = new Vector(1, 2 * CHUNK_SIZE_Y, 1);

        // 1. Fill cells
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                xyz.set(chunk.coord.x + x, chunk.coord.y, chunk.coord.z + z);

                // Create map cell
                const preset = this.getPreset(xyz);
                const biome = this.calcBiome(xyz, preset);
                const dirt_block_id = biome.dirt_layers[0];
                const cell = new TerrainMapCell(value, biome.humidity, biome.temperature, biome, dirt_block_id);
                cell.river_point = this.makeRiverPoint(xyz.x, xyz.z);
                cell.preset = preset
                cell.dirt_level = Math.floor((this.noise2d(xyz.x / 16, xyz.z / 16) + 2)); // динамическая толщина дерна
                map.cells[z * CHUNK_SIZE_X + x] = cell;

            }
        }

        // 2. Create cluster
        map.cluster = this.layer.clusterManager.getForCoord(chunk.coord, this)

        // Aquifera
        map.aquifera = new Aquifera(chunk.coord)

        // 3. Find door Y position for cluster buildings
        if(!map.cluster.is_empty && map.cluster.buildings) {

            for(const building of map.cluster.buildings.values()) {

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
                            const biome = this.calcBiome(xyz, preset)
                            building.setBiome(biome, biome.temperature, biome.humidity)
                            break
                        }
                        free_height = 0
                    }

                    free_height++

                }

            }
        }

        // console.log(`Actual maps count: ${this.maps_cache.size}`);

        return map;

    }

}