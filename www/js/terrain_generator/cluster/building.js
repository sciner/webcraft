import { impl as alea } from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";
import { CHUNK_SIZE_X } from '../../chunk_const.js';
import { AABB } from '../../core/AABB.js';
import { DIRECTION, getChunkAddr, Vector } from "../../helpers.js";
import { ClusterPoint } from "./base.js";
import { BlockDrawer } from './block_drawer.js';
import { getAheadMove } from './building_cluster_base.js';

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

// roof types
export const ROOF_TYPE_PITCHED = 'pitched';
export const ROOF_TYPE_FLAT = 'flat';

const DEFAULT_DOOR_POS = new Vector(0, 0, 0);

// Base building
export class Building {

    /**
     * @param {*} cluster 
     * @param {*} seed 
     * @param {Vector} coord 
     * @param {AABB} _aabb 
     * @param {Vector} _entrance 
     * @param {Vector} _door_bottom 
     * @param {int} door_direction 
     * @param {Vector} _size 
     * @param {*} building_template 
     */
    constructor(cluster, seed, coord, _aabb, _entrance, _door_bottom, door_direction, _size, building_template) {

        // coord = new Vector(coord).add(building_template.door_pos)

        _door_bottom = new Vector(coord)
        _entrance = new Vector(_door_bottom).add(getAheadMove(door_direction))
        _door_bottom.y = Infinity
        _entrance.y = Infinity
        _size = building_template ? new Vector(building_template.size) : _size
        _aabb = new AABB(
            coord.x,
            coord.y,
            coord.z,
            coord.x + _size.x,
            coord.y + _size.y,
            coord.z + _size.z
        )

        // Building.selectSize(building_template, coord, _size, _entrance, _door_bottom, door_direction, _aabb);

        // other props
        this.randoms            = new alea(coord.toHash())
        this.cluster            = cluster
        this.id                 = coord.toHash()
        this.seed               = seed

        //
        this.building_template   = building_template
        this.door_direction     = door_direction
        this.coord              = coord
        this.door_bottom        = _door_bottom
        this.entrance           = _entrance
        this.aabb               = _aabb
        this.size               = _size
        this.materials          = null
        this.draw_entrance      = true

        // blocks
        this.blocks = new BlockDrawer(this)

    }

    get pos() {
        return this.entrance.add(Vector.YP)
    }

    get direction() {
        return this.door_direction;
    }

    addBlocks() {}

    setBiome(biome, temperature, humidity) {
        this.biome = biome;
        this.temperature = temperature;
        this.humidity = humidity;
        this.addBlocks()
    }

    // Translate position
    translate(vec) {
        this.aabb.translate(vec.x, vec.y, vec.z);
        this.coord.addSelf(vec);
        this.entrance.addSelf(vec);
        this.door_bottom.addSelf(vec);
    }

    /**
     * @param { import("./base.js").ClusterBase } cluster
     * @param {*} chunk 
     * @param {boolean} draw_natural_basement
     */
    draw(cluster, chunk, draw_natural_basement = true) {
        // natural basement
        if(draw_natural_basement) {
            const height = 4
            const dby = this.building_template ? this.building_template.world.door_bottom.y - 2 : 0 // 2 == 1 уровень ниже пола + изначально вход в конструкторе стоит на высоте 1 метра над землей
            const coord = new Vector(this.aabb.x_min, this.coord.y + dby, this.aabb.z_min)
            const size = new Vector(this.size.x, -height, this.size.z)
            cluster.drawNaturalBasement(chunk, coord, size, BLOCK.STONE)
        }
    }

    setY(y) {

        this.door_bottom.y     = y
        this.entrance.y        = y - 1
        this.coord.y           = this.entrance.y + this.coord.y

        const height           = this.aabb.height

        this.aabb.y_min        = this.entrance.y - BUILDING_AABB_MARGIN
        this.aabb.y_max        = this.aabb.y_min + height

        if(this.building_template) {
            const bdpy = this.building_template.world.pos1.y // this.building_template.door_pos.y
            this.aabb.translate(0, bdpy, 0)
        }

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
                resp.push({size: {x, z}})
            }
        }
        return resp;
    }

    /**
     * Limit building size
     * 
     * @param {*} building_template 
     * @param {Vector} coord 
     * @param {Vector} size 
     * @param {Vector} entrance 
     * @param {Vector} door_bottom 
     * @param {int} door_direction 
     */
    static selectSize(building_template, coord, size, entrance, door_bottom, door_direction, aabb) {

        const door_pos = new Vector(building_template?.door_pos ?? DEFAULT_DOOR_POS);

        if(building_template.size.y != undefined) {
            aabb.y_max = aabb.y_min + building_template.size.y + BUILDING_AABB_MARGIN;
        }

        const random_size = new Vector(building_template.size);

        // swap X and Z
        if(door_direction % 2 == 1) {
            random_size.swapXZSelf();
            door_pos.swapXZSelf();
        }

        //
        switch(door_direction) {
            case DIRECTION.SOUTH: {
                coord.z += (size.z - random_size.z)
                size.x = random_size.x
                size.z = random_size.z
                entrance.x = coord.x + random_size.x - 1
                entrance.x -= door_pos.x
                break;
            }
            case DIRECTION.NORTH: {
                size.x = random_size.x
                size.z = random_size.z
                entrance.x = coord.x
                entrance.x += door_pos.x
                break;
            }
            case DIRECTION.EAST: {
                size.x = random_size.x
                size.z = random_size.z
                entrance.z = coord.z + random_size.z - 1
                entrance.z -= door_pos.z
                break;
            }
            case DIRECTION.WEST: {
                coord.x += size.x - random_size.x
                size.x = random_size.x
                size.z = random_size.z
                entrance.z = coord.z
                entrance.z += door_pos.z
                break;
            }
            default: {
                throw `error_invalid_building_door_direction|${door_direction}`
            }
        }

        let dbx = door_bottom.x;
        let dbz = door_bottom.z;

        door_bottom.x = entrance.x
        door_bottom.z = entrance.z

        //
        switch(door_direction) {
            case DIRECTION.NORTH: {
                door_bottom.x += door_pos.x
                break;
            }
            case DIRECTION.SOUTH: {
                door_bottom.x -= door_pos.x
                break;
            }
            case DIRECTION.WEST: {
                door_bottom.z -= door_pos.z
                break;
            }
            case DIRECTION.EAST: {
                door_bottom.z += door_pos.z
                break;
            }
        }

        // aabb.translate(- door_bottom.x + dbx, 0, - door_bottom.z + dbz);

    }

    /**
     * For old style generators
     * @param {*} chunk 
     * @deprecated
     */
    findYOld(chunk, maps) {
        if(this.entrance.y != Infinity) {
            return false;
        }
        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
        let value2 = 0;
        for(let entrance of [this.entrance, this.entrance.clone().addSelf(getAheadMove(this.door_direction))]) {
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
            if(!this.biome) {
                this.setBiome({}, 0, 0);
            }
            this.setY(value2);
            return true;
        }
        return false;
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
                this.cluster.mask[z * this.cluster.size.x + x] = new ClusterPoint(h, BLOCK.HAY_BLOCK.id, 1, null, null, 1); 
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

}