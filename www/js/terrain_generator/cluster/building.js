import {impl as alea} from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";
import { AABB } from '../../core/AABB.js';
import {DIRECTION, Vector} from "../../helpers.js";
import {CLUSTER_SIZE, ClusterPoint, ClusterBase} from "./base.js";

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

const ROOF_TYPE_PITCHED = 'pitched';
const ROOF_TYPE_FLAT = 'flat';

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

    setBiome(biome, temperature, humidity) {
        this.biome = biome;
        this.temperature = temperature;
        this.humidity = humidity;
    }

    // Translate position
    translate(vec) {
        this.aabb.translate(vec.x, vec.y, vec.z);
        this.coord.addSelf(vec);
        this.entrance.addSelf(vec);
        this.door_bottom.addSelf(vec);
    }

    //
    draw(cluster, chunk) {
        // 4 walls
        cluster.drawQuboid(chunk, this.coord, this.size, BLOCK.TEST);
    }

    drawBasement(cluster, chunk, height, basement_block_id) {
        const building = this;
        // floor
        const coord_floor = building.coord.clone().addSelf(new Vector(0, -1, 0));
        const size_floor = building.size.clone().addSelf(new Vector(0, -building.size.y + 1, 0));
        cluster.drawQuboid(chunk, coord_floor, size_floor, BLOCK.fromId(basement_block_id || this.cluster.basement_block));
        // natural basement
        // const coord = building.coord.clone().addSelf(new Vector(-1, -height, -1));
        // const size = building.size.clone().addSelf(new Vector(2, -building.size.y + 4, 2));
        const coord = building.coord.clone().addSelf(new Vector(0, -height - 4, 0));
        const size = building.size.clone().addSelf(new Vector(0, -building.size.y + 7, 0));
        cluster.drawNaturalBasement(chunk, coord, size, BLOCK.STONE);
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

    addHays(dx, dz) {
        const rad = 2 + Math.round(this.randoms.double() * 1);
        for(let i = -rad; i < rad; i++) {
            for(let j = -rad; j < rad; j++) {
                const x = dx + i;
                const z = dz + j;
                let h = Math.round(this.randoms.double() * 2);
                if(h == 0) {
                    continue;
                }
                this.cluster.mask[z * CLUSTER_SIZE.x + x] = new ClusterPoint(h, BLOCK.HAY_BLOCK.id, 1, null, null, 1); 
            }
        }
    }

    // Draw blocks
    drawBlocks(cluster, chunk) {
        const vec = new Vector(0, 0, 0);
        const block_coord = this.door_bottom.clone().subSelf(chunk.coord);
        const dir = this.door_direction;
        for (let i = 0; i < this.blocks.list.length; i++) {
            const item = this.blocks.list[i];
            vec.copyFrom(block_coord).addByCardinalDirectionSelf(item.move, dir + 2, this.blocks.mirror_x, this.blocks.mirror_z);
            cluster.setBlock(chunk, vec.x, vec.y, vec.z, item.block_id, item.rotate, item.extra_data);
        }
    }
    
    //
    drawPitchedRoof(chunk, coord, size, dir, roof_block, roof_ridge_block, roof_gable_block) {
        const cluster = this.cluster;
        // gable | фронтон
        if(roof_gable_block) {
            roof_gable_block.reset();
            if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
                let pos = new Vector(coord.x, coord.y + size.y - 2, coord.z).subSelf(chunk.coord);
                let w = size.z - 2;
                for(let i = 1; i < Math.floor(size.z / 2); i++) {
                    pos.y++;
                    pos.z++;
                    for(let j = 0; j < w; j++) {
                        cluster.setBlock(chunk, pos.x, pos.y, pos.z + j, roof_gable_block.next().id, null);
                        cluster.setBlock(chunk, pos.x + size.x - 1, pos.y, pos.z + j, roof_gable_block.next().id, null);
                    }
                    w -= 2;
                }
            } else {
                let pos = new Vector(coord.x, coord.y + size.y - 2, coord.z).subSelf(chunk.coord);
                let w = size.x - 2;
                for(let i = 1; i < Math.floor(size.x / 2); i++) {
                    pos.y++;
                    pos.x++;
                    for(let j = 0; j < w; j++) {
                        cluster.setBlock(chunk, pos.x + j, pos.y, pos.z, roof_gable_block.next().id, null);
                        cluster.setBlock(chunk, pos.x + j, pos.y, pos.z + size.z - 1, roof_gable_block.next().id, null);
                    }
                    w -= 2;
                }
            }
        }
        // roof ridge | конёк
        if(roof_ridge_block) {
            if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
                if(size.z % 2 == 1) {
                    const roof_height = Math.floor(size.z / 2);
                    let q_pos = new Vector(coord.x - 1, coord.y + size.y + roof_height - 3, coord.z + roof_height);
                    cluster.drawQuboid(chunk, q_pos, new Vector(size.x + 2, 1, 1), roof_ridge_block);
                }
            } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
                if(size.x % 2 == 1) {
                    const roof_height = Math.floor(size.x / 2);
                    let q_pos = new Vector(coord.x + roof_height, coord.y + size.y + roof_height - 3, coord.z - 1);
                    cluster.drawQuboid(chunk, q_pos, new Vector(1, 1, size.z + 2), roof_ridge_block);
                }
            }
        }
        // pitched planes | скаты
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
    }

    drawFlatRoof(chunk, coord, size, dir, roof_block, roof_ridge_block, roof_gable_block) {
        const cluster = this.cluster;
        const roof_pos = coord.clone();
        roof_pos.y += this.size.y - 1;
        const roof_size = size.clone();
        roof_size.y = 1;
        cluster.drawFlatRoof(chunk, roof_pos, roof_size, roof_block);
    }

    setY(y) {
        this.door_bottom.y     = y;
        this.entrance.y        = y - 1;
        this.coord.y           = this.entrance.y + this.coord.y;
        this.aabb.y_min        = this.entrance.y - BUILDING_AABB_MARGIN;
        this.aabb.y_max        = this.aabb.y_min + this.size.y * 3;
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
        cluster.drawQuboid(chunk, building.coord.add(new Vector(0, -1, 0)), building.size, BLOCK.OAK_LOG);
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
                        // fix. because water not replace FARMLAND_WET
                        cluster.drawQuboid(chunk, water_pos, water_size, BLOCK.AIR);
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

// Street light
export class StreetLight extends Building {

    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.draw_entrance = false;
        // Blocks
        const mirror_x           = door_direction % 2 == 1;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        }
        if(seed > .75) {
            this.blocks.list.push(...[
                {move: new Vector(0, -1, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 0, 0), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 3, 0), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 4, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 4, -1), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.NORTH, 0, 0)},
                {move: new Vector(0, 4, 1), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector(-1, 4, 0), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.EAST, 0, 0)},
                {move: new Vector(1, 4, 0), block_id: BLOCK.OAK_SLAB.id, rotate: new Vector(DIRECTION.WEST, 0, 0)},
                {move: new Vector(0, 3, -1), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.NORTH, -1, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.SOUTH, -1, 0)},
                {move: new Vector(-1, 3, 0), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.EAST, -1, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.LANTERN.id, rotate: new Vector(DIRECTION.WEST, -1, 0)},
            ]);
        } else {
            this.blocks.list.push(...[
                {move: new Vector(0, -1, 0), block_id: BLOCK.COBBLESTONE.id},
                {move: new Vector(0, 0, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 3, 0), block_id: BLOCK.GRAY_WOOL.id},
                {move: new Vector(0, 3, -1), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.NORTH, 0, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.SOUTH, 0, 0)},
                {move: new Vector(-1, 3, 0), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.EAST, 0, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.TORCH.id, rotate: new Vector(DIRECTION.WEST, 0, 0)},
            ]);
        }
    }

    //
    draw(cluster, chunk) {
        // draw blocks
        this.drawBlocks(cluster, chunk);
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
        cluster.road_block.reset();
        cluster.addRoadPlatform(coord, size, cluster.road_block);
        //
        this.draw_entrance = false;
        // Blocks
        const dir = door_direction;
        const mirror_x = door_direction % 2 == 1;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        }
        if(seed < .75) {
            this.wallBlocks = this.cluster.createPalette([
                {value: BLOCK.OAK_PLANKS, chance: 1}
            ]);
            this.blocks.list.push(...[
                {move: new Vector(0, 1, 1), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(2, 1, 1), block_id: BLOCK.COBBLESTONE_WALL.id},
                {move: new Vector(0, 2, 1), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 1), block_id: BLOCK.OAK_FENCE.id},
                //
                {move: new Vector(0, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(1, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(2, 3, 0), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector(2, 3, 1), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector(2, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(1, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(0, 3, 2), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector(0, 3, 1), block_id: BLOCK.OAK_STAIRS.id, rotate: new Vector((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
                //
                {move: new Vector(1, 4, 1), block_id: BLOCK.OAK_SLAB.id},
            ]);
        } else {
            this.wallBlocks = this.cluster.createPalette([
                {value: BLOCK.COBBLESTONE, chance: 1}
            ]);
            this.blocks.list.push(...[
                {move: new Vector(0, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 1, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 0), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 1, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(0, 2, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 1, 2), block_id: BLOCK.OAK_FENCE.id},
                {move: new Vector(2, 2, 2), block_id: BLOCK.OAK_FENCE.id},
                //
                {move: new Vector(0, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(1, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 0), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 1), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(2, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(1, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(0, 3, 2), block_id: BLOCK.COBBLESTONE_SLAB.id},
                {move: new Vector(0, 3, 1), block_id: BLOCK.COBBLESTONE_SLAB.id},
                //
                {move: new Vector(1, 3, 1), block_id: BLOCK.COBBLESTONE.id},
                //
                {move: new Vector(1, 0, 0), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 0) % 4, 0, 0)},
                {move: new Vector(2, 0, 1), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 1 + (mirror_x?2:0)) % 4, 0, 0)},
                {move: new Vector(1, 0, 2), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 2) % 4, 0, 0)},
                {move: new Vector(0, 0, 1), block_id: BLOCK.COBBLESTONE_STAIRS.id, rotate: new Vector((dir + 3 + (mirror_x?2:0)) % 4, 0, 0)},
            ]);
        }
    }

    /**
     * 
     * @param {ClusterBase} cluster 
     * @param {*} chunk 
     */
    draw(cluster, chunk) {
        const building = this;
        // 4 walls
        cluster.drawQuboid(chunk, building.coord, building.size.add(new Vector(0, -1, 0)), BLOCK.AIR);
        const walls_size = building.size.clone().addSelf(new Vector(0, -4, 0));
        cluster.draw4Walls(chunk, building.coord, walls_size, this.wallBlocks);
        const q_pos = building.coord.add(new Vector(1, 1, 1));
        const q_size = walls_size.add(new Vector(-2, -2, -2));
        cluster.drawQuboid(chunk, q_pos, q_size, BLOCK.STILL_WATER);
        this.drawBlocks(cluster, chunk);
    }

}

