import {getChunkAddr} from "../../chunk.js";
import {DIRECTION, Vector, VectorCollector} from "../../helpers.js";
import { AABB } from '../../core/AABB.js';
import {ClusterBase, ClusterPoint, CLUSTER_SIZE} from "./base.js";
import {VilageSchema} from "./vilage_schema.js";
import {impl as alea} from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";

const CLUSTER_PADDING       = 4;
const STREET_WIDTH          = 15;
const ROAD_DAMAGE_FACTOR    = 0.05;

const USE_ROAD_AS_GANGWAY   = .1;
const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

const building_size_x       = new Vector(7, 5, 5);
const building_size_z       = new Vector(5, 5, 7);

//
export class ClusterVilage extends ClusterBase {

    constructor(addr) {
        super(addr);
        this.buildings              = new VectorCollector();
        this.use_road_as_gangway    = this.randoms.double() <= USE_ROAD_AS_GANGWAY;
        if(!this.is_empty) {
            this.flat               = this.randoms.double() >= .8;
            this.max_height         = this.flat ? 1 : 30;
            this.wall_block         = this.flat ? 98 : 7;
            this.road_block         = this.flat ? 12 : 468;
            this.basement_block     = this.flat ? 546 : 8;
            //
            let vs = new VilageSchema(this);
            let resp = vs.generate(this.id);
            this.mask = resp.mask;
            for(let house of resp.houses.values()) {
                const size = new Vector(house.width, 5, house.depth);
                const entrance_pos = new Vector(house.door.x, Infinity, house.door.z);
                const door_bottom = new Vector(house.door.x, Infinity, house.door.z);
                this.addBuilding(this.randoms.double(), house.x, house.z, size, entrance_pos, door_bottom, house.door.direction);
            }
        }
    }

