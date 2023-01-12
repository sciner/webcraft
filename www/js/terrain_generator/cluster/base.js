import { CHUNK_SIZE_Y } from "../../chunk_const.js";
import {DIRECTION, Vector} from "../../helpers.js";
import {BLOCK} from "../../blocks.js";
import {impl as alea} from '../../../vendors/alea.js';

export const NEAR_MASK_MAX_DIST = 10
export const CLUSTER_PADDING    = 8

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

// ClusterBase
export class ClusterBase {

    // constructor
    constructor(clusterManager, addr, size) {
        this.clusterManager = clusterManager;
        this.y_base         = 80;
        this.addr           = addr;
        this.size           = new Vector(clusterManager.size)
        this.coord          = addr.clone().multiplyVecSelf(this.size);
        this.id             = this.clusterManager.seed + '_' + addr.toHash();
        this.randoms        = new alea(`villages_${this.id}`);
        this.r              = new alea(`cluster_r_${this.id}`).double();
        this.is_empty       = (clusterManager.version == 2) ? false : (this.addr.y != 0 || this.randoms.double() > 1/4);
        this.mask           = new Array(this.size.x * this.size.z);
        this.max_height     = null;
        this.max_dist       = NEAR_MASK_MAX_DIST;
        this.corner         = (clusterManager.version == 2) ? Math.floor(this.randoms.double() * 4) : undefined
    }

    /**
     * Set block
     * @param {*} chunk 
     * @param {int} x 
     * @param {int} y 
     * @param {int} z 
     * @param {int} block_id 
     * @param {*} rotate 
     * @param {*} extra_data 
     * @param {boolean} check_is_solid 
     * @param {boolean} destroy_fluid  
     * @param {boolean} candidate_for_cap_block 
     * @param {?object} map
     * 
     * @returns 
     */
    setBlock(chunk, x, y, z, block_id, rotate, extra_data, check_is_solid = false, destroy_fluid = false, candidate_for_cap_block = false, map = null) {
        if(x >= 0 && y >= 0 && z >= 0 && x < chunk.size.x && y < chunk.size.y && z < chunk.size.z) {
            // ok
        } else {
            return false;
        }
        if(map) {
            // IMPORTANT: replace structure dirt blocks
            if(block_id == BLOCK.GRASS_BLOCK.id || block_id == BLOCK.DIRT.id) {
                const cell = map.getCell(x, z)
                const cdl = cell.dirt_layer
                if(cdl) {
                    const layer_index = Math.min(block_id == BLOCK.DIRT.id ? 1 : 0, cdl.blocks.length - 1)
                    block_id = cdl.blocks[layer_index]
                }
            }
            if(candidate_for_cap_block) {
                const cell = map.getCell(x, z)
                const cap_block_id = cell.dirt_layer?.cap_block_id
                const existing_block_id = chunk.getBlockID(x, y, z)
                if(cap_block_id && existing_block_id == 0) {
                    block_id = cap_block_id
                } else {
                    return
                }
            }
        }
        chunk.setBlockIndirect(x, y, z, block_id, rotate, extra_data, undefined, undefined, check_is_solid, destroy_fluid)
        if(BLOCK.TICKING_BLOCKS.has(block_id)) {
            chunk.addTickingBlock(chunk.coord.offset(x, y, z));
        }
        return true;
    }

    // Return block from pos
    getBlock(chunk, x, y, z) {
        const {cx, cy, cz, cw} = chunk.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return chunk.tblocks.id[index];
    }

