import {impl as alea} from '../../vendors/alea.js';
import {Vector, DIRECTION} from "../helpers.js";
import {BLOCK} from '../blocks.js';
import type { ChunkWorkerChunk } from '../worker/chunk.js';
import { BLOCK_FLAG } from '../constant.js';

const _pos = new Vector(0, 0, 0);
const _vec = new Vector(0, 0, 0);

const HIDE_DUNGEON = false;
const OPAQUE_NEIGHBOUR_POSES = [new Vector(-1, 0, 0), new Vector(1, 0, 0), new Vector(0, 0, -1), new Vector(0, 0, 1), new Vector(0, -1, 0)]

export class DungeonGenerator {
    seed: any;

    constructor(seed? : string) {
        this.seed = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
    }

    add(chunk) {
        const random = new alea(this.seed + chunk.addr.toString());
        const {fromFlatChunkIndex, CHUNK_SIZE} = chunk.chunkManager.grid.math;
        // 8 попыток установки
        for(let n = 0; n < 8; n++) {
            fromFlatChunkIndex(_pos, Math.floor(random.double() * CHUNK_SIZE));
            if(this.checkPosition(chunk, _pos.x, _pos.y, _pos.z)) {
               this.genDung(chunk, random, _pos.x, _pos.y, _pos.z);
               break;
            }
            if(this.checkPositionHole(chunk, _pos.x, _pos.y, _pos.z)) {
               this.genDungeonHole(chunk, random, _pos.x, _pos.y, _pos.z);
               break;
            }
        }
    }

