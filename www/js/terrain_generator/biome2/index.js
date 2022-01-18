import {CHUNK_BLOCKS, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Vector, Helpers, VectorCollector} from '../../helpers.js';
import {CubeSym} from '../../core/CubeSym.js';
import {BLOCK} from '../../blocks.js';
import {Map} from './../map.js';
import {MapCell} from './../map_cell.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import {Default_Terrain_Generator, noise, alea} from "../default.js";

import {CaveGenerator} from '../caves.js';
import {BIOMES} from "../biomes.js";
import { AABB } from '../../core/AABB.js';

//
let vox_templates = {};
const ABS_CONCRETE              = 16;
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;

// Terrain generator class
export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super(seed, world_id);
        this._createBlockAABB = new AABB();
        this._createBlockAABB_second = new AABB();
        this.temp_set_block = null;
        this.OCEAN_BIOMES = ['OCEAN', 'BEACH'];
    }

    async init() {
        const scale                 = .5;
        // Настройки
        this.options = {
            WATER_LINE:             63, // Ватер-линия
            SCALE_EQUATOR:          1280 * scale, // Масштаб для карты экватора
            SCALE_BIOM:             640  * scale, // Масштаб для карты шума биомов
            SCALE_HUMIDITY:         320  * scale, // Масштаб для карты шума влажности
            SCALE_VALUE:            250  * scale // Масштаб шума для карты высот
        };
        //
        this.noisefn                = noise.perlin2;
        this.noisefn3d              = noise.perlin3;
        this.maps_cache             = new VectorCollector();
        // Сaves manager
        this.caveManager            = new CaveGenerator(this.seed);
        this.islands                = [];
        this.extruders              = [];
        // Map specific
        if(this.world_id == 'demo') {
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
            await Vox_Loader.load(root_dir + '/data/vox/small_castle.vox', (chunks) => {
                vox_templates.small_castle = {chunk: chunks[0], palette: {}};
            });
            await Vox_Loader.load(root_dir + '/data/vox/castle.vox', (chunks) => {
                let palette = {
                    93: BLOCK.GRAVEL,
                    106: BLOCK.STONE_BRICK,
                    114: BLOCK.CONCRETE,
                    72: BLOCK.DIRT,
                    235: BLOCK.SNOW_BLOCK,
                    54: BLOCK.SPRUCE_PLANK,
                    150: BLOCK.OAK_LEAVES,
                    139: BLOCK.OAK_LEAVES,
                    58: BLOCK.OAK_TRUNK,
                    107: BLOCK.DIRT,
                    144: BLOCK.OAK_LEAVES,
                    143: BLOCK.DIRT,
                    253: BLOCK.OAK_PLANK,
                    238: BLOCK.SPRUCE_PLANK,
                    79: BLOCK.BIRCH_PLANK,
                    184: BLOCK.DIRT,
                    174: BLOCK.DIRT,
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
    }

    // Delete map for unused chunk
    deleteMap(addr) {
        return this.maps_cache.delete(addr);
    }

    // generateMap
    generateMap(chunk, noisefn) {
        let cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }
        const options               = this.options;
        const SX                    = chunk.coord.x;
        const SZ                    = chunk.coord.z;
        // Result map
        let map                     = new Map(chunk, this.options);
        this.caveManager.addSpiral(chunk.addr);
        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let px = SX + x;
                let pz = SZ + z;
                // Высота горы в точке
                let value = noisefn(px / 150, pz / 150, 0) * .4 + 
                    noisefn(px / 1650, pz / 1650) * .1 + // 10 | 1650
                    noisefn(px / 650, pz / 650) * .25 + // 65 | 650
                    noisefn(px / 20, pz / 20) * .05 +
                    noisefn(px / 350, pz / 350) * .5;
                value += noisefn(px / 25, pz / 25) * (4 / 255 * noisefn(px / 20, pz / 20));
                // Влажность
                let humidity = Helpers.clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY) + 0.8) / 2, 0, 1);
                // Экватор
                let equator = Helpers.clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR) + 0.8) / 1, 0, 1);
                // Get biome
                let biome = BIOMES.getBiome((value * 64 + 68) / 255, humidity, equator);
                value = value * biome.max_height + 68;
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
                    // map.cells[x + 1][z + 1] = cell;
                    // map.cells[x + 1][z] = cell;
                    // map.cells[x][z + 1] = cell;
                } catch(e) {
                    debugger;
                }
            }
        }
        // Clear maps_cache
        this.maps_cache.reduce(20000);
        return this.maps_cache.add(chunk.addr, map);
    }

    // generateMaps
    generateMaps(chunk) {
        const noisefn               = this.noisefn;
        let maps                    = [];
        let map                     = null;
        let size                    = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        let rad                     = 1;
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                let addr = chunk.addr.add(new Vector(x, -chunk.addr.y, z));
                const c = {
                    id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
                    blocks: {},
                    seed:   chunk.seed,
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
        // Smooth (for central and part of neighbours)
        if(!map.info.smoothed) {
            map.info.smoothed = true;
            map.info.smooth(this);
            // Generate vegetation
            for(let map of maps) {
                map.info.generateVegetation();
            }
        }
        return maps;
    }

    // Generate
    generate(chunk) {

        let maps                    = this.generateMaps(chunk);
        let map                     = maps[4];
        let xyz                     = new Vector(0, 0, 0);
        let xyz_stone_density       = new Vector(0, 0, 0);
        let temp_vec                = new Vector(0, 0, 0);
        let temp_vec2               = new Vector(0, 0, 0);
        let ppos                    = new Vector(0, 0, 0);

        const noise3d               = noise.simplex3;
        const seed                  = chunk.id;
        const aleaRandom            = new alea(seed);
        let DENSITY_COEFF           = 1;

        // Bedrock
        let min_y = 0;

        //
        const setBlock = (x, y, z, block_id, rotate) => {
            temp_vec2.set(x, y, z);
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            if(rotate) {
                chunk.tblocks.rotate.set(temp_vec2, rotate);
            }
            chunk.tblocks.id[index] = block_id;
        };

        //
        const getBlock = (x, y, z) => {
            temp_vec2.set(x, y, z);
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            return chunk.tblocks.id[index];
        };

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {

            let fill_count = 0;

            //
            for(let x = 0; x < chunk.size.x; x++) {

                // let DENSITY_COEFF_X = Math.sin((chunk.coord.x + x) / 2000 * Math.PI * 2 / 10) + 2;

                for(let z = 0; z < chunk.size.z; z++) {

                    let y_start                 = Infinity;
                    let stalactite_height       = 0;
                    let stalactite_can_start    = false;
                    let dripstone_allow         = true;

                    // let DENSITY_COEFF_Z = Math.sin((chunk.coord.z + z) / 2000 * Math.PI * 2 / 10) + 2;

                    for(let y = chunk.size.y - 1; y >= 0; y--) {

                        xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                        // let DENSITY_COEFF_Y = Math.sin((chunk.coord.y + y) / 500 * Math.PI * 2 / 10) + 2;
                        // let DENSITY_COEFF = (DENSITY_COEFF_X + DENSITY_COEFF_Y + DENSITY_COEFF_Z) / 3;

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
                                        setBlock(x, y + 1, z, BLOCK.MOSS_BLOCK.id);
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
                                                        setBlock(x, y_start - yy, z, vine_id);
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
                                                setBlock(x, y_start - 0, z, BLOCK.DRIPSTONE.id);
                                                setBlock(x, y_start - 1, z, BLOCK.DRIPSTONE2.id);
                                                setBlock(x, y_start - 2, z, BLOCK.DRIPSTONE3.id);
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

                        setBlock(x, y, z, stone_block_id);

                        // reset stalactite
                        stalactite_can_start    = stone_block_id == BLOCK.DRIPSTONE_BLOCK.id;
                        y_start                 = Infinity;
                        stalactite_height       = 0;

                        fill_count++;

                    }
                }
            }

            // Amethyst room
            if(fill_count > CHUNK_BLOCKS * .7) {
                let chance = aleaRandom.double();
                if(chance < .25) {
                    const room_pos = new Vector(chunk.size).divScalar(2);
                    let temp_vec_amethyst = new Vector(0, 0, 0);
                    let sides = [
                        new Vector(1, 0, 0),
                        new Vector(-1, 0, 0),
                        new Vector(0, 1, 0),
                        new Vector(0, -1, 0),
                        new Vector(0, 0, 1),
                        new Vector(0, 0, -1)
                    ];
                    let rotates = [
                        new Vector(CubeSym.ROT_Z, 0, 0),
                        new Vector(CubeSym.ROT_Z3, 0, 0),
                        new Vector(CubeSym.NEG_Y, 0, 0),
                        new Vector(CubeSym.ROT_Y3, 0, 0),
                        new Vector(CubeSym.ROT_X, 0, 0),
                        new Vector(CubeSym.ROT_X3, 0, 0)
                    ];
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
                                            setBlock(x, y, z, BLOCK.AMETHYST.id);
                                        }
                                    } else {
                                        setBlock(x, y, z, BLOCK.AIR.id);
                                    }
                                }
                            }
                        }
                    }
                    // Set clusters
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
                                            setBlock(x, y, z, BLOCK.AMETHYST_CLUSTER.id, rotate);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

        } else {

            //
            this._createBlockAABB.copyFrom({
                x_min: chunk.coord.x,
                x_max: chunk.coord.x + CHUNK_SIZE_X,
                y_min: chunk.coord.y,
                y_max: chunk.coord.y + CHUNK_SIZE_Y,
                z_min: chunk.coord.z,
                z_max: chunk.coord.z + CHUNK_SIZE_Z
            });
    
            // Static objects
            let islands = this.islands;
            let extruders = this.extruders;
    
            // voxel_buildings
            let has_voxel_buildings = false;
            for(var item of this.voxel_buildings) {
                if(this._createBlockAABB.intersect({
                    x_min: item.coord.x,
                    x_max: item.coord.x + item.size.x,
                    y_min: item.coord.y,
                    y_max: item.coord.y + item.size.y,
                    z_min: item.coord.z,
                    z_max: item.coord.z + item.size.z
                })) {
                    has_voxel_buildings = true;
                    break;
                }
            }
    
            // Islands
            let has_islands = false;
            for(let item of this.islands) {
                let rad = item.rad;
                if(this._createBlockAABB.intersect({
                    x_min: item.pos.x - rad,
                    x_max: item.pos.x + rad,
                    y_min: item.pos.y - rad,
                    y_max: item.pos.y + rad,
                    z_min: item.pos.z - rad,
                    z_max: item.pos.z + rad
                })) {
                    has_islands = true;
                    break;
                }
            }
    
            // extruders
            let has_extruders = false;
            for(let item of this.extruders) {
                let rad = item.rad;
                if(this._createBlockAABB.intersect({
                    x_min: item.pos.x - rad,
                    x_max: item.pos.x + rad,
                    y_min: item.pos.y - rad,
                    y_max: item.pos.y + rad,
                    z_min: item.pos.z - rad,
                    z_max: item.pos.z + rad
                })) {
                    has_extruders = true;
                    break;
                }
            }

            // caves
            // Соседние чанки в указанном радиусе, на наличие начала(головы) пещер
            let neighbours_caves = this.caveManager.getNeighbours(chunk.addr);
            let in_chunk_cave_points = [];
            for(let map_cave of neighbours_caves) {
                for(let item of map_cave.points) {
                    let rad = item.rad;
                    if(this._createBlockAABB.intersect({
                        x_min: item.pos.x - rad,
                        x_max: item.pos.x + rad,
                        y_min: item.pos.y - rad,
                        y_max: item.pos.y + rad,
                        z_min: item.pos.z - rad,
                        z_max: item.pos.z + rad
                    })) {
                        in_chunk_cave_points.push(item);
                    }
                }
            }
    
            // Endless spiral staircase
            if(this.world_id == 'demo') {
                if(chunk.addr.x == 180 && chunk.addr.z == 174) {
                    for(let y = min_y; y < chunk.size.y; y += .25) {
                        let y_abs = y + chunk.coord.y;
                        let y_int = parseInt(y);
                        let x = 8 + parseInt(Math.sin(y_abs / Math.PI) * 6);
                        let z = 8 + parseInt(Math.cos(y_abs / Math.PI) * 6);
                        let block = BLOCK.BEDROCK;
                        if(y >= 1) {
                            setBlock(x, y_int - 1, z, block.id);
                        }
                        if(y_abs % 16 == 1) {
                            block = BLOCK.GOLD;
                        }
                        if(y_abs % 32 == 1) {
                            block = BLOCK.DIAMOND_ORE;
                        }
                        setBlock(x, y_int, z, block.id);
                    }
                }
            }

            //
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {

                    const cell              = map.info.cells[x][z];
                    const biome             = cell.biome;
                    const value             = cell.value2;

                    let rnd                 = aleaRandom.double();
                    let local_dirt_level    = value - (rnd < .005 ? 1 : 3);
                    let in_ocean            = this.OCEAN_BIOMES.indexOf(biome.code) >= 0;

                    // Bedrock
                    if(chunk.coord.y == 0) {
                        setBlock(x, 0, z, BLOCK.CONCRETE.id);
                    }

                    for(let y = min_y; y < chunk.size.y; y++) {

                        xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                        // Draw voxel buildings
                        if(has_voxel_buildings) {
                            let vb = this.getVoxelBuilding(xyz);
                            if(vb) {
                                let block = vb.getBlock(xyz);
                                if(block) {
                                    setBlock(x, y, z, block.id);
                                }
                                continue;
                            }
                        }

                        // Islands
                        if(has_islands) {
                            for(let island of islands) {
                                let dist = xyz.distance(island.pos);
                                if(dist < island.rad) {
                                    if(xyz.y < island.pos.y) {
                                        if(xyz.y < island.pos.y - 3) {
                                            setBlock(x, y, z, BLOCK.CONCRETE.id);
                                        } else {
                                            if(dist < island.rad * 0.9) {
                                                setBlock(x, y, z, BLOCK.CONCRETE.id);
                                            } else {
                                                setBlock(x, y, z, BLOCK.DIRT.id);
                                            }
                                        }
                                    }
                                    break;
                                }
                            }
                        }

                        // Remove volume from terrain
                        if(has_extruders) {
                            let need_extrude = false;
                            for(let extruder of extruders) {
                                let dist = xyz.distance(extruder.pos);
                                if(dist < extruder.rad) {
                                    need_extrude = true;
                                    break;
                                }
                                if(need_extrude) {
                                    break;
                                }
                            }
                            if(need_extrude) {
                                continue;
                            }
                        }

                        // Exit
                        if(xyz.y >= value) {
                            continue;
                        }

                        // Caves | Пещеры
                        if(in_chunk_cave_points && !in_ocean) {
                            // Проверка не является ли этот блок пещерой
                            let is_cave_block = false;
                            for(let cave_point of in_chunk_cave_points) {
                                if(xyz.distance(cave_point.pos) < cave_point.rad) {
                                    is_cave_block = true;
                                    break;
                                }
                                if(is_cave_block) {
                                    break;
                                }
                            }
                            // Проверка того, чтобы под деревьями не удалялась земля (в радиусе 5 блоков)
                            if(is_cave_block) {
                                let near_tree = false;
                                const near_rad = 5;
                                // const check_only_current_map = (x >= near_rad && y >= near_rad && z >= near_rad && x < CHUNK_SIZE_X - near_rad &&  y < CHUNK_SIZE_Y - near_rad && z < CHUNK_SIZE_Z - near_rad);
                                for(let m of maps) {
                                    if(m.info.trees.size == 0) continue;
                                    //
                                    this._createBlockAABB.copyFrom({
                                        x_min: m.chunk.coord.x,
                                        x_max: m.chunk.coord.x + CHUNK_SIZE_X,
                                        y_min: m.chunk.coord.y,
                                        y_max: m.chunk.coord.y + CHUNK_SIZE_Y,
                                        z_min: m.chunk.coord.z,
                                        z_max: m.chunk.coord.z + CHUNK_SIZE_Z
                                    });
                                    this._createBlockAABB_second.set(
                                        xyz.x - near_rad,
                                        xyz.y - near_rad - chunk.coord.y,
                                        xyz.z - near_rad,
                                        xyz.x + near_rad,
                                        xyz.y + near_rad - chunk.coord.y,
                                        xyz.z + near_rad
                                    );
                                    if(!this._createBlockAABB.intersect(this._createBlockAABB_second)) {
                                        continue;
                                    }
                                    ppos.set(xyz.x - m.chunk.coord.x, xyz.y - m.chunk.coord.y, xyz.z - m.chunk.coord.z);
                                    for(let tree of m.info.trees) {
                                        if(tree.pos.distance(ppos) < near_rad) {
                                            near_tree = true;
                                            break;
                                        }
                                    }
                                    if(near_tree) {
                                        break;
                                    }
                                }
                                if(!near_tree) {
                                    continue;
                                }
                            }
                        }

                        // Ores (если это не вода, то заполняем полезными ископаемыми)
                        if(xyz.y < local_dirt_level) {
                            temp_vec.set(x, y + 1, z);
                            const has_plant = !map.info.plants.has(temp_vec);
                            let stone_block_id = has_plant ? BLOCK.CONCRETE.id : biome.dirt_block;
                            if(has_plant) {
                                let density = noise3d(xyz.x / 20, xyz.z / 20, xyz.y / 20) / 2 + .5;
                                if(density > 0.5) {
                                    if(density < 0.66) {
                                        stone_block_id = BLOCK.DIORITE.id;
                                    } else if(density < 0.83) {
                                        stone_block_id = BLOCK.ANDESITE.id;
                                    } else {
                                        stone_block_id = BLOCK.GRANITE.id;
                                    }
                                } else if(xyz.y < value - 5) {
                                    let density_ore = noise3d(xyz.y / 10, xyz.x / 10, xyz.z / 10) / 2 + .5;
                                    const DIAMOND_ORE_FREQ = xyz.y < 16 ? (xyz.y < 6 ? 0.06 : 0.04) : 0;
                                    if(density < DIAMOND_ORE_FREQ) {
                                        stone_block_id = BLOCK.DIAMOND_ORE.id;
                                    } else if (density_ore < .1) {
                                        stone_block_id = BLOCK.COAL_ORE.id;
                                    } else if (density_ore > .85) {
                                        stone_block_id = BLOCK.COAL_ORE.id;
                                    }
                                }
                            }
                            setBlock(x, y, z, stone_block_id);
                        } else {
                            setBlock(x, y, z, biome.dirt_block);
                        }

                    }

                    // `Y` of waterline
                    let ywl = map.info.options.WATER_LINE - chunk.coord.y;
                    if(biome.code == 'OCEAN' && ywl >= 0) {
                        for(let y = value; y <= map.info.options.WATER_LINE; y++) {
                            if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                                temp_vec.set(x, y - chunk.coord.y, z);
                                if(!chunk.tblocks.has(temp_vec)) {
                                    setBlock(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.STILL_WATER.id);
                                }
                            }
                        }
                    }

                }
            }

            // Plant trees
            for(const m of maps) {
                for(let p of m.info.trees) {
                    this.plantTree(
                        p,
                        chunk,
                        m.chunk.coord.x + p.pos.x - chunk.coord.x,
                        m.chunk.coord.y + p.pos.y - chunk.coord.y,
                        m.chunk.coord.z + p.pos.z - chunk.coord.z
                    );
                }
            }

            // Plant herbs
            let temp_block = null;
            let idx = 0;
            for(let pos of map.info.plants.keys()) {
                let block_id = map.info.plants.get(pos);
                if(pos.y >= chunk.coord.y && pos.y < chunk.coord.y + CHUNK_SIZE_Y) {
                    xyz.set(pos.x, pos.y - chunk.coord.y - 1, pos.z);
                    temp_block = chunk.tblocks.get(xyz, temp_block);
                    if(temp_block.id === BLOCK.DIRT.id || temp_block.id == 516) {
                        temp_vec.set(pos.x, pos.y - chunk.coord.y, pos.z);
                        if(!chunk.tblocks.has(temp_vec)) {
                            if(idx++ % 7 == 0 && temp_vec.y < CHUNK_SIZE_Y - 2 && block_id == BLOCK.GRASS.id) {
                                setBlock(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.TALL_GRASS.id);
                                setBlock(temp_vec.x, temp_vec.y + 1, temp_vec.z, BLOCK.TALL_GRASS_TOP.id);
                            } else {
                                setBlock(temp_vec.x, temp_vec.y, temp_vec.z, block_id);
                            }
                        }
                    }
                }
            }

        }

        return map;

    }

}