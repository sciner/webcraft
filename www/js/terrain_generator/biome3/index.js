import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Helpers, IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell, Default_Terrain_Generator} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";
import {DungeonGenerator} from "../dungeon.js";

// import {DungeonGenerator} from "../dungeon.js";
// import FlyIslands from "../flying_islands/index.js";
// import { AABB } from '../../core/AABB.js';
// import { CaveGenerator } from "../cave_generator.js";
// import BottomCavesGenerator from "../bottom_caves/index.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const DEFAULT_DENSITY_COEFF = {
    d1: 0.5333,
    d2: 0.2667,
    d3: 0.1333,
    d4: 0.0667
}

const MAP_PRESETS = {
    // relief - кривизна рельефа
    // mid_level - базовая высота поверхности
    norm:               {id: 'norm', chance: 7, relief: 4, mid_level: 6, is_plain: true, grass_block_id: BLOCK.GRASS_BLOCK.id},
    mountains:          {id: 'mountains', chance: 4, relief: 48, mid_level: 8, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id},
    high_noise:         {id: 'high_noise', chance: 2, relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id, second_grass_block_threshold: 0.2, second_grass_block_id: BLOCK.MOSS_BLOCK.id},
    high_coarse_noise:  {id: 'high_coarse_noise', chance: 2, relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id, density_coeff: {d1: 0.5333, d2: 0.7, d3: 0.1333, d4: 0.0667}, second_grass_block_threshold: .1, second_grass_block_id: BLOCK.PODZOL.id}
};

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
        //
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

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        this.noise2d        = noise.simplex2;
        this.noise3d        = noise.simplex3;
        this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noise2d, this.noise3d);
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const CHUNK_START_Y = 25;
        const coord = new Vector(0, 0, 0).copyFrom(chunk.coord);
        const addr = new Vector(0, 0, 0).copyFrom(chunk.addr);
        coord.y -= chunk.size.y * CHUNK_START_Y;
        addr.y -= CHUNK_START_Y;
        const fake_chunk = {...chunk, coord, addr};
        fake_chunk.setBlockIndirect = chunk.setBlockIndirect;
        return this.flying_islands.generate(fake_chunk);
    }

    // Generate
    generate(chunk) {

        const seed                      = this.seed + chunk.id;
        const rnd                       = new alea(seed);
        const noise2d                   = this.noise2d;
        const noise3d                   = this.noise3d;
        // const maps                   = this.maps.generateAround(chunk, chunk.addr, false, true);
        // const map                    = maps[4];
        // const cluster                = chunk.cluster;
        // const caves                  = new CaveGenerator(chunk.coord, noise2d);

        const xyz                       = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const WATER_LEVEL               = 70;

        // blocks
        const water_id                  = BLOCK.STILL_WATER.id;
        const stone_block_id            = BLOCK.STONE.id;
        const grass_id                  = BLOCK.GRASS.id;
        const grass_block_id            = BLOCK.GRASS_BLOCK.id;
        const dirt_block_id             = BLOCK.DIRT.id;

        let not_air_count               = -1;
        let tree_pos                    = null;

        const map                       = this.generateMap(chunk);

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                const cell = map.cells[z * CHUNK_SIZE_X + x];

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, 0, chunk.coord.z + z);

                const dirt_level = noise2d(xyz.x / 16, xyz.z / 16); // динамическая толщина дерна
                const river_tunnel = noise2d(xyz.x / 256, xyz.z / 256) / 2 + .5;
                const {relief, mid_level, radius, dist, op} = this.getPreset(xyz);

                const dist_percent = 1 - Math.min(dist/radius, 1);
                // const max_height = 70 + dist_percent * 128;

                //
                const dirt_pattern = dirt_level;
                const river_point = this.maps.makeRiverPoint2(xyz.x, xyz.z);

                const density_coeff = op.density_coeff ?? DEFAULT_DENSITY_COEFF;

                for(let y = size_y; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;

                    //if(xyz.y < max_height) {
                    //    chunk.setBlockIndirect(x, y, z, stone_block_id);
                    //}
                    // continue;

                    const d1 = noise3d(xyz.x/100, xyz.y / 100, xyz.z/100);
                    const d2 = noise3d(xyz.x/50, xyz.y / 50, xyz.z/50);
                    const d3 = noise3d(xyz.x/25, xyz.y / 25, xyz.z/25);
                    const d4 = noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5);

                    // waterfront/берег
                    const under_waterline = xyz.y < WATER_LEVEL;
                    const under_waterline_density = under_waterline ? 1.025 : 1; // немного пологая часть суши в части находящейся под водой в непосредственной близости к берегу
                    const h = (1 - (xyz.y - mid_level * 2 - WATER_LEVEL) / relief) * under_waterline_density; // уменьшение либо увеличение плотности в зависимости от высоты над/под уровнем моря (чтобы выше моря суша стремилась к воздуху, а ниже уровня моря к камню)

                    let density = (
                        // 64/120 + 32/120 + 16/120 + 8/120
                        (d1 * density_coeff.d1 + d2 * density_coeff.d2 + d3 * density_coeff.d3 + d4 * density_coeff.d4)
                        / 2 + .5
                    ) * h;

                    // rivers/реки
                    
                    if(river_point) {

                        let river_density = 1;
                        const {value, percent, river_percent, waterfront_percent} = river_point;
                        const perc = Math.min(percent, waterfront_percent);
                        river_density = Math.max(0, perc);

                        const river_vert_dist = (WATER_LEVEL - xyz.y);
                        // const tunnel_density = river_tunnel;
                        // const river_vert_density = Math.max(-.5, river_vert_dist * tunnel_density * Math.PI); // чем выше, тем больше воздуха вокруг реки (чем меньше, тем выше вероятность образорвания реки в тоннеле)

                        if(xyz.y < WATER_LEVEL && river_percent >= 0) {
                            river_density = Math.min(density, Math.max(river_vert_dist / (32 * (1-perc)), river_density));
                        }

                        density *= river_density;

                    }

                    if(density > .6) {
                        let block_id = op.grass_block_id;
                        if(op.second_grass_block_id && dist_percent * d2 > op.second_grass_block_threshold) {
                            block_id = op.second_grass_block_id;
                        }
                        // проплешины с камнем
                        if(d3 * dist_percent > .1 && !op.is_plain) {
                            // dist_percent влияет на то, что чем ближе к краю области, тем проплешин меньше,
                            // чтобы они плавно сходили на нет и не было заметно резких границ каменных проплешин
                            block_id = stone_block_id;
                        } else {
                            // если это самый первый слой поверхности
                            if(not_air_count == 0) {
                                // если это не под водой
                                if(xyz.y > WATER_LEVEL + (dirt_level + 2) * 1.15) {
                                    // растения
                                    let r = rnd.double();
                                    let plant_id = grass_id;
                                    if(r < .5) {
                                        if(block_id == BLOCK.PODZOL.id) {
                                            if(r < .005) {
                                                plant_id = BLOCK.DEAD_BUSH.id;
                                            } else {
                                                plant_id = null;
                                            }
                                        } else {
                                            if(d4 < .5) {
                                                //
                                                if(r < .1) {
                                                    plant_id = BLOCK.TALL_GRASS.id;
                                                    chunk.setBlockIndirect(x, y + 2, z, plant_id, null, {is_head: true});
                                                }
                                            } else {
                                                if(r < .1) {
                                                    plant_id = r < .03 ? BLOCK.RED_TULIP.id : BLOCK.OXEYE_DAISY.id;
                                                }
                                            }
                                        }
                                        if(plant_id) {
                                            chunk.setBlockIndirect(x, y + 1, z, plant_id);
                                        }
                                    }
                                } else {
                                    block_id = dirt_pattern < .0 ? BLOCK.GRAVEL.id : BLOCK.SAND.id;
                                    if(dirt_pattern < -.3) {
                                        block_id = xyz.y < WATER_LEVEL ? dirt_block_id : grass_block_id;
                                    }
                                    if(xyz.y >= WATER_LEVEL) {
                                        block_id = BLOCK.SAND.id
                                    }
                                }
                            } else {
                                // dirt_level динамическая толщина дерна
                                block_id = not_air_count < dirt_level * 4 ? dirt_block_id : stone_block_id;
                            }
                        }
                        chunk.setBlockIndirect(x, y, z, block_id);
                        if(block_id == grass_block_id) {
                            if(xyz.y >= WATER_LEVEL && x > 7 && x < 11 && z > 7 && z < 11 && !tree_pos) {
                                tree_pos = new Vector(x, y + 1, z);
                            }
                        }
                        not_air_count++;

                    } else {
                        not_air_count = 0;
                        if(xyz.y <= WATER_LEVEL) {
                            chunk.setBlockIndirect(x, y, z, water_id);
                        }
                    }

                }
            }
        }

        // Plant trees
        if(tree_pos && tree_pos.y < 32) {
            let type = { "percent": 0.99, "trunk": 3, "leaves": 233, "style": "wood", "height": { "min": 4, "max": 8 } };
            const r = rnd.double();
            if(r < .05) {
                // type = {"trunk": BLOCK.MUSHROOM_STEM.id, "leaves": BLOCK.RED_MUSHROOM_BLOCK.id, "style": 'mushroom', "height": {"min": 5, "max": 12}};
            } else if(r < .5) {
                type = {"trunk": BLOCK.BIRCH_LOG.id, "leaves": BLOCK.BIRCH_LEAVES.id, "style": 'wood', "height": {"min": 4, "max": 8}};
            } else if(r < .55) {
                type = {"trunk": BLOCK.MOSS_STONE.id, "leaves": null, "style": 'tundra_stone', "height": {"min": 2, "max": 2}};
            }
            const tree_height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
            this.plantTree({
                    "biome_code": "TROPICAL_SEASONAL_FOREST", "pos": tree_pos, "height": tree_height, "rad": 3,
                    type
                },
                chunk,
                tree_pos.x, tree_pos.y, tree_pos.z,
                true
            );
        }

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        // Dungeon
        this.dungeon.add(chunk);

        // Cluster
        // chunk.cluster.fillBlocks(this.maps, chunk, map);

        return map;

    }

    //
    generateMap(chunk) {
        const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: new Default_Terrain_Map_Cell({
            code: 'Flat'
        })};
        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63000},
            Array(chunk.size.x * chunk.size.z).fill(cell)
        );
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
        const seed = this.seed_int + this.noise2d(center_x / RAD, center_z / RAD) * 1000000;

        // базовые кривизна рельефа и высота поверхности
        let op                  = MAP_PRESETS.norm;
        let relief              = op.relief;
        let mid_level           = op.mid_level;

        // частичное занижение общего уровня, чтобы равнины становились ближе к воде
        let deform_mid_level = this.noise3d(xyz.x/500, xyz.z/500, this.seed_int) * 6 + 1;
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
        const deformation = this.noise3d(x * frequency, y * frequency, seed) + 1;
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

        return {relief, mid_level, radius, dist, op}

    }

}