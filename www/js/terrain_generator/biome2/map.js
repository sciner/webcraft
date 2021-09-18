import {impl as alea} from '../../../vendors/alea.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../blocks.js";
import {Vector, Helpers, Color} from '../../helpers.js';
import {BIOMES} from '../../biomes.js';

export class MapCell {

    constructor(value, humidity, equator, biome, block) {
        this.value      = value;
        this.value2     = value;
        this.humidity   = Math.round(humidity * 100000) / 100000;
        this.equator    = Math.round(equator * 100000) / 100000;
        this.biome      = biome;
        this.block      = block;
    }

}

export class Map {

    // Constructor
    constructor(chunk, options) {
        this.options        = options;
        this.trees          = [];
        this.plants         = [];
        this.cells          = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(null));
        this.chunk          = {
            size: chunk.size,
            addr: chunk.addr,
            coord: chunk.coord
        };
    }

    // Сглаживание карты высот
    smooth(generator) {
        const SMOOTH_RAD    = 3;
        let neighbour_map   = null;
        let map             = null;
        let chunk_coord     = this.chunk.coord;
        // Smoothing | Сглаживание
        for(let x = -SMOOTH_RAD; x < CHUNK_SIZE_X + SMOOTH_RAD; x++) {
            for(let z = -SMOOTH_RAD; z < CHUNK_SIZE_Z + SMOOTH_RAD; z++) {
                // absolute cell coord
                let px          = chunk_coord.x + x;
                let pz          = chunk_coord.z + z;
                let addr        = BLOCK.getChunkPos(px, 0, pz); // calc chunk addr for this cell
                let map_addr_ok = map && (map.chunk.addr.x == addr.x) && (map.chunk.addr.z == addr.z); // get chunk map from cache
                if(!map || !map_addr_ok) {
                    map = generator.maps_cache[addr.toString()];
                }
                let bi = BLOCK.getBlockIndex(px, 0, pz);
                let cell = map.cells[bi.x][bi.z];
                if(!cell) {
                    continue;
                }
                // Не сглаживаем блоки пляжа и океана
                if(cell.value > this.options.WATER_LINE - 2 && [BIOMES.OCEAN.code, BIOMES.BEACH.code].indexOf(cell.biome.code) >= 0) {
                    continue;
                }
                let height_sum  = 0;
                let cnt         = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                for(let i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(let j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        // calc chunk addr for this cell
                        let neighbour_addr = BLOCK.getChunkPos(px + i, 0, pz + j);
                        let addr_ok = neighbour_map &&
                                      (neighbour_map.chunk.addr.x == neighbour_addr.x) &&
                                      (neighbour_map.chunk.addr.z == neighbour_addr.z);
                        // хак оптимизации скорости (т.к. toString() очень дорогой)
                        if(!neighbour_map || !addr_ok) {
                            neighbour_map = generator.maps_cache[neighbour_addr.toString()];
                        }
                        if(!neighbour_map) {
                            console.error('Neighbor not found in generator.maps_cache for key ' + neighbour_addr.toString(), chunk_coord, px, pz);
                            debugger;
                        }
                        //
                        let bi = BLOCK.getBlockIndex(px + i, 0, pz + j);
                        let neighbour_cell = neighbour_map.cells[bi.x][bi.z];
                        if(neighbour_cell) {
                            height_sum += neighbour_cell.value;
                            dirt_color.add(neighbour_cell.biome.dirt_color);
                            cnt++;
                        }
                    }
                }
                cell.value2           = parseInt(height_sum / cnt);
                cell.biome.dirt_color = dirt_color.divide(new Color(cnt, cnt, cnt, cnt));
            }
        }
    }

    // Генерация растительности
    generateVegetation() {
        let chunk       = this.chunk;
        let aleaRandom  = new alea(chunk.seed + '_' + chunk.id);
        this.trees      = [];
        this.plants     = [];
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let cell = this.cells[x][z];
                let biome = BIOMES[cell.biome.code];
                let y = cell.value2;
                // Если наверху блок земли
                let dirt_block_ids = biome.dirt_block.map(function(item) {return item.id;});
                if(dirt_block_ids.indexOf(cell.block) >= 0) {
                    // Динамическая рассадка растений
                    let rnd = aleaRandom.double();
                    if(rnd > 0 && rnd <= biome.plants.frequency) {
                        let s = 0;
                        let r = rnd / biome.plants.frequency;
                        for(let p of biome.plants.list) {
                            s += p.percent;
                            if(r < s) {
                                this.plants.push({
                                    pos: new Vector(x, y, z),
                                    block: p.block
                                });
                                break;
                            }
                        }
                    }
                    // Посадка деревьев
                    if(rnd > 0 && rnd <= biome.trees.frequency) {   
                        let s = 0;
                        let r = rnd / biome.trees.frequency;
                        for(let type of biome.trees.list) {
                            s += type.percent;
                            if(r < s) {
                                const height = Helpers.clamp(Math.round(aleaRandom.double() * type.height.max), type.height.min, type.height.max);
                                const rad = Math.max(parseInt(height / 2), 2);
                                this.trees.push({
                                    biome_code: biome.code,
                                    pos:    new Vector(x, y, z),
                                    height: height,
                                    rad:    rad,
                                    type:   type
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

}