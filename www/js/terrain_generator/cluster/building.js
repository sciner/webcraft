import { impl as alea } from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";
import { DIRECTION, Vector } from "../../helpers.js";
import { CLUSTER_SIZE, ClusterPoint } from "./base.js";
import { BlockDrawer } from './block_drawer.js';

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

// roof types
export const ROOF_TYPE_PITCHED = 'pitched';
export const ROOF_TYPE_FLAT = 'flat';

const DEFAULT_DOOR_POS = new Vector(0, 0, 0);

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
        // blocks
        this.blocks = new BlockDrawer(this);
    }

    get pos() {
        return this.entrance.add(Vector.YP);
    }

    get direction() {
        return this.door_direction;
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

        const height = this.size.y;

        // natural basement
        const coord = this.coord.clone().subSelf(new Vector(0, height + 6, 0));
        const size = this.size.clone().addSelf(new Vector(0, -this.size.y + 7, 0));

        cluster.drawNaturalBasement(chunk, coord, size, BLOCK.STONE);

    }

    // Стоги сена
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

    //
    drawFlatRoof(chunk, coord, size, dir, roof_block) {
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

    /**
     * @param {int[]} sizes 
     */
    static makeRandomSizeList(sizes) {
        const resp = [];
        for(let i = 0; i < sizes.length; i++) {
            const x = sizes[i]
            for(let j = 0; j < sizes.length; j++) {
                const z = sizes[j]
                resp.push({x, z})
            }
        }
        return resp;
    }

    /**
     * Limit building size
     * 
     * @param {*} random_size 
     * @param {float} seed 
     * @param {Vector} coord 
     * @param {Vector} size 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {int} door_direction 
     */
    static selectSize(random_size, seed, coord, size, entrance, door_bottom, door_direction) {

        const door_pos = new Vector(random_size?.door_pos ?? DEFAULT_DOOR_POS);

        random_size = new Vector(random_size);

        // swap X and Z
        if(door_direction % 2 == 1) {
            random_size.swapXZSelf();
            door_pos.swapXZSelf();
        }

        //
        switch(door_direction) {
            case DIRECTION.NORTH: {
                coord.z += (size.z - random_size.z)
                size.x = random_size.x
                size.z = random_size.z
                entrance.x = coord.x + random_size.x - 1
                entrance.x -= door_pos.x
                break;
            }
            case DIRECTION.SOUTH: {
                size.x = random_size.x
                size.z = random_size.z
                entrance.x = coord.x
                entrance.x += door_pos.x
                break;
            }
            case DIRECTION.WEST: {
                size.x = random_size.x
                size.z = random_size.z
                entrance.z = coord.z + random_size.z - 1
                entrance.z -= door_pos.z
                break;
            }
            case DIRECTION.EAST: {
                coord.x += size.x - random_size.x
                size.x = random_size.x
                size.z = random_size.z
                entrance.z = coord.z
                entrance.z += door_pos.z
                break;
            }
        }

        door_bottom.x = entrance.x
        door_bottom.z = entrance.z

        //
        switch(door_direction) {
            case DIRECTION.NORTH: {
                door_bottom.x -= door_pos.x
                break;
            }
            case DIRECTION.SOUTH: {
                door_bottom.x += door_pos.x
                break;
            }
            case DIRECTION.WEST: {
                door_bottom.z += door_pos.z
                break;
            }
            case DIRECTION.EAST: {
                door_bottom.z -= door_pos.z
                break;
            }
        }

    }

}