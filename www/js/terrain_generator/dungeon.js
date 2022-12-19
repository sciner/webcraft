import {impl as alea} from '../../vendors/alea.js';
import {Vector, DIRECTION} from "../helpers.js";
import {BLOCK} from '../blocks.js';
import { CHUNK_SIZE } from '../chunk_const.js';

const _pos = new Vector(0, 0, 0);
const _vec = new Vector(0, 0, 0);

export class DungeonGenerator {
    
    constructor(seed) {
        this.seed = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
    }
    
    add(chunk) {
        const random = new alea(this.seed + chunk.addr.toString());
        // 8 попыток установки
        for(let n = 0; n < 8; n++) {
            _pos.fromFlatChunkIndex(Math.floor(random.double() * CHUNK_SIZE));
            //if(this.checkPosition(chunk, _pos.x, _pos.y, _pos.z)) {
            //   this.genDung(chunk, random, _pos.x, _pos.y, _pos.z);
            //   break;
           // }
            if(this.checkPositionHole(chunk, _pos.x, _pos.y, _pos.z)) {
               this.genDungeonHole(chunk, random, _pos.x, _pos.y, _pos.z);
               break;
            }
        }
    }
    
    /*
    * Данж заброшенный колодец
    */
    genDungeonHole(chunk, alea, x, y, z, biome) {
        const map = chunk.map;
        console.log(map.cells[0].biome);
        const up = this.getBlock(chunk, x, y, z);
        console.log('genDungeonHole: ' + up.posworld + ' ' + biome)
        let block_well_1 = BLOCK.STONE_BRICKS;
        let block_well_2 = BLOCK.MOSSY_STONE_BRICKS;
        let block_well_3 = BLOCK.MOSSY_STONE_BRICKS;
        
        // стенки верха (входа)
        this.genBox(chunk, alea, x + 3, y + 5, z + 3, 4, 3, 4, block_well_1);
        this.genBoxNoAir(chunk, alea, x + 4, y + 4, z + 4, 2, 7, 2, BLOCK.AIR);
        this.genBoxNoAir(chunk, alea, x + 3, y + 5, z + 3, 4, 3, 4, block_well_2, 0.5);
        this.genBoxNoAir(chunk, alea, x + 3, y + 5, z + 3, 4, 3, 4, block_well_3, 0.3);
        // стенки данжа
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, block_well_1);
        this.genBoxNoAir(chunk, alea, x + 1, y + 1, z + 1, 7, 3, 7, BLOCK.AIR);
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, block_well_2, 0.5);
        this.genBoxNoAir(chunk, alea, x, y, z, 9, 5, 9, block_well_3, 0.3);
        
       // this.genBox(chunk, alea, x + 3, y + 8, z + 3, 5, 1, 5, block_well_1);
       // this.genBox(chunk, alea, x + 3, y + 8, z + 3, 5, 1, 4, block_well_2, 0.5);
       // this.genBox(chunk, alea, x + 3, y + 8, z + 3, 5, 1, 5, block_well_3, 0.3);
        
        
        // Очищаем блоки под место установки
        
    }
    // Проверка места установки данжа колодец
    checkPositionHole(chunk, x, y, z) {
        if ( x > 9 || x < 1 || z > 9 || z < 1) {
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
             //   const bottom = this.getBlock(chunk, i + x, y + 4, j + z);
             //   if(!bottom || bottom.id == 0) {
              //      return false;
              //  }
            }
        }
         // Под основнием нет пустот
        for (let i = 2; i <= 7; i++) {
            for (let j = 2; j <= 7; j++) {
                const air = this.getBlock(chunk, i + x, y + 8, j + z);
                if(!air) {
                    return false;
                }
                 if((air.id != 0 || air.fluid != 0) && air.material.style != 'planting') {
                    return false;
                }
                const ground = this.getBlock(chunk, i + x, y + 7, j + z);
                if(!ground || ground.id == 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    
    /*
    * Вертикальный данж
    */
    genDungeonVertial(chunk, alea, x, y, z, biome) {
        // Проверяем можно ли на это место поставить данж
        if (!checkPosition()) {
            return;
        }

        const block_well_1 = BLOCK.STONE_BRICKS;
        const block_well_2 = BLOCK.MOSSY_STONE_BRICKS;
        const block_well_3 = BLOCK.MOSSY_STONE_BRICKS;
        
        // стенки верха (входа)
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_1);
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_2, 0.5);
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_3, 0.3);
        
        // стенки верха (входа)
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_1);
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_2, 0.5);
        this.genBoxNoAir(chunk, alea, x, y + 7, z, 8, 3, 8, block_well_3, 0.3);
        
        // Очищаем блоки под место установки
        this.genBoxNoAir(chunk, alea, x + 4, y + 4, z + 4, 2, 7, 2, BLOCK.AIR);
    }
    // Проверка места установки данжа
    checkPositionVertical(chunk, x, y, z) {
        //if ( x > 3 || x < 1 || z > 9 || z < 1) {
        //    return false;
        //}
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
        // У крыши есть пустоты
        for(let i = 0; i < 8; i++) {
            if (this.checkWellVerical(i + x, y + 8, z) || this.checkWellVerical(i + x, y + 8, z + 8) || this.checkWellVerical(x, y + 8, z + i) || this.checkWellVerical(x + 8, y + 8, z + i)) {
                return true;
            }
        }
    }
    
    // Проверям, что при возведении стены будет не менее 1 пустоты, размром с игрока
    checkWellVerical(x, y, z) {
        const top = this.getBlock(chunk, x, y + 1, z);
        if (top && top.id == 0 && top.fluid == 0) {
            const bottom = this.getBlock(chunk, x, y, z);
            if (bottom && bottom.id == 0 && bottom.fluid == 0) {
                    return true;
            }
        }
    }
    
    
    
    genDung(chunk, alea, x, y, z) {
        
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.STONE_BRICKS);
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.MOSSY_STONE_BRICKS, 0.5);
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 5, 7, BLOCK.MOSS_BLOCK, 0.3);
        this.genBoxNoAir(chunk, alea, x, y + 1, z, 7, 1, 7, BLOCK.LODESTONE);
        this.genBoxNoAir(chunk, alea, x, y, z, 7, 1, 7, BLOCK.AIR, 0.1);
        this.genBox(chunk, alea, x + 1, y + 1, z + 1, 5, 3, 5, BLOCK.AIR);
        
        this.genBox(chunk, alea, x + 6, y + 1, z + 3, 1, 3, 1, BLOCK.AIR);
        
        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.STONE_BRICKS);
        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.MOSSY_STONE_BRICKS, 0.5);
        this.genBox(chunk, alea, x + 7, y, z, 7, 5, 7, BLOCK.MOSS_BLOCK, 0.3);
        this.genBox(chunk, alea, x + 7, y + 1, z, 7, 1, 7, BLOCK.LODESTONE);
        this.genBox(chunk, alea, x + 7, y + 1, z + 1, 5, 3, 5, BLOCK.AIR);
        
        // Декор
        this.deleteWall(chunk, alea, x, y, z);
        
        this.setBlock(chunk, 9 + x, y + 1, 3 + z, BLOCK.MOB_SPAWN);
        this.setBlock(chunk, x + 6, y + 3, z + 3, BLOCK.IRON_BARS);
        
        const rotate = new Vector(DIRECTION.NORTH, 0, 0);
        this.setBlock(chunk, x + 10, y + 1, z + 1, BLOCK.CHEST, rotate, {generate: true, params: {source: 'treasure_room'}});
        
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
    
    genBox(chunk, alea, minX, minY, minZ, nX, nY, nZ, blocks = {id : 0}, chance = 1) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if(is_chance) {
                            chunk.tblocks.setBlockId(x, y, z, blocks.id);
                        }
                    }
                }
            }
        }
    }
    
    genBoxAir(chunk, alea, minX, minY, minZ, nX, nY, nZ, blocks = {id : 0}, chance = 1) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if (is_chance) {
                            const block = this.getBlock(chunk, x, y, z);
                            if (block.id == 0) {
                                chunk.tblocks.setBlockId(x, y, z, blocks.id);
                            }
                        }
                    }
                }
            }
        }
    }
    
    genBoxNoAir(chunk, alea, minX, minY, minZ, nX, nY, nZ, blocks = {id : 0}, chance = 1) {
        for (let x = minX; x < nX + minX; ++x) {
            for (let y = minY; y < nY + minY; ++y) {
                for (let z = minZ; z < nZ + minZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if (is_chance) {
                            const block = this.getBlock(chunk, x, y, z);
                            if (block.id != 0) {
                                chunk.tblocks.setBlockId(x, y, z, blocks.id);
                            }
                        }
                    }
                }
            }
        }
    }
    
    
    setBlock(chunk, x, y, z, block_type, rotate, extra_data) {
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