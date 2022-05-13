import {CHUNK_SIZE_X, getChunkAddr} from "../../chunk.js";
import {DIRECTION, Vector, VectorCollector} from "../../helpers.js";
import { AABB } from '../../core/AABB.js';
import {ClusterBase, ClusterPoint, CLUSTER_SIZE, CLUSTER_PADDING} from "./base.js";
import {VilageSchema} from "./vilage_schema.js";
import {BUILDING_AABB_MARGIN, Building1, BuildingS, Farmland, StreetLight, WaterWell} from "./building.js";
import {impl as alea} from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";

const ROAD_DAMAGE_FACTOR    = 0.15;
const USE_ROAD_AS_GANGWAY   = 0;

//
const entranceAhead = new Vector(0, 0, 0);
const getAheadMove = (dir) => {
    entranceAhead.set(0, 0, 0);
    if(dir == DIRECTION.NORTH) {entranceAhead.z++;}
    else if(dir == DIRECTION.SOUTH) {entranceAhead.z--;}
    else if(dir == DIRECTION.EAST) {entranceAhead.x++;}
    else {entranceAhead.x--;}
    return entranceAhead;
}

//
export class ClusterVilage extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.buildings              = new VectorCollector();
        this.randoms                = new alea(this.id);
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;
        if(!this.is_empty) {
            this.flat               = this.randoms.double() >= .8;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? BLOCK.STONE_BRICK.id : BLOCK.OAK_PLANK.id;
            this.road_block         = this.createPalette(this.flat ? [
                {value: BLOCK.ANDESITE, chance: .5},
                {value: BLOCK.CONCRETE, chance: 1}
            ] : [
                {value: BLOCK.DIRT_PATH, chance: 1}
            ]);
            this.road_block.reset();
            this.basement_block     = this.flat ? BLOCK.POLISHED_ANDESITE.id : BLOCK.COBBLESTONE.id;
            this.building_palette   = this.createBuildingPalette({
                crossroad: [
                    {class: StreetLight, max_count: Infinity, chance: 1}
                ],
                required: [
                    {class: WaterWell, max_count: 1, chance: 1},
                    {class: Farmland, max_count: 1, chance: 1}
                ],
                others: [
                    {class: WaterWell, max_count: 2, chance: 0.12},
                    {class: Farmland, max_count: Infinity, chance: 0.285},
                    {class: Building1, max_count: Infinity, chance: 0.7025},
                    {class: BuildingS, max_count: Infinity, chance: 1}
                ],
            });
            //
            this.timers = {
                generate: 0,
                fill_blocks: 0,
                add_buildings: 0,
                fill_blocks_count: 0
            };
            // generate schema
            let t = performance.now();
            let vs = this.schema = new VilageSchema(this, {
                margin: CLUSTER_PADDING,
                road_damage_factor: this.flat ? 0 : ROAD_DAMAGE_FACTOR
            });
            let resp = vs.generate(this.id);
            this.timers.generate = performance.now() - t; t = performance.now();
            // work with schema
            this.mask = resp.mask;
            for(let house of resp.houses.values()) {
                const size = new Vector(house.width, 5, house.depth);
                const entrance_pos = new Vector(house.door.x, Infinity, house.door.z);
                const door_bottom = new Vector(house.door.x, Infinity, house.door.z);
                this.addBuilding(this.randoms.double(), house.x, house.z, size, entrance_pos, door_bottom, house.door.direction);
            }
            this.timers.add_buildings = performance.now() - t; t = performance.now();
        }
        //
        const moving = this.moveToRandomCorner();
        for(let b of this.buildings) {
            b.translate(moving);
        }
    }

    // createBuildingPalette...
    createBuildingPalette(rules) {
        let that = this;
        let resp = {};
        for(let k in rules) {
            resp[k] = {
                list: rules[k],
                next: function(args) {
                    const r = that.randoms.double();
                    for(let i in this.list) {
                        let b = this.list[i];
                        if (r <= b.chance) {
                            b.max_count--;
                            if(b.max_count <= 0) {
                                this.list.splice(i, 1);
                            }
                            return new b.class(...args);
                        }
                    }
                    throw 'Proportional fill pattern';
                }
            }
        }
        return resp;
    }

    // Add building
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {
        let dy = 1;
        const coord = new Vector(dx + this.coord.x, dy, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        //
        let building_args = [
            this,
            seed,
            coord.clone(),
            new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN),
            entrance.addSelf(this.coord),
            door_bottom.addSelf(this.coord),
            door_direction,
            size
        ];
        // generate random building from palette
        let building = null;
        if(size.x == 1 && size.z == 1) {
            building = this.building_palette.crossroad.next(building_args);
        } else if(this.building_palette.required.list.length > 0) {
            building = this.building_palette.required.next(building_args);
        } else {
            building = this.building_palette.others.next(building_args);
        }
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
        return true;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        let t = performance.now();
        // each all buildings
        for(let b of this.buildings.values()) {
            if(b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y - BUILDING_AABB_MARGIN;
                b.aabb.y_max = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 2;
            }
            // если строение частично или полностью находится в этом чанке
            if(b.aabb.intersect(chunk.aabb)) {
                // у строения до этого момента нет точной информации о вертикальной позиции двери (а значит и пола)
                if(b.entrance.y == Infinity) {
                    // забираем карту того участка, где дверь, чтобы определить точный уровень пола
                    let value2 = 0;
                    for(let entrance of [b.entrance, b.entrance.clone().addSelf(getAheadMove(b.door_direction))]) {
                        const map_addr = getChunkAddr(entrance);
                        map_addr.y = 0;
                        let entrance_map = maps.get(map_addr);
                        if(entrance_map) {
                            // if map not smoothed
                            if(!entrance_map.smoothed) {
                                // generate around maps and smooth current
                                entrance_map = maps.generateAround(chunk, map_addr, true, false)[4];
                            }
                            const entrance_x    = entrance.x - entrance_map.chunk.coord.x;
                            const entrance_z    = entrance.z - entrance_map.chunk.coord.z;
                            const cell          = entrance_map.cells[entrance_z * CHUNK_SIZE_X + entrance_x];
                            if(cell.value2 > value2) {
                                value2 = cell.value2;
                            }
                        }
                    }
                    if(value2 > 0) {
                        b.entrance.y        = value2 - 1;
                        b.coord.y           = b.entrance.y + b.coord.y;
                        b.aabb.y_min        = b.entrance.y - BUILDING_AABB_MARGIN;
                        b.aabb.y_max        = b.aabb.y_min + b.size.y * 3; // + BUILDING_AABB_MARGIN * 5;
                        b.door_bottom.y     = value2;
                    }
                }
                if(b.entrance.y == Infinity) {
                    console.error('Invalid building y');
                } else if(b.aabb.intersect(chunk.aabb)) {
                    this.drawBulding(chunk, maps, b);
                }
            }
        }
        super.fillBlocks(maps, chunk, map);
        //
        this.timers.fill_blocks += performance.now() - t;
        this.timers.fill_blocks_count++;
        // console.log(this.addr.toHash(), this.timers)
    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            let bx = building.coord.x + i;
            // if(bx < chunk.coord.x || bx > chunk.coord.x + chunk.size.x) continue;
            for(let j = 0; j < building.size.z; j++) {
                let bz = building.coord.z + j;
                // if(bz < chunk.coord.z || bz > chunk.coord.z + chunk.size.z) continue;
                const x = bx - chunk.coord.x;
                const z = bz - chunk.coord.z;
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
                                bi = maps.generateAround(chunk, map_addr, true, false)[4];
                            }
                            const entrance_x    = vec.x - bi.chunk.coord.x;
                            const entrance_z    = vec.z - bi.chunk.coord.z;
                            const cell          = bi.cells[entrance_z * CHUNK_SIZE_X + entrance_x];
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
            building.draw(this, chunk);
        }
    }

}