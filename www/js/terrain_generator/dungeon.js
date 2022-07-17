import {impl as alea} from '../../vendors/alea.js';
import {Vector, SpiralGenerator, VectorCollector, DIRECTION} from "../helpers.js";
import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE} from "../chunk_const.js";
import {AABB} from '../core/AABB.js';
import {BLOCK} from '../blocks.js';

export class DungeonGenerator {
    
    constructor(seed) {
        this.seed = typeof seed != 'undefined' ? seed : 'default_seed'; // unique world seed
    }
    
    add(chunk) {
        const random = new alea(this.seed + chunk.addr.toString());
        
        //8 попыток установки
        for (let n = 0; n < 8; n++) {
            const length = 7 + parseInt(random.double() * 2); //длина сокровищницы
            const width = (length == 9 && random.double() > 0.5) ? 9 : 7;//ширина сокровищницы
            const x = parseInt(random.double() * chunk.size.x);
            const y = parseInt(random.double() * chunk.size.y);
            const z = parseInt(random.double() * chunk.size.z);
            if (this.checkPosition(chunk, x, y, z, length, width)) {
               console.log("gen: " + n + " " + chunk.addr.toString());
               this.genDung(chunk, random, x, y, z, length, width);
               break;
            }
        }
    }
    
    genDung(chunk, alea, x, y, z, length, width) {
        //Структура
        this.genBox(chunk, alea, x, y, z, x + width, y + 5, z + length, BLOCK.COBBLESTONE);
        this.genBox(chunk, alea, x, y, z, x + width, y + 1, z + length, BLOCK.MOSSY_COBBLESTONE, 0.5);
        this.genBox(chunk, alea, x + 1, y + 1, z + 1, x + width - 1, y + 5, z + length - 1, BLOCK.AIR);

        this.genDecor(chunk, alea, x, y, z, length, width);
        
        this.setBlock(chunk, Math.round((width - 1) / 2) + x, y + 1, Math.round((length - 1) / 2) + z, BLOCK.MOB_SPAWN);
    }
    
    //Элементы примыкания и сундук
    genDecor(chunk, alea, x, y, z, length, width) {
        let set_chest = false;
        for (let i = 1; i < length - 1; i++) {
            const top = this.getBlock(chunk, x - 1, y + 2, i + z);
            const bottom = this.getBlock(chunk, x - 1, y + 1, i + z);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                this.genBox(chunk, alea, x, y + 1, z + i, x + 1, y + 5, z + i + 1, BLOCK.AIR);
            } else {
                if (!set_chest && alea.double() < 0.2) {
                    const rotate = new Vector(DIRECTION.EAST, 0, 0);
                    this.setBlock(chunk, x + 1, y + 1, z + i, BLOCK.CHEST, rotate);
                    set_chest = true;
                }
            }
        }
        
        for (let i = 1; i < length - 1; i++) {
            const top = this.getBlock(chunk, x + width, y + 2, i + z);
            const bottom = this.getBlock(chunk, x + width, y + 1, i + z);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                this.genBox(chunk, alea, x + width - 1, y + 1, z + i, x + width, y + 5, z + i + 1, BLOCK.AIR);
            } else {
                if (!set_chest && alea.double() < 0.2) {
                    const rotate = new Vector(DIRECTION.WEST, 0, 0);
                    this.setBlock(chunk, x + width - 2, y + 1, z + i, BLOCK.CHEST, rotate);
                    set_chest = true;
                }
            }
        }
        
        for (let i = 1; i < width - 1; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z - 1);
            const bottom = this.getBlock(chunk, x + i, y + 1, z - 1);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                this.genBox(chunk, alea, x + i, y + 1, z, x + i + 1, y + 5, z + 1, BLOCK.AIR);
            } else {
                if (!set_chest && alea.double() < 0.2) {
                    const rotate = new Vector(DIRECTION.NORTH, 0, 0);
                    this.setBlock(chunk, x + i, y + 1, z + 1, BLOCK.CHEST, rotate);
                    set_chest = true;
                }
            }
        }
        
        for (let i = 1; i < width - 1; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z + length);
            const bottom = this.getBlock(chunk, x + i, y + 1, z + length);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                this.genBox(chunk, alea, x + i, y + 1, z + length - 1, x + i + 1, y + 5, z + length, BLOCK.AIR);
            } else {
                if (!set_chest && alea.double() < 0.2) {
                    const rotate = new Vector(DIRECTION.SOUTH, 0, 0);
                    this.setBlock(chunk, x + i, y + 1, z + length - 2, BLOCK.CHEST, rotate);
                    set_chest = true;
                }
            }
        }
    }
    
    
    
    genBox(chunk, alea, minX, minY, minZ, maxX, maxY, maxZ, blocks = {id : 0}, chance = 1) {
        for (let x = minX; x < maxX; ++x) {
            for (let y = minY; y < maxY; ++y) {
                for (let z = minZ; z < maxZ; ++z) {
                    if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
                        const is_chance = (chance == 1) ? true : alea.double() < chance;
                        if (is_chance) {
                            chunk.tblocks.setBlockId(x, y, z, blocks.id);
                        }
                    }
                }
            }
        }
    }

    //Проверям место установки
    checkPosition(chunk, x, y, z, length, width) {
        if ((x + width) > 16 || x < 1 || (z + length) > 16 || z < 1) {
            return false;
        }
        
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < length; j++) {
               // const top = this.getBlock(chunk, i + x, y + 4, j + z);
                const bottom = this.getBlock(chunk, i + x, y + 4, j + z);
                if (!bottom || bottom.id == 0) {
                    return false;
                }
            }
        }
        
        for (let i = 1; i < length - 1; i++) {
            const top = this.getBlock(chunk, x - 1, y + 2, i + z);
            const bottom = this.getBlock(chunk, x - 1, y + 1, i + z);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                return true;
            }
        }
        
        for (let i = 1; i < length - 1; i++) {
            const top = this.getBlock(chunk, x + width, y + 2, i + z);
            const bottom = this.getBlock(chunk, x + width, y + 1, i + z);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                return true;
            }
        }
        
        for (let i = 1; i < width - 1; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z - 1);
            const bottom = this.getBlock(chunk, x + i, y + 1, z - 1);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                return true;
            }
        }
        
        for (let i = 1; i < width - 1; i++) {
            const top = this.getBlock(chunk, x + i, y + 2, z + length);
            const bottom = this.getBlock(chunk, x + i, y + 1, z + length);
            if (top && bottom && top.id == 0 && bottom.id == 0) {
                return true;
            }
        }
        
        return false;
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
            return chunk.tblocks.get(new Vector(x, y, z));
        }
    }
    
}