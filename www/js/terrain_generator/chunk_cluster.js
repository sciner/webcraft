import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "../chunk.js";
import {Vector, VectorCollector} from "../helpers.js";
import {impl as alea} from '../../vendors/alea.js';
import { AABB } from '../core/AABB.js';

const CLUSTER_PADDING   = 4;
const STREET_WIDTH      = 15;
const CLUSTER_SIZE      = new Vector(128, 128, 128);
const temp_vec2         = new Vector(0, 0, 0);

class ClusterPoint {

    constructor(height, block_id, margin, info, building) {
        this.height = height;
        this.block_id = block_id;
        this.margin = margin;
        this.info = info;
        this.building = building;
    }

}

// ChunkCluster
export class ChunkCluster {

    // All clusters
    static all = new VectorCollector();

    // Return cluster
    static getForCoord(coord) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        let cluster = ChunkCluster.all.get(addr);
        if(cluster) {
            return cluster;
        }
        cluster = new ChunkCluster(addr.clone());
        ChunkCluster.all.set(addr, cluster);
        return cluster;
    }

    // constructor
    constructor(addr) {
        this.addr           = addr;
        this.coord          = addr.multiplyVecSelf(CLUSTER_SIZE);
        this.id             = addr.toHash();
        this.randoms        = new alea(this.id);
        this.is_empty       = this.addr.y != 0 || this.randoms.double() > 1/2;
        this.mask           = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        this.buildings      = new VectorCollector();
        if(!this.is_empty) {
            //
            this.civil          = this.randoms.double() >= .5;
            this.max_height     = this.civil ? 1 : 30;
            this.wall_block     = this.civil ? 98 : 7;
            this.road_block     = this.civil ? 12 : 468;
            this.basement_block = this.civil ? 546 : 8;
            //
            for(let g = 0; g < 16; g++) {
                let x = Math.round(this.randoms.double() * 64) + CLUSTER_PADDING;
                let z = Math.round(this.randoms.double() * 64) + CLUSTER_PADDING;
                let w = Math.round(this.randoms.double() * (64 - CLUSTER_PADDING));
                x = Math.ceil(x / STREET_WIDTH) * STREET_WIDTH;
                z = Math.ceil(z / STREET_WIDTH) * STREET_WIDTH;
                w = Math.ceil(w / STREET_WIDTH) * STREET_WIDTH;
                if(this.randoms.double() < .5) {
                    // horizontal
                    for(let i = 0; i < w; i++) {
                        this.mask[z * CLUSTER_SIZE.x + (x + i)] = new ClusterPoint(1, this.road_block, 5, null);
                        this.mask[(z + 1) * CLUSTER_SIZE.x + (x + i)] = new ClusterPoint(1, this.road_block, 5, null);
                    }
                    this.addBuilding(x + 3, z + 3, 11, 11, new Vector(x + 3 + 3, Infinity, z + 2));
                } else {
                    // vertical
                    for(let i = z; i < z + w; i++) {
                        this.mask[i * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.road_block, 5, null);
                        this.mask[i * CLUSTER_SIZE.x + (x + 1)] = new ClusterPoint(1, this.road_block, 5, null);
                    }
                    this.addBuilding(x + 3, z + 3, 11, 11, new Vector(x + 2, Infinity, z + 3 + 3));
                }
            }
        }
    }

    // addBuilding
    addBuilding(dx, dz, width, depth, door) {
        const coord = new Vector(dx + this.coord.x, 0, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        const height = 16;
        const building = {
            id:         coord.toHash(),
            coord:      coord.clone(),
            aabb:       new AABB().set(0, 0, 0, width, height, depth).translate(coord.x, 0, coord.z),
            door:       door.add(new Vector(this.coord.x, 0, this.coord.z)),
            size:       new Vector(width, height, depth)
        };
        this.buildings.set(building.coord, building);
        //
        this.mask[door.z * CLUSTER_SIZE.x + door.x] = new ClusterPoint(1, this.road_block, 1, null);
        //
        for(let i = 0; i < width; i++) {
            for(let j = 0; j < depth; j++) {
                const x = dx + i;
                const z = dz + j;
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(4, 0 /* this.basement_block */, 1, null, building);
                /*
                // Draw building by heightmap
                if(i == 0 || j == 0 || i == width - 1 || j == depth - 1) {
                    this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.basement_block, 3, null);
                } else if(i == 1 || j == 1 || i == width - 2 || j == depth - 2) {
                    this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(8, this.wall_block, 1, null);
                } else {
                    this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.basement_block, 1, null);
                }
                */
            }
        }
        return true;
    }

    setBlock(chunk, x, y, z, block_id, rotate) {
        temp_vec2.x = x;
        temp_vec2.y = y;
        temp_vec2.z = z;
        const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * temp_vec2.y + (temp_vec2.z * CHUNK_SIZE_X) + temp_vec2.x;
        if(rotate) {
            chunk.tblocks.rotate.set(temp_vec2, rotate);
        }
        chunk.tblocks.id[index] = block_id;
    };

    // Generate chunk blocks
    generateBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        //
        const randoms = new alea('cluster_chunk_' + chunk.id);
        //
        const getBlock = (x, y, z) => {
            const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
            return chunk.tblocks.id[index];
        };
        //
        const start_x = chunk.coord.x - this.coord.x;
        const start_z = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM = chunk.coord.y;
        for(let i = 0; i < CHUNK_SIZE_X; i++) {
            for(let j = 0; j < CHUNK_SIZE_Z; j++) {
                let x = start_x + i;
                let z = start_z + j;
                let point = this.mask[z * CLUSTER_SIZE.x + x];
                if(point && point.height) {
                    if(point.block_id == 0) {
                        continue;
                    }
                    const cell = map.info.cells[i][j];
                    if(cell.biome.code == 'OCEAN') {
                        continue;
                    }
                    for(let k = 0; k < point.height; k++) {
                        let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                        // let block_id = getBlock(i, y, j);
                        // if(block_id && (block_id == cell.biome.dirt_block))
                        /*
                        // Remove one part of road randomly
                        if(!this.civil && point.block_id == this.road_block) {
                            if(randoms.double() < .05) {
                                continue;
                            }
                        }
                        */
                        this.setBlock(chunk, i, y, j, point.block_id, null);
                    }
                }
            }
        }
        // перебираем все строения
        for(let [_, b] of this.buildings.entries()) {
            b.aabb.y_min = chunk.coord.y;
            b.aabb.y_max = b.aabb.y_min + b.size.y;
            // если строение частично или полностью находится в этом чанке
            if(b.aabb.intersect(chunk.aabb)) {
                // у строения до этого момента нет точной информации о вертикальной позиции двери (а значит и пола)
                if(b.door.y == Infinity) {
                    // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                    const map_addr = getChunkAddr(b.door);
                    map_addr.y = 0;
                    let door_map = maps.get(map_addr);
                    if(door_map) {
                        if(!door_map.smoothed) {
                            door_map = maps.generateAround(map_addr, true, true)[4].info;
                        }
                        // карта в любом случае должна быть
                        let door_x = b.door.x - door_map.chunk.coord.x;
                        let door_z = b.door.z - door_map.chunk.coord.z;
                        const cell = door_map.cells[door_x][door_z];
                        b.door.y = cell.value2 - 1;
                        b.coord.y = b.door.y;
                    }
                }
                if(b.door.y == Infinity) {
                    console.error('invalid building y');
                } else {
                    this.drawBulding(chunk, b);
                }
            }
        }
    }

    // Draw part of building on map
    drawBulding(chunk, building) {
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = building.coord.x - chunk.coord.x + i;
                const y = building.coord.y - chunk.coord.y;
                const z = building.coord.z - chunk.coord.z + j;
                if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                    this.setBlock(chunk, x, y, z, this.basement_block, null);
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
                    if(info && info.height) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

}