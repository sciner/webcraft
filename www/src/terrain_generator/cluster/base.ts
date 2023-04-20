import { Vector} from "../../helpers.js";
import {impl as alea} from '../../../vendors/alea.js';

import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { Biome3TerrainMap } from "../biome3/terrain/map.js";
import type { TerrainMap, TerrainMapManager } from "../terrain_map.js";
import type { ClusterManager } from "./manager.js";
import type { BLOCK } from "../../blocks.js";
import { WATER_LEVEL } from "../biome3/terrain/manager_vars.js";

export const NEAR_MASK_MAX_DIST = 10
export const CLUSTER_PADDING    = 8

export class ClusterPoint {
    [key: string]: any;

    constructor(height : int, block_id : int, margin : int, info? : any, building? : any, y_shift? : int) {
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
    [key: string]: any;

    clusterManager: ClusterManager
    block_manager:  BLOCK
    randoms:        alea
    r:              alea
    is_empty:       boolean
    max_height?:    int = null
    max_dist:       int = NEAR_MASK_MAX_DIST
    y_base:         int = WATER_LEVEL
    mask:           any

    constructor(clusterManager : ClusterManager, addr : Vector, size? : Vector) {
        this.y_base         = clusterManager.world.generator.options.WATER_LEVEL
        this.clusterManager = clusterManager;
        this.block_manager  = clusterManager.world.block_manager
        this.addr           = addr;
        this.size           = new Vector(clusterManager.size)
        this.coord          = addr.clone().multiplyVecSelf(this.size);
        this.id             = this.clusterManager.seed + '_' + addr.toHash();
        this.randoms        = new alea(`villages_${this.id}`);
        this.r              = new alea(`cluster_r_${this.id}`).double();
        this.is_empty       = clusterManager.layer ? false : (this.addr.y != 0 || this.randoms.double() > 1/4);
        this.mask           = new Array(this.size.x * this.size.z);
        this.corner         = clusterManager.layer ? Math.floor(this.randoms.double() * 4) : undefined
    }

    get generator() {
        return this.clusterManager.world.generator
    }

    getMaskByWorldXZ(x : int, z : int) {
        x -= this.coord.x
        z -= this.coord.z
        const sizeX = this.size.x
        if ((x | z) < 0 || x >= sizeX || z >= this.size.x) {
            return null
        }
        return this.mask[x + z * sizeX]
    }

    /**
     * Set block
     */
    setBlock(chunk : ChunkWorkerChunk, x : int, y : int, z : int, block_id : int, rotate : Vector | null = null, extra_data : any | null = null, check_is_solid : boolean = false, destroy_fluid : boolean = false, candidate_for_cap_block : boolean = false, map? : Biome3TerrainMap) : boolean {
        if(x >= 0 && y >= 0 && z >= 0 && x < chunk.size.x && y < chunk.size.y && z < chunk.size.z) {
            // ok
        } else {
            return false
        }
        const bm = this.block_manager
        switch(block_id) {
            case bm.BLD_AIR.id: {
                block_id = 0
                break
            }
        }
        if(map) {
            // IMPORTANT: replace structure dirt blocks
            if(block_id == bm.GRASS_BLOCK.id || block_id == bm.DIRT.id) {
                const cell = map.getCell(x, z)
                const cdl = cell.dirt_layer
                if(cdl) {
                    const layer_index = Math.min(block_id == bm.DIRT.id ? 1 : 0, cdl.blocks.length - 1)
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
                    return false
                }
            }
        }
        chunk.setBlockIndirect(x, y, z, block_id, rotate, extra_data, undefined, undefined, check_is_solid, destroy_fluid)
        return true;
    }

    /**
     * Return block ID from pos
     */
    getBlock(chunk : ChunkWorkerChunk, x : int, y : int, z : int) : int {
        const {cx, cy, cz, cw} = chunk.dataChunk;
        const index = cx * x + cy * y + cz * z + cw;
        return chunk.tblocks.id[index];
    }

    resetNearMask() : void {
        this.near_mask = new Array(this.size.x * this.size.z).fill(255)
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
        for(let index : int = 0; index < this.mask.length; index++) {
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
        this.resetNearMask()
        for(let x = 0; x < this.size.x; x++) {
            for(let z = 0; z < this.size.z; z++) {
                const index = z * this.size.x + x;
                const value = this.mask[index];
                if(value && (Array.isArray(value.block_id) || value.block_id > 0)) {
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

    /**
     * Fill chunk blocks
     */
    fillBlocks(maps : TerrainMapManager, chunk : ChunkWorkerChunk, map: TerrainMap) {
        if(this.is_empty) {
            return false;
        }
        const START_X           = chunk.coord.x - this.coord.x;
        const START_Z           = chunk.coord.z - this.coord.z;
        const CHUNK_Y_BOTTOM    = chunk.coord.y;
        const bm                = this.block_manager
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
                    const cell = map.getCell(i, j)
                    if(cell.biome.code == 'OCEAN') {
                        /*if(this.use_road_as_gangway && point.block_id == this.road_block) {
                            let y = WATER_LEVEL - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < CHUNK_SIZE_Y) {
                                this.setBlock(chunk, i, y, j, bm.OAK_PLANKS.id, null);
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
                                this.setBlock(chunk, i, y, j, is_array ? point.block_id[k] : point.block_id);
                            }
                        }
                    } else {
                        const is_array = Array.isArray(point.block_id);
                        let ai = 0;
                        for(let k = point.height; k <= 0; k++) {
                            let y = cell.value2 + k - CHUNK_Y_BOTTOM - 1;
                            if(y >= 0 && y < chunk.size.y) {
                                let block_id = k == point.height ? point.block_id : bm.AIR.id;
                                if(is_array) {
                                    block_id = point.block_id[ai++];
                                }
                                this.setBlock(chunk, i, y, j, block_id);
                            }
                        }
                    }
                }
            }
        }
    }

    // Return true if cell is occupied by any object (road or building)
    cellIsOccupied(x : int, z : int, margin : int) : boolean {
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
    getCell(x : int, z : int) : any {
        if(this.is_empty) {
            return false;
        }
        x -= this.coord.x;
        z -= this.coord.z;
        const index = z * this.size.x + x;
        return this.mask[index];
    }

    /**
     * Add NPC
     */
    addNPC(chunk : ChunkWorkerChunk, pos : Vector) : boolean {
        const bm = this.block_manager
        // Auto generate mobs
        const auto_generate_mobs = this.clusterManager.chunkManager.world.getGeneratorOptions('auto_generate_mobs', true);
        if(!auto_generate_mobs) {
            return false;
        }
        const rel_pos = pos.sub(chunk.coord);
        if(rel_pos.x < 0 || rel_pos.y < 0 || rel_pos.z < 0 || rel_pos.x >= chunk.size.x || rel_pos.y >= chunk.size.y || rel_pos.z >= chunk.size.z) {
            return false;
        }
        const npc_extra_data = bm.calculateExtraData(this.generateNPCSpawnExtraData(), rel_pos);
        this.setBlock(chunk, rel_pos.x, rel_pos.y, rel_pos.z, bm.MOB_SPAWN.id, null, npc_extra_data);
        return true;
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

    drawQuboid(chunk : ChunkWorkerChunk, pos : Vector, size : Vector, block : any, rotate : Vector, extra_data : any) {
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

    /**
     * @deprecated see drawAutoBasement
     * @param chunk 
     * @param pos 
     * @param size - y may be negative. It means "draw below pos.y"
     * @param block 
     */
    drawNaturalBasement(chunk : ChunkWorkerChunk, pos : Vector, size : Vector, block : any) {

        // console.log(pos.toHash())
        //const aabb = new AABB().set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y - size.y + 1, pos.z + size.z)
        //if(!chunk.aabb.intersect(aabb)) return false

        const bm = this.block_manager

        let bx = pos.x - chunk.coord.x;
        let by = pos.y - chunk.coord.y;
        let bz = pos.z - chunk.coord.z;

        const ysign = Math.sign(size.y)
        const height = Math.abs(size.y)
        const m = 0
        for(let x = -m; x < size.x + m; x++) {
            for(let z = -m; z < size.z + m; z++) {
                for(let y = 0; y < height; y++) {
                    this.setBlock(chunk, x + bx, by + y * ysign, z + bz, y == 0 ? bm.GRASS_BLOCK.id : bm.DIRT.id)
                }
            }
        }

        /*
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
                        if(block_id == 0 || block_id > 0 && bm.canReplace(block_id)) {
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
                                if(under_block_id == bm.GRASS_BLOCK.id) {
                                    this.setBlock(chunk, x, y - 1, z, bm.DIRT.id);
                                }
                            }
                        }
                    }
                }
            }
        }
        */

    }

    // Return extra data for block MOB_SPAWN
    generateNPCSpawnExtraData() {
        return {
            type: 'mob/npc',
            limit: {count: 1},
            calculated: [
                {type: 'random_item', name: 'skin', items: [1, 2, 3, 4, 5, 6, 7, 10]},
                {type: 'random_int', name: 'max_ticks', min_max: [1, 1]}
            ]
        }
    }

}