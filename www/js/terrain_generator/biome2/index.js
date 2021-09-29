import {impl as alea} from '../../../vendors/alea.js';
import noise from '../../../vendors/perlin.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../blocks.js";
import {Vector, Helpers} from '../../helpers.js';
import {blocks, BIOMES} from '../../biomes.js';
import {CaveGenerator} from '../../caves.js';
import {Map, MapCell} from './map.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";

//
let vox_templates = {};
await Vox_Loader.load('/data/monu10.vox', (chunks) => {
    let palette = {
        81: BLOCK.CONCRETE,
        97: BLOCK.OAK_PLANK,
        121: BLOCK.STONE_BRICK,
        122: BLOCK.SMOOTH_STONE,
        123: BLOCK.GRAVEL,
    };
    vox_templates.monu10 = {chunk: chunks[0], palette: palette};
});
await Vox_Loader.load('/data/small_castle.vox', (chunks) => {
    vox_templates.small_castle = {chunk: chunks[0], palette: {}};
});
await Vox_Loader.load('/data/castle.vox', (chunks) => {
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

// Terrain generator class
export default class Terrain_Generator {

    constructor(seed) {
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
        this.maps_cache             = {};
        this.seed                   = null;
        this.setSeed(seed);
        // Сaves manager
        this.caveManager            = new CaveGenerator(seed);
        // Voxel buildings
        this.voxel_buildings        = [
            new Vox_Mesh(vox_templates.monu10, new Vector(2840, 58, 2830), new Vector(0, 0, 0), null, null),
            // new Vox_Mesh(vox_templates.small_castle, new Vector(2938, 65, 2813), new Vector(0, 0, 0), null, null),
            new Vox_Mesh(vox_templates.castle, new Vector(2980, 70, 2640), new Vector(0, 0, 0), null, new Vector(0, 1, 0))
        ];
        // Islands
        this.islands = [
            {
                pos: new Vector(2865, 118, 2787),
                rad: 15
            },
            {
                pos: new Vector(2920, 1024, 2787),
                rad: 20
            }
        ];
        // Extruders
        this.extruders = [
            {
                pos: this.islands[0].pos.sub(new Vector(0, 50, 0)),
                rad: this.islands[0].rad
            }
        ];
    }

    async setSeed(seed) {
        this.seed = seed;
        noise.seed(this.seed);
    }

    // generateMap
    generateMap(chunk, noisefn) {
        let addr_string = chunk.addr.toString();
        if(this.maps_cache.hasOwnProperty(addr_string)) {
            return this.maps_cache[addr_string];
        }
        const options               = this.options;
        const SX                    = chunk.coord.x;
        const SZ                    = chunk.coord.z;
        // Result map
        let map                     = new Map(chunk, this.options);
        this.caveManager.addSpiral(chunk.addr);
        //
        for(let x = 0; x < chunk.size.x; x += 2) {
            for(let z = 0; z < chunk.size.z; z += 2) {
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
                let humidity = Helpers.clamp((noisefn(px / options.SCALE_HUMIDITY, pz / options.SCALE_HUMIDITY) + 0.8) / 2);
                // Экватор
                let equator = Helpers.clamp((noisefn(px / options.SCALE_EQUATOR, pz / options.SCALE_EQUATOR) + 0.8) / 1);
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
                        block:          biome.block.id
                    },
                    dirt_block.id
                );
                if(biome.code == 'OCEAN') {
                    cell.block = blocks.STILL_WATER;
                }
                map.cells[x][z] = cell;
                map.cells[x + 1][z + 1] = cell;
                map.cells[x + 1][z] = cell;
                map.cells[x][z + 1] = cell;
            }
        }
        // Clear maps_cache
        let keys = Object.keys(this.maps_cache);
        let MAX_ENTR = 20000;
        if(keys.length > MAX_ENTR) {
            let del_count = Math.floor(keys.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(let key of keys) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[key]);
            }
        }
        //
        return this.maps_cache[addr_string] = map;
    }

    // generateMaps
    generateMaps(chunk) {
        const noisefn               = this.noisefn;
        let maps                    = [];
        let map                     = null;
        let size                    = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
        for(let x = -1; x <= 1; x++) {
            for(let z = -1; z <= 1; z++) {
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
        // Smooth (for central and part of neighbors)
        map.info.smooth(this);
        // Generate vegetation
        for(let map of maps) {
            map.info.generateVegetation();
        }
        return maps;
    }

    //
    getVoxelBuilding(xyz) {
        for(var vb of this.voxel_buildings) {
            if(xyz.x >= vb.coord.x && xyz.y >= vb.coord.y && xyz.z >= vb.coord.z &&
                xyz.x < vb.coord.x + vb.size.x &&
                xyz.y < vb.coord.y + vb.size.z && 
                xyz.z < vb.coord.z + vb.size.y) {
                    return vb;
                }
        }
        return null;
    }

    // Generate
    generate(chunk) {

        let maps                    = this.generateMaps(chunk);
        let map                     = maps[4];

        const seed                  = chunk.id;
        const aleaRandom            = new alea(seed);

        // Проверяем соседние чанки в указанном радиусе, на наличие начала(головы) пещер
        let neighbors_caves        = this.caveManager.getNeighbors(chunk.addr);

        // Bedrock
        let min_y   = 0;
        if(chunk.coord.y == 0) {
            min_y++;
        }

        //
        let setBlock = (x, y, z, block) => {
            chunk.blocks[x][z][y] = block;
        };

        // Static objects
        let islands = this.islands;
        let extruders = this.extruders;

        // Endless spiral staircase
        if(chunk.addr.x == 180 && chunk.addr.z == 174) {
            for(let y = min_y; y < chunk.size.y; y += .25) {
                let y_abs = y + chunk.coord.y;
                let y_int = parseInt(y);
                let x = 8 + parseInt(Math.sin(y_abs / Math.PI) * 6);
                let z = 8 + parseInt(Math.cos(y_abs / Math.PI) * 6);
                let block = blocks.BEDROCK;
                if(y >= 1) {
                    setBlock(x, y_int - 1, z, block.id);
                }
                if(y_abs % 16 == 1) {
                    block = blocks.GOLD;
                }
                if(y_abs % 32 == 1) {
                    block = blocks.DIAMOND_ORE;
                }
                setBlock(x, y_int, z, block.id);
            }
        }

        //
        /*if(chunk.addr.x == 194) {
            let ab = all_blocks;
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y < chunk.size.y; y++) {
                        let index = aleaRandom.double() * ab.length;
                        index = index | 0;
                        let b = ab[index];
                        if(!b || !b.spawnable || b.is_item || !b.sound || b.is_entity || b.transparent || (b.style && b.style == 'triangle')) {
                            y--;
                            continue;
                        }
                        setBlock(x, y, z, b.id);
                    }
                }
            }
            return map;
        }*/

        //
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {

                const cell              = map.info.cells[x][z];
                const biome             = cell.biome;
                const value             = cell.value2;

                let rnd                 = aleaRandom.double();
                let local_dirt_level    = value - (rnd < .005 ? 0 : 3);
                let in_ocean            = ['OCEAN', 'BEACH'].indexOf(biome.code) >= 0;

                // Bedrock
                if(chunk.coord.y == 0) {
                    setBlock(x, 0, z, blocks.BEDROCK.id);
                }

                for(let y = min_y; y < chunk.size.y; y++) {

                    let xyz = new Vector(x, y, z).add(chunk.coord);

                    // Draw voxel buildings
                    let vb = this.getVoxelBuilding(xyz);
                    if(vb) {
                        let block = vb.getBlock(xyz);
                        if(block) {
                            setBlock(x, y, z, block.id);
                        }
                        continue;
                    }

                    // Islands
                    for(let island of islands) {
                        let dist = xyz.distance(island.pos);
                        if(dist < island.rad) {
                            if(xyz.y < island.pos.y) {
                                if(xyz.y < island.pos.y - 3) {
                                    setBlock(x, y, z, blocks.CONCRETE.id);
                                } else {
                                    if(dist < island.rad * 0.9) {
                                        setBlock(x, y, z, blocks.CONCRETE.id);
                                    } else {
                                        setBlock(x, y, z, blocks.DIRT.id);
                                    }
                                }
                            }
                            break;
                        }
                    }

                    // Remove island form from terrain
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

                    // Exit
                    if(xyz.y >= value) {
                        continue;
                    }

                    // Caves | Пещеры
                    if(!in_ocean) {
                        // Проверка не является ли этот блок пещерой
                        let is_cave_block = false;
                        for(let map_cave of neighbors_caves) {
                            for(let cave_point of map_cave.points) {
                                if(xyz.distance(cave_point.pos) < cave_point.rad) {
                                    is_cave_block = true;
                                    break;
                                }
                            }
                            if(is_cave_block) {
                                break;
                            }
                        }
                        // Проверка того, чтобы под деревьями не удалялась земля (в радиусе 5 блоков)
                        if(is_cave_block) {
                            // Чтобы не удалять землю из под деревьев
                            let near_tree = false;
                            for(let m of maps) {
                                let ppos = xyz.sub(m.chunk.coord);
                                for(let tree of m.info.trees) {
                                    if(tree.pos.distance(ppos) < 5) {
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
                        let r = aleaRandom.double() * 1.33;
                        if(r < 0.0025 && xyz.y < value - 5) {
                            setBlock(x, y, z, blocks.DIAMOND_ORE.id);
                        } else if(r < 0.01) {
                            setBlock(x, y, z, blocks.COAL_ORE.id);
                        } else {
                            let norm = true;
                            for(let plant of map.info.plants) {
                                if(plant.pos.x == x && y == plant.pos.y - 1 && plant.pos.z == z) {
                                    norm = false;
                                    break;
                                }
                            }
                            setBlock(x, y, z, norm ? blocks.CONCRETE.id : biome.dirt_block);
                        }
                    } else {
                        setBlock(x, y, z, biome.dirt_block);
                    }
                }
                // `Y` of waterline
                let ywl = map.info.options.WATER_LINE - chunk.coord.y;
                if(biome.code == 'OCEAN' && ywl >= 0) {
                    for(let y = value; y <= map.info.options.WATER_LINE; y++) {
                        if(y >= chunk.coord.y && y < chunk.coord.y + chunk.size.y) {
                            if(!chunk.blocks[x][z][y - chunk.coord.y]) {
                                setBlock(x, y - chunk.coord.y, z, blocks.STILL_WATER.id);
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
        for(let p of map.info.plants) {
            if(p.pos.y >= chunk.coord.y && p.pos.y < chunk.coord.y + CHUNK_SIZE_Y) {
                let b = chunk.blocks[p.pos.x][p.pos.z][p.pos.y - chunk.coord.y - 1];
                if(b && b === blocks.DIRT.id) {
                    if(!chunk.blocks[p.pos.x][p.pos.z][p.pos.y - chunk.coord.y]) {
                        setBlock(p.pos.x, p.pos.y - chunk.coord.y, p.pos.z, p.block);
                    }
                }
            }
        }

        return map;

    }

    // plantTree...
    plantTree(options, chunk, x, y, z) {
        const height        = options.height;
        const type          = options.type;
        let ystart = y + height;
        // setBlock
        let setBlock = (x, y, z, block, force_replace) => {
            if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                if(force_replace || !chunk.blocks[x][z][y]) {
                    let xyz = new Vector(x, y, z);
                    if(!this.getVoxelBuilding(xyz.add(chunk.coord))) {
                        chunk.blocks[x][z][y] = block.id;
                    }
                }
            }
        };
        // ствол
        for(let p = y; p < ystart; p++) {
            setBlock(x, p, z, type.trunk, true);
        }
        // листва над стволом
        switch(type.style) {
            case 'cactus': {
                // кактус
                break;
            }
            case 'stump': {
                // пенёк
                setBlock(x, ystart, z, type.leaves, true);
                break;
            }
            case 'wood': {
                // дуб, берёза
                let py = y + height;
                for(let rad of [1, 1, 2, 2]) {
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                let m = (i == x - rad && j == z - rad) ||
                                    (i == x + rad && j == z + rad) || 
                                    (i == x - rad && j == z + rad) ||
                                    (i == x + rad && j == z - rad);
                                    let m2 = (py == y + height) ||
                                    (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                                if(m && m2) {
                                    continue;
                                }
                                let b = chunk.blocks[i][j][py];
                                let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                                if(!b_id || b_id >= 0 && b_id != type.trunk.id) {
                                    setBlock(i, py, j, type.leaves, false);
                                }
                            }
                        }
                    }
                    py--;
                }
                break;
            }
            case 'acacia': {
                // акация
                let py = y + height;
                for(let rad of [2, 3]) {
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(Helpers.distance(new Vector(x, 0, z), new Vector(i, 0, j)) > rad) {
                                    continue;
                                }
                                let b = chunk.blocks[i][j][py];
                                let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                                if(!b_id || b_id >= 0 && b_id != type.trunk.id) {
                                    setBlock(i, py, j, type.leaves, false);
                                }
                            }
                        }
                    }
                    py--;
                }
                break;
            }
            case 'spruce': {
                // ель
                let r = 1;
                let rad = Math.round(r);
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    setBlock(x, ystart, z, type.leaves, false);
                    if(options.biome_code == 'SNOW') {
                        setBlock(x, ystart + 1, z, blocks.SNOW, false);
                    }
                }
                let step = 0;
                for(let y = ystart - 1; y > ystart - (height - 1); y--) {
                    if(step++ % 2 == 0) {
                        rad = Math.min(Math.round(r), 3);
                    } else {
                        rad = 1;
                    }
                    for(let i = x - rad; i <= x + rad; i++) {
                        for(let j = z - rad; j <= z + rad; j++) {
                            if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                                if(rad == 1 || Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                                    let b = chunk.getBlock(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
                                    let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                                    if(b_id === blocks.AIR.id) {
                                        setBlock(i, y, j, type.leaves, false);
                                        if(options.biome_code == 'SNOW') {
                                            setBlock(i, y + 1, j, blocks.SNOW, false);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    r += .9;
                }
                break;
            }
        }
    }

}