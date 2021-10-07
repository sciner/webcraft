import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../blocks.js";
import {Vector, Helpers, VectorCollector} from '../../helpers.js';
import {CaveGenerator} from '../../caves.js';
import {Map, MapCell} from './map.js';
import {Vox_Loader} from "../../vox/loader.js";
import {Vox_Mesh} from "../../vox/mesh.js";
import {Default_Terrain_Generator, BIOMES, noise, alea} from "../default.js";

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
export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super(seed, world_id);
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
        this.maps_cache             = new VectorCollector();
        // Сaves manager
        this.caveManager            = new CaveGenerator(seed);
        this.islands                = [];
        this.extruders              = [];
        // Map specific
        if(this.world_id == 'demo') {
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
        // Smooth (for central and part of neighbors)
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
        if(this.world_id == 'demo') {
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
                            let norm = !map.info.plants.has(new Vector(x, y + 1, z))
                            /*
                            for(let plant of map.info.plants) {
                                if(plant.pos.x == x && y == plant.pos.y - 1 && plant.pos.z == z) {
                                    norm = false;
                                    break;
                                }
                            }*/
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
        for(let pos of map.info.plants.keys()) {
            let block_id = map.info.plants.get(pos);
            if(pos.y >= chunk.coord.y && pos.y < chunk.coord.y + CHUNK_SIZE_Y) {
                let b = chunk.blocks[pos.x][pos.z][pos.y - chunk.coord.y - 1];
                if(b && b === blocks.DIRT.id) {
                    if(!chunk.blocks[pos.x][pos.z][pos.y - chunk.coord.y]) {
                        setBlock(pos.x, pos.y - chunk.coord.y, pos.z, block_id);
                    }
                }
            }
        }

        return map;

    }

}