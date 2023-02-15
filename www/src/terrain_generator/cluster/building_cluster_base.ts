import { CHUNK_SIZE_X } from "../../chunk_const.js";
import { DIRECTION, getChunkAddr, PerformanceTimer, Vector, VectorCollector} from "../../helpers.js";
import { ClusterBase, ClusterPoint } from "./base.js";
import { BUILDING_AABB_MARGIN } from "./building.js";
import { impl as alea } from '../../../vendors/alea.js';
import { BuildingPalettes } from "./building/palette.js";
import type { ClusterManager } from "./manager.js";

//
const entranceAhead = new Vector(0, 0, 0);
export const getAheadMove = (dir) => {
    dir %= 4
    entranceAhead.set(0, 0, 0);
    if(dir == DIRECTION.NORTH) {entranceAhead.z++;}
    else if(dir == DIRECTION.SOUTH) {entranceAhead.z--;}
    else if(dir == DIRECTION.EAST) {entranceAhead.x++;}
    else {entranceAhead.x--;}
    return entranceAhead;
}

// Building base cluster
export class ClusterBuildingBase extends ClusterBase {
    [key: string]: any;

    /**
     * @type {BuildingPalettes}
     */
    building_palettes

    //
    constructor(clusterManager : ClusterManager, addr : Vector, biome? : any) {

        super(clusterManager, addr)

        this.buildings              = new VectorCollector()
        this.randoms                = new alea(this.id)
        this.timers                 = new PerformanceTimer()

    }

    /**
     * Add building
     * 
     * @param {*} seed 
     * @param {int} door_x 
     * @param {int} door_z 
     * @param {Vector} size 
     * @param {Vector} entrance 
     * @param {int} door_direction 
     * @param {boolean} is_crossroad
     * 
     * @returns 
     */
    addBuilding(seed, door_x, door_z, size, entrance, door_direction, is_crossroad = false) {

        const coord = new Vector(door_x + this.coord.x, 0, door_z + this.coord.z)
        if(this.buildings.has(coord)) {
            return false
        }

        const building = this.building_palettes.next(this, seed, door_direction, size, coord, entrance, is_crossroad)

        //
        this.buildings.set(building.coord, building);

        // 1. building mask
        /*
        const margin = 0
        const pos = new Vector(building.aabb.x_min, 0, building.aabb.z_min)
        for(let i = -margin; i < building.size.x + margin; i++) {
            for(let j = -margin; j < building.size.z + margin; j++) {
                const x = pos.x - this.coord.x + i
                const z = pos.z - this.coord.z + j
                if(x >= 0 && z >= 0 && x < this.size.x && z < this.size.z) {
                    const nidx = z * this.size.x + x
                    //this.mask[nidx] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building)
                }
            }
        }
        */

        // 1. building mask
        const new_door_x = building.coord.x - this.coord.x
        const new_door_z = building.coord.z - this.coord.z
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = new_door_x + i
                const z = new_door_z + j
                // Draw building basement over heightmap
                this.mask[z * this.size.x + x] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building)
            }
        }

        /*
        // 2. add entrance mask
        if(building.draw_entrance) {
            const ahead = getAheadMove(building.door_direction);
            const ex = building.entrance.x - this.coord.x + ahead.x
            const ez = building.entrance.z - this.coord.z + ahead.z
            this.mask[ez * this.size.x + ex] = new ClusterPoint(1, this.basement_block, 3, null, null)
        }
        */

        return building

    }

    /**
     * Fill chunk blocks
     * @param {*} maps 
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk  
     * @param {*} map 
     * @param {boolean} fill_blocks 
     * @param {boolean} calc_building_y 
     * @returns 
     */
    fillBlocks(maps, chunk, map, fill_blocks = true, calc_building_y = true) {

        if(this.is_empty) {
            return false;
        }

        this.timers.start('fill_blocks')

        // each all buildings
        for(let b of this.buildings.values()) {

            // for old biome2 generator only
            if(calc_building_y && b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y - BUILDING_AABB_MARGIN;
                b.aabb.y_max = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 2;
                if(b.aabb.intersect(chunk.aabb)) {
                    b.findYOld(chunk, maps);
                }
            }

            if(b.entrance.y != Infinity) {
                this.drawBulding(chunk, maps, b, map)
            }

        }

        if(fill_blocks) {
            super.fillBlocks(maps, chunk, map);
        }

        //
        this.timers.stop()
        this.timers.fill_blocks_count++;

    }

    /**
     * Draw part of building on map
     * 
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @param {object[]} maps 
     * @param {*} building 
     * @param {*} map 
     * 
     * @returns 
     */
    drawBulding(chunk, maps, building, map) {
        
        if(building.hidden) {
            return
        }

        // если строение частично или полностью находится в этом чанке
        const buildingIntersects = building.aabb.intersect(chunk.aabb)

        // for old version of terrain generator
        // Call it before drawing anything.
        if (buildingIntersects) {
            this.fixBuildingHeight(maps, chunk, building)
        }
        // draw basement before the building
        if (building.getautoBasementAABB()?.intersect(chunk.aabb)) {
            building.drawAutoBasement(chunk)
        }
        // draw building
        if (buildingIntersects) {
            building.draw(this, chunk, map)
        }
    }

    /**
     * 
     * @param {*} maps 
         * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @param {*} building 
     * @returns 
     */
    fixBuildingHeight(maps, chunk, building) {

        if(this.clusterManager.chunkManager.world.generator.layers) {
            return false
        }

        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;

        for(let i = 0; i < building.size.x; i++) {
            const bx = building.coord.x + i
            // if(bx < chunk.coord.x || bx > chunk.coord.x + chunk.size.x) continue;
            for(let j = 0; j < building.size.z; j++) {
                const bz = building.coord.z + j
                // if(bz < chunk.coord.z || bz > chunk.coord.z + chunk.size.z) continue;
                const x = bx - chunk.coord.x
                const z = bz - chunk.coord.z
                // fix basement height
                const pz = START_Z + z
                const px = START_X + x
                if(px >= 0 && pz >= 0 && px < this.size.x && pz < this.size.z) {
                    const mask_point = this.mask[pz * this.size.x + px]
                    if(mask_point && mask_point.height && !mask_point.height_fixed) {
                        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                        const vec = new Vector(building.coord.x + i, 0, building.coord.z + j)
                        const map_addr = Vector.toChunkAddr(vec)
                        let bi = maps.get(map_addr)
                        if(bi) {
                            // if map not smoothed
                            if(!bi.smoothed) {
                                // generate around maps and smooth current
                                bi = maps.generateAround(chunk, map_addr, true, false)[4]
                            }
                            const entrance_x    = vec.x - bi.chunk.coord.x
                            const entrance_z    = vec.z - bi.chunk.coord.z
                            const cell          = bi.cells[entrance_z * CHUNK_SIZE_X + entrance_x]
                            if(cell.biome.code == 'BEACH' || cell.biome.code == 'OCEAN') {
                                building.hidden = true
                            }
                            mask_point.height = Math.max(Math.min(mask_point.height, building.coord.y - cell.value2 + 1), 0)
                            mask_point.height_fixed = true
                        }
                    }
                }
            }
        }

    }

}