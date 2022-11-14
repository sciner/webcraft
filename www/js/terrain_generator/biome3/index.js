import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Helpers, IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {noise, alea, Default_Terrain_Map, Default_Terrain_Map_Cell} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";
// import {DungeonGenerator} from "../dungeon.js";
// import FlyIslands from "../flying_islands/index.js";
import {DungeonGenerator} from "../dungeon.js";

// import { AABB } from '../../core/AABB.js';
import Demo_Map from "./demo_map.js";
import { CaveGenerator } from "../cave_generator.js";
// import BottomCavesGenerator from "../bottom_caves/index.js";

// Randoms
const randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
const a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

const MAP_PRESETS = {
    // relief - кривизна рельефа
    // mid_level - базовая высота поверхности
    min: {relief: 48, mid_level: 8, grass_block_id: BLOCK.GRASS_BLOCK.id},
    norm: {relief: 4, mid_level: 8, is_plain: true, grass_block_id: BLOCK.GRASS_BLOCK.id},
    max: {relief: 128, mid_level: 24, grass_block_id: BLOCK.GRASS_BLOCK.id}
};

// Terrain generator class
export default class Terrain_Generator extends Demo_Map {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        // this._createBlockAABB = new AABB();
        // this._createBlockAABB_second = new AABB();
        // this.temp_set_block = null;
        // this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
        // this.bottomCavesGenerator = new BottomCavesGenerator(seed, world_id, {});
        this.dungeon = new DungeonGenerator(seed);
        this._center = new Vector(0, 0, 0);
    }

    async init() {
        await super.init();
        this.options        = {...GENERATOR_OPTIONS, ...this.options};
        // this.temp_vec       = new Vector(0, 0, 0);
        this.noise2d        = noise.simplex2;
        this.noise3d        = noise.simplex3;
        this.maps           = new TerrainMapManager(this.seed, this.world_id, this.noise2d, this.noise3d);
    }

    // Draw fly islands in the sky
    drawFlyIslands(chunk) {
        if(!this.flying_islands) {
            return null;
        }
        const xyz = new Vector(0, 0, 0);
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

        const seed                      = chunk.id;
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

        let not_air_count = -1;
        let tree_pos = null;

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                // абсолютные координаты в мире
                xyz.set(chunk.coord.x + x, 0, chunk.coord.z + z);

                const dirt_level = noise2d(xyz.x / 16, xyz.z / 16); // динамическая толщина дерна
                const river_tunnel = noise2d(xyz.x / 256, xyz.z / 256) / 2 + .5;
                const {relief, mid_level, radius, dist, op} = this.getPreset(xyz);

                //
                const dirt_pattern = dirt_level;
                const river_point = new Vector(Math.round(xyz.x / 1000) * 1000, WATER_LEVEL, xyz.z);

                for(let y = size_y; y >= 0; y--) {

                    xyz.y = chunk.coord.y + y;

                    const d1 = noise3d(xyz.x/100, xyz.y / 100, xyz.z/100);
                    const d2 = noise3d(xyz.x/50, xyz.y / 50, xyz.z/50);
                    const d3 = noise3d(xyz.x/25, xyz.y / 25, xyz.z/25);
                    const d4 = noise3d(xyz.x/12.5, xyz.y / 12.5, xyz.z/12.5);

                    // waterfront/берег
                    const under_waterline = xyz.y < WATER_LEVEL;
                    const under_waterline_density = under_waterline ? 1.025 : 1; // немного пологая часть суши в части находящейся под водой в непосредственной близости к берегу
                    const h = (1 - (xyz.y - mid_level * 2 - WATER_LEVEL) / relief) * under_waterline_density; // уменьшение либо увеличение плотности в зависимости от высоты над/под уровнем моря (чтобы выше моря суша стремилась к воздуху, а ниже уровня моря к камню)

                    // rivers/реки
                    const river_vert_dist = xyz.y - river_point.y;
                    const tunnel_density = river_tunnel;
                    const river_vert_density = Math.max(-.5, river_vert_dist * tunnel_density * Math.PI); // чем выше, тем больше воздуха вокруг реки
                    const river_density = Math.min(river_point.distance(xyz) / (10 + river_vert_density), 1);

                    const density = (
                            ((d1 * 64 + d2 * 32 + d3 * 16 + d4 * 8) / (64 + 32 + 16 + 8))
                            / 2 + .5
                        ) * h * river_density;

                    if(density > .6) {
                        let block_id = op.grass_block_id;
                        if(d3 > .2 && !op.is_plain) {
                            // проплешины камня
                            block_id = stone_block_id;
                        } else {
                            // если это самый первый слой поверхности
                            if(not_air_count == 0) {
                                // если это не под водой
                                if(xyz.y > WATER_LEVEL + (dirt_level + 1) * 1.15) {
                                    let r = rnd.double();
                                    let plant_id = grass_id;
                                    if(r < .5) {
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
                                        chunk.setBlockIndirect(x, y + 1, z, plant_id);
                                    }
                                } else {
                                    block_id = dirt_pattern < .0 ? BLOCK.GRAVEL.id : BLOCK.SAND.id;
                                    if(dirt_pattern < -.3) {
                                        block_id = xyz.y < WATER_LEVEL ? dirt_block_id : grass_block_id;
                                    }
                                }
                            } else {
                                // dirt_level динамическая толщина дерна
                                block_id = not_air_count < dirt_level * 3 ? dirt_block_id : stone_block_id;
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

        return this.generateMap(chunk);

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

        // радиус области
        const RAD = 1024;
        const TRANSITION_WIDTH = 64; // ширина перехода межу обалстью и равниной

        // базовые кривизна рельефа и высота поверхности
        let op          = MAP_PRESETS.norm;
        let relief      = op.relief;
        let mid_level   = op.mid_level;

        // центр области
        const cx = Math.round(xyz.x / RAD) * RAD;
        const cz = Math.round(xyz.z / RAD) * RAD;

        // угол к центру области
        const angle = this.angleTo(xyz, cx, cz);

        // Формируем неровное очертание области вокруг его центра
        // https://www.benfrederickson.com/flowers-from-simplex-noise/
        const circle_radius = RAD * 0.28;
        const frequency = 2.15;
        const magnitude = .5;
        // Figure out the x/y coordinates for the given angle
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        // Randomly deform the radius of the circle at this point
        const deformation = this.noise3d(x * frequency, y * frequency, 9999) + 1;
        const radius = circle_radius * (1 + magnitude * deformation);
        const max_dist = radius;

        // Расстояние до центра области
        let lenx = cx - xyz.x;
        let lenz = cz - xyz.z;
        const dist = Math.sqrt(lenx * lenx + lenz * lenz);

        if((dist < max_dist)) {
            const perc = 1 - Math.min( Math.max((dist - (max_dist - TRANSITION_WIDTH)) / TRANSITION_WIDTH, 0), 1);
            const perc_side = this.noise2d(cx / 1024, cz / 1024);
            // выбор типа области настроек
            op = perc_side < .35 ? MAP_PRESETS.min : MAP_PRESETS.max;
            relief += ( (op.relief - MAP_PRESETS.norm.relief) * perc);
            mid_level += ((op.mid_level - MAP_PRESETS.norm.mid_level) * perc);
        }

        return {relief, mid_level, radius, dist, op}

    }

}