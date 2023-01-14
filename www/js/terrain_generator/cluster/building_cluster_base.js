import { CHUNK_SIZE_X } from "../../chunk_const.js";
import { DIRECTION, getChunkAddr, Vector, VectorCollector} from "../../helpers.js";
import { AABB } from '../../core/AABB.js';
import { ClusterBase, ClusterPoint, CLUSTER_SIZE } from "./base.js";
import { BUILDING_AABB_MARGIN } from "./building.js";
import { impl as alea } from '../../../vendors/alea.js';

//
const entranceAhead = new Vector(0, 0, 0);
export const getAheadMove = (dir) => {
    entranceAhead.set(0, 0, 0);
    if(dir == DIRECTION.NORTH) {entranceAhead.z++;}
    else if(dir == DIRECTION.SOUTH) {entranceAhead.z--;}
    else if(dir == DIRECTION.EAST) {entranceAhead.x++;}
    else {entranceAhead.x--;}
    return entranceAhead;
}

// Building base cluster
export class ClusterBuildingBase extends ClusterBase {

    //
    constructor(clusterManager, addr, biome) {

        super(clusterManager, addr);

        this.buildings              = new VectorCollector()
        this.randoms                = new alea(this.id)

        //
        this.timers = {
            generate: 0,
            fill_blocks: 0,
            add_buildings: 0,
            fill_blocks_count: 0
        }

    }

    /**
     * Add building
     * 
     * @param {*} seed 
     * @param {int} dx 
     * @param {int} dz 
     * @param {Vector} size 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {int} door_direction 
     * 
     * @returns 
     */
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {

        const coord = new Vector(dx + this.coord.x, 1, dz + this.coord.z)
        if(this.buildings.has(coord)) {
            return false
        }

        const aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN)
        const building = this.building_palettes.next(this, seed, door_direction, size, coord.clone(), aabb, entrance.addSelf(this.coord), door_bottom.addSelf(this.coord))

        //
        this.buildings.set(building.coord, building);

        // 1. building mask
        dx = building.coord.x - this.coord.x;
        dz = building.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building);
            }
        }

        // 2. entrance mask
        if(building.draw_entrance) {
            let ahead = getAheadMove(building.door_direction);
            const ex = building.entrance.x - this.coord.x + ahead.x;
            const ez = building.entrance.z - this.coord.z + ahead.z;
            this.mask[ez * CLUSTER_SIZE.x + ex] = new ClusterPoint(1, this.basement_block, 3, null, null);
        }

        return building

    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map, fill_blocks = true, calc_building_y = true) {

        if(this.is_empty) {
            return false;
        }

        let t = performance.now();

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

            // если строение частично или полностью находится в этом чанке
            if(b.entrance.y != Infinity && b.aabb.intersect(chunk.aabb)) {
                this.drawBulding(chunk, maps, b, map)
            }

        }

        if(fill_blocks) {
            super.fillBlocks(maps, chunk, map);
        }

        //
        this.timers.fill_blocks += performance.now() - t;
        this.timers.fill_blocks_count++;

    }

    /**
     * Draw part of building on map
     * 
     * @param {*} chunk 
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

        // 
        this.fixBuildingHeight(maps, chunk, building)

        // draw building
        if(!building.hidden) {
            building.draw(this, chunk, map)
        }

    }

    //
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
                if(px >= 0 && pz >= 0 && px < CLUSTER_SIZE.x && pz < CLUSTER_SIZE.z) {
                    const mask_point = this.mask[pz * CLUSTER_SIZE.x + px]
                    if(mask_point && mask_point.height && !mask_point.height_fixed) {
                        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                        const vec = new Vector(building.coord.x + i, 0, building.coord.z + j)
                        const map_addr = getChunkAddr(vec)
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