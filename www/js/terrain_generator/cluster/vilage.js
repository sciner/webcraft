import { CHUNK_SIZE_X } from "../../chunk_const.js";
import {DIRECTION, getChunkAddr, Vector, VectorCollector} from "../../helpers.js";
import { AABB } from '../../core/AABB.js';
import {ClusterBase, ClusterPoint, CLUSTER_SIZE, CLUSTER_PADDING} from "./base.js";
import {VilageSchema} from "./vilage_schema.js";
import {BUILDING_AABB_MARGIN, Building} from "./building.js";
import {impl as alea} from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";

// Buildings
import { BuildingS } from "./building/buildings.js";
import { Building1 } from "./building/building1.js";
import { Farmland } from "./building/farmland.js";
import { WaterWell } from "./building/waterwell.js";
import { Church } from "./building/church.js";
import { StreetLight } from "./building/streetlight.js";

const ROAD_DAMAGE_FACTOR    = 0.15;
const USE_ROAD_AS_GANGWAY   = 0;

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
            this.wall_block         = this.flat ? BLOCK.STONE_BRICKS.id : BLOCK.OAK_PLANKS.id;
            this.road_block         = this.createPalette(this.flat ? [
                {value: BLOCK.DIRT_PATH, chance: 1}
               // {value: BLOCK.ANDESITE, chance: .5},
               // {value: BLOCK.STONE, chance: 1}
            ] : [
                {value: BLOCK.DIRT_PATH, chance: 1}
            ]);
            this.road_block.reset();
            this.basement_block = this.flat ? BLOCK.POLISHED_ANDESITE.id : BLOCK.COBBLESTONE.id;
            // Building palettes
            this.building_palette = this.createBuildingPalette({
                crossroad: [
                    {class: StreetLight, max_count: Infinity, chance: 1}
                ],
                required: [
                    {class: WaterWell, max_count: 1, chance: 1},
                    {class: Farmland, max_count: 1, chance: 1},
                    {class: Church, max_count: 1, chance: 1}
                ],
                others: [
                    {class: WaterWell, max_count: 2, chance: 0.12},
                    {class: Farmland, max_count: Infinity, chance: 0.285},
                    {class: Building1, max_count: Infinity, chance: 0.7025},
                    {class: BuildingS, max_count: Infinity, chance: 1}
                ]
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
            const settings = {
                margin: CLUSTER_PADDING,
                road_damage_factor: ROAD_DAMAGE_FACTOR // this.flat ? 0 : ROAD_DAMAGE_FACTOR
            };
            if(clusterManager.version == 2) {
                settings.quant = 16;
            }
            let vs = this.schema = new VilageSchema(this, settings);
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

                    const {size} = args;
                    const r = that.randoms.double();

                    // each all buildings in this palette
                    for(let i in this.list) {

                        const b = this.list[i];

                        if (r <= b.chance) {

                            let found = false;
                            let random_size = null;
                            const size_list = [...b.class.SIZE_LIST];

                            // search random building size
                            while(!found && size_list.length) {
                                const index = size_list.length * args.seed | 0;
                                random_size = size_list[index];
                                if([DIRECTION.NORTH, DIRECTION.SOUTH].includes(args.door_direction)) {
                                    // x
                                    found = random_size.x <= size.x && random_size.z <= size.z;
                                } else {
                                    // z
                                    found = random_size.z <= size.x && random_size.x <= size.z;
                                }
                                if(!found) {
                                    size_list.splice(index, 1);
                                }
                            }

                            // if random size founded
                            if(found) {

                                b.max_count--;
                                if(b.max_count <= 0) {
                                    this.list.splice(i, 1);
                                }

                                // calculate correct door position
                                Building.selectSize(random_size, args.seed, args.coord, args.size, args.entrance, args.door_bottom, args.door_direction);

                                // create object by pre-calculated arguments
                                return new b.class(args.cluster, args.seed, args.coord, args.aabb, args.entrance, args.door_bottom, args.door_direction, args.size, random_size);

                            }

                        }
                    }

                    return null;
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
        const building_args = {
            cluster:        this,
            seed:           seed,
            door_direction: door_direction,
            size:           size,
            coord:          coord.clone(),
            aabb:           new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN),
            entrance:       entrance.addSelf(this.coord),
            door_bottom:    door_bottom.addSelf(this.coord)
        };

        // generate random building from palette
        let building = null;
        if(size.x == 1 && size.z == 1) {
            building = this.building_palette.crossroad.next(building_args);
        }        
        if(!building && this.building_palette.required.list.length > 0) {
            building = this.building_palette.required.next(building_args);
        }
        if(!building) {
            building = this.building_palette.others.next(building_args);
        }

        if(!building) {
            throw 'Proportional fill pattern';
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
    fillBlocks(maps, chunk, map, fill_blocks = true, call_building_y = true) {
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
                if(b.entrance.y == Infinity && call_building_y) {
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
                        if(!b.biome) {
                            b.setBiome({}, 0, 0);
                        }
                        b.setY(value2);
                    }
                }
                if(b.entrance.y == Infinity) {
                    // console.error('Invalid building y');
                } else if(b.aabb.intersect(chunk.aabb)) {
                    this.drawBulding(chunk, maps, b);
                }
            }
        }
        if(fill_blocks) {
            super.fillBlocks(maps, chunk, map);
        }
        //
        this.timers.fill_blocks += performance.now() - t;
        this.timers.fill_blocks_count++;
        // console.log(this.addr.toHash(), this.timers)
    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        if(building.hidden) {
            return;
        }
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