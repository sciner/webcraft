import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Color, Vector} from '../../helpers.js';
import {Mine} from './mine.js';
import {BLOCK} from '../../blocks.js';

let Direction = {South: 0, East: 1, North: 2, West: 3};
const MINE_SIZE_X = 10;
const MINE_SIZE_Z = 10;
const CHANCE_HAL = 0.5;
const CHANCE_BRANCH = 0.2;
const CHANCE_CROSS = 0.2;
export default class MineGenerator extends Mine {

    constructor(seed, world_id) {
        super();
        //this.setSeed(0);
        
        for (let i = 0; i < 100; ++i){
            this.map = [];
            this.genNode(1, 0, 1, Direction.North);
            if (this.map.length > 20)
                break;
        }
        
        console.log("generation mine " + this.map.length);
    }

    async init() {}
    
    generate(chunk) {
        
        

        // let block_id = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.DARK_OAK_PLANK.id : BLOCK.BIRCH_PLANK.id;
        let block_id = BLOCK.GRASS_DIRT.id;

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    let n = (chunk.addr.z == 173 && chunk.addr.x == 180) ? 1 : 10;
                    for(let y = 0; y < n; y++) {
                        this.setBlock(chunk, x, y, z, block_id);
                    }
                }
            }
        }
        
        this.genMine(chunk);

        let cell = {biome: {dirt_color: new Color(850 / 1024, 930 / 1024, 0, 0), code: 'Flat'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        let addr = chunk.addr;
        let size = chunk.size;

        return {
            chunk: {
                id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
                blocks: {},
                seed:   chunk.seed,
                addr:   addr,
                size:   size,
                coord:  addr.mul(size),
            },
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };
    }
    
    genNode(x, y, z, dir){
        if (x > MINE_SIZE_X || x < 0 || z > MINE_SIZE_Z || z < 0)
            return;
        let newX = x, newY = y, newZ = z;
        if (dir == Direction.South) {
            --newZ;
        }
        
        if (dir == Direction.East) {
            ++newX;
        }
        
        if (dir == Direction.North) {
            ++newZ;
        }
        
        if (dir == Direction.West) {
            --newX;
        }
        
        let node = this.findNode(newX, newY, newZ);
        if (node != null)
            return;
        
        if (Math.random() < CHANCE_HAL) {
            this.map.push({"x" : newX, "y": newY, "z": newZ, "dir": dir, "type": "hal"});
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.North, dir));
            return;
        }
        
        if (Math.random() < CHANCE_BRANCH) {
            this.map.push({"x" : newX, "y": newY, "z": newZ, "dir": dir, "type": "branch"});
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.North, dir));
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.East, dir));
            return;
        }
        
        if (Math.random() < CHANCE_CROSS) {
            this.map.push({"x" : newX, "y": newY, "z": newZ, "dir": dir, "type": "cross"});
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.North, dir));
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.East, dir));
            this.genNode(newX, newY, newZ, this.wrapRotation(Direction.West, dir));
            return;
        }
        
        this.map.push({"x" : newX, "y": newY, "z": newZ, "dir": dir, "type": "room"});
    }
    
    wrapRotation(dir, angle){
	let newDir = 0;
	switch(angle){
		case 0: newDir = dir - 2; break;
		case 1: newDir = dir - 1; break;
		case 2: newDir = dir; break;
		case 3: newDir = dir + 1; break;
	}
	if (newDir == -1)
		newDir = 3;
	if (newDir == -2)
		newDir = 2;
	if (newDir == 4)
		newDir = 0;
	return newDir;
}
        

}