    // Add building
    addBuilding(seed, dx, dz, size, entrance, door_bottom, door_direction) {
        let dy = 1;
        const coord = new Vector(dx + this.coord.x, dy, dz + this.coord.z);
        if(this.buildings.has(coord)) {
            return false;
        }
        let building = null;
        let entrance_block = this.basement_block;
        if(seed < .12) {
            // Water well
            coord.y = -14;
            size.y = 21;
            size.x = size.z = 3;
            building = new WaterWell(
                this,
                coord.toHash(),
                seed,
                coord.clone(),
                new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN),
                entrance.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_bottom.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_direction,
                size
            );
            //
            entrance_block = this.road_block;
            //
            for(let i = 0; i < building.size.x + 2; i++) {
                for(let j = 0; j < building.size.z + 2; j++) {
                    const x = dx + i - 1;
                    const z = dz + j - 1;
                    // Draw building basement over heightmap
                    this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(1, this.road_block, 1, null, building);
                }
            }
        } else if(seed < .285) {
            // Farmland
            size.y = 2;
            //
            building = new Farmland(
                this,
                coord.toHash(),
                seed,
                coord.clone(),
                new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN),
                entrance.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_bottom.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_direction,
                size
            );
            entrance_block = this.road_block;
        } else {
            // Building #1
            building = new Building1(
                this,
                coord.toHash(),
                seed,
                coord.clone(),
                entrance.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_bottom.add(new Vector(this.coord.x, this.coord.y, this.coord.z)),
                door_direction,
                size
            );
            // building.aabb.y_max += 10; // Math.ceil(Math.max(size.x, size.z) / 2); // - BUILDING_AABB_MARGIN;
        }
        //
        this.buildings.set(building.coord, building);
        // 1. entrance mask
        this.mask[entrance.z * CLUSTER_SIZE.x + entrance.x] = new ClusterPoint(1, entrance_block, 1, null);
        // 2. building mask
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = dx + i;
                const z = dz + j;
                // Draw building basement over heightmap
                this.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(building.coord.y, this.basement_block, 3, null, building);
            }
        }
        return true;
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        // each all buildings
        for(let [_, b] of this.buildings.entries()) {
            if(b.entrance.y == Infinity) {
                b.aabb.y_min = chunk.coord.y - BUILDING_AABB_MARGIN;
                b.aabb.y_max = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 2;
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
                        b.coord.y           = b.entrance.y + b.coord.y;
                        b.aabb.y_min        = b.entrance.y - BUILDING_AABB_MARGIN;
                        b.aabb.y_max        = b.aabb.y_min + b.size.y + BUILDING_AABB_MARGIN * 5;
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
        super.fillBlocks(maps, chunk, map);
    }

    // Draw part of building on map
    drawBulding(chunk, maps, building) {
        const START_X = chunk.coord.x - this.coord.x;
        const START_Z = chunk.coord.z - this.coord.z;
        for(let i = 0; i < building.size.x; i++) {
            for(let j = 0; j < building.size.z; j++) {
                const x = building.coord.x - chunk.coord.x + i;
                const z = building.coord.z - chunk.coord.z + j;
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
            building.draw(this, chunk);
        }
    }

}

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
    }

    //
    draw(cluster, chunk) {
        const building = this;
        //
        // const bx = building.coord.x - chunk.coord.x;
        // const by = building.coord.y - chunk.coord.y;
        // const bz = building.coord.z - chunk.coord.z;
        // 4 walls
        // cluster.draw4Walls(chunk, building.coord, building.size, building.materials.wall);
        cluster.drawQuboid(chunk, building.coord, building.size, BLOCK.TEST);
    }

    drawBasement(cluster, chunk, height) {
        const building = this;
        // quboid
        const coord = building.coord.clone().add(new Vector(0, -height, 0));
        const size = building.size.clone().add(new Vector(0, -building.size.y + 4, 0));
        cluster.drawQuboid(chunk, coord, size, BLOCK.fromId(this.cluster.basement_block));
    }

    // Limit building size
    static limitSize(max_sizes, seed, coord, size, entrance, door_direction) {
        const dir = door_direction;
        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST)  ? -1 : 1;
        const max_size = {
            x: max_sizes[max_sizes.length * seed | 0],
            z: max_sizes[max_sizes.length * (seed * 10 % 1) | 0]
        };
        //
        if(size.x > max_size.x) {
            size.x = max_size.x;
            if(door_direction == DIRECTION.NORTH) {
                coord.x = entrance.x - Math.ceil(size.x / 2);
            } else if(door_direction == DIRECTION.SOUTH) {
                coord.x = entrance.x - (Math.floor(size.x / 2) - 1) * sign;
            } else if(door_direction == DIRECTION.EAST) {
                coord.x = entrance.x - (size.x - 1);
            } else {
                coord.x = entrance.x;
            }
        }
        //
        if(size.z > max_size.z) {
            size.z = max_size.z;
            if(door_direction == DIRECTION.NORTH) {
                coord.z = entrance.z - (size.z - 1);
            } else if(door_direction == DIRECTION.SOUTH) {
                // do nothing
            } else if(door_direction == DIRECTION.EAST) {
                coord.z = entrance.z - Math.ceil(size.z / 2)
            } else {
                coord.z = entrance.z - (Math.floor(size.z / 2) - 1) * sign;
            }
        }
    }

}

// Farmland
class Farmland extends Building {

    constructor(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        Building.limitSize([3, 5, 7, 7, 9, 9, 9, 11, 11, 11, 15, 15, 17, 19], seed, coord, size, entrance, door_direction);
        //
        super(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
        this.seeds = this.randoms.double() < .5 ? BLOCK.CARROT_SEEDS : BLOCK.WHEAT_SEEDS;
    }

    draw(cluster, chunk) {
        // super.draw(cluster, chunk);
        this.drawBasement(cluster, chunk, 4);
        const building = this;
        cluster.drawQuboid(chunk, building.coord.add(new Vector(0, -1, 0)), building.size, BLOCK.OAK_TRUNK);
        let inner_size = building.size.clone().addSelf(new Vector(-2, -1, -2));
        let pos = building.coord.clone().addSelf(new Vector(1, 0, 1));
        cluster.drawQuboid(chunk, pos, inner_size, BLOCK.FARMLAND);
        //
        pos.addSelf(new Vector(0, 1, 0));
        cluster.drawQuboid(chunk, pos, inner_size, this.seeds, null, {stage: 7, complete: true});
    }

}

class WaterWell extends Building {

    constructor(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        super(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size);
    }

