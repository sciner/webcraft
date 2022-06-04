import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../../chunk.js";
import {Vector} from '../../helpers.js';
import {CubeSym} from '../../core/CubeSym.js';
import {BLOCK} from '../../blocks.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {Default_Terrain_Generator, noise, alea} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";

import { AABB } from '../../core/AABB.js';

const DEFAULT_CHEST_ROTATE = new Vector(3, 1, 0);

const sides = [
    new Vector(1, 0, 0),
    new Vector(-1, 0, 0),
    new Vector(0, 1, 0),
    new Vector(0, -1, 0),
    new Vector(0, 0, 1),
    new Vector(0, 0, -1)
];

const rotates = [
    new Vector(CubeSym.ROT_Z, 0, 0),
    new Vector(CubeSym.ROT_Z3, 0, 0),
    new Vector(CubeSym.NEG_Y, 0, 0),
    new Vector(CubeSym.ROT_Y3, 0, 0),
    new Vector(CubeSym.ROT_X, 0, 0),
    new Vector(CubeSym.ROT_X3, 0, 0)
];

// Randoms
let randoms = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
let a = new alea('random_plants_position');
for(let i = 0; i < randoms.length; i++) {
    randoms[i] = a.double();
}

//
const vox_templates             = {};

//
const ABS_CONCRETE              = 16;
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this._createBlockAABB = new AABB();
        this._createBlockAABB_second = new AABB();
        this.temp_set_block = null;
        this.OCEAN_BIOMES = ['OCEAN', 'BEACH', 'RIVER'];
    }

    async init() {
        // Настройки
        this.options                = {...GENERATOR_OPTIONS, ...this.options};
        this.temp_vec               = new Vector(0, 0, 0);
        //
        this.noisefn                = noise.perlin2;
        this.noisefn3d              = noise.perlin3;
        // Сaves manager
        this.islands                = [];
        this.extruders              = [];
        //
        this.maps                   = new TerrainMapManager(this.seed, this.world_id, this.noisefn, this.noisefn3d);
        // Map specific
        if(this.world_id == 'demo') {
            await this.generateDemoMapStructures();
        }
    }

    // Map specific
    async generateDemoMapStructures() {
        // Костыль для NodeJS
        let root_dir = '../www';
        if(typeof process === 'undefined') {
            root_dir = '';
        }
        await Vox_Loader.load(root_dir + '/data/vox/monu10.vox', (chunks) => {
            let palette = {
                81: BLOCK.CONCRETE,
                97: BLOCK.OAK_PLANK,
                121: BLOCK.STONE_BRICK,
                122: BLOCK.SMOOTH_STONE,
                123: BLOCK.GRAVEL,
            };
            vox_templates.monu10 = {chunk: chunks[0], palette: palette};
        });
        await Vox_Loader.load(root_dir + '/data/vox/castle.vox', (chunks) => {
            let palette = {
                93: BLOCK.GRAVEL,
                106: BLOCK.STONE_BRICK,
                114: BLOCK.CONCRETE,
                72: BLOCK.GRASS_DIRT,
                235: BLOCK.POWDER_SNOW,
                54: BLOCK.SPRUCE_PLANK,
                150: BLOCK.OAK_LEAVES,
                139: BLOCK.OAK_LEAVES,
                58: BLOCK.OAK_TRUNK,
                107: BLOCK.GRASS_DIRT,
                144: BLOCK.OAK_LEAVES,
                143: BLOCK.GRASS_DIRT,
                253: BLOCK.OAK_PLANK,
                238: BLOCK.SPRUCE_PLANK,
                79: BLOCK.BIRCH_PLANK,
                184: BLOCK.GRASS_DIRT,
                174: BLOCK.GRASS_DIRT,
            };
            vox_templates.castle = {chunk: chunks[0], palette: palette};
        });
        this.voxel_buildings.push(new Vox_Mesh(vox_templates.monu10, new Vector(2840, 58, 2830), new Vector(0, 0, 0), null, null));
        this.voxel_buildings.push(new Vox_Mesh(vox_templates.castle, new Vector(2980, 70, 2640), new Vector(0, 0, 0), null, new Vector(0, 1, 0)));
        this.islands.push({
            pos: new Vector(2865, 118, 2787),
            rad: 15
        });
        this.islands.push({
            pos: new Vector(2920, 1024, 2787),
            rad: 20
        });
        this.extruders.push({
            pos: this.islands[0].pos.sub(new Vector(0, 50, 0)),
            rad: this.islands[0].rad
        });
    }

    // Generate
    generate(chunk) {

        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        const maps                      = this.maps.generateAround(chunk, chunk.addr, true, true);
        const map                       = maps[4];
        const cluster                   = chunk.cluster;

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {
            this.generateBottomCaves(chunk, aleaRandom);
            return map;
        }

        const xyz                       = new Vector(0, 0, 0);
        const temp_vec                  = new Vector(0, 0, 0);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        const BLOCK_WATER_ID            = BLOCK.STILL_WATER.id;
        const ywl                       = map.options.WATER_LINE - chunk.coord.y;
        const plant_pos                 = new Vector(0, 0, 0);
        
        let plant_index = 0;

        const has_voxel_buildings       = this.intersectChunkWithVoxelBuildings(chunk.aabb);
        const has_islands               = this.intersectChunkWithIslands(chunk.aabb);
        const has_extruders             = this.intersectChunkWithExtruders(chunk.aabb);
        const has_spiral_staircaes      = this.world_id == 'demo' && chunk.addr.x == 180 && chunk.addr.z == 174;

        if(has_spiral_staircaes) {
            this.drawSpiralStaircases(chunk);
        }

        //
        for(let x = 0; x < size_x; x++) {
            for(let z = 0; z < size_z; z++) {

                xyz.set(x + chunk.coord.x, chunk.coord.y, z + chunk.coord.z);

                const cell              = map.cells[z * CHUNK_SIZE_X + x];
                const biome             = cell.biome;
                const value             = cell.value2;
                const rnd               = aleaRandom.double();
                const local_dirt_level  = value - (rnd < .005 ? 1 : 3);
                const in_ocean          = this.OCEAN_BIOMES.indexOf(biome.code) >= 0;
                const dirt_block        = cell.dirt_block_id;
                const has_ocean_blocks  = biome.code == 'OCEAN' && ywl >= 0;
                const has_cluster       = !cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2);

                if(!has_ocean_blocks && chunk.coord.y > value && !has_voxel_buildings && !has_islands && !has_extruders) {
                    continue;
                }

                for(let y = 0; y < size_y; y++) {

                    xyz.y = chunk.coord.y + y;

                    // Draw voxel buildings
                    if(has_voxel_buildings && this.drawBuilding(xyz, x, y, z, chunk)) {
                        continue;
                    }

                    // Islands
                    if(has_islands && this.drawIsland(xyz, x, y, z, chunk)) {
                        continue;
                    }

                    // Remove volume from terrain
                    if(has_extruders && this.extrude(xyz)) {
                        continue;
                    }

                    // Exit
                    if(xyz.y >= value) {
                        continue;
                    }

                    // Clusters
                    const cluster_padding = 5;
                    const cellIsOccupied = has_cluster &&
                        (xyz.y > value - cluster_padding && xyz.y < value + 1);

                    // Caves | Пещеры
                    if(!cellIsOccupied) {
                        const caveDensity = map.caves.getPoint(xyz, cell, in_ocean);
                        if(caveDensity !== null) {
                            continue;
                        }
                    }

                    // this.drawTreasureRoom(chunk, line, xyz, x, y, z);

                    // Ores (if this is not water, fill by ores)
                    let block_id = dirt_block;
                    if(xyz.y < local_dirt_level) {
                        block_id = map.ores.get(xyz, value);
                    }
                    chunk.setBlockIndirect(x, y, z, block_id);

                    // Plants
                    if(block_id == dirt_block && xyz.y == value - 1) {
                        plant_pos.x = x;
                        plant_pos.z = z;
                        plant_pos.y = xyz.y + 1;
                        const plant = map.plants.get(plant_pos);
                        if(plant) {
                            const block_id = plant.id;
                            const extra_data = plant.extra_data || null;
                            plant_pos.y -= chunk.coord.y;
                            if(plant_index++ % 7 == 0 && plant_pos.y < CHUNK_SIZE_Y - 2 && block_id == BLOCK.GRASS.id) {
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y, plant_pos.z, BLOCK.TALL_GRASS.id);
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y + 1, plant_pos.z, BLOCK.TALL_GRASS_TOP.id);
                            } else {
                                chunk.setBlockIndirect(plant_pos.x, plant_pos.y, plant_pos.z, block_id, null, extra_data);
                            }
                        }
                    }

                }

                // `Y` of waterline
                if(has_ocean_blocks) {
                    temp_vec.set(x, 0, z);
                    for(let y = value; y <= map.options.WATER_LINE; y++) {
                        if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = y - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK_WATER_ID);
                        }
                    }
                    if(cell.equator < .6 && cell.humidity > .4) {
                        const vl = map.options.WATER_LINE;
                        if(vl >= chunk.coord.y && vl < chunk.coord.y + chunk.size.y) {
                            temp_vec.y = vl - chunk.coord.y;
                            chunk.setBlockIndirect(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.ICE.id);
                        }
                    }
                }

            }
        }

        if(!chunk.cluster.is_empty) {
            chunk.cluster.fillBlocks(this.maps, chunk, map);
        }

        // Plant trees
        for(let i = 0; i < maps.length; i++) {
            const m = maps[i];
            for(let j = 0; j < m.trees.length; j++) {
                const tree = m.trees[j];
                this.plantTree(
                    tree,
                    chunk,
                    m.chunk.coord.x + tree.pos.x - chunk.coord.x,
                    m.chunk.coord.y + tree.pos.y - chunk.coord.y,
                    m.chunk.coord.z + tree.pos.z - chunk.coord.z
                );
            }
        }

        // Mines
        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        return map;

    }

    // Генерация пещер нижнего мира
    generateBottomCaves(chunk, aleaRandom) {

        const noise3d               = noise.simplex3;
        let xyz                     = new Vector(0, 0, 0);
        let xyz_stone_density       = new Vector(0, 0, 0);
        let DENSITY_COEFF           = 1;
        let fill_count              = 0;

        const { cx, cy, cz, cw, tblocks } = chunk;
        //
        const getBlock = (x, y, z) => {
            const index = cx * x + cy * y + cz * z + cw;
            return tblocks.id[index];
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {

            for(let z = 0; z < chunk.size.z; z++) {

                let y_start                 = Infinity;
                let stalactite_height       = 0;
                let stalactite_can_start    = false;
                let dripstone_allow         = true;

                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                    let density = (
                        noise3d(xyz.x / (100 * DENSITY_COEFF), xyz.y / (15 * DENSITY_COEFF), xyz.z / (100 * DENSITY_COEFF)) / 2 + .5 +
                        noise3d(xyz.x / (20 * DENSITY_COEFF), xyz.y / (20 * DENSITY_COEFF), xyz.z / (20 * DENSITY_COEFF)) / 2 + .5
                    ) / 2;

                    if(xyz.y > -ABS_CONCRETE) {
                        const dist = xyz.y / -ABS_CONCRETE + .2;
                        density += dist;
                    }

                    // air
                    if(density < 0.5) {
                        if(stalactite_can_start) {
                            const humidity = noise3d(xyz.x / 80, xyz.z / 80, xyz.y / 80) / 2 + .5;
                            if(y_start == Infinity) {
                                // start stalactite
                                y_start = y;
                                stalactite_height = 0;
                                // MOSS_BLOCK
                                if(humidity > MOSS_HUMIDITY) {
                                    chunk.setBlockIndirect(x, y + 1, z, BLOCK.MOSS_BLOCK.id);
                                    dripstone_allow = false;
                                }
                            } else {
                                stalactite_height++;
                                if(stalactite_height >= 5) {
                                    // Moss and vine
                                    if(humidity > MOSS_HUMIDITY) {
                                        if(stalactite_height == 5 + Math.round((humidity - MOSS_HUMIDITY) * (1 / MOSS_HUMIDITY) * 20)) {
                                            if(aleaRandom.double() < .3) {
                                                for(let yy = 0; yy < stalactite_height; yy++) {
                                                    let vine_id = null;
                                                    if(yy == stalactite_height - 1) {
                                                        vine_id = BLOCK.CAVE_VINE_PART3.id + (x + z + y + yy) % 2;
                                                    } else {
                                                        vine_id = BLOCK.CAVE_VINE_PART1.id + (aleaRandom.double() < .2 ? 1 : 0);
                                                    }
                                                    chunk.setBlockIndirect(x, y_start - yy, z, vine_id);
                                                }
                                            }
                                            // reset stalactite
                                            y_start = Infinity;
                                            stalactite_height = 0;
                                            stalactite_can_start = false;
                                        }
                                    } else if(dripstone_allow) {
                                        // Dripstone
                                        if(aleaRandom.double() < .3) {
                                            chunk.setBlockIndirect(x, y_start - 0, z, BLOCK.DRIPSTONE.id);
                                            chunk.setBlockIndirect(x, y_start - 1, z, BLOCK.DRIPSTONE2.id);
                                            chunk.setBlockIndirect(x, y_start - 2, z, BLOCK.DRIPSTONE3.id);
                                        }
                                        // reset stalactite
                                        y_start = Infinity;
                                        stalactite_height = 0;
                                        stalactite_can_start = false;
                                    }
                                }
                            }
                        }
                        continue;
                    }

                    let stone_block_id = BLOCK.CONCRETE.id;
                    xyz_stone_density.set(xyz.x + 100000, xyz.y + 100000, xyz.z + 100000);
                    let stone_density = noise3d(xyz_stone_density.x / 20, xyz_stone_density.z / 20, xyz_stone_density.y / 20) / 2 + .5;

                    if(stone_density < .025) {
                        stone_block_id = BLOCK.GLOWSTONE.id;
                    } else {
                        if(stone_density > 0.5) {
                            if(stone_density < 0.66) {
                                stone_block_id = BLOCK.DIORITE.id;
                            } else if(stone_density < 0.83) {
                                stone_block_id = BLOCK.ANDESITE.id;
                            } else {
                                stone_block_id = BLOCK.GRANITE.id;
                            }
                        } else {
                            let density_ore = noise3d(xyz.y / 10, xyz.x / 10, xyz.z / 10) / 2 + .5;
                            // 0 ... 0.06
                            if(stone_density < 0.06) {
                                stone_block_id = BLOCK.DIAMOND_ORE.id;
                            // 0.06 ... 0.1
                            } else if (density_ore < .1) {
                                stone_block_id = BLOCK.COAL_ORE.id;
                            // 0.1 ... 0.3
                            } else if (density_ore > .3) {
                                stone_block_id = BLOCK.DRIPSTONE_BLOCK.id;
                            // 0.85 ...1
                            } else if (density_ore > .85) {
                                stone_block_id = BLOCK.COAL_ORE.id;
                            }
                        }
                    }

                    chunk.setBlockIndirect(x, y, z, stone_block_id);

                    // reset stalactite
                    stalactite_can_start    = stone_block_id == BLOCK.DRIPSTONE_BLOCK.id;
                    y_start                 = Infinity;
                    stalactite_height       = 0;

                    fill_count++;

                }
            }
        }

        // Amethyst room
        if(fill_count > CHUNK_SIZE * .7) {
            let chance = aleaRandom.double();
            if(chance < .25) {
                const room_pos = new Vector(chunk.size).divScalar(2);
                let temp_vec_amethyst = new Vector(0, 0, 0);
                let temp_ar_vec = new Vector();
                let rad = chance * 4;
                room_pos.y += Math.round((rad - 0.5) * 10);
                for(let x = 0; x < chunk.size.x; x++) {
                    for(let z = 0; z < chunk.size.z; z++) {
                        for(let y = chunk.size.y - 1; y >= 0; y--) {
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist <= AMETHYST_ROOM_RADIUS) {
                                if(dist > AMETHYST_ROOM_RADIUS - 1.5) {
                                    let b = getBlock(x, y, z);
                                    if(b == 0) {
                                        // air
                                        continue;
                                    } else if (dist >= AMETHYST_ROOM_RADIUS - 1.42) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK.AMETHYST.id);
                                    }
                                } else {
                                    chunk.setBlockIndirect(x, y, z, BLOCK.AIR.id);
                                }
                            }
                        }
                    }
                }
                // Set amethyst clusters
                let y_start = Math.max(room_pos.y - AMETHYST_ROOM_RADIUS, 1);
                let y_end = Math.min(room_pos.y + AMETHYST_ROOM_RADIUS, chunk.size.y - 2);
                for(let x = 1; x < chunk.size.x - 1; x++) {
                    for(let z = 1; z < chunk.size.z - 1; z++) {
                        for(let y = y_start; y < y_end; y++) {
                            let rnd = aleaRandom.double();
                            if(rnd > AMETHYST_CLUSTER_CHANCE) {
                                continue;
                            }
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist < AMETHYST_ROOM_RADIUS - 1.5) {
                                if(getBlock(x, y, z) == 0) {
                                    let set_vec     = null;
                                    let attempts    = 0;
                                    let rotate      = null;
                                    while(!set_vec && ++attempts < 5) {
                                        let i = Math.round(rnd * 10 * 5 + attempts) % 5;
                                        temp_ar_vec.set(x + sides[i].x, y + sides[i].y, z + sides[i].z);
                                        let b = getBlock(temp_ar_vec.x, temp_ar_vec.y, temp_ar_vec.z);
                                        if(b != 0 && b != BLOCK.AMETHYST_CLUSTER.id) {
                                            set_vec = sides[i];
                                            rotate = rotates[i];
                                        }
                                    }
                                    if(set_vec) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK.AMETHYST_CLUSTER.id, rotate);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

    }

    //
    intersectChunkWithVoxelBuildings(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.voxel_buildings.length; i++) {
            const item = this.voxel_buildings[i];
            _createBlockAABB_second.set(
                item.coord.x - item.size.x,
                item.coord.y - item.size.y,
                item.coord.z - item.size.z,
                item.coord.x + item.size.x,
                item.coord.y + item.size.y,
                item.coord.z + item.size.z
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    //
    intersectChunkWithIslands(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.islands.length; i++) {
            const item = this.islands[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // extruders
    intersectChunkWithExtruders(chunkAABB) {
        const _createBlockAABB_second = this._createBlockAABB_second;
        for (let i = 0; i < this.extruders.length; i++) {
            const item = this.extruders[i];
            const rad = item.rad;
            _createBlockAABB_second.set(
                item.pos.x - rad,
                item.pos.y - rad,
                item.pos.z - rad,
                item.pos.x + rad,
                item.pos.y + rad,
                item.pos.z + rad
            );
            if(chunkAABB.intersect(_createBlockAABB_second)) {
                return true;
            }
        }
        return false;
    }

    // Endless spiral staircase
    drawSpiralStaircases(chunk) {
        for(let y = 0; y < chunk.size.y; y += .25) {
            let y_abs = y + chunk.coord.y;
            let y_int = parseInt(y);
            let x = 8 + parseInt(Math.sin(y_abs / Math.PI) * 6);
            let z = 8 + parseInt(Math.cos(y_abs / Math.PI) * 6);
            let block = BLOCK.BEDROCK;
            if(y >= 1) {
                chunk.setBlockIndirect(x, y_int - 1, z, block.id);
            }
            if(y_abs % 16 == 1) {
                block = BLOCK.GOLD;
            }
            if(y_abs % 32 == 1) {
                block = BLOCK.DIAMOND_ORE;
            }
            chunk.setBlockIndirect(x, y_int, z, block.id);
        }
    }

    // drawBuilding...
    drawBuilding(xyz, x, y, z, chunk) {
        let vb = this.getVoxelBuilding(xyz);
        if(vb) {
            let block = vb.getBlock(xyz);
            if(block) {
                chunk.setBlockIndirect(x, y, z, block.id);
            }
            return true;
        }
        return false;
    }

    // drawIsland
    drawIsland(xyz, x, y, z, chunk) {
        for (let i = 0; i < this.islands.length; i++) {
            const island = this.islands[i];
            let dist = xyz.distance(island.pos);
            if(dist < island.rad) {
                if(xyz.y < island.pos.y) {
                    if(xyz.y < island.pos.y - 3) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.CONCRETE.id);
                        return true;
                    } else {
                        if(dist < island.rad * 0.9) {
                            chunk.setBlockIndirect(x, y, z, BLOCK.CONCRETE.id);
                            return true;
                        } else {
                            chunk.setBlockIndirect(x, y, z, BLOCK.GRASS_DIRT.id);
                            return true;
                        }
                    }
                }
                break;
            }
        }
        return false;
    }

    // extrude
    extrude(xyz) {
        for (let i = 0; i < this.extruders.length; i++) {
            const extruder = this.extruders[i];
            if(xyz.distance(extruder.pos) < extruder.rad) {
                return true;
            }
        }
        return false;
    }

    // getTreasureRoomMat
    getTreasureRoomMat(xyz, is_floor, level) {
        if(!is_floor && level == 0) {
            return BLOCK.LODESTONE.id;
        }
        let rb = randoms[Math.abs(xyz.x + xyz.y + xyz.z) % randoms.length];
        if(rb < .2) {
            return BLOCK.MOSS_BLOCK.id;
        } else if (rb < .8) {
            return BLOCK.STONE_BRICK.id;
        } else {
            return BLOCK.MOSSY_STONE_BRICKS.id;
        }
    }

    // drawTreasureRoom...
    drawTreasureRoom(chunk, line, xyz, x, y, z) {
        if(xyz.y < line.p_start.y || xyz.y == line.p_start.y + Math.round(line.rad) - 1) {
            chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, true));
        } else {
            if(
                // long walls
                (xyz.z == line.p_start.z + Math.floor(line.rad)) ||
                (xyz.z == line.p_end.z - Math.floor(line.rad)) ||
                // short walls
                (xyz.x == line.p_end.x + Math.floor(line.rad)) ||
                (xyz.x == line.p_start.x - Math.floor(line.rad))
            ) {
                chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
            } else if (xyz.x == line.p_start.x - Math.floor(line.rad) + 7) {
                // 3-th short wall with door
                if(xyz.z != line.p_start.z || (xyz.z == line.p_start.z && xyz.y > line.p_start.y + 2)) {
                    chunk.setBlockIndirect(x, y, z, this.getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
                } else {
                    // iron bars over door
                    if(xyz.y == line.p_start.y + 2) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.IRON_BARS.id);
                    }
                }
            }
            if(xyz.y == line.p_start.y) {
                // chest
                if(xyz.z == line.p_start.z) {
                    let cx = Math.round((line.p_start.x + line.p_end.x) / 2) - 6;
                    if(xyz.x == cx) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.CHEST.id, DEFAULT_CHEST_ROTATE, {generate: true, params: {source: 'treasure_room'}});
                    }
                    if(xyz.x == cx + 3) {
                        chunk.setBlockIndirect(x, y, z, BLOCK.MOB_SPAWN.id, DEFAULT_CHEST_ROTATE);
                    }
                }
            }
        }
    }

}