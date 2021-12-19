import {impl as alea} from '../../vendors/alea.js';
import {CHUNK_SIZE_X, CHUNK_SIZE_Z, getChunkAddr} from "../chunk.js";
import {Vector, Helpers, Color, VectorCollector} from '../helpers.js';
import {BLOCK} from "../blocks.js";
import {BIOMES} from "./biomes.js";

export const SMOOTH_RAD         = 3;
export const NO_SMOOTH_BIOMES   = [BIOMES.OCEAN.code, BIOMES.BEACH.code];

export class Map {

    static _cells;

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

    static initCells() {
        Map._cells = [];
        for(let x = -SMOOTH_RAD * 2; x < CHUNK_SIZE_X + SMOOTH_RAD * 2; x++) {
            Map._cells[x] = [];
            for(let z = -SMOOTH_RAD * 2; z < CHUNK_SIZE_Z + SMOOTH_RAD * 2; z++) {
                Map._cells[x][z] = null;
            }
        }
    }

    // Сглаживание карты высот
    smooth(generator) {
        // 1. Кеширование ячеек
        let map             = null;
        let addr            = new Vector(0, 0, 0);
        let bi              = new Vector(0, 0, 0);
        for(let x = -SMOOTH_RAD * 2; x < CHUNK_SIZE_X + SMOOTH_RAD * 2; x++) {
            for(let z = -SMOOTH_RAD * 2; z < CHUNK_SIZE_Z + SMOOTH_RAD * 2; z++) {
                // absolute cell coord
                let px          = this.chunk.coord.x + x;
                let pz          = this.chunk.coord.z + z;
                addr            = getChunkAddr(px, 0, pz, addr); // calc chunk addr for this cell
                if(!map || map.chunk.addr.x != addr.x || map.chunk.addr.z != addr.z) {
                    map = generator.maps_cache.get(addr); // get chunk map from cache
                }
                bi = BLOCK.getBlockIndex(px, 0, pz, bi);
                Map._cells[x][z] = map.cells[bi.x][bi.z];
            }
        }
        // 2. Smoothing | Сглаживание
        let colorComputer   = new Color();
        for(let x = -SMOOTH_RAD; x < CHUNK_SIZE_X + SMOOTH_RAD; x++) {
            for(let z = -SMOOTH_RAD; z < CHUNK_SIZE_Z + SMOOTH_RAD; z++) {
                let cell = Map._cells[x][z];
                let cnt         = 0;
                let height_sum  = 0;
                let dirt_color  = new Color(0, 0, 0, 0);
                for(let i = -SMOOTH_RAD; i <= SMOOTH_RAD; i++) {
                    for(let j = -SMOOTH_RAD; j <= SMOOTH_RAD; j++) {
                        let neighbour_cell = Map._cells[x + i][z + j];
                        height_sum += neighbour_cell.value;
                        dirt_color.add(neighbour_cell.biome.dirt_color);
                        cnt++;
                    }
                }
                // Не сглаживаем блоки пляжа и океана
                let smooth = !(cell.value > this.options.WATER_LINE - 2 && NO_SMOOTH_BIOMES.indexOf(cell.biome.code) >= 0);
                if(smooth) {
                    cell.value2 = parseInt(height_sum / cnt);
                }
                colorComputer.set(cnt, cnt, cnt, cnt);
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

Map.initCells();