import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "../chunk.js";
import {Vector, VectorCollector} from "../helpers.js";
import {impl as alea} from '../../vendors/alea.js';
import { AABB } from '../core/AABB.js';

const CLUSTER_PADDING       = 4;
const STREET_WIDTH          = 15;
const ROAD_DAMAGE_FACTOR    = 0.05;
const WATER_LINE            = 64;
const USE_ROAD_AS_GANGWAY   = false;

const CLUSTER_SIZE          = new Vector(128, 128, 128);
const temp_vec2             = new Vector(0, 0, 0);

class ClusterPoint {

    constructor(height, block_id, margin, info, building) {
        this.height         = height;
        this.block_id       = block_id;
        this.margin         = margin;
        this.info           = info;
        this.building       = building;
        this.height_fixed   = false;
        this.hidden         = false;
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
        const building_size = new Vector(11, 10, 11);
        if(!this.is_empty) {
            this.flat           = this.randoms.double() >= .5;
            this.max_height     = this.flat ? 1 : 30;
            this.wall_block     = this.flat ? 98 : 7;
            this.road_block     = this.flat ? 12 : 468;
            this.basement_block = this.flat ? 546 : 8;
            // create roads
            for(let g = 0; g < 16; g++) {
                let x = Math.round(this.randoms.double() * 64) + CLUSTER_PADDING;
                let z = Math.round(this.randoms.double() * 64) + CLUSTER_PADDING;
                let w = Math.round(this.randoms.double() * (64 - CLUSTER_PADDING));
                // quantization
                x = Math.ceil(x / STREET_WIDTH) * STREET_WIDTH;
                z = Math.ceil(z / STREET_WIDTH) * STREET_WIDTH;
                w = Math.ceil(w / STREET_WIDTH) * STREET_WIDTH;
                if(this.randoms.double() < .5) {
                    // along X axis
                    for(let i = 0; i < w; i++) {
                        this.mask[z * CLUSTER_SIZE.x + (x + i)] = new ClusterPoint(1, this.road_block, 5, null);
                        this.mask[(z + 1) * CLUSTER_SIZE.x + (x + i)] = new ClusterPoint(1, this.road_block, 5, null);
                    }
                    const entrance_pos = new Vector(x + 3 + 3, Infinity, z + 2);
                    this.addBuilding(x + 3, z + 3, building_size, entrance_pos, entrance_pos.add(new Vector(0, 0, 1)));
                } else {
                    // along Z axis
                    for(let i = z; i < z + w; i++) {
                        this.mask[i * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.road_block, 5, null);
                        this.mask[i * CLUSTER_SIZE.x + (x + 1)] = new ClusterPoint(1, this.road_block, 5, null);
                    }
                    const entrance_pos = new Vector(x + 2, Infinity, z + 3 + 3);
                    this.addBuilding(x + 3, z + 3, building_size, entrance_pos, entrance_pos.add(new Vector(1, 0, 0)));
                }
            }
        }
    }

