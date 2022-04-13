import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Color, Vector} from '../../helpers.js';
import { Default_Terrain_Generator } from '../default.js';
import {BLOCK} from '../../blocks.js';
import {impl as alea} from '../../../vendors/alea.js';

let Direction = {South: 0, East: 1, North: 2, West: 3};
const MINE_SIZE_X = 10;
const MINE_SIZE_Z = 10;
const CHANCE_HAL = 0.5;
const CHANCE_BRANCH = 0.2;
const CHANCE_CROSS = 0.2;
export class Mine {
    constructor() {
        this.map = [];
        
    }
    
    genMine(chunk){
        let x = chunk.addr.x - 180;
        let z = chunk.addr.z - 173;
        let y = chunk.addr.y;
        
        let xyz = chunk.coord.add(new Vector(x, y, z));
        let random = new alea('tree' + xyz.toHash());
        
        
       let node = this.findNode(x, y, z);
       if (node) {
           if (node.type == "hal") {
               this.genBigHal(chunk, node, random);
                //this.setFill(chunk, node.dir, 4, 1, 0, 11, 5, 15, 0);
            }
            if (node.type == "cross" || node.type == "branch") {
                this.setFill(chunk, node.dir, 4, 1, 0, 11, 6, 15, 0);
                this.setFill(chunk, node.dir, 0, 1, 4, 15, 6, 11, 0);
            }
            if (node.type == "room") {
                this.setFill(chunk, node.dir, 0, 1, 0, 15, 10, 15, 0);
            }
       }
        
    }
    
   genBigHal(chunk, node, random){
        this.rplBlockNonAir(chunk, node.dir, random, 0.6, 4, 0, 0, 11, 7, 15, 1);
        this.rplBlockNonAir(chunk, node.dir, random, 0.6, 4, 0, 0, 11, 0, 15, 5);
        this.setFill(chunk, node.dir, 5, 1, 0, 10, 4, 15, 0);
        this.setFill(chunk, node.dir, 6, 4, 0, 9, 5, 15, 0);
        this.setFill(chunk, node.dir, 7, 6, 0, 8, 6, 15, 0);
        this.setBlock(chunk, 7, 2, 7, BLOCK.TORCH.id);
    }
    
    rplBlockNonAir(chunk, dir, random, chance, minX, minY, minZ, maxX, maxY, maxZ, id) {
         for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    if (random.double() < chance) {
                        
                         if (dir == Direction.South || dir == Direction.North)
                        this.setBlock(chunk, x, y, z, id);
                    else
                       this.setBlock(chunk, z, y, x, id); 
                    }
                        
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
    
    setFill(chunk, dir, minX, minY, minZ, maxX, maxY, maxZ, id) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    if (dir == Direction.South || dir == Direction.North)
                        this.setBlock(chunk, x, y, z, id);
                    else
                       this.setBlock(chunk, z, y, x, id); 
                }
            }
        }
    }
    
    setBlock(chunk, x, y, z, id) {
        let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
        chunk.tblocks.id[index] = id;
    }
}