// Building1
export class Building1 extends Building {

    static MAX_SIZES = [7];

    /**
     * 
     * @param {ClusterBase} cluster 
     * @param {float} seed 
     * @param {Vector} coord 
     * @param {AABB} aabb 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {Vector} door_direction 
     * @param {Vector} size 
     */
    constructor(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size) {
        const orig_coord = coord.clone();
        const orig_size = size.clone();
        Building.limitSize(Building1.MAX_SIZES, seed, coord, size, entrance, door_bottom, door_direction);
        //
        aabb = new AABB().set(0, 0, 0, size.x, size.y, size.z).translate(coord.x, coord.y, coord.z).pad(BUILDING_AABB_MARGIN);
        super(cluster, seed, coord, aabb, entrance, door_bottom, door_direction, size);
        this.is_big_building = orig_size.x > 11 && orig_size.z > 11;
        this.roof_type = ROOF_TYPE_PITCHED;
        //
        this.selectMaterials();
        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: 1}
        ]);
        // Blocks
        const dir                = this.door_direction;
        const mirror_x           = dir % 2 == 1;
        const add_hays           = this.randoms.double() <= .75;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_chest          = this.randoms.double() <= .5;
        const has_bed            = this.randoms.double() <= .6;
        const has_bookshelfs      = this.randoms.double();

        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        }
        //
        if(this.is_big_building) {
            // draw fence
            cluster.addFence(orig_coord, orig_size, door_bottom, this.blocks.list);
            //
            if(add_hays) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector(-11, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }
        if(has_chest) {
            this.blocks.list.push({
                move: new Vector(-1, 3, 5),
                block_id: BLOCK.CHEST.id,
                rotate: {x: (dir + 1 + (mirror_x ? 2 : 0)) % 4, y: 1, z: 0},
                extra_data: {generate: true, params: {source: 'village_house'}}
            });
        }
        // Bed
        if(has_bed) {
            const color_index = ((this.randoms.double() * 4) | 0);
            const bed_block_id = 1210 + color_index;
            const carpet_block_id = 810 + color_index;
            this.blocks.list.push({move: new Vector(1, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 1 + (mirror_x ? 0 : 2)) % 4, y: -1, z: 0}});
            this.blocks.list.push({move: new Vector(2, 0, 5), block_id: bed_block_id, rotate: {x: (dir + 1 + (mirror_x ? 0 : 2)) % 4, y: -1, z: 0}, extra_data: {is_head: true}});
            this.blocks.list.push({move: new Vector(1, 0, 4), block_id: carpet_block_id, rotate: {x: 0, y: 1, z: 0}});
        }
        // Book cases
        if(has_bookshelfs < .6) {
            let bc_start_pos = null;
            if(has_bookshelfs < .2) {
                bc_start_pos = new Vector(3, 0, 4);
            } else if(has_bookshelfs < .4) {
                bc_start_pos = new Vector(-1, 0, 1);
            }
            if(bc_start_pos) {
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 0, 0)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 0, 1)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 1, 0)), block_id: BLOCK.BOOKSHELF.id});
                this.blocks.list.push({move: bc_start_pos.add(new Vector(0, 1, 1)), block_id: BLOCK.BOOKSHELF.id});
            }
        }
    }

    selectMaterials() {
        const {cluster, seed} = this;
        //
        if(cluster.flat) {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.STONE_BRICKS,
                    door: BLOCK.SPRUCE_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.LANTERN
                };
            } else {
                this.materials  = {
                    wall: BLOCK.BRICKS,
                    door: BLOCK.DARK_OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.LANTERN
                };
            }
        } else {
            if(seed < .5) {
                this.materials  = {
                    wall: BLOCK.OAK_PLANKS,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.TORCH
                };
            } else {
                this.materials  = {
                    wall: BLOCK.OAK_PLANKS,
                    door: BLOCK.OAK_DOOR,
                    roof: BLOCK.DARK_OAK_STAIRS,
                    roof_block: BLOCK.DARK_OAK_PLANKS,
                    light: BLOCK.TORCH
                };
            }
        }
    }

    addSecondFloor() {
        const dir = this.door_direction;
        this.blocks.list.push(...[
            {move: new Vector(-1, 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(-1, 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(0, 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(0, 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(1, 2, 5), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(1, 2, 4), block_id: BLOCK.SPRUCE_PLANKS.id},
            {move: new Vector(2, 2, 5), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(2, 2, 4), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(3, 2, 5), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(3, 2, 4), block_id: BLOCK.SPRUCE_SLAB.id, extra_data: {point: {x: 0, y: 0, z: 0}}},
            {move: new Vector(2, 1, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: new Vector(dir, 0, 0)},
            {move: new Vector(2, 0, 2), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: new Vector(dir, 0, 0)},
            {move: new Vector(-1, 3, 4), block_id: BLOCK.OAK_FENCE.id},
            {move: new Vector(0, 3, 4), block_id: BLOCK.OAK_FENCE.id},
            {move: new Vector(1, 3, 4), block_id: BLOCK.OAK_FENCE.id},
        ]);
    }

    setBiome(biome, temperature, humidity) {
        super.setBiome(biome, temperature, humidity);
        // this.selectMaterials();
        if(['Заснеженный пляж', 'Пустыня'].includes(biome.title)) {
            this.materials = {...this.materials,
                wall: BLOCK.SANDSTONE,
                // door: BLOCK.SPRUCE_DOOR,
                roof: BLOCK.CUT_SANDSTONE,
                roof_block: BLOCK.CUT_SANDSTONE,
                light: null
            };
            this.wallBlocks = this.cluster.createPalette([
                {value: this.materials.wall, chance: 1}
            ]);
            this.roof_type = ROOF_TYPE_FLAT;
            this.size.y--;
        } else {
            this.addSecondFloor();
        }
    }

    //
    draw(cluster, chunk) {

        const dir       = this.door_direction;
        const coord     = this.coord;
        const mat       = this.materials;

        let sign = (dir == DIRECTION.NORTH || dir == DIRECTION.EAST) ? -1 : 1;

        this.drawBasement(cluster, chunk, 4);

        //
        const bx = coord.x - chunk.coord.x;
        const by = coord.y - chunk.coord.y;
        const bz = coord.z - chunk.coord.z;

        // 4 walls
        cluster.draw4Walls(chunk, coord, this.size, this.wallBlocks);

        // npc
        const npc_pos = new Vector(bx + Math.round(this.size.x/2) + chunk.coord.x, by + chunk.coord.y, bz + Math.round(this.size.z/2) + chunk.coord.z);
        cluster.addNPC(chunk, npc_pos);

        // window
        const window_rot = {x: dir, y: 0, z: 0};
        if(dir == DIRECTION.EAST || dir == DIRECTION.WEST) {
            let w_pos = this.door_bottom.clone().add(new Vector(0, 1, 2 * sign));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x += (this.size.x - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        } else if(dir == DIRECTION.NORTH || dir == DIRECTION.SOUTH) {
            let w_pos = this.door_bottom.clone().add(new Vector(2 * sign, 1, 0));
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.z += (this.size.z - 1) * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
            w_pos.x -= 2 * sign;
            cluster.setBlock(chunk, w_pos.x - chunk.coord.x, w_pos.y - chunk.coord.y, w_pos.z - chunk.coord.z, BLOCK.GLASS_PANE.id, window_rot);
        }

        // light
        if(mat.light) {
            const light_rot = {x: dir, y: 0, z: 0};
            const l_pos = this.door_bottom.clone().subSelf(chunk.coord);
            l_pos.addByCardinalDirectionSelf(new Vector(dir % 2 == 0 ? 1 : -1, 1, -1), dir + 2);
            if(mat.light.id == BLOCK.LANTERN.id) {
                light_rot.y = -1;
                l_pos.y += 3;
            }
            cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);
        }

        // door
        const door_random = new alea(this.door_bottom.toHash());
        cluster.drawDoor(chunk, this.door_bottom, mat.door, dir, door_random.double() > .5, true);

        // draw blocks
        this.drawBlocks(cluster, chunk);

        // roof
        switch(this.roof_type) {
            case ROOF_TYPE_PITCHED: {
                this.drawPitchedRoof(chunk, coord, this.size, dir, mat.roof, mat.roof_block, this.wallBlocks);
                break;
            }
            case ROOF_TYPE_FLAT: {
                this.drawFlatRoof(chunk, coord, this.size, dir, mat.roof, mat.road_block, this.wallBlocks);
            }
        }

    }

}

// BuildingS (small)
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
            door:           BLOCK.SPRUCE_DOOR,
            wall_corner:    BLOCK.OAK_LOG,
            roof:           BLOCK.OAK_STAIRS,
            roof_block:     BLOCK.OAK_PLANKS,
            light:          BLOCK.TORCH
        };
        //
        this.wallBlocks = this.cluster.createPalette([
            {value: this.materials.wall, chance: .33},
            {value: BLOCK.ANDESITE, chance: .66},
            {value: BLOCK.STONE, chance: 1},
        ]);
        //
        if(orig_size.x > 11 && orig_size.z > 11) {
            // draw fence
            cluster.addFence(orig_coord, orig_size);
            //
            if(this.randoms.double() < .75) {
                const centerOfHay = door_bottom.clone().addByCardinalDirectionSelf(new Vector(-10, 0, 6), door_direction + 2);
                const dx = centerOfHay.x - cluster.coord.x;
                const dz = centerOfHay.z - cluster.coord.z;
                this.addHays(dx, dz);
            }
        }
        // Blocks
        const dir                = this.door_direction;
        const mirror_x           = dir % 2 == 1;
        const has_crafting_table = this.randoms.double() <= .4;
        const has_chandelier     = this.randoms.double() <= .8;
        const has_bed            = this.randoms.double() <= .6;
        this.blocks = {
            mirror_x:       mirror_x,
            mirror_z:       false,
            list:           []
        }
        if(this.seed < .7) {
            this.blocks.list.push(...[
                {move: new Vector(0, 0, 3), block_id: BLOCK.SPRUCE_FENCE.id},
                {move: new Vector(0, 1, 3), block_id: BLOCK.SPRUCE_TRAPDOOR.id, extra_data: {opened: false, point: {x: 0, y: 0, z: 0}}},
                {move: new Vector(1, 0, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: {x: (dir + 3 + (mirror_x ? 2 : 0)) % 4, y: 0, z: 0}}
            ]);
        } else {
            this.blocks.list.push({move: new Vector(1, 0, 3), block_id: BLOCK.SPRUCE_STAIRS.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_crafting_table) {
            this.blocks.list.push({move: new Vector(-1, 0, 1), block_id: BLOCK.CRAFTING_TABLE.id, rotate: {x: dir, y: 0, z: 0}});
        }
        if(has_chandelier) {
            this.blocks.list.push({move: new Vector(0, 3, 2), block_id: BLOCK.LANTERN.id, rotate: {x: 0, y: -1, z: 0}});
        }
        // Bed
        if(has_bed) {
            const bed_block_id = 1210 + ((this.randoms.double() * 4) | 0);
            this.blocks.list.push({move: new Vector(-1, 0, 1), block_id: bed_block_id, rotate: {x: dir + 2, y: -1, z: 0}, extra_data: {is_head: true}});
            this.blocks.list.push({move: new Vector(-1, 0, 2), block_id: bed_block_id, rotate: {x: dir + 2, y: -1, z: 0}});
        }
    }

    //
    draw(cluster, chunk) {

        const building  = this;
        const dir       = building.door_direction;
        const coord     = building.coord;
        const mat       = building.materials;

        this.drawBasement(cluster, chunk, 4, this.materials.wall_corner.id);

        // 4 walls
        cluster.draw4Walls(chunk, coord, building.size, this.wallBlocks);

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
        const light_rot = {x: dir, y: 0, z: 0};
        const l_pos = building.door_bottom.clone().subSelf(chunk.coord);
        l_pos.addByCardinalDirectionSelf(new Vector(0, 2, -1), dir + 2);
        cluster.setBlock(chunk, l_pos.x, l_pos.y, l_pos.z, mat.light.id, light_rot);

        // door
        const door_random = new alea(building.door_bottom.toHash());
        cluster.drawDoor(chunk, building.door_bottom, mat.door, dir, door_random.double() > .5, true);

        // draw blocks
        this.drawBlocks(cluster, chunk);

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
        this.drawPitchedRoof(chunk, coord, building.size, dir, mat.roof, mat.roof_block, this.wallBlocks);

    }

}