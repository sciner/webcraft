import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {DIRECTION} from '../../helpers.js';
import {Color, Vector} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';

const MINE_SIZE_X = 10;
const MINE_SIZE_Z = 10;

const LANTERN_ROT_UP = {x: 0, y: -1, z: 0};

export class MineGenerator {
    constructor(x, y, z, options = {}) {
        this.x = x;
        this.y = y;
        this.z = z;
        
        this.chance_hal = (options.chance_hal) ? options.chance_hal : 0.5;
        this.chance_cross = (options.chance_cross) ? options.chance_cross : 0.2;

        for (let i = 0; i < 100; ++i){
            this.map = [];
            this.genNode(0, 0, 0, DIRECTION.SOUTH);
            if (this.map.length > 20)
                break;
        }
        console.log("generator mine " + this.map.length)
        
        this.voxel_buildings = [];
    }
    
    async setSeed(seed) {
        this.seed = seed;
    }
    
    generate(chunk){
        let x = chunk.addr.x - this.x;
        let y = chunk.addr.y - this.y;
        let z = chunk.addr.z - this.z;
        let random = new alea(x + "mine" + y + "mine" + z);
        
        if (x == 0 && z == 0)
            this.genEnter(chunk, random, DIRECTION.SOUTH);
        
        let node = this.findNode(x, y, z);
        if (node == null)
            return;
        
        if (node.type == "hal") {
            this.genSmallHal(chunk, random, node.dir);
        } else if (node.type == "cross") {
            this.genSmallCross(chunk, random, node.dir);
        } else {
            this.genSideRoom(chunk, random, node.dir);
        }
    }
    
