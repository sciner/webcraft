import {impl as alea} from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";
import { AABB } from '../../core/AABB.js';
import {DIRECTION, Vector} from "../../helpers.js";
import {ClusterPoint, CLUSTER_SIZE} from "./base.js";

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

// Base building
export class Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        this.randoms        = new alea(coord.toHash());
        this.cluster        = cluster;
        this.id             = coord.toHash();
        this.seed           = seed;
        this.coord          = coord;
        this.aabb           = aabb;
        this.entrance       = entrance;
        this.door_bottom    = door_bottom;
        this.door_direction = door_direction;
        this.size           = size;
        this.materials      = null;
        this.draw_entrance  = true;
    }

    //
    draw(cluster, chunk) {
        // 4 walls
        cluster.drawQuboid(chunk, this.coord, this.size, BLOCK.TEST);
    }

    drawBasement(cluster, chunk, height, basement_block_id) {
        const building = this;
        // quboid
        const coord = building.coord.clone().add(new Vector(0, -height, 0));
        const size = building.size.clone().add(new Vector(0, -building.size.y + 4, 0));
        cluster.drawQuboid(chunk, coord, size, BLOCK.fromId(basement_block_id || this.cluster.basement_block));
    }

    // Limit building size
    static limitSize(max_sizes, seed, coord, size, entrance, door_bottom, door_direction, shift_entrance_value = 0) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        const dir = door_direction;
        shift_entrance_value = shift_entrance_value | 0;
        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST)  ? -1 : 1;
        const max_size = {
            x: max_sizes[max_sizes.length * seed | 0],
            z: max_sizes[max_sizes.length * (seed * 10 % 1) | 0]
        };
        //
        if(size.x > max_size.x) {
            size.x = max_size.x;
        }
        if(door_direction == DIRECTION.NORTH) {
            coord.x = entrance.x - Math.ceil(size.x / 2);
        } else if(door_direction == DIRECTION.SOUTH) {
            coord.x = entrance.x - (Math.floor(size.x / 2) - 1) * sign;
        } else if(door_direction == DIRECTION.EAST) {
            coord.x = entrance.x - (size.x - 1);
        } else {
            coord.x = entrance.x;
        }
        //
        if(size.z > max_size.z) {
            size.z = max_size.z;
        }
        if(door_direction == DIRECTION.NORTH) {
            coord.z = entrance.z - (size.z - 1);
        } else if(door_direction == DIRECTION.SOUTH) {
            // do nothing
        } else if(door_direction == DIRECTION.EAST) {
            coord.z = entrance.z - Math.ceil(size.z / 2)
        } else {
            coord.z = entrance.z - (Math.floor(size.z / 2) - 1) * sign;
        }
        // Fix exit ouside first area 
        if(door_direction == DIRECTION.NORTH || door_direction == DIRECTION.SOUTH) {
            const shift_start = orig_coord.x - coord.x;
            const shift_end = (coord.x + size.x) - (orig_coord.x + orig_size.x);
            if(shift_start < 0) {
                coord.x += shift_start;
                entrance.x += shift_start + shift_entrance_value;
                door_bottom.x += shift_start + shift_entrance_value;
            } else if(shift_end < 0) {
                coord.x -= shift_end;
                entrance.x -= shift_end + shift_entrance_value;
                door_bottom.x -= shift_end + shift_entrance_value;
            }
        } else {
            const shift_start = orig_coord.z - coord.z;
            const shift_end = (coord.z + size.z) - (orig_coord.z + orig_size.z);
            if(shift_start < 0) {
                coord.z += shift_start;
                entrance.z += shift_start + shift_entrance_value;
                door_bottom.z += shift_start + shift_entrance_value;
            } else if(shift_end < 0) {
                coord.z -= shift_end;
                entrance.z -= shift_end + shift_entrance_value;
                door_bottom.z -= shift_end + shift_entrance_value;
            }
        }
    }
    
    //
    drawPitchedRoof(chunk, coord, size, dir, roof_block, roof_gable_block) {
        const cluster = this.cluster;
        //
        if(dir == DIRECTION.WEST || dir == DIRECTION.EAST) {
            let roof_height = Math.ceil(size.z / 2);
            if(size.z % 2 == 0) {
                roof_height++;
            }
            // south side
            let roof_pos = new Vector(coord.x - 1, coord.y + size.y - 3, coord.z - 1);
            let roof_size = new Vector(size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.SOUTH, roof_block);
            // north side
            roof_pos = new Vector(coord.x - 1, coord.y + size.y - 3, coord.z + size.z);
            roof_size = new Vector(size.x + 2, roof_height, 0);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.NORTH, roof_block);
        } else if(dir == DIRECTION.SOUTH || dir == DIRECTION.NORTH) {
            const roof_size_add = 2;
            const minus_y = 3;
            let roof_height = Math.ceil(size.x / 2);
            if(size.x % 2 == 0) {
                roof_height++;
            }
            // west side
            let roof_pos = new Vector(coord.x - 1, coord.y + size.y - minus_y, coord.z - 1);
            let roof_size = new Vector(0, roof_height, size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.WEST, roof_block);
            // east side
            roof_pos = new Vector(coord.x + size.x, coord.y + size.y - minus_y, coord.z - 1);
            roof_size = new Vector(0, roof_height, size.z + roof_size_add);
            cluster.drawPitchedRoof(chunk, roof_pos, roof_size, DIRECTION.EAST, roof_block);
        }
        // roof gable
        if(roof_gable_block) {
            if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
                if(size.z % 2 == 1) {
                    const roof_height = Math.ceil(size.z / 2) + 1;
                    let q_pos = new Vector(coord.x - 1, coord.y + roof_height, coord.z + roof_height - 2);
                    cluster.drawQuboid(chunk, q_pos, new Vector(size.x + 2, 1, 1), roof_gable_block);
                }
            } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
                if(size.x % 2 == 1) {
                    const roof_height = Math.ceil(size.x / 2) + 1;
                    let q_pos = new Vector(coord.x + roof_height - 2, coord.y + roof_height, coord.z - 1);
                    cluster.drawQuboid(chunk, q_pos, new Vector(1, 1, size.z + 2), roof_gable_block);
                }
            }
        }
    }

}