    /*
    * Данж заброшенный колодец
    */
    genDungeonHole(chunk, alea, x, y, z) {
        const biome = chunk.map.cells[z * chunk.chunkManager.grid.chunkSize.x + x].biome;
        // const up = this.getBlock(chunk, x, y, z);
        // console.debug('genDungeonHole: ' + up.posworld + ' ' + biome.title + ' ' + biome.id)
        // стандартные блоки
        let block_wall_1 = BLOCK.STONE_BRICKS;
        let block_wall_2 = BLOCK.MOSSY_STONE_BRICKS;
        let block_wall_3 = BLOCK.MOSS_BLOCK;
        let block_wall_4 = BLOCK.LODESTONE;
        let block_wall_5 = BLOCK.DARK_OAK_FENCE;
        let block_wall_6 = BLOCK.STONE_BRICK_SLAB;

        // Тип освещения
        let light = alea.double() * 3 | 0;
        let web = true;
        let ice = false;

        if (biome.id == 30 || biome.id == 31 || biome.id == 26) {
            ice = true;
        }

        // песок, как строительный материал
        if (biome.id == 2 || biome.id == 36 || biome.id == 35) {
            block_wall_1 = BLOCK.WHITE_TERRACOTTA;
            block_wall_2 = BLOCK.CUT_SANDSTONE;
            block_wall_3 = BLOCK.SAND;
            block_wall_4 = BLOCK.CHISELED_SANDSTONE;
            block_wall_5 = BLOCK.SANDSTONE_WALL;
            block_wall_6 = BLOCK.SMOOTH_SANDSTONE_SLAB;
            if (light == 1) {
                light = 2;
            }
        }
        if (!HIDE_DUNGEON) {
            // очистка от травы верхушки
            this.genBox(chunk, alea, x + 3, y + 9, z + 3, 3, 3, 3, BLOCK.AIR);
        }
        this.genBoxNoAir(chunk, alea, x + 3, y + 5, z + 3, 3, 4, 3, block_wall_1, 0.2);
        this.genBoxNoAir(chunk, alea, x + 3, y + 5, z + 3, 3, 4, 3, block_wall_2, 0.2);
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, block_wall_1, 0.2);
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, block_wall_2, 0.5);
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, (!ice) ? block_wall_3 : BLOCK.ICE, 0.3);

        // свечи в стенах
        if (light == 0) {
            this.genBoxNoAir(chunk, alea, x, y + 2, z, 9, 2, 9, BLOCK.WHITE_CANDLE, 0.05);
        }

        this.genBoxNoAir(chunk, alea, x, y + 1, z, 9, 1, 9, block_wall_4, 0.5);
        this.genBoxNoAir(chunk, alea, x + 4, y + 4, z + 4, 1, 7, 1, BLOCK.AIR);
        this.genBoxNoAir(chunk, alea, x + 1, y + 1, z + 1, 7, 3, 7, BLOCK.AIR);
        // паутина
        if (web) {
            for (let i = 1; i < 8; i++) {
                for (let j = 1; j < 8; j++) {
                    if ((i == 7 || i == 1 || j == 7 || j == 1) && alea.double() > 0.8) {
                        this.setBlock(chunk, x + i, y + 1, z + j, BLOCK.COBWEB);
                    }
                }
            }
        }
        // светящийся лишайник
        if (light == 1) {
            for (let i = 1; i < 8; i++) {
                for (let j = 1; j < 8; j++) {
                    if (j == 4 && i == 4) {
                        continue;
                    }
                    if (alea.double() > 0.8) {
                        this.setBlock(chunk, x + i, y + 3, z + j, BLOCK.GLOW_LICHEN, {x: 0, y: 0, z: 0}, {
                            down: true,
                        });
                    }
                    if (alea.double() > 0.9) {
                        this.setBlock(chunk, x + i, y + 1, z + j, BLOCK.BROWN_MUSHROOM);
                    }
                }
            }
        }
        // факелы
        if (light == 2) {
            this.setBlock(chunk, x + 1, y + 2, z + 1, BLOCK.TORCH, {x: 3, y: 0, z: 0});
            this.setBlock(chunk, x + 7, y + 2, z + 7, BLOCK.TORCH, {x: 1, y: 0, z: 0});
        }

        // Сундук
        this.setBlock(chunk, x + 3, y + 1, z + 3, BLOCK.CHEST, {x: 0, y: 0, z: 0}, {generate: true, params: {source: 'treasure_room'}});

        // Спавнер
        const mob = alea.double() < 0.75 ? 'mob/zombie' : 'mob/skeleton';
        this.setBlock(chunk, x + 5, y + 1, z + 5, BLOCK.MOB_SPAWN, {x: 0, y: 0, z: 0}, {
            type: mob,
            skin: 'base',
            max_ticks: 800
        });

        if (!HIDE_DUNGEON) {
            this.genBox(chunk, alea, x + 3, y + 9, z + 3, 3, 1, 3, block_wall_1);
            this.genBox(chunk, alea, x + 3, y + 10, z + 4, 1, 2, 1, block_wall_5);
            this.genBox(chunk, alea, x + 5, y + 10, z + 4, 1, 2, 1, block_wall_5);
            this.genBox(chunk, alea, x + 3, y + 12, z + 3, 3, 1, 3, block_wall_6, 1, {x:0, y:0, z:0}, {point:{x: 0.55, y: 0, z: 0}});
            this.genBoxNoAir(chunk, alea, x + 4, y + 4, z + 4, 1, 7, 1, BLOCK.AIR);
        }
    }

    // Проверка места установки данжа колодец
    checkPositionHole(chunk, x, y, z) {
        if ( x > 8 || x < 1 || z > 8 || z < 1) {
            return false;
        }
        // Под основнием нет пустот
        for (let i = 0; i <= 8; i++) {
            for (let j = 0; j <= 8; j++) {
                const up = this.getBlock(chunk, i + x, y, j + z);
                if(!up || up.id == 0) {
                    return false;
                }
                const middle = this.getBlock(chunk, i + x, y + 2, j + z);
                if(!middle || middle.id == 0) {
                    return false;
                }
                const bottom = this.getBlock(chunk, i + x, y + 4, j + z);
                if(!bottom || bottom.id == 0) {
                    return false;
                }
            }
        }
         // Под основанием нет пустот
        for (let i = 2; i <= 7; i++) {
            for (let j = 2; j <= 7; j++) {
                const air = this.getBlock(chunk, i + x, y + 9, j + z);
                if(!air) {
                    return false;
                }
                 if((air.id != 0 || air.fluid != 0) && air.material.style_name != 'planting' && air.id != BLOCK.SNOW.id) {
                    return false;
                }
                const ground = this.getBlock(chunk, i + x, y + 8, j + z);
                if(!ground || ground.id == 0 || ground.id == BLOCK.SNOW.id) {
                    return false;
                }
            }
        }
        return true;
    }

    genDung(chunk, alea, x, y, z) {

        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.STONE_BRICKS);
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.MOSSY_STONE_BRICKS, 0.5);
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.MOSS_BLOCK, 0.3);
        this.genBoxNoAir(chunk, alea, x, y + 1, z, 7, 1, 7, BLOCK.LODESTONE);
        this.genBox(chunk, alea, x + 1, y + 1, z + 1, 5, 3, 5, BLOCK.AIR);

        this.genBox(chunk, alea, x + 6, y + 1, z + 3, 1, 3, 1, BLOCK.AIR);

        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.STONE_BRICKS);
        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.MOSSY_STONE_BRICKS, 0.5);
        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.MOSS_BLOCK, 0.3);
        this.genBox(chunk, alea, x + 7, y + 1, z, 7, 1, 7, BLOCK.LODESTONE);
        this.genBox(chunk, alea, x + 7, y + 1, z + 1, 5, 3, 5, BLOCK.AIR);

        // Декор
        this.deleteWall(chunk, alea, x, y, z);
        this.setBlock(chunk, x + 6, y + 3, z + 3, BLOCK.IRON_BARS);

        this.genIfOpaqueNeighbors(chunk, alea, x, y, z, 7, 1, 7, BLOCK.STILL_WATER, 0.1)

        const rotate = new Vector(DIRECTION.NORTH, 0, 0);
        this.setBlock(chunk, x + 10, y + 1, z + 1, BLOCK.CHEST, rotate, {generate: true, params: {source: 'treasure_room'}});

        // Спавнер
        const mob = alea.double() < 0.75 ? 'mob/zombie' : 'mob/skeleton';
        this.setBlock(chunk, x + 9, y + 1, z + 3, BLOCK.MOB_SPAWN, {x: 0, y: 0, z: 0}, {
            type: mob,
            skin: 'base',
            max_ticks: 800
        });

    }

    checkPosition(chunk, x, y, z) {

        if ( x > 3 || x < 1 || z > 9 || z < 1) {
            return false;
        }

        // Под основным блоком нет пустот
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                const up = this.getBlock(chunk, i + x + 6, y, j + z);
                if(!up || up.id == 0) return false;
                const middle = this.getBlock(chunk, i + x + 6, y + 2, j + z);
                if(!middle || middle.id == 0) return false;
                const bottom = this.getBlock(chunk, i + x + 6, y + 4, j + z);
                if(!bottom || bottom.id == 0) return false;
            }
        }

        // У левой стенки есть пустоты
        for(let i = 0; i < 7; i++) {
            const top = this.getBlock(chunk, x - 1, y + 2, i + z);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x - 1, y + 1, i + z);
                if(bottom && bottom.id == 0) return true;
            }
        }

        // У фронтальной стенки есть пустоты
        for(let i = 0; i < 7; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z + 7);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x + i, y + 1, z + 7);
                if(bottom && bottom.id == 0) return true;
            }
        }

        // У тыльной стенки есть пустоты
        for(let i = 0; i < 7; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z - 1);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x + i, y + 1, z - 1);
                if(bottom && bottom.id == 0) return true;
            }
        }

        return false;

    }

    //
    deleteWall(chunk, alea, x, y, z) {

        for (let i = 0; i < 6; i++) {
            const top = this.getBlock(chunk, x - 1, y + 2, i + z);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x - 1, y + 1, i + z);
                if(bottom && bottom.id == 0) {
                    this.genBox(chunk, alea, x, y + 1, z + i, 1, 3, 1, BLOCK.AIR);
                }
            }
        }

        for(let i = 0; i < 6; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z - 1);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x + i, y + 1, z - 1);
                if(bottom && bottom.id == 0) {
                    this.genBox(chunk, alea, x + i, y + 1, z, 1, 3, 1, BLOCK.AIR);
                }
            }
        }

        for(let i = 0; i < 6; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z + 7);
            if(top && top.id == 0) {
                const bottom = this.getBlock(chunk, x + i, y + 1, z + 7);
                if(bottom && bottom.id == 0) {
                    this.genBox(chunk, alea, x + i, y + 1, z + 6, 1, 3, 1, BLOCK.AIR);
                }
            }
        }

    }

    genBox(chunk, alea, minX, minY, minZ, nX, nY, nZ, blocks = {id: 0}, chance = 1, rotate = null, extra_data = null) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if(is_chance) {
                            this.setBlock(chunk, x, y, z, blocks, rotate, extra_data);
                        }
                    }
                }
            }
        }
    }

    genBoxAir(chunk, alea, minX, minY, minZ, nX, nY, nZ, block = {id : 0}, chance = 1) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if (is_chance) {
                            const existing_block = this.getBlock(chunk, x, y, z);
                            if (existing_block.id == 0) {
                                chunk.tblocks.setBlockId(x, y, z, block.id);
                            }
                        }
                    }
                }
            }
        }
    }

    // вставляет блок, если вокруг него все соседи solid блоки (чтобы если мы ставим блок воды, он не никуда выливался), также проверяется, чтобы сверху был воздух (опционально)
    genIfOpaqueNeighbors(chunk : ChunkWorkerChunk, alea, minX : int, minY : int, minZ : int, nX : int, nY : int, nZ : int, block = {id: 0}, chance : float = 1, up_is_air : boolean = true) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance
                        if (is_chance) {
                            let ok = true
                            for(let p of OPAQUE_NEIGHBOUR_POSES) {
                                const existing_block = this.getBlock(chunk, x + p.x, y + p.y, z + p.z)
                                if(!existing_block || !(BLOCK.flags[existing_block.id] & BLOCK_FLAG.SOLID)) {
                                    ok = false
                                    break
                                }
                            }
                            if(ok) {
                                if(up_is_air) {
                                    const existing_block = this.getBlock(chunk, x, y + 1, z)
                                    if(!existing_block || existing_block.id != 0) {
                                        ok = false
                                    }
                                }
                                if(ok) {
                                    if(BLOCK.flags[block.id] & BLOCK_FLAG.FLUID) {
                                        chunk.tblocks.setBlockId(x, y, z, 0)
                                        chunk.setBlockIndirect(x, y, z, block.id)
                                    } else {
                                        chunk.tblocks.setBlockId(x, y, z, block.id)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    genBoxNoAir(chunk : ChunkWorkerChunk, alea, minX : int, minY : int, minZ : int, nX : int, nY : int, nZ : int, block = {id: 0}, chance : float = 1) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const existing_block = this.getBlock(chunk, x, y, z)
                        const is_chance = (chance == 1) ? true : alea.double() < chance
                        if (is_chance) {
                            if (existing_block.id != 0) {
                                if(BLOCK.flags[block.id] & BLOCK_FLAG.FLUID) {
                                    chunk.tblocks.setBlockId(x, y, z, 0)
                                    chunk.setBlockIndirect(x, y, z, block.id)
                                } else {
                                    chunk.tblocks.setBlockId(x, y, z, block.id)
                                }
                            }
                        } else if (existing_block.id == BLOCK.GRASS_BLOCK.id || existing_block.id == BLOCK.SNOW_DIRT.id) {
                            chunk.tblocks.setBlockId(x, y, z, BLOCK.DIRT.id);
                        }
                    }
                }
            }
        }
    }

    setBlock(chunk : ChunkWorkerChunk, x : int, y : int, z : int, block_type, rotate? : IVector, extra_data? : any) {
        if (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            const { tblocks } = chunk;
            tblocks.setBlockId(x, y, z, block_type.id);
            if(rotate || extra_data) {
                tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data);
            }
        }
    }

    getBlock(chunk, x, y, z) {
        if (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            return chunk.tblocks.get(_vec.set(x, y, z));
        }
    }

}