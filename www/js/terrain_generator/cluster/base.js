import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {DIRECTION, Vector} from "../../helpers.js";
import {BLOCK} from "../../blocks.js";
import {impl as alea} from '../../../vendors/alea.js';

export const CLUSTER_SIZE = new Vector(128, 128, 128);
const WATER_LINE            = 64;
const temp_vec2             = new Vector(0, 0, 0);

export class ClusterPoint {

    constructor(height, block_id, margin, info, building, y_shift) {
        this.height         = height;
        this.block_id       = block_id;
        this.margin         = margin;
        this.info           = info;
        this.building       = building;
        this.height_fixed   = false;
        this.hidden         = false;
        this.y_shift        = y_shift | 0;
    }

}

export class ClusterBase {

    // constructor
    constructor(addr) {
        this.addr        = addr;
        this.coord       = addr.multiplyVecSelf(CLUSTER_SIZE);
        this.size        = CLUSTER_SIZE.clone();
        this.id          = addr.toHash();
        this.randoms     = new alea(`villages_${this.id}`);
        this.is_empty    = this.addr.y != 0 || this.randoms.double() > 1/4;
        this.mask        = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        this.max_height  = null;
    }

    // Set block
    setBlock(chunk, x, y, z, block_id, rotate, extra_data) {
        if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
            // ok
        } else {
            return false;
        }
        temp_vec2.x = x;
        temp_vec2.y = y;
        temp_vec2.z = z;
        const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
        if(rotate) {
            chunk.tblocks.rotate.set(temp_vec2, rotate);
        }
        if(extra_data) {
            chunk.tblocks.extra_data.set(temp_vec2, extra_data);
        }
        chunk.tblocks.id[index] = block_id;
        return true;
    }

    // Return block from pos
    getBlock(chunk, x, y, z) {
        const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
        return chunk.tblocks.id[index];
    }

    // Fill chunk blocks
    fillBlocks(chunk, map) {
        if(this.is_empty) {
            return false;
        }
        const START_X           = chunk.coord.x - this.coord.x;
        const START_Z           = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM    = chunk.coord.y;
        // fill roards and basements
        for(let i = 0; i < CHUNK_SIZE_X; i++) {
            for(let j = 0; j < CHUNK_SIZE_Z; j++) {
                let x       = START_X + i;
                let z       = START_Z + j;
                let point   = this.mask[z * CLUSTER_SIZE.x + x];
                if(point && point.height) {
                    if(point.block_id == 0) {
                        continue;
                    }
                    const cell = map.info.cells[i][j];
                    if(cell.biome.code == 'OCEAN') {
                        if(point.block_id == this.road_block && this.use_road_as_gangway) {
                            let y = WATER_LINE - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, BLOCK.OAK_PLANK.id, null);
                            }
                        }
                        continue;
                    }
                    //
                    if(point.height > 0) {
                        const is_array = Array.isArray(point.block_id);
                        for(let k = 0; k < point.height; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1 + point.y_shift;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, is_array ? point.block_id[k] : point.block_id, null);
                            }
                        }
                    } else {
                        for(let k = point.height; k <= 0; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, k == point.height ? point.block_id : BLOCK.AIR.id, null);
                            }
                        }
                    }
                }
            }
        }
    }

    // Return true if cell is occupied by any object (road or building)
    cellIsOccupied(x, y, z, margin) {
        x -= this.coord.x;
        y -= this.coord.y;
        z -= this.coord.z;
        for(let i = -margin; i <= margin; i++) {
            for(let j = -margin; j <= margin; j++) {
                const dx = x + i;
                const dz = z + j;
                if(dx >= 0 && dz >= 0 && dx < CLUSTER_SIZE.x && z < CLUSTER_SIZE.z) {
                    const info = this.mask[dz * CLUSTER_SIZE.x + dx];
                    if(info ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Add NPC
    addNPC(chunk, pos) {
        let rel_pos = pos.sub(chunk.coord);
        if(rel_pos.x < 0 || rel_pos.y < 0 || rel_pos.z < 0 || rel_pos.x >= CHUNK_SIZE_X || rel_pos.y >= CHUNK_SIZE_Y || rel_pos.z >= CHUNK_SIZE_Z) {
            return false;
        }
        this.setBlock(chunk, rel_pos.x, rel_pos.y, rel_pos.z, BLOCK.MOB_SPAWN.id, null, this.generateNPCSpawnExtraData());
        chunk.addTickingBlock(pos);
        return true;
    }

    // Add fence
    addFence(coord, size) {
        const dx = coord.x - this.coord.x;
        const dz = coord.z - this.coord.z;
        let fence_point = new ClusterPoint(2, [BLOCK.COBBLESTONE_WALL.id, BLOCK.OAK_FENCE.id], 1, null, null, 1);
        let fence_point_torch = new ClusterPoint(3, [BLOCK.COBBLESTONE_WALL.id, BLOCK.OAK_FENCE.id, BLOCK.TORCH.id], 1, null, null, 1);
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                if(i == 0 || j == 0 || i == size.x - 1 || j == size.z - 1) {
                    const x = dx + i;
                    const z = dz + j;
                    if((i+j+coord.x+coord.z) % 20 == 0) {
                        this.mask[z * CLUSTER_SIZE.x + x] = fence_point_torch;
                    } else {
                        this.mask[z * CLUSTER_SIZE.x + x] = fence_point;
                    }
                }
            }
        }
    }

    // Add road platform
    addRoadPlatform(coord, size, road_block_id) {
        const dx = coord.x - this.coord.x;
        const dz = coord.z - this.coord.z;
        for(let i = 0; i < size.x + 2; i++) {
            for(let j = 0; j < size.z + 2; j++) {
                const x = dx + i - 1;
                const z = dz + j - 1;
                // Draw road around plot
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(1, road_block_id, 1, null, null);
            }
        }
    }

    //
    drawQuboid(chunk, pos, size, block, rotate, extra_data) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    this.setBlock(chunk, x, y, z, block.id, rotate, extra_data);
                }
            }
        }
    }

    // Draw walls
    draw4Walls(chunk, pos, size, block_palette) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        const xyz = new Vector(0, 0, 0);
        block_palette.reset();
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y - 1; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    xyz.copyFrom(pos).add(i, k, j);
                    const block_id = block_palette.next().id;
                    if(i < 1 || j < 1 || k < 0 || i > size.x - 2 || j > size.z - 2 || k > size.y - 1) {
                        this.setBlock(chunk, x, y, z, block_id, null);
                    } else {
                        this.setBlock(chunk, x, y, z, 0, null);
                    }
                }
            }
        }
    }

    // Add pitched roof
    drawPitchedRoof(chunk, pos, size, dir, block) {
        switch(dir) {
            // Look to north
            case DIRECTION.NORTH: {
                for(let i = 0; i < size.x; i++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + i;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z - k;
                        this.setBlock(chunk, x, y, z, block.id, {x: 0, y: 0, z: 0});
                    }
                }    
                break;
            }
            // Look to south
            case DIRECTION.SOUTH: {
                for(let i = 0; i < size.x; i++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + i;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + k;
                        this.setBlock(chunk, x, y, z, block.id, {x: 2, y: 0, z: 0});
                    }
                }    
                break;
            }
            // Look to west
            case DIRECTION.WEST: {
                for(let j = 0; j < size.z; j++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x + k;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + j;
                        this.setBlock(chunk, x, y, z, block.id, {x: 1, y: 0, z: 0});
                    }
                }
                break;
            }
            // Look to east
            case DIRECTION.EAST: {
                for(let j = 0; j < size.z; j++) {
                    for(let k = 0; k < size.y; k++) {
                        const x = pos.x - chunk.coord.x - k;
                        const y = pos.y - chunk.coord.y + k;
                        const z = pos.z - chunk.coord.z + j;
                        this.setBlock(chunk, x, y, z, block.id, {x: 3, y: 0, z: 0});
                    }
                }
                break;
            }
        }
    }

    // Draw door
    drawDoor(chunk, pos, block, dir, opened, left) {
        const door_blocks = [block.id, block.next_part.id];
        for(let k of [0, 1]) {
            const x = pos.x - chunk.coord.x;
            const y = pos.y - chunk.coord.y + k;
            const z = pos.z - chunk.coord.z;
            if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                let rot = {x: dir, y: 0, z: 0};
                this.setBlock(chunk, x, y, z, door_blocks[k], rot, {point: {x: 0, y: 0, z: 0}, opened: opened, left: left});
                // this.setBlock(chunk, x, y, z - 1, BLOCK.AIR.id, null, null);
            }
        }
    }

    // Return extra data for block MOB_SPAWN
    generateNPCSpawnExtraData() {
        return {
            "type": "npc",
            "limit": {"count": 1},
            "calculated": [
                {"type": "random_item", "name": "skin", "items": [1, 2, 3, 4, 5, 6, 7, 10]},
                {"type": "random_int", "name": "max_ticks", "min_max": [1, 1]}
            ]
        }
    }

}