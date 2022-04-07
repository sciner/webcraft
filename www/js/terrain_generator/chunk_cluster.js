import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_SIZE, getChunkAddr} from "../chunk.js";
import {DIRECTION, Vector, VectorCollector} from "../helpers.js";
import {BLOCK} from "../blocks.js";
import {impl as alea} from '../../vendors/alea.js';
import { AABB } from '../core/AABB.js';

const CLUSTER_PADDING       = 4;
const STREET_WIDTH          = 15;
const ROAD_DAMAGE_FACTOR    = 0.05;
const WATER_LINE            = 64;
const USE_ROAD_AS_GANGWAY   = .1;
const BUILDING_AABB_MARGIN  = 3; // cecause building must calling to draw from neighbours chunks

const CLUSTER_SIZE          = new Vector(128, 128, 128);
const temp_vec2             = new Vector(0, 0, 0);

const building_size_x       = new Vector(7, 5, 5);
const building_size_z       = new Vector(5, 5, 7);

class Building {

    constructor(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        this.randoms        = new alea(coord.toHash());
        this.cluster        = cluster;
        this.id             = id;
        this.seed           = seed;
        this.coord          = coord;
        this.aabb           = aabb;
        this.entrance       = entrance;
        this.door_bottom    = door_bottom;
        this.door_direction = door_direction;
        this.size           = size;
        this.materials      = null;
        if(cluster.flat) {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.STONE_BRICK,
                    door: BLOCK.SPRUCE_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANK,
                    light: BLOCK.LANTERN
                };
            } else {
                this.materials  = {
                    wall: BLOCK.BRICK,
                    door: BLOCK.DARK_OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANK,
                    light: BLOCK.LANTERN
                };
            }
        } else {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.OAK_PLANK,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANK,
                    light: BLOCK.TORCH
                };
            } else {
                this.materials  = {
                    wall: BLOCK.OAK_PLANK,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANK,
                    light: BLOCK.TORCH
                };
            }
        }
    }

}

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
        this.addr                   = addr;
        this.coord                  = addr.multiplyVecSelf(CLUSTER_SIZE);
        this.id                     = addr.toHash();
        this.randoms                = new alea(this.id);
        this.is_empty               = this.addr.y != 0 || this.randoms.double() > 1/2;
        this.mask                   = new Array(CLUSTER_SIZE.x * CLUSTER_SIZE.z);
        this.buildings              = new VectorCollector();
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;
        if(!this.is_empty) {
            this.flat               = this.randoms.double() >= .5;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? 98 : 7;
            this.road_block         = this.flat ? 12 : 468;
            this.basement_block     = this.flat ? 546 : 8;
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
                    const entrance_pos = new Vector(x + 3 + 2, Infinity, z + 2);
                    this.addBuilding(this.randoms.double(), x + 3, z + 3, building_size_x, entrance_pos, entrance_pos.add(new Vector(0, 0, 1)), DIRECTION.NORTH);
                } else {
                    // along Z axis
                    for(let i = z; i < z + w; i++) {
                        this.mask[i * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.road_block, 5, null);
                        this.mask[i * CLUSTER_SIZE.x + (x + 1)] = new ClusterPoint(1, this.road_block, 5, null);
                    }
                    const entrance_pos = new Vector(x + 2, Infinity, z + 3 + 2);
                    this.addBuilding(this.randoms.double(), x + 3, z + 3, building_size_z, entrance_pos, entrance_pos.add(new Vector(1, 0, 0)), DIRECTION.EAST);
                }
            }
        }
    }

    // Add building
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {
        const coord = new Vector(dx + this.coord.x, 0, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        const building = new Building(
            this,
            coord.toHash(),
            seed,
            coord.clone(),
            new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, 0, coord.z).pad(BUILDING_AABB_MARGIN),
            entrance.add(new Vector(this.coord.x, 0, this.coord.z)),
            door_bottom.add(new Vector(this.coord.x, 0, this.coord.z)),
            door_direction,
            size
        );
        this.buildings.set(building.coord, building);
        //
        this.mask[entrance.z * CLUSTER_SIZE.x + entrance.x] = new ClusterPoint(1, this.basement_block, 1, null);
        //
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(4, this.basement_block, 1, null, building);
            }
        }
        return true;
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
                        if(point.block_id == this.road_block && this.use_road_as_gangway) {
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

    //
    drawBuild1(chunk, building) {
        const bx = building.coord.x - chunk.coord.x;
        const by = building.coord.y - chunk.coord.y;
        const bz = building.coord.z - chunk.coord.z;
        // 4 walls
        this.draw4Walls(chunk, building.coord, building.size, building.materials.wall);
        //
        if(building.door_direction == DIRECTION.EAST) {
            this.setBlock(chunk, bx, by + building.size.y - 1, bz + 2, building.materials.wall.id, null);
            this.setBlock(chunk, bx, by + building.size.y - 1, bz + 3, building.materials.wall.id, null);
            this.setBlock(chunk, bx, by + building.size.y - 1, bz + 4, building.materials.wall.id, null);
            this.setBlock(chunk, bx + building.size.x - 1, by + building.size.y - 1, bz + 2, building.materials.wall.id, null);
            this.setBlock(chunk, bx + building.size.x - 1, by + building.size.y - 1, bz + 3, building.materials.wall.id, null);
            this.setBlock(chunk, bx + building.size.x - 1, by + building.size.y - 1, bz + 4, building.materials.wall.id, null);
        } else if(building.door_direction == DIRECTION.NORTH) {
            this.setBlock(chunk, bx + 2, by + building.size.y - 1, bz, building.materials.wall.id, null);
            this.setBlock(chunk, bx + 3, by + building.size.y - 1, bz, building.materials.wall.id, null);
            this.setBlock(chunk, bx + 4, by + building.size.y - 1, bz, building.materials.wall.id, null);
            this.setBlock(chunk, bx + 2, by + building.size.y - 1, bz + building.size.z - 1, building.materials.wall.id, null);
            this.setBlock(chunk, bx + 3, by + building.size.y - 1, bz + building.size.z - 1, building.materials.wall.id, null);
            this.setBlock(chunk, bx + 4, by + building.size.y - 1, bz + building.size.z - 1, building.materials.wall.id, null);
        }
        // npc
        const npc_pos = new Vector(bx + Math.round(building.size.x/2) + chunk.coord.x, by + 1 + chunk.coord.y, bz + Math.round(building.size.z/2) + chunk.coord.z);
        this.setBlock(chunk, npc_pos.x - chunk.coord.x, npc_pos.y - chunk.coord.y, npc_pos.z - chunk.coord.z, BLOCK.MOB_SPAWN.id, null, this.generateNPCSpawnExtraData(building));
        chunk.addTickingBlock(npc_pos);
        // roof gable
        if(building.door_direction == DIRECTION.EAST) {
            let q_pos = new Vector(building.coord.x - 1, building.coord.y + building.size.y, building.coord.z + Math.floor(building.size.z / 2));
            this.drawQuboid(chunk, q_pos, new Vector(building.size.x + 2, 1, 1), building.materials.roof_block);
        } else if(building.door_direction == DIRECTION.NORTH) {
            let q_pos = new Vector(building.coord.x + Math.floor(building.size.x / 2), building.coord.y + building.size.y, building.coord.z - 1);
            this.drawQuboid(chunk, q_pos, new Vector(1, 1, building.size.z + 2), building.materials.roof_block);
        }
        // window
        if(building.door_direction == DIRECTION.EAST) {
            const window_rot = {x: 3, y: 0, z: 0};
            let w_pos = building.door_bottom.clone().add(new Vector(0, 1, 2));
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x += building.size.x - 1;
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z -= 2;
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        } else if(building.door_direction == DIRECTION.NORTH) {
            const window_rot = {x: 2, y: 0, z: 0};
            let w_pos = building.door_bottom.clone().add(new Vector(2, 1, 0));
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z += building.size.z - 1;
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x -= 2;
            this.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        }
        // roof
        if(building.door_direction == DIRECTION.EAST) {
            // south side
            let roof_pos = new Vector(building.coord.x - 1, building.coord.y + 2, building.coord.z - 1);
            let roof_size = new Vector(building.size.x + 2, 4, 0);
            this.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.SOUTH, building.materials.roof);
            // north side
            roof_pos = new Vector(building.coord.x - 1, building.coord.y + 2, building.coord.z + building.size.z);
            roof_size = new Vector(building.size.x + 2, 4, 0);
            this.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.NORTH, building.materials.roof);
        } else if(building.door_direction == DIRECTION.NORTH) {
            // west side
            let roof_pos = new Vector(building.coord.x - 1, building.coord.y + 2, building.coord.z - 1);
            let roof_size = new Vector(0, 4, building.size.z + 2);
            this.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.WEST, building.materials.roof);
            // east side
            roof_pos = new Vector(building.coord.x + building.size.x, building.coord.y + 2, building.coord.z - 1);
            roof_size = new Vector(0, 4, building.size.z + 2);
            this.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.EAST, building.materials.roof);
        }
        // door
        this.drawDoor(chunk, building.door_bottom, building.materials.door, building.door_direction, building.randoms.double() > .5, true);
        // light
        if(building.door_direction == DIRECTION.EAST) {
            let light_rot = {x: 1, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().add(new Vector(-1, 1, 1));
            if(building.materials.light.id == BLOCK.LANTERN.id) {
                light_rot.y = -1;
                l_pos.y += 2;
            }
            this.setBlock(chunk, l_pos.x - chunk.coord.x, l_pos.y - chunk.coord.y, l_pos.z - chunk.coord.z, building.materials.light.id, light_rot);
        } else if(building.door_direction == DIRECTION.NORTH) {
            let light_rot = {x: 2, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().add(new Vector(1, 1, -1));
            if(building.materials.light.id == BLOCK.LANTERN.id) {
                light_rot.y = -1;
                l_pos.y += 2;
            }
            this.setBlock(chunk, l_pos.x - chunk.coord.x, l_pos.y - chunk.coord.y, l_pos.z - chunk.coord.z, building.materials.light.id, light_rot);
        }
    }

    drawQuboid(chunk, pos, size, block) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    this.setBlock(chunk, x, y, z, block.id, null);
                }
            }
        }
    }

    // Draw walls
    draw4Walls(chunk, pos, size, block) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        const xyz = new Vector(0, 0, 0);
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y - 1; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    xyz.copyFrom(pos).add(i, k, j);
                    if(i < 1 || j < 1 || k < 1 || i > size.x - 2 || j > size.z - 2 || k > size.y - 1) {
                        this.setBlock(chunk, x, y, z, block.id, null);
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
                if(dir == DIRECTION.EAST) {
                    this.setBlock(chunk, x, y, z, door_blocks[k], {x: 1, y: 0, z: 0}, {point: {x: 0, y: 0, z: 0}, opened: opened, left: left});
                } else if(dir == DIRECTION.NORTH) {
                    this.setBlock(chunk, x, y, z, door_blocks[k], {x: 2, y: 0, z: 0}, {point: {x: 0, y: 0, z: 0}, opened: opened, left: left});
                }
            }
        }
    }

    // Return extra data for block MOB_SPAWN
    generateNPCSpawnExtraData(building) {
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