// Farmland
export class Farmland extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        size.y = 2;
        Building.limitSize([3, 5, 7, 7, 10, 10, 10, 13, 13, 13, 16, 16, 16], seed, coord, size, entrance, door_bottom, door_direction);
        //
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
        this.seeds = this.randoms.double() < .5 ? BLOCK.CARROT_SEEDS : BLOCK.WHEAT_SEEDS;
        this.draw_entrance = false;
    }

    draw(cluster, chunk) {
        // super.draw(cluster, chunk);
        this.drawBasement(cluster, chunk, 4, BLOCK.DIRT.id);
        const building = this;
        cluster.drawQuboid(chunk, building.coord.add(new Vector(0, -1, 0)), building.size.add(new Vector(0, 5, 0)), BLOCK.AIR);
        cluster.drawQuboid(chunk, building.coord.add(new Vector(0, -1, 0)), building.size, BLOCK.OAK_TRUNK);
        let inner_size = building.size.clone().addSelf(new Vector(-2, -1, -2));
        let pos = building.coord.clone().addSelf(new Vector(1, 0, 1));
        cluster.drawQuboid(chunk, pos, inner_size, BLOCK.FARMLAND_WET);
        //
        pos.addSelf(new Vector(0, 1, 0));
        cluster.drawQuboid(chunk, pos, inner_size, this.seeds, null, {stage: 7, complete: true});
        // water
        for(let axe of ['x', 'z']) {
            if(building.size[axe] >= 7) {
                const sz = building.size[axe];
                if((sz - 7) % 3 == 0) {
                    const water_pos = building.coord.clone();
                    const water_size = inner_size.clone();
                    if(axe == 'x') {
                        water_pos.z++;
                        water_size.x = 1;
                    } else {
                        water_pos.x++;
                        water_size.z = 1;
                    }
                    water_size.y = 1;
                    for(let i = 3; i < building.size[axe] - 1; i += 3) {
                        water_pos[axe] += 3;
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.STILL_WATER);
                        water_pos.y++;
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.AIR);
                        water_pos.y--;
                    }
                    break;
                }
            }
        }
    }

}

export class StreetLight extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.draw_entrance = false;
    }

    //
    draw(cluster, chunk) {
        const building = this;
        const bx = building.coord.x - chunk.coord.x;
        const by = building.coord.y - chunk.coord.y;
        const bz = building.coord.z - chunk.coord.z;
        //
        cluster.setBlock(chunk, bx, by - 1, bz, BLOCK.COBBLESTONE.id);
        for(let y = 0; y < this.size.y - 2; y++) {
            cluster.setBlock(chunk, bx, by + y, bz, BLOCK.OAK_FENCE.id);
        }
        let ly = this.size.y - 2;
        cluster.setBlock(chunk, bx, by + ly, bz, BLOCK.GRAY_WOOL.id);
        cluster.setBlock(chunk, bx, by + ly, bz + 1, BLOCK.TORCH.id, {x: DIRECTION.NORTH, y: 0, z: 0});
        cluster.setBlock(chunk, bx, by + ly, bz - 1, BLOCK.TORCH.id, {x: DIRECTION.SOUTH, y: 0, z: 0});
        cluster.setBlock(chunk, bx + 1, by + ly, bz, BLOCK.TORCH.id, {x: DIRECTION.EAST, y: 0, z: 0});
        cluster.setBlock(chunk, bx - 1, by + ly, bz, BLOCK.TORCH.id, {x: DIRECTION.WEST, y: 0, z: 0});
    }

}