    //
    draw(cluster, chunk) {
        const building = this;
        const bx = building.coord.x - chunk.coord.x;
        const by = building.coord.y - chunk.coord.y;
        const bz = building.coord.z - chunk.coord.z;
        // 4 walls
        const walls_size = building.size.clone().add(new Vector(0, -4, 0));
        cluster.draw4Walls(chunk, building.coord, walls_size, BLOCK.OAK_PLANK);
        const q_pos = building.coord.add(new Vector(1, 1, 1));
        const q_size = walls_size.add(new Vector(-2, -2, -2));
        cluster.drawQuboid(chunk, q_pos, q_size, BLOCK.STILL_WATER);
        //
        let rot = null;
        const roof_support_shift = {x: 0, z: 0};
        const roof_step = {x: 0, z: 0};
        if(building.door_direction == DIRECTION.EAST || building.door_direction == DIRECTION.WEST) {
            roof_support_shift.z = 1;
            roof_step.x = walls_size.x - 1;
        } else {
            roof_support_shift.z = 1;
            roof_step.x = walls_size.x - 1;
        }
        // roof supports
        cluster.setBlock(chunk, bx + roof_support_shift.x,                    by + building.size.y - 5,     bz + roof_support_shift.z, BLOCK.COBBLESTONE_WALL.id, rot);
        cluster.setBlock(chunk, bx + roof_support_shift.x + roof_step.x, by + building.size.y - 5,          bz + roof_support_shift.z + roof_step.z, BLOCK.COBBLESTONE_WALL.id, rot);
        cluster.setBlock(chunk, bx + roof_support_shift.x,                    by + building.size.y - 5 + 1, bz + roof_support_shift.z, BLOCK.OAK_FENCE.id, rot);
        cluster.setBlock(chunk, bx + roof_support_shift.x + roof_step.x, by + building.size.y - 5 + 1,      bz + roof_support_shift.z + roof_step.z, BLOCK.OAK_FENCE.id, rot);
        // center of roof
        cluster.setBlock(chunk, bx + 1, by + building.size.y - 5 + 3, bz + 1, BLOCK.OAK_SLAB.id, rot);
        // roof
        cluster.setBlock(chunk, bx + 0, by + building.size.y - 5 + 2, bz, BLOCK.OAK_STAIRS.id, {x: 1, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 1, by + building.size.y - 5 + 2, bz, BLOCK.OAK_STAIRS.id, {x: 2, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 2, by + building.size.y - 5 + 2, bz, BLOCK.OAK_STAIRS.id, {x: 2, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 2, by + building.size.y - 5 + 2, bz + 1, BLOCK.OAK_STAIRS.id, {x: 3, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 2, by + building.size.y - 5 + 2, bz + 2, BLOCK.OAK_STAIRS.id, {x: 3, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 1, by + building.size.y - 5 + 2, bz + 2, BLOCK.OAK_STAIRS.id, {x: 0, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 0, by + building.size.y - 5 + 2, bz + 2, BLOCK.OAK_STAIRS.id, {x: 0, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 0, by + building.size.y - 5 + 2, bz + 1, BLOCK.OAK_STAIRS.id, {x: 1, y: 0, z: 0});
    }

}

// Building1
class Building1 extends Building {

    constructor(cluster, id, seed, coord, entrance, door_bottom, door_direction, size) {
        Building.limitSize([7, 7, 7, 9], seed, coord, size, entrance, door_direction);
        //
        const aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, id, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
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

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

        // if(dir != DIRECTION.NORTH && dir != DIRECTION.SOUTH) return;
        // if(dir != DIRECTION.WEST && dir != DIRECTION.EAST) return;

        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST)  ? -1 : 1;

        this.drawBasement(cluster, chunk, 4);
        
        //
        const bx = coord.x - chunk.coord.x;
        const by = coord.y - chunk.coord.y;
        const bz = coord.z - chunk.coord.z;
        
        // 4 walls
        cluster.draw4Walls(chunk, coord, building.size, mat.wall);

        // npc
        const npc_pos = new Vector(bx + Math.round(building.size.x/2) + chunk.coord.x, by + chunk.coord.y, bz + Math.round(building.size.z/2) + chunk.coord.z);
        cluster.addNPC(chunk, npc_pos);

        // window
        const window_rot = {x: dir, y: 0, z: 0};
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let w_pos = building.door_bottom.clone().add(new Vector(0, 1, 2 * sign));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x += (building.size.x - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            let w_pos = building.door_bottom.clone().add(new Vector(2 * sign, 1, 0));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z += (building.size.z - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        }
    
        // light
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let light_rot = {x: dir, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().addSelf(new Vector(1 * -sign, 1, 1 * sign)).subSelf(chunk.coord);
            if(mat.light.id == BLOCK.LANTERN.id) {
                light_rot.y += 1;
                l_pos.y += 2;
                l_pos.z -= 1 * sign;
            }
            cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            let light_rot = {x: dir, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().addSelf(new Vector(1 * sign, 1, 1 * -sign)).subSelf(chunk.coord);
            if(mat.light.id == BLOCK.LANTERN.id) {
                light_rot.y += 1;
                l_pos.y += 2;
                l_pos.x -= 1 * sign;
            }
            cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);
        }

        // door
        const door_random = new alea(building.door_bottom.toHash());
        cluster.drawDoor(chunk, building.door_bottom, mat.door, dir, door_random.double() > .5, true);

        //
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let pos = new Vector(coord.x, coord.y + building.size.y - 2, coord.z).subSelf(chunk.coord);
            let w = building.size.z - 2;
            for(let i = 1; i < Math.floor(building.size.z / 2); i++) {
                pos.y++;
                pos.z++;
                for(let j = 0; j < w; j++) {
                    cluster.setBlock(chunk, pos.x, pos.y, pos.z + j, mat.wall.id, null);
                    cluster.setBlock(chunk, pos.x + building.size.x - 1, pos.y, pos.z + j, mat.wall.id, null);
                }
                w -= 2;
            }
        } else {
            let pos = new Vector(coord.x, coord.y + building.size.y - 2, coord.z).subSelf(chunk.coord);
            let w = building.size.x - 2;
            for(let i = 1; i < Math.floor(building.size.x / 2); i++) {
                pos.y++;
                pos.x++;
                for(let j = 0; j < w; j++) {
                    cluster.setBlock(chunk, pos.x + j, pos.y, pos.z, mat.wall.id, null);
                    cluster.setBlock(chunk, pos.x + j, pos.y, pos.z + building.size.z - 1, mat.wall.id, null);
                }
                w -= 2;
            }
        }

        // roof
        if(dir == DIRECTION.WEST || dir == DIRECTION.EAST) {
            let roof_height = Math.ceil(building.size.z / 2);
            if(building.size.z % 2 == 0) {
                roof_height++;
            }
            // south side
            let roof_pos = new Vector(coord.x - 1, coord.y + building.size.y - 3, coord.z - 1);
            let roof_size = new Vector(building.size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.SOUTH, mat.roof);
            // north side
            roof_pos = new Vector(coord.x - 1, coord.y + building.size.y - 3, coord.z + building.size.z);
            roof_size = new Vector(building.size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.NORTH, mat.roof);
        } else if(dir == DIRECTION.SOUTH || dir == DIRECTION.NORTH) {
            const roof_size_add = 2;
            const minus_y = 3;
            let roof_height = Math.ceil(building.size.x / 2);
            if(building.size.x % 2 == 0) {
                roof_height++;
            }
            // south side
            let roof_pos = new Vector(coord.x - 1, coord.y + building.size.y - minus_y, coord.z - 1);
            let roof_size = new Vector(0, roof_height, building.size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.WEST, mat.roof);
            // north side
            roof_pos = new Vector(coord.x + building.size.x, coord.y + building.size.y - minus_y, coord.z - 1);
            roof_size = new Vector(0, roof_height, building.size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.EAST, mat.roof);
        }

        // roof gable
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            if(building.size.z % 2 == 1) {
                const roof_height = Math.ceil(building.size.z / 2) + 1;
                let q_pos = new Vector(coord.x - 1, coord.y + roof_height, coord.z + roof_height - 2);
                cluster.drawQuboid(chunk, q_pos, new Vector(building.size.x + 2, 1, 1), mat.roof_block);
            }
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            if(building.size.x % 2 == 1) {
                const roof_height = Math.ceil(building.size.x / 2) + 1;
                let q_pos = new Vector(coord.x + roof_height - 2, coord.y + roof_height, coord.z - 1);
                cluster.drawQuboid(chunk, q_pos, new Vector(1, 1, building.size.z + 2), mat.roof_block);
            }
        }

    }

}