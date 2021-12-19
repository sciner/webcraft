import {impl as alea} from '../../vendors/alea.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z, getChunkAddr} from "../chunk.js";
import {Vector, Helpers, Color, VectorCollector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {BIOMES} from "./biomes.js";

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
        let neighbour_addr  = new Vector(0, 0, 0);
        let temp_vec        = new Vector(0, 0, 0);
        let addr            = new Vector(0, 0, 0);
        let colorComputer   = new Color();
        let bi              = new Vector(0, 0, 0);
        let addr_offset     = new Vector(100, 0, 100);
        let ignore_biomes   = [BIOMES.OCEAN.code, BIOMES.BEACH.code];
        // Smoothing | Сглаживание
        for(let x = -SMOOTH_RAD; x < CHUNK_SIZE_X + SMOOTH_RAD; x++) {
            for(let z = -SMOOTH_RAD; z < CHUNK_SIZE_Z + SMOOTH_RAD; z++) {
                // absolute cell coord
                let px          = chunk_coord.x + x;
                let pz          = chunk_coord.z + z;
                addr            = getChunkAddr(px, 0, pz, addr); // calc chunk addr for this cell
                let map_addr_ok = map && (map.chunk.addr.x == addr.x) && (map.chunk.addr.z == addr.z);
                if(!map_addr_ok) {
                    map = generator.maps_cache.get(addr); // get chunk map from cache
                }
                bi = BLOCK.getBlockIndex(px, 0, pz, bi);
                let cell = map.cells[bi.x][bi.z];
                if(!cell) {
                    continue;
                }
                // Не сглаживаем блоки пляжа и океана
                if(cell.value > this.options.WATER_LINE - 2 && ignore_biomes.indexOf(cell.biome.code) >= 0) {
                    continue;
                }
                let height_sum  = 0;
                let cnt         = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                let ox          = 0;
                let oz          = 0;
                for(let i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(let j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        // оптимизация скорости
                        ox = 0;
                        oz = 0;
                        if(x + i < 0) ox = -1;
                        if(z + j < 0) oz = -1;
                        if(x + i >= CHUNK_SIZE_X) ox = 1;
                        if(z + j >= CHUNK_SIZE_Z) oz = 1;
                        if(addr_offset.x != ox || addr_offset.z != oz) {
                            addr_offset.set(ox, 0, oz);
                            // calc chunk addr for this cell
                            neighbour_addr = getChunkAddr(px + i, 0, pz + j, neighbour_addr);
                            neighbour_map = generator.maps_cache.get(neighbour_addr);
                            if(!neighbour_map) {
                                console.error('Neighbour not found in generator.maps_cache for key ' + neighbour_addr.toString(), chunk_coord, px, pz);
                                debugger;
                            }
                        }
                        //
                        temp_vec = BLOCK.getBlockIndex(px + i, 0, pz + j, temp_vec);
                        let neighbour_cell = neighbour_map.cells[temp_vec.x][temp_vec.z];
                        if(neighbour_cell) {
                            height_sum += neighbour_cell.value;
                            dirt_color.add(neighbour_cell.biome.dirt_color);
                            cnt++;
                        }
                    }
                }
                colorComputer.set(cnt, cnt, cnt, cnt);
                cell.value2           = parseInt(height_sum / cnt);
                cell.biome.dirt_color = dirt_color.divide(colorComputer);
            }
        }
    }

    // Генерация растительности
    generateVegetation() {
        let chunk           = this.chunk;
        let aleaRandom      = new alea(chunk.seed + '_' + chunk.coord.toString());
        this.trees          = [];
        this.plants         = new VectorCollector();
        let biome           = null;
        let dirt_block_ids  = [];
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                let cell = this.cells[x][z];
                if(!biome || biome.code != cell.biome.code) {
                    biome = BIOMES[cell.biome.code];
                    dirt_block_ids = biome.dirt_block.map(function(item) {return item.id;});
                }
                let y = cell.value2;
                // Если наверху блок земли
                if(dirt_block_ids.indexOf(cell.block) >= 0) {
                    // Динамическая рассадка растений
                    let rnd = aleaRandom.double();
                    if(rnd > 0 && rnd <= biome.plants.frequency) {
                        let s = 0;
                        let r = rnd / biome.plants.frequency;
                        for(let p of biome.plants.list) {
                            s += p.percent;
                            if(r < s) {
                                if(p.block) {
                                    this.plants.add(new Vector(x, y, z), p.block);
                                } else if(p.trunk) {
                                    this.plants.add(new Vector(x, y, z), p.trunk);
                                    this.plants.add(new Vector(x, y + 1, z), p.leaves);
                                    /*
                                    if(p.leaves) {
                                        this.plants.add(new Vector(x, y + 1, z), p.leaves.id);
                                    }*/
                                }
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
                                let r = aleaRandom.double();
                                const height = Helpers.clamp(Math.round(r * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
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