    moveToRandomCorner() {
        const resp = new Vector(0, 0, 0);
        if(this.is_empty) {
            return resp;
        }
        const corner = this.corner ?? Math.floor(this.randoms.double() * 4)
        let min_x = this.size.x;
        let min_z = this.size.z;
        let max_x = 0;
        let max_z = 0;
        for(let index in this.mask) {
            const value = this.mask[index];
            if(value && (Array.isArray(value.block_id) || value.block_id > 0)) {
                const x = index % this.size.x;
                const z = Math.floor(index / this.size.x);
                if(x < min_x) min_x = x;
                if(z < min_z) min_z = z;
                if(x > max_x) max_x = x;
                if(z > max_z) max_z = z;
            }
        }
        let move_x = 0;
        let move_z = 0;
        switch(corner) {
            case 0: {
                move_x = -min_x + CLUSTER_PADDING;
                move_z = -min_z + CLUSTER_PADDING;
                break;
            }
            case 1: {
                move_x = this.size.x - max_x - CLUSTER_PADDING;
                move_z = -min_z + CLUSTER_PADDING;
                break;
            }
            case 2: {
                move_x = this.size.x - max_x - CLUSTER_PADDING;
                move_z = this.size.z - max_z - CLUSTER_PADDING;
                break;
            }
            case 3: {
                move_x = -min_x + CLUSTER_PADDING;
                move_z = this.size.z - max_z - CLUSTER_PADDING;
                break;
            }
        }

        // make new mask
        const new_mask = new Array(this.size.x * this.size.z);
        this.near_mask = new Array(this.size.x * this.size.z).fill(255);
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                const index = z * this.size.x + x;
                const value = this.mask[index];
                if(value && (Array.isArray(value.block_id) || value.block_id > 0)) {
                    if(value == 69) debugger
                    const new_x = x + move_x;
                    const new_z = z + move_z;
                    const new_index = new_z * this.size.x + new_x;
                    new_mask[new_index] = value;
                    for(let i = -NEAR_MASK_MAX_DIST; i < NEAR_MASK_MAX_DIST; i++) {
                        for(let j = -NEAR_MASK_MAX_DIST; j < NEAR_MASK_MAX_DIST; j++) {
                            const dx = new_x + i;
                            const dz = new_z + j;
                            if(dx > -1 && dz > -1 && dx < this.size.x && dz < this.size.z) {
                                const nidx = dz * this.size.x + dx;
                                const dist = Math.sqrt(Math.pow(dx - new_x, 2) + Math.pow(dz - new_z, 2));
                                if(this.near_mask[nidx] > dist && dist <= NEAR_MASK_MAX_DIST) {
                                    this.near_mask[nidx] = dist;
                                }
                            }
                        }
                    }
                }
            }
        }
        this.mask = new_mask;
        resp.x = move_x;
        resp.z = move_z;
        return resp;
    }

    //
    createBlockPalette(list, auto_chance = false) {
        let that = this;
        if(auto_chance) {
            const cnt = list.length
            let i = 0;
            for(let item of list) {
                item.chance = ++i / cnt;
            }
        }
        let resp = {
            list: list,
            reset: function() {
                this.randoms = new alea(that.id);
            },
            next: function() {
                if(!this.randoms) {
                    this.reset();
                }
                const r = this.randoms.double();
                for(let item of this.list) {
                    if (r <= item.chance) {
                        return item.value;
                    }
                }
                throw 'error_proportional_fill_pattern2'
            }
        };
        return resp;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        const START_X           = chunk.coord.x - this.coord.x;
        const START_Z           = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM    = chunk.coord.y;
        //
        // this.road_block.reset();
        // fill roards and basements
        for(let i = 0; i < chunk.size.x; i++) {
            for(let j = 0; j < chunk.size.z; j++) {
                let x       = START_X + i;
                let z       = START_Z + j;
                let point   = this.mask[z * this.size.x + x];
                if(point && point.height) {
                    if(point.block_id == 0) {
                        continue;
                    }
                    const cell = map.cells[j * chunk.size.x + i];
                    if(cell.biome.code == 'OCEAN') {
                        /*if(this.use_road_as_gangway && point.block_id == this.road_block) {
                            let y = WATER_LINE - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, BLOCK.OAK_PLANKS.id, null);
                            }
                        }*/
                        continue;
                    }
                    //
                    if(point.height > 0) {
                        const is_array = Array.isArray(point.block_id);
                        for(let k = 0; k < point.height; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1 + point.y_shift;
                            if(y >= 0 && y < chunk.size.y) {
                                this.setBlock(chunk, i, y, j, is_array ? point.block_id[k] : point.block_id, null);
                            }
                        }
                    } else {
                        const is_array = Array.isArray(point.block_id);
                        let ai = 0;
                        for(let k = point.height; k <= 0; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < chunk.size.y) {
                                let block_id = k == point.height ? point.block_id : BLOCK.AIR.id;
                                if(is_array) {
                                    block_id = point.block_id[ai++];
                                }
                                this.setBlock(chunk, i, y, j, block_id, null);
                            }
                        }
                    }
                }
            }
        }
    }

    // Return true if cell is occupied by any object (road or building)
    cellIsOccupied(x, y, z, margin) {
        if(this.is_empty) {
            return false;
        }
        x -= this.coord.x;
        // y -= this.coord.y;
        z -= this.coord.z;
        const index = z * this.size.x + x;
        return this.near_mask[index] <= margin;
    }

    //
    getCell(x, y, z) {
        if(this.is_empty) {
            return false;
        }
        x -= this.coord.x;
        z -= this.coord.z;
        const index = z * this.size.x + x;
        return this.mask[index];
    }

    // Add NPC
    addNPC(chunk, pos) {
        // Auto generate mobs
        const auto_generate_mobs = this.clusterManager.chunkManager.world.getGeneratorOptions('auto_generate_mobs', true);
        if(!auto_generate_mobs) {
            return;
        }
        let rel_pos = pos.sub(chunk.coord);
        if(rel_pos.x < 0 || rel_pos.y < 0 || rel_pos.z < 0 || rel_pos.x >= chunk.size.x || rel_pos.y >= chunk.size.y || rel_pos.z >= chunk.size.z) {
            return false;
        }
        const npc_extra_data = BLOCK.calculateExtraData(this.generateNPCSpawnExtraData(), rel_pos);
        this.setBlock(chunk, rel_pos.x, rel_pos.y, rel_pos.z, BLOCK.MOB_SPAWN.id, null, npc_extra_data);
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
                        this.mask[z * this.size.x + x] = fence_point_torch;
                    } else {
                        this.mask[z * this.size.x + x] = fence_point;
                    }
                }
            }
        }
    }

    // Add road platform
    addRoadPlatform(coord, size, road_block_palette) {
        const dx = coord.x - this.coord.x;
        const dz = coord.z - this.coord.z;
        for(let i = 0; i < size.x + 2; i++) {
            for(let j = 0; j < size.z + 2; j++) {
                const x = dx + i - 1;
                const z = dz + j - 1;
                // Draw road around plot
                this.mask[z * this.size.x + x] = new ClusterPoint(1, road_block_palette.next().id, 1, null, null);
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

    //
    drawNaturalBasement(chunk, pos, size, block) {

        // console.log(pos.toHash())

        //const aabb = new AABB().set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y - size.y + 1, pos.z + size.z)
        //if(!chunk.aabb.intersect(aabb)) return false

        let bx = pos.x - chunk.coord.x;
        let by = pos.y - chunk.coord.y;
        let bz = pos.z - chunk.coord.z;

        const ysign = Math.sign(size.y)
        const height = Math.abs(size.y)
        const m = 0

        for(let x = -m; x < size.x + m; x++) {
            for(let z = -m; z < size.z + m; z++) {
                for(let y = 0; y < height; y++) {
                    this.setBlock(chunk, x + bx, by + y * ysign, z + bz, BLOCK.WHITE_CONCRETE.id)
                }
            }
        }

        return

        const randoms = new alea(`natural_basement_${pos.x}_${pos.y}_${pos.z}`);
        const center = new Vector(bx + size.x/2, by + size.y, bz + size.z/2)
        const _vec = new Vector(0, 0, 0);
        const margin = 2;

        for(let k = size.y; k > 0; k--) {
            const y = by + k;
            if(y >= CHUNK_SIZE_Y) continue
            const rad_coef = Math.sqrt(k / (size.y / 2.2)) * .6 * (1 - randoms.double() / 4.5);
            for(let i = -margin; i < size.x + margin; i++) {
                for(let j = -margin; j < size.z + margin; j++) {
                    const x = bx + i;
                    const z = bz + j;
                    _vec.set(x, y, z);
                    const dist = center.distance(_vec);
                    if(dist < Math.max(size.x, size.z) * rad_coef) {
                        const block_id = this.getBlock(chunk, x, y, z);
                        if(block_id == 0 || block_id > 0 && BLOCK.canReplace(block_id)) {
                            let block_id = block.id;
                            // blocks
                            if(chunk.map && x >= 0 && z >= 0 && x < chunk.size.x && z < chunk.size.z) {
                                const cell = chunk.map.getCell(x, z)
                                let dl = cell?.dirt_layer
                                if(dl) {
                                    block_id = dl.blocks[0]
                                    if(k < size.y && dl.blocks.length > 1) {
                                        block_id = dl.blocks[1]
                                    }
                                } else if(cell.biome.dirt_layers) {
                                    dl = cell.biome.dirt_layers[0]
                                    block_id = dl.blocks[Math.min(k, dl.blocks.length - 1)]
                                }
                                if(dl.cap_block_id) {
                                    if(k == size.y) {
                                        this.setBlock(chunk, x, y + 1, z, dl.cap_block_id)
                                    }
                                }
                            }
                            this.setBlock(chunk, x, y, z, block_id);
                            if(y > 0) {
                                let under_block_id = this.getBlock(chunk, x, y - 1, z);
                                if(under_block_id == BLOCK.GRASS_BLOCK.id) {
                                    this.setBlock(chunk, x, y - 1, z, BLOCK.DIRT.id);
                                }
                            }
                        }
                    }
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

    // Add flat roof
    drawFlatRoof(chunk, pos, size, block) {
        const bx = pos.x - chunk.coord.x;
        const by = pos.y - chunk.coord.y;
        const bz = pos.z - chunk.coord.z;
        const xyz = new Vector(0, 0, 0);
        // block_palette.reset();
        for(let i = 0; i < size.x; i++) {
            for(let j = 0; j < size.z; j++) {
                for(let k = 0; k < size.y; k++) {
                    const x = bx + i;
                    const y = by + k;
                    const z = bz + j;
                    xyz.copyFrom(pos).add(i, k, j);
                    const block_id = block.id; // block_palette.next().id;
                    //if(i < 1 || j < 1 || k < 0 || i > size.x - 2 || j > size.z - 2 || k > size.y - 1) {
                        this.setBlock(chunk, x, y, z, block_id, null);
                    //} else {
                    //    this.setBlock(chunk, x, y, z, 0, null);
                    //}
                }
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