    // Add building
    addBuilding(dx, dz, size, entrance, door_bottom) {
        const coord = new Vector(dx + this.coord.x, 0, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        const building = {
            id:             coord.toHash(),
            coord:          coord.clone(),
            aabb:           new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, 0, coord.z),
            entrance:       entrance.add(new Vector(this.coord.x, 0, this.coord.z)),
            door_bottom:    door_bottom.add(new Vector(this.coord.x, 0, this.coord.z)),
            size:           size
        };
        this.buildings.set(building.coord, building);
        //
        this.mask[entrance.z * CLUSTER_SIZE.x + entrance.x] = new ClusterPoint(1, this.basement_block, 1, null);
        //
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(5, this.basement_block, 1, null, building);
            }
        }
        return true;
    }

    // Set block
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

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        const START_X           = chunk.coord.x - this.coord.x;
        const START_Z           = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM    = chunk.coord.y;
        const randoms           = new alea('cluster_chunk_' + chunk.id);
        /*
            const getBlock = (x, y, z) => {
                const index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
                return chunk.tblocks.id[index];
            };
        */
        // each all buildings
        for(let [_, b] of this.buildings.entries()) {
            if(b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y;
                b.aabb.y_max = b.aabb.y_min + b.size.y;
            }
            // если строение частично или полностью находится в этом чанке
            if(b.aabb.intersect(chunk.aabb)) {
                // у строения до этого момента нет точной информации о вертикальной позиции двери (а значит и пола)
                if(b.entrance.y == Infinity) {
                    // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                    const map_addr = getChunkAddr(b.entrance);
                    map_addr.y = 0;
                    let entrance_map_info = maps.get(map_addr);
                    if(entrance_map_info) {
                        // if map not smoothed
                        if(!entrance_map_info.smoothed) {
                            // generate around maps and smooth current
                            entrance_map_info = maps.generateAround(map_addr, true, true)[4].info;
                        }
                        const entrance_x    = b.entrance.x - entrance_map_info.chunk.coord.x;
                        const entrance_z    = b.entrance.z - entrance_map_info.chunk.coord.z;
                        const cell          = entrance_map_info.cells[entrance_x][entrance_z];
                        b.entrance.y        = cell.value2 - 1;
                        b.coord.y           = b.entrance.y;
                        b.aabb.y_min        = b.entrance.y;
                        b.aabb.y_max        = b.aabb.y_min + b.size.y;
                        b.door_bottom.y     = cell.value2;
                    }
                }
                if(b.entrance.y == Infinity) {
                    console.error('Invalid building y');
                } else if(b.aabb.intersect(chunk.aabb)) {
                    this.drawBulding(chunk, maps, b);
                }
            }
        }
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
                        if(USE_ROAD_AS_GANGWAY && point.block_id == this.road_block) {
                            let y = WATER_LINE - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, 7, null);
                            }
                        }
                        continue;
                    }
                    for(let k = 0; k < point.height; k++) {
                        let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                        if(y >= 0 && y < CHUNK_SIZE_Y) {
                            // remove one part of road randomly
                            if(ROAD_DAMAGE_FACTOR > 0 && !this.flat && point.block_id == this.road_block) {
                                if(randoms.double() < ROAD_DAMAGE_FACTOR) {
                                    continue;
                                }
                            }
                            this.setBlock(chunk, i, y, j, point.block_id, null);
                        }
                    }
                }
            }
        }
    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = building.coord.x - chunk.coord.x + i;
                const z = building.coord.z - chunk.coord.z + j;
                /*
                let y = building.coord.y - chunk.coord.y;
                if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                    // set block
                    this.setBlock(chunk, x, y, z, this.basement_block, null);
                }
                */
                // fix basement height
                const pz = START_Z + z;
                const px = START_X + x;
                if(px >= 0 && pz >= 0 && px < CLUSTER_SIZE.x && pz < CLUSTER_SIZE.z) {
                    let point = this.mask[pz * CLUSTER_SIZE.x + px];
                    if(point && point.height && !point.height_fixed) {
                        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                        const vec = new Vector(building.coord.x + i, 0, building.coord.z + j);
                        const map_addr = getChunkAddr(vec);
                        let bi = maps.get(map_addr);
                        if(bi) {
                            // if map not smoothed
                            if(!bi.smoothed) {
                                // generate around maps and smooth current
                                bi = maps.generateAround(map_addr, true, true)[4].info;
                            }
                            const entrance_x    = vec.x - bi.chunk.coord.x;
                            const entrance_z    = vec.z - bi.chunk.coord.z;
                            const cell          = bi.cells[entrance_x][entrance_z];
                            if(cell.biome.code == 'BEACH' || cell.biome.code == 'OCEAN') {
                                building.hidden = true;
                            }
                            point.height = Math.max(Math.min(point.height, building.coord.y - cell.value2 + 1), 0);
                            point.height_fixed = true;
                        }
                    }
                }
            }
        }
        // draw building
        if(!building.hidden) {
            this.drawBuild1(chunk, building);
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

    drawBuild1(chunk, building) {
        const xyz = new Vector(0, 0, 0);
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                for(let k = 0; k < building.size.y; k++) {
                    const x = building.coord.x - chunk.coord.x + i;
                    const y = building.coord.y - chunk.coord.y + k;
                    const z = building.coord.z - chunk.coord.z + j;
                    xyz.copyFrom(building.coord).add(i, k, j);
                    if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                        if(i < 1 || j < 1 || k < 1 || i > building.size.x - 2 || j > building.size.z - 2 || k > building.size.y - 1) {
                            this.setBlock(chunk, x, y, z, this.wall_block, null);
                        } else {
                            this.setBlock(chunk, x, y, z, 0, null);
                        }
                    }
                }
            }
        }
        // doorway
        for(let k of [0, 1]) {
            const x = building.door_bottom.x - chunk.coord.x;
            const y = building.door_bottom.y - chunk.coord.y + k;
            const z = building.door_bottom.z - chunk.coord.z;
            if(x >= 0 && y >= 0 && z >= 0 && x < CHUNK_SIZE_X && y < CHUNK_SIZE_Y && z < CHUNK_SIZE_Z) {
                this.setBlock(chunk, x, y, z, 0, null);
            }
        }
    }

}