    genEnter(chunk, random, dir) {
        let vec = new Vector(0, 0, 0);
        let y = chunk.addr.y + 5;
        
        this.genBox(chunk, 0, 1, 8, 15, 3, 15, dir);
        this.genBox(chunk, 0, 0, 0, 15, 0, 15, dir, BLOCK.OAK_PLATE);
        
        this.genBox(chunk, 5, 1, 2, 7, 12, 7, dir);
        this.genBox(chunk, 4, y, 1, 4, y + 5, 1, dir, BLOCK.OAK_TRUNK);
        this.genBox(chunk, 8, y, 1, 8, y + 5, 1, dir, BLOCK.OAK_TRUNK);
        this.genBox(chunk, 4, y + 4, 1, 8, y + 4, 1, dir, BLOCK.OAK_TRUNK);
        
        vec.set(15, 3, 15).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP); 
        vec.set(0, 3, 15).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP); 
        vec.set(0, 3, 8).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
        vec.set(15, 3, 8).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
        
        for (let n = 0; n < 6; ++n) {
            this.genBox(chunk, 4, y - n, 2 + n, 8, y - n, 2 + n, dir, BLOCK.OAK_PLATE);
            this.genBox(chunk, 4, y - n + 4, 3 + n, 8, y - n + 4, 3 + n, dir, BLOCK.OAK_PLATE);
            this.genBox(chunk, 4, y - n, 2 + n, 4, y - n + 4, 2 + n, dir, BLOCK.OAK_PLATE);
            this.genBox(chunk, 8, y - n, 2 + n, 8, y - n + 4, 2 + n, dir, BLOCK.OAK_PLATE);
        }
    }
    
    genSideRoom(chunk, random, dir){
        this.genBox(chunk, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, 1, 1, 1, 8, 3, 4, dir);
        let ceiling = [];
        for (let x = 0; x <= 9; ++x) {
            ceiling[x] = [];
            for (let z = 0; z <= 4; ++z) {
                
                ceiling[x][z] = true;
            }
        }
    }
    
    genSmallHal(chunk, random, dir){
        this.genBox(chunk, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, random, 0.05);
        this.genBox(chunk, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLATE);
        
        let interval = Math.round(random.double()) + 4;
        for (let n = 0; n <= 15; n += interval) {
             //опоры
            this.genBox(chunk, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            this.genBoxNoAir(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB, random, 0.25);
            
            this.genBoxAir(chunk, 1, 3, n - 1, 1, 3, n + 1, dir, BLOCK.MOSS_STONE, random, 0.25); //добавить из окружения
            this.genBoxAir(chunk, 3, 3, n - 1, 3, 3, n + 1, dir, BLOCK.MOSS_STONE, random, 0.25);
            
            //путина
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, random, 0.05);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, random, 0.05);
            
            //грибы
            this.genBoxAir(chunk, 1, 1, n - 3, 1, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, random, 0.01);
            this.genBoxAir(chunk, 3, 1, n - 3, 3, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, random, 0.01);
            
            //факел
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, random, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, random, 0.1, LANTERN_ROT_UP);
        }
    }
    
    genSmallCross(chunk, random, dir){
        //тунель
        this.genBox(chunk, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, random, 0.05);
        //this.genBox(chunk, 0, 0, 11, 15, 3, 15, dir, BLOCK.OAK_PLATE, random, 0.05);
        
        this.genBox(chunk, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, 1, 1, 12, 15, 3, 14, dir);
        
        this.genBox(chunk, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLATE);
        this.genBox(chunk, 1, 0, 12, 15, 0, 14, dir, BLOCK.OAK_PLATE);
        this.genBox(chunk, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLATE);
        
        let interval = Math.round(random.double()) + 4;
        for (let n = 0; n < 16; n += interval) {
             //опоры
            this.genBox(chunk, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            
            this.genBox(chunk, n, 1, 14, n, 2, 14, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, n, 1, 12, n, 2, 12, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, n, 3, 12, n, 3, 14, dir, BLOCK.OAK_SLAB);
            
            //путина
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, random, 0.05);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, random, 0.05);
            
            this.genBoxAir(chunk, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.COBWEB, random, 0.05);
            this.genBoxAir(chunk, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.COBWEB, random, 0.05);
            
            //факелы
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, random, 0.2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, random, 0.1, LANTERN_ROT_UP);
            
            this.genBoxAir(chunk, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.LANTERN, random, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.LANTERN, random, 0.2, LANTERN_ROT_UP);
        }
    }
    
    genNode(x, y, z, dir) {
        if (x > MINE_SIZE_X || x < 0 || z > MINE_SIZE_Z || z < 0)
            return;
        
        let new_x = x, new_y = y, new_z = z;
        
        if (dir == DIRECTION.SOUTH) {
            ++new_z;
        } else if (dir == DIRECTION.EAST) {
            ++new_x;
        } else if (dir == DIRECTION.NORTH) {
            --new_z;
        } else if (dir == DIRECTION.WEST){
            --new_x;
        }
        
        let node = this.findNode(new_x, new_y, new_z);
        if (node != null)
            return;
        
        if ((x == 0 && z == 0) || (Math.random() < this.chance_cross)) {
            this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "cross"});
            this.genNode(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNode(new_x, new_y, new_z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNode(new_x, new_y, new_z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }
        
        if (Math.random() < this.chance_hal) {
            this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "hal"});
            this.genNode(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            return;
        }
        
        this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "room"});
    }
    
    wrapRotation(dir, angle) {
        //TO DO нельзя править направление DIRECTION
        let new_dir = dir - angle;
        if (new_dir == -1) {
            new_dir = 3;
        } else if (new_dir == -2) {
            new_dir = 2;
        }
        return new_dir;
    }
    
    
    getBlock(chunk, x, y, z) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }
    
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
    
    setBlock(chunk, x, y, z, block_type, force_replace, rotate, extra_data) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            this.xyz_temp = new Vector(0, 0, 0);
            this.xyz_temp.set(x, y, z);
            if(force_replace || !chunk.tblocks.has(this.xyz_temp)) {
                this.xyz_temp_coord = new Vector(0, 0, 0);
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                if(!this.getVoxelBuilding(this.xyz_temp_coord)) {
                    let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * this.xyz_temp.y + (this.xyz_temp.z * CHUNK_SIZE_X) + this.xyz_temp.x;
                    chunk.tblocks.id[index] = block_type.id;
                    if(rotate || extra_data) {
                        this.temp_tblock = chunk.tblocks.get(this.xyz_temp, this.temp_tblock);
                        if(rotate) this.temp_tblock.rotate = rotate;
                        if(extra_data) this.temp_tblock.extra_data = extra_data;
                    }
                    // chunk.tblocks.delete(this.xyz_temp);
                    // this.temp_tblock = chunk.tblocks.get(this.xyz_temp, this.temp_tblock);
                    // this.temp_tblock.id = block_type.id;
                }
            }
        }
    }
    
    findNode(x, y, z){
        for (let node of this.map){
            if (node.x == x && node.y == y && node.z == z){
                return node;
            }
        }
        return null;
    }
    
    /**
     * TO DO EN генерация бокса внутри чанка, генерация с вероятностью установки
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {alea} random ссылка на модуль рандома
     * @param {float} chance вероятность установки
     */
    genBox(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION.NORTH, blocks = {id : 0}, random = null, chance = null){
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let is_chance = (random == null) ? true : random.double() < chance; 
                    let vec = (new Vector(x, y, z)).rotY(dir); 
                    if (is_chance) {
                        if (blocks.id == null ){
                            for (let block of blocks) {
                                if (random.double() < block.chance){
                                   this.setBlock(chunk, vec.x, vec.y, vec.z, block, true);  
                                }
                            }
                        } else {
                            this.setBlock(chunk, vec.x, vec.y, vec.z, blocks, true); 
                        }
                    }
                }
            }
        }
    }
    /**
     * TO DO EN замена воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION_BIT} dir поворот внутри чанка
     * @param {alea} random ссылка на модуль рандома
     * @param {float} chance вероятность замены
     */
    genBoxAir(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, random = null, chance = null, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, vec.x, vec.y, vec.z);
                    let is_chance = (random == null) ?  true : random.double() < chance;
                    if (is_chance == true && temp_block != null && temp_block.id == 0) {
                        this.setBlock(chunk, vec.x, vec.y, vec.z, block, true, block_rotate); 
                    }
                }
            }
        }
    }
    /**
     * TO DO EN замена не воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION_BIT} dir поворот внутри чанка
     * @param {alea} random ссылка на модуль рандома
     * @param {float} chance вероятность замены
     */
    genBoxNoAir(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, random = null, chance = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, vec.x, vec.y, vec.z);
                    let is_chance = (random == null) ?  true : random.double() < chance;
                    if (is_chance == true && temp_block != null && temp_block.id != 0) {
                        this.setBlock(chunk, vec.x, vec.y, vec.z, block, true); 
                    }
                }
            }
        }
    }
    
    getMainSelector(random){
        let rnd = Math.floor(random.double() * 3.0);
        console.log(vatiants.main[rnd].block);
        return vatiants.main[rnd].block;
    }
}