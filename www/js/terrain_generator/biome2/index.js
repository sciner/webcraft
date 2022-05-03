import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../../chunk.js";
import {Vector} from '../../helpers.js';
import {CubeSym} from '../../core/CubeSym.js';
import {BLOCK} from '../../blocks.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import {GENERATOR_OPTIONS, TerrainMapManager} from "../terrain_map.js";
import {Default_Terrain_Generator, noise, alea} from "../default.js";
import {MineGenerator} from "../mine/mine_generator.js";

import {CaveGenerator} from '../caves.js';
import { AABB } from '../../core/AABB.js';

const DEFAULT_CHEST_ROTATE = new Vector(3, 1, 0);

/*
    let arr = new Array(20).fill(0);
    const r = new alea('seed');
    const n = noise.simplex3;
    for(let i = 0; i < 1000; i++) {
        for(let j = 0; j < 1000; j++) {
        // let value = r.double();
        let value = n(i / 150, j / 150, 0);
        value = Math.floor(value * 10) + 10;
        arr[value]++;
        }
    }
    console.log(arr);
*/

// Ores
const ORE_RANDOMS = [
    {max_rad: 2, block_id: BLOCK.DIAMOND_ORE.id, max_y: 32},
    {max_rad: 2, block_id: BLOCK.GOLD_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.REDSTONE_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.IRON_ORE.id, max_y: Infinity},
    {max_rad: 1, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 1, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 2, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity},
    {max_rad: 3, block_id: BLOCK.COAL_ORE.id, max_y: Infinity}
];

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
let vox_templates = {};
const ABS_CONCRETE              = 16;
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;
const _intersection             = new Vector(0, 0, 0);

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
        // Настройки
        this.options                = GENERATOR_OPTIONS;
        this.temp_vec               = new Vector(0, 0, 0);
        this.noise3d                = noise.simplex3;
        //
        this.noisefn                = noise.perlin2;
        this.noisefn3d              = noise.perlin3;
        // Сaves manager
        this.caveManager            = new CaveGenerator(this.seed);
        this.islands                = [];
        this.extruders              = [];
        //
        this.maps                   = new TerrainMapManager(this.seed, this.world_id, this.noisefn);
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
            await Vox_Loader.load(root_dir + '/data/vox/castle.vox', (chunks) => {
                let palette = {
                    93: BLOCK.GRAVEL,
                    106: BLOCK.STONE_BRICK,
                    114: BLOCK.CONCRETE,
                    72: BLOCK.GRASS_DIRT,
                    235: BLOCK.SNOW_BLOCK,
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
    }

    // getOreBlockID...
    getOreBlockID(map, xyz, value, dirt_block) {
        this.temp_vec.copyFrom(xyz);
        this.temp_vec.y++;
        if(map.info.plants.has(this.temp_vec)) {
            return dirt_block;
        }
        let stone_block_id = BLOCK.CONCRETE.id;
        let density = this.noise3d(xyz.x / 20, xyz.z / 20, xyz.y / 20) / 2 + .5;
        if(density > 0.5) {
            if(density < 0.66) {
                stone_block_id = BLOCK.DIORITE.id;
            } else if(density < 0.83) {
                stone_block_id = BLOCK.ANDESITE.id;
            } else {
                stone_block_id = BLOCK.GRANITE.id;
            }
        } else if(xyz.y < value - 5) {
            for(let ore of this.ores) {
                if(ore.pos.distance(xyz) < ore.rad) {
                    if(xyz.y < ore.max_y) {
                        stone_block_id = ore.block_id;
                    }
                    break;
                }
            }
        }
        return stone_block_id;
    }

    // Generate
    generate(chunk) {
        const chunk_coord               = chunk.coord;
        let xyz                         = new Vector(0, 0, 0);
        let temp_vec                    = new Vector(0, 0, 0);
        let temp_vec2                   = new Vector(0, 0, 0);
        let ppos                        = new Vector(0, 0, 0);
        let chunkAABB                   = new AABB();
        const _createBlockAABB          = this._createBlockAABB;
        const _createBlockAABB_second   = this._createBlockAABB_second;
        const seed                      = chunk.id;
        const aleaRandom                = new alea(seed);
        const size_x                    = chunk.size.x;
        const size_y                    = chunk.size.y;
        const size_z                    = chunk.size.z;
        let randoms_index               = 0;

        // Maps
        let maps                        = this.maps.generateAround(chunk.addr, true, true);
        let map                         = maps[4];
        let cluster                     = chunk.cluster; // ClusterManager.getForCoord(chunk.coord);
        this.caveManager.addSpiral(chunk.addr);

        this.ores = [];
        const margin = 3;
        let count = Math.round(aleaRandom.double() * 15);
        for(let i = 0; i < count; i++) {
            const r = Math.floor(aleaRandom.double() * ORE_RANDOMS.length);
            const ore = ORE_RANDOMS[r];
            ore.rad = Math.min(Math.round(aleaRandom.double() * ore.max_rad) + 1, ore.max_rad),
            ore.pos = new Vector(
                margin + (CHUNK_SIZE_X - margin*2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Y - margin*2) * aleaRandom.double(),
                margin + (CHUNK_SIZE_Z - margin*2) * aleaRandom.double()
            ).flooredSelf().addSelf(chunk_coord)
            this.ores.push(ore)
        }

        //
        const setBlock = (x, y, z, block_id, rotate) => {
            // temp_vec2.set(x, y, z);
            temp_vec2.x = x;
            temp_vec2.y = y;
            temp_vec2.z = z;
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
            if(rotate) {
                chunk.tblocks.rotate.set(temp_vec2, rotate);
            }
            chunk.tblocks.id[index] = block_id;
        };

        // Endless caves / Бесконечные пещеры нижнего уровня
        if(chunk.addr.y < -1) {

            this.generateBottomCaves(chunk, aleaRandom, setBlock); 

        } else {

            //
            chunkAABB.set(
                chunk_coord.x,
                chunk_coord.y,
                chunk_coord.z,
                chunk_coord.x + CHUNK_SIZE_X,
                chunk_coord.y + CHUNK_SIZE_Y,
                chunk_coord.z + CHUNK_SIZE_Z
            );
    
            // Static objects
            let islands = this.islands;
            let extruders = this.extruders;
    
            // voxel_buildings
            let has_voxel_buildings = false;
            for(var item of this.voxel_buildings) {
                _createBlockAABB_second.set(
                    item.coord.x - item.size.x,
                    item.coord.y - item.size.y,
                    item.coord.z - item.size.z,
                    item.coord.x + item.size.x,
                    item.coord.y + item.size.y,
                    item.coord.z + item.size.z
                );
                if(chunkAABB.intersect(_createBlockAABB_second)) {
                    has_voxel_buildings = true;
                    break;
                }
            }
    
            // Islands
            let has_islands = false;
            for(let item of this.islands) {
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
                    has_islands = true;
                    break;
                }
            }
    
            // extruders
            let has_extruders = false;
            for(let item of this.extruders) {
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
                    has_extruders = true;
                    break;
                }
            }

            // Ищем отрезки пещер
            const neighbour_lines = this.caveManager.getNeighbourLines(chunk.addr);
            const in_chunk_cave_lines = neighbour_lines && neighbour_lines.list.length > 0;

            // Проверка не является ли этот блок пещерой
            function checkIsCaveBlock(xyz) {
                if(!in_chunk_cave_lines) {
                    return false;
                }
                for(let k = neighbour_lines.list.length - 1; k >= 0; k--) {
                    const line = neighbour_lines.list[k];
                    if(line.is_treasure) {
                        if(line.aabb.contains(xyz.x, xyz.y, xyz.z)) {
                            return line;
                        }
                    } else {
                        let dist = xyz.distanceToLine(line.p_start, line.p_end, _intersection);
                        let r = randoms[Math.abs(xyz.x + xyz.y + xyz.z) % randoms.length];
                        if(dist < line.rad + r * 1) {
                            return line;
                        }
                    }
                }
                return false;
            }

            // Проверка того, чтобы под деревьями не удалялась земля (в радиусе 5 блоков)
            function nearTree(xyz, value2) {
                if(!cluster.is_empty) {
                    if(xyz.y > value2 - 3 && xyz.y < value2 + 1) {
                        if(cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, 2)) {
                            return true;
                        }
                    }
                }
                const near_rad = 5;
                // const check_only_current_map = (x >= near_rad && y >= near_rad && z >= near_rad && x < CHUNK_SIZE_X - near_rad &&  y < CHUNK_SIZE_Y - near_rad && z < CHUNK_SIZE_Z - near_rad);
                _createBlockAABB_second.set(
                    xyz.x - near_rad,
                    xyz.y - near_rad - chunk_coord.y,
                    xyz.z - near_rad,
                    xyz.x + near_rad,
                    xyz.y + near_rad - chunk_coord.y,
                    xyz.z + near_rad
                );
                for(let m of maps) {
                    if(m.info.trees.length == 0) {
                        continue;
                    }
                    //
                    _createBlockAABB.set(
                        m.chunk.coord.x,
                        m.chunk.coord.y,
                        m.chunk.coord.z,
                        m.chunk.coord.x + CHUNK_SIZE_X,
                        m.chunk.coord.y + CHUNK_SIZE_Y,
                        m.chunk.coord.z + CHUNK_SIZE_Z
                    );
                    if(!_createBlockAABB.intersect(_createBlockAABB_second)) {
                        continue;
                    }
                    ppos.set(xyz.x - m.chunk.coord.x, xyz.y - m.chunk.coord.y, xyz.z - m.chunk.coord.z);
                    for(let tree of m.info.trees) {
                        if(tree.pos.distance(ppos) < near_rad) {
                            return true;
                        }
                    }
                }
                return false;
            }

            // drawBuilding...
            const drawBuilding = (xyz, x, y, z) => {
                if(has_voxel_buildings) {
                    let vb = this.getVoxelBuilding(xyz);
                    if(vb) {
                        let block = vb.getBlock(xyz);
                        if(block) {
                            setBlock(x, y, z, block.id);
                        }
                        return true;
                    }
                }
                return false;
            }

            // drawIsland
            function drawIsland(xyz, x, y, z) {
                if(!has_islands) {
                    return false;
                }
                for(let island of islands) {
                    let dist = xyz.distance(island.pos);
                    if(dist < island.rad) {
                        if(xyz.y < island.pos.y) {
                            if(xyz.y < island.pos.y - 3) {
                                setBlock(x, y, z, BLOCK.CONCRETE.id);
                                return true;
                            } else {
                                if(dist < island.rad * 0.9) {
                                    setBlock(x, y, z, BLOCK.CONCRETE.id);
                                    return true;
                                } else {
                                    setBlock(x, y, z, BLOCK.GRASS_DIRT.id);
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
            function extrude(xyz) {
                for(let extruder of extruders) {
                    if(xyz.distance(extruder.pos) < extruder.rad) {
                        return true;
                    }
                }
                return false;
            }

            // getTreasureRoomMat
            function getTreasureRoomMat(xyz, is_floor, level) {
                if(!is_floor && level == 0) {
                    return BLOCK.LODESTONE.id;
                }
                let rb = randoms[randoms_index++ % randoms.length];
                if(rb < .2) {
                    return BLOCK.MOSS_BLOCK.id;
                } else if (rb < .8) {
                    return BLOCK.STONE_BRICK.id;
                } else {
                    return BLOCK.MOSSY_STONE_BRICKS.id;
                }
            }

            // drawTreasureRoom...
            function drawTreasureRoom(line, xyz, x, y, z) {
                if(xyz.y < line.p_start.y || xyz.y == line.p_start.y + Math.round(line.rad) - 1) {
                    // floor
                    /*if(line.r < 1.1) {
                        if(xyz.y == line.p_start.y - 1) {
                            if(xyz.x == line.p_start.x - Math.floor(line.rad) + 1) {
                                setBlock(x, y, z, BLOCK.STILL_LAVA.id);
                            } else {
                                setBlock(x, y, z, getTreasureRoomMat(xyz, true));
                            }
                        } else {
                            setBlock(x, y, z, getTreasureRoomMat(xyz, true));
                        }
                    } else {
                        setBlock(x, y, z, getTreasureRoomMat(xyz, true));
                    }
                    */
                    setBlock(x, y, z, getTreasureRoomMat(xyz, true));
                } else {
                    if(
                        // long walls
                        (xyz.z == line.p_start.z + Math.floor(line.rad)) ||
                        (xyz.z == line.p_end.z - Math.floor(line.rad)) ||
                        // short walls
                        (xyz.x == line.p_end.x + Math.floor(line.rad)) ||
                        (xyz.x == line.p_start.x - Math.floor(line.rad))
                    ) {
                        setBlock(x, y, z, getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
                    } else if (xyz.x == line.p_start.x - Math.floor(line.rad) + 7) {
                        // 3-th short wall with door
                        if(xyz.z != line.p_start.z || (xyz.z == line.p_start.z && xyz.y > line.p_start.y + 2)) {
                            setBlock(x, y, z, getTreasureRoomMat(xyz, false, xyz.y - line.p_start.y));
                        } else {
                            // iron bars over door
                            if(xyz.y == line.p_start.y + 2) {
                                setBlock(x, y, z, BLOCK.IRON_BARS.id);
                            }
                        }
                    }
                    if(xyz.y == line.p_start.y) {
                        // chest
                        if(xyz.z == line.p_start.z) {
                            let cx = Math.round((line.p_start.x + line.p_end.x) / 2) - 6;
                            if(xyz.x == cx) {
                                setBlock(x, y, z, BLOCK.CHEST.id, DEFAULT_CHEST_ROTATE);
                            }
                            if(xyz.x == cx + 3) {
                                setBlock(x, y, z, BLOCK.MOB_SPAWN.id, DEFAULT_CHEST_ROTATE);
                            }
                        }
                    }
                }
            }

            // Endless spiral staircase
            if(this.world_id == 'demo') {
                if(chunk.addr.x == 180 && chunk.addr.z == 174) {
                    for(let y = 0; y < chunk.size.y; y += .25) {
                        let y_abs = y + chunk_coord.y;
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
            for(let x = 0; x < size_x; x++) {
                for(let z = 0; z < size_z; z++) {

                    const cell              = map.info.cells[x][z];
                    const biome             = cell.biome;
                    const value             = cell.value2;
                    const rnd               = aleaRandom.double();
                    const local_dirt_level  = value - (rnd < .005 ? 1 : 3);
                    const in_ocean          = this.OCEAN_BIOMES.indexOf(biome.code) >= 0;
                    const dirt_block        = cell.dirt_block_id;

                    xyz.set(x + chunk_coord.x, 0, z + chunk_coord.z);

                    for(let y = 0; y < size_y; y++) {

                        xyz.y = y + chunk_coord.y;
                        // xyz.set(x + chunk_coord.x, y + chunk_coord.y, z + chunk_coord.z);

                        // Draw voxel buildings
                        if(has_voxel_buildings) {
                            if(drawBuilding(xyz, x, y, z)) {
                                continue;
                            }
                        }

                        // Islands
                        if(has_islands) {
                            if(drawIsland(xyz, x, y, z)) {
                                continue;
                            }
                        }

                        // Remove volume from terrain
                        if(has_extruders) {
                            if(extrude(xyz)) {
                                continue;
                            }
                        }

                        // Exit
                        if(xyz.y >= value) {
                            continue;
                        }

                        // Caves | Пещеры
                        if(in_chunk_cave_lines && !in_ocean) {
                            const line = checkIsCaveBlock(xyz);
                            if(line) {
                                if(line.is_treasure) {
                                    drawTreasureRoom(line, xyz, x, y, z);
                                    continue;
                                } else if(!nearTree(xyz, value)) {
                                    continue;
                                }
                            }
                        }

                        // Ores (если это не вода, то заполняем полезными ископаемыми)
                        let block_id = dirt_block;
                        if(xyz.y < local_dirt_level) {
                            block_id = this.getOreBlockID(map, xyz, value, dirt_block);
                        }
                        setBlock(x, y, z, block_id);

                    }

                    // `Y` of waterline
                    let ywl = map.info.options.WATER_LINE - chunk_coord.y;
                    if(biome.code == 'OCEAN' && ywl >= 0) {
                        temp_vec.set(x, 0, z);
                        for(let y = value; y <= map.info.options.WATER_LINE; y++) {
                            if(y >= chunk_coord.y && y < chunk_coord.y + chunk.size.y) {
                                temp_vec.y = y - chunk_coord.y;
                                if(!chunk.tblocks.has(temp_vec)) {
                                    setBlock(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.STILL_WATER.id);
                                }
                            }
                        }
                        if(cell.equator < .6 && cell.humidity > .4) {
                            const vl = map.info.options.WATER_LINE;
                            if(vl >= chunk_coord.y && vl < chunk_coord.y + chunk.size.y) {
                                temp_vec.y = vl - chunk_coord.y;
                                setBlock(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.ICE.id);
                            }
                        }
                    }

                }
            }

            if(!chunk.cluster.is_empty) {
                chunk.cluster.fillBlocks(this.maps, chunk, map);
            }

            // Plant trees
            for(const m of maps) {
                for(let p of m.info.trees) {
                    this.plantTree(
                        p,
                        chunk,
                        m.chunk.coord.x + p.pos.x - chunk_coord.x,
                        m.chunk.coord.y + p.pos.y - chunk_coord.y,
                        m.chunk.coord.z + p.pos.z - chunk_coord.z
                    );
                }
            }

            // Plant herbs
            let temp_block = null;
            let idx = 0;
            for(let pos of map.info.plants.keys()) {
                if(pos.y >= chunk_coord.y && pos.y < chunk_coord.y + CHUNK_SIZE_Y) {
                    let block_id = map.info.plants.get(pos);
                    xyz.set(pos.x, pos.y - chunk_coord.y - 1, pos.z);
                    temp_block = chunk.tblocks.get(xyz, temp_block);
                    if(temp_block.id === BLOCK.GRASS_DIRT.id || temp_block.id == 516) {
                        temp_vec.set(pos.x, pos.y - chunk_coord.y, pos.z);
                        if(!chunk.tblocks.has(temp_vec)) {
                            if(idx++ % 7 == 0 && temp_vec.y < CHUNK_SIZE_Y - 2 && block_id == BLOCK.GRASS.id) {
                                // check over block
                                xyz.y += 2;
                                temp_block = chunk.tblocks.get(xyz, temp_block);
                                if(temp_block.id == 0) {
                                    //
                                    setBlock(temp_vec.x, temp_vec.y, temp_vec.z, BLOCK.TALL_GRASS.id);
                                    setBlock(temp_vec.x, temp_vec.y + 1, temp_vec.z, BLOCK.TALL_GRASS_TOP.id);
                                } else {
                                    setBlock(temp_vec.x, temp_vec.y, temp_vec.z, block_id);    
                                }
                            } else {
                                setBlock(temp_vec.x, temp_vec.y, temp_vec.z, block_id);
                            }
                        }
                    }
                }
            }

        }

        if(chunk.addr.y == 0) {
            const mine = MineGenerator.getForCoord(this, chunk.coord);
            mine.fillBlocks(chunk);
        }

        return map;

    }

    // Генерация пещер нижнего мира
    generateBottomCaves(chunk, aleaRandom, setBlock) {

        const noise3d               = noise.simplex3;
        let xyz                     = new Vector(0, 0, 0);
        let xyz_stone_density       = new Vector(0, 0, 0);
        let DENSITY_COEFF           = 1;
        let fill_count              = 0;

        //
        const getBlock = (x, y, z) => {
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            return chunk.tblocks.id[index];
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {
            //if(chunk.coord.x + x < 2800) continue;

            for(let z = 0; z < chunk.size.z; z++) {

                //if(chunk.coord.z + z > 2900) continue;

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
                                        setBlock(x, y, z, BLOCK.AMETHYST.id);
                                    }
                                } else {
                                    setBlock(x, y, z, BLOCK.AIR.id);
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
                                        setBlock(x, y, z, BLOCK.AMETHYST_CLUSTER.id, rotate);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

    }

}