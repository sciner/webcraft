import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Color, Vector, DIRECTION} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';

const LANTERN_ROT_UP = {x: 0, y: -1, z: 0};
export const MINE_SIZE = new Vector(128, 40, 128);

/**
 * Draw mines
 * @class MineGenerator
 * @param {World} world world
 * @param {number} x x chunk positon
 * @param {number} y y chunk positon
 * @param {number} z z chunk positon
 * @param {object} options options
 */
export class MineGenerator {

    static all = new VectorCollector();

    constructor(world, x, y, z, options = {}) {
        this.size_x = (options.size_x) ? options.size_x : 20;
        this.size_z = (options.size_z) ? options.size_z : 20;
        this.chance_hal = (options.chance_hal) ? options.chance_hal : 0.5;
        this.chance_cross = (options.chance_cross) ? options.chance_cross : 0.2;
        this.chance_side_room = (options.chance_side_room) ? options.chance_side_room : 0.5;
        this.world = world;
        this.x = x;
        this.y = y;
        this.z = z;
        this.random = new alea(x + "mine" + y + "mine" + z);
        for (let i = 0; i < 1000; ++i) {
            this.map = [];
            this.genNodeMine(0, 0, 0, DIRECTION.SOUTH);
            if (this.map.length > ((this.size_x + this.size_z) / 2)){
                break;
            }
        }
        
        console.log("[INFO]MineGenerator: generation " + this.map.length + " nodes");
        
        this.voxel_buildings = [];
    }

    // getForCoord
    static getForCoord(generator, coord) {
        const addr = new Vector(coord.x, 0, coord.z).divScalarVec(MINE_SIZE).flooredSelf();
        let mine = MineGenerator.all.get(addr);
        if(mine) {
            return mine;
        }
        mine = new MineGenerator(generator, addr.x, addr.y, addr.z);
        MineGenerator.all.set(addr, mine);
        return mine;
    }

    generate(chunk){
        let x = chunk.addr.x - this.x;
        let y = chunk.addr.y - this.y;
        let z = chunk.addr.z - this.z;
        
        let node = this.findNodeMine(x, y, z);
        if (node == null)
            return;
        
        if (node.type == "enter") {
            this.genNodeEnter(chunk, node.dir);
        } else if (node.type == "cross") {
            this.genNodeCross(chunk, node.dir);
        } else if (node.type == "hal") {
            this.genNodeHal(chunk, node.dir);
        } else if (node.type == "room") {
            this.genNodeSideRoom(chunk, node.dir);
        }
    }
    
    genNodeSideRoom(chunk, dir){
        this.genBox(chunk, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, 1, 1, 1, 8, 3, 4, dir);
        
        let vec = new Vector(0, 0, 0);
        vec.set(8, 3, 4).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
        
        vec.set(1, 1, 1).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.CHEST, true, LANTERN_ROT_UP);
    }
    
    genNodeEnter(chunk, dir){
        this.genBox(chunk, 0, 1, 8, 15, 50, 15, dir);
        this.genBox(chunk, 0, 0, 0, 15, 0, 15, dir, BLOCK.OAK_PLATE);
        
        let vec = new Vector(0, 0, 0);
        vec.set(15, 3, 15).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP); 
        vec.set(0, 3, 15).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP); 
        vec.set(0, 3, 8).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
        vec.set(15, 3, 8).rotY(dir); 
        this.setBlock(chunk, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
    }
     
    genNodeCross(chunk, dir){
        this.genBox(chunk, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);
        
        this.genBox(chunk, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, 1, 1, 12, 15, 3, 14, dir);
        
        this.genBox(chunk, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLATE);
        this.genBox(chunk, 1, 0, 12, 15, 0, 14, dir, BLOCK.OAK_PLATE);
        this.genBox(chunk, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLATE);
        
        let interval = Math.round(this.random.double()) + 4;
        for (let n = 0; n < 16; n += interval) {
             //опоры
            this.genBox(chunk, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            
            this.genBox(chunk, n, 1, 14, n, 2, 14, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, n, 1, 12, n, 2, 12, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, n, 3, 12, n, 3, 14, dir, BLOCK.OAK_SLAB);
            
            //путина
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            
            this.genBoxAir(chunk, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.COBWEB, 0.05);
            
            //факелы
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, 0.2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.1, LANTERN_ROT_UP);
            
            this.genBoxAir(chunk, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.LANTERN, 0.2, LANTERN_ROT_UP);
        }
    }
    
    genNodeHal(chunk, dir) {
        this.genBox(chunk, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);
        this.genBox(chunk, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLATE);
        
        let interval = Math.round(this.random.double()) + 4;
        for (let n = 0; n <= 15; n += interval) {
            this.genBox(chunk, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            
             this.genBoxNoAir(chunk, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB, 0.25);
            
            this.genBoxAir(chunk, 1, 3, n - 1, 1, 3, n + 1, dir, BLOCK.COBBLESTONE, 0.25); //добавить из окружения
            this.genBoxAir(chunk, 3, 3, n - 1, 3, 3, n + 1, dir, BLOCK.DIRT, 0.25);
            
            //путина
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            
            //грибы
            this.genBoxAir(chunk, 1, 1, n - 3, 1, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);
            this.genBoxAir(chunk, 3, 1, n - 3, 3, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);
            
            //факел
            this.genBoxAir(chunk, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
        }
    }
    
    genNodeMine(x, y, z, dir) {
        if (x > this.size_x || x < 0 || z > this.size_z || z < 0)
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
        
        if (this.map.length == 0) {
            this.map.push({"x" : x, "y": y, "z": z, "dir": dir, "type": "enter"});
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }
        
        let node = this.findNodeMine(new_x, new_y, new_z);
        if (node != null)
            return;
        
        if (this.random.double() < this.chance_cross) {
            this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "cross"});
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }
        
        if (this.random.double() < this.chance_hal) {
            this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "hal"});
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            return;
        }
        
        if (this.random.double() < this.chance_side_room) {
            this.map.push({"x" : new_x, "y": new_y, "z": new_z, "dir": dir, "type": "room"});
        }
    }
    
    findNodeMine(x, y, z){
        for (let node of this.map){
            if (node.x == x && node.y == y && node.z == z){
                return node;
            }
        }
        return null;
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
    
    getBlock(chunk, x, y, z) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }
    
    wrapRotation(dir, angle) {
        let new_dir = dir - angle;
        if (new_dir == -1) {
            new_dir = 3;
        } else if (new_dir == -2) {
            new_dir = 2;
        }
        return new_dir;
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
     * @param {float} chance вероятность установки
     */
    genBox(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION.NORTH, blocks = {id : 0}, chance = 1){
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let is_chance = (chance == 1) ? true : this.random.double() < chance; 
                    let vec = (new Vector(x, y, z)).rotY(dir); 
                    if (is_chance) {
                        this.setBlock(chunk, vec.x, vec.y, vec.z, blocks, true); 
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
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     * @param {Vector} block_rotate поворот блока
     */
    genBoxAir(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, vec.x, vec.y, vec.z);
                    let is_chance = (chance == 1) ?  true : this.random.double() < chance;
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
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     */
    genBoxNoAir(chunk, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, vec.x, vec.y, vec.z);
                    let is_chance = (chance == 1) ?  true : this.random.double() < chance;
                    if (is_chance == true && temp_block != null && temp_block.id != 0) {
                        this.setBlock(chunk, vec.x, vec.y, vec.z, block, true); 
                    }
                }
            }
        }
    }
}