// Water well
export class WaterWell extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        coord.y = -14;
        size.y = 21;
        Building.limitSize([3], seed, coord, size, entrance, door_bottom, door_direction);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        //
        cluster.addRoadPlatform(coord, size, cluster.road_block);
        //
        this.draw_entrance = false;
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
export class Building1 extends Building {

    static MAX_SIZES = [7, 7, 7, 9];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        Building.limitSize(Building1.MAX_SIZES, seed, coord, size, entrance, door_bottom, door_direction);
        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
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
        //
        if(orig_size.x > 11 && orig_size.z > 11) {
            // draw fence
            cluster.addFence(orig_coord, orig_size);
        }
    }

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

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
                light_rot.y = -1;
                l_pos.y += 3;
                l_pos.x -= 1 * sign;
                cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, BLOCK.SMOOTH_STONE_SLAB.id, null, {point: {x: 0, y: 0, z: .55}});
                l_pos.y--;
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
        this.drawPitchedRoof(chunk, coord, building.size, dir, mat.roof, mat.roof_block);

    }

}

// BuildingS
export class BuildingS extends Building {

    static MAX_SIZES = [5];

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        Building.limitSize(BuildingS.MAX_SIZES, seed, coord, size, entrance, door_bottom, door_direction, 1);
        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.materials  = {
            wall:           BLOCK.COBBLESTONE,
            door:           BLOCK.OAK_DOOR,
            wall_corner:    BLOCK.OAK_TRUNK,
            roof:           BLOCK.OAK_STAIRS,
            roof_block:     BLOCK.OAK_PLANK,
            light:          BLOCK.TORCH
        };
        //
        if(orig_size.x > 11 && orig_size.z > 11) {
            // draw fence
            cluster.addFence(orig_coord, orig_size);
        }
    }

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST)  ? -1 : 1;

        this.drawBasement(cluster, chunk, 4, this.materials.wall_corner.id);

        // 4 walls
        cluster.draw4Walls(chunk, coord, building.size, mat.wall);

        // window
        const wrd = Math.floor((building.size.x - 1) / 2);
        const window_rotates = [
            {vec: new Vector(wrd, 1, 0), dir: DIRECTION.SOUTH},
            {vec: new Vector(0, 1, wrd), dir: DIRECTION.WEST},
            {vec: new Vector(wrd, 1, building.size.z - 1), dir: DIRECTION.NORTH},
            {vec: new Vector(building.size.x - 1, 1, wrd), dir: DIRECTION.EAST}
        ];
        for(let wr of window_rotates) {
            if(dir == wr.dir) continue;
            let wrot = new Vector(wr.dir, 0, 0);
            let wcoord = building.coord.clone().addSelf(wr.vec);
            cluster.setBlock(chunk, wcoord.x - chunk.coord.x, wcoord.y - chunk.coord.y, wcoord.z - chunk.coord.z, BLOCK.GLASS_PANE.id, wrot);
        }

        // light
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let light_rot = {x: dir, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().addSelf(new Vector(1 * -sign, 2, 0 * sign)).subSelf(chunk.coord);
            cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            let light_rot = {x: dir, y: 0, z: 0};
            let l_pos = building.door_bottom.clone().addSelf(new Vector(0 * sign, 2, 1 * -sign)).subSelf(chunk.coord);
            cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);
        }

        // door
        const door_random = new alea(building.door_bottom.toHash());
        cluster.drawDoor(chunk, building.door_bottom, mat.door, dir, door_random.double() > .5, true);

        // wall corners
        const corner_size = new Vector(1, building.size.y - 1, 1);
        const corner_coord = building.coord.clone();
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.x += building.size.x - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.z += building.size.z - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);
        corner_coord.x -= building.size.x - 1;
        cluster.drawQuboid(chunk, corner_coord, corner_size, mat.wall_corner);

        // roof
        this.drawPitchedRoof(chunk, coord, building.size, dir, mat.roof, mat.roof_block);

    }

}