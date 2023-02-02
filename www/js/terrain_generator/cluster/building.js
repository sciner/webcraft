import { impl as alea } from '../../../vendors/alea.js';
import { BLOCK } from "../../blocks.js";
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
     * @param {Vector} _entrance
     * @param {int} door_direction
     * @param {Vector} _size
     * @param {*} building_template
     */
    constructor(cluster, seed, coord, _entrance, door_direction, _size, building_template) {

        _entrance = new Vector(_entrance)
        _entrance.y = Infinity
        _size = building_template ? new Vector(building_template.size) : _size

        // other props
        this.randoms            = new alea(coord.toHash())
        this.cluster            = cluster
        this.id                 = coord.toHash()
        this.seed               = seed

        //
        this.building_template  = building_template
        this.door_direction     = door_direction
        this.coord              = coord
        this.entrance           = _entrance
        this.size               = _size
        this.materials          = null
        this.draw_entrance      = true
        this.aabb               = this.building_template ? this.getRealAABB() : new AABB(
                                        coord.x,
                                        coord.y,
                                        coord.z,
                                        coord.x + _size.x,
                                        coord.y + _size.y,
                                        coord.z + _size.z
                                    )

        // blocks
        this.blocks = new BlockDrawer(this)

    }

    get pos() {
        return this.entrance.add(Vector.YP)
    }

    get direction() {
        return this.door_direction;
    }

    get ahead_entrance() {
        return this.entrance
            .clone()
            .addSelf(
                getAheadMove(this.door_direction + 2)
            )
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
        this.aabb.translate(vec.x, vec.y, vec.z)
        this.coord.addSelf(vec)
        this.entrance.addSelf(vec)
    }

    /**
     * @param { import("./base.js").ClusterBase } cluster
     * @param {*} chunk
     * @param {boolean} draw_natural_basement
     */
    draw(cluster, chunk, draw_natural_basement = true) {
        // TODO: need to draw one block of air ahead door bottom
        // natural basement
        if(draw_natural_basement) {
            const height = 4
            const dby = 0 // this.building_template ? this.building_template.world.entrance.y - 2 : 0 // 2 == 1 уровень ниже пола + изначально вход в конструкторе стоит на высоте 1 метра над землей
            const coord = new Vector(this.aabb.x_min, this.coord.y + dby, this.aabb.z_min)
            const size = new Vector(this.size.x, -height, this.size.z)
            cluster.drawNaturalBasement(chunk, coord, size, BLOCK.STONE)
        }
    }

    setY(y) {

        if(this.building_template) {
            y += 1 // this.building_template.door_pos.y
        }

        this.entrance.y        = y - 1 + this.coord.y
        this.coord.y           = this.entrance.y + this.coord.y

        const height           = this.building_template ? (this.building_template.size.y + BUILDING_AABB_MARGIN) : this.aabb.height

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
     * @param {int} door_direction
     */
    static selectSize(building_template, coord, size, entrance, door_direction) {

        const MOVE_TO_BACK = 0 // door_pos.z // 1

        //TODO: FLIP TEST
        // door_direction = CubeSym.add(door_direction, CubeSym.NEG_X);

        // corner of building in the plot coords
        let corner1 = new Vector(0, 0, MOVE_TO_BACK);
        // diagonal of building, signed vector
        let signed_size = new Vector(building_template.size);
        // door, relative to corner
        let corner_to_door = new Vector(building_template?.door_pos ?? DEFAULT_DOOR_POS);

        if (door_direction) {
            // rotate corner relative to plot center
            corner1.applyCubeSymSelf(door_direction);
            signed_size.applyCubeSymSelf(door_direction);
            if (signed_size.x < 0) corner1.x += size.x;
            if (signed_size.z < 0) corner1.z += size.z;
            // door is BLOCK! rotation is around 0.5!
            corner_to_door.applyCubeSymSelf(door_direction, new Vector(-0.5, 0, -0.5));
        }

        entrance.x = coord.x + corner1.x + corner_to_door.x;
        entrance.z = coord.z + corner1.z + corner_to_door.z;

        // diagonal might become negative, that's fine
        let west = Math.min(signed_size.x, 0);
        let south = Math.min(signed_size.z, 0);
        coord.x += corner1.x + west;
        coord.z += corner1.z + south;

        size.x = Math.abs(signed_size.x);
        size.z = Math.abs(signed_size.z);
    }

    getRealAABB() {
        const coord = new Vector(0, 0, 0);
        const size = new Vector(1, 0, 1)
        const entrance = new Vector(0, 0, 0)
        Building.selectSize(this.building_template, coord, size, entrance, this.door_direction)
        coord.x += this.coord.x - entrance.x
        coord.y = this.coord.y
        coord.z += this.coord.z - entrance.z
        return new AABB(coord.x, coord.y, coord.z, coord.x + this.size.x, coord.y + this.size.y, coord.z + this.size.z).translate(0, this.building_template.door_pos.y, 0)
    }

    /**
     * @param {Vector} vec 
     */
    translateXZ(vec) {

        // aabb
        const aabb_y_min = this.aabb.y_min
        const aabb_y_max = this.aabb.y_max
        this.aabb.translate(vec.x, vec.y, vec.z)
        this.aabb.y_min = aabb_y_min
        this.aabb.y_max = aabb_y_max

        // coord
        const orig_coord_y = this.coord.y
        this.coord.translate(vec.x, vec.y, vec.z)
        this.coord.y = orig_coord_y

        // entrance
        const orig_entrance_y = this.entrance.y
        this.entrance.translate(vec.x, vec.y, vec.z)
        this.entrance.y = orig_entrance_y

    }

    moveXZTo(vec) {
        const aabb = this.aabb // this.getRealAABB()
        const diff = new Vector(aabb.x_min, aabb.y_min, aabb.z_min).subSelf(vec).multiplyScalarSelf(-1)
        this.translateXZ(diff)
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
        let value2 = 0
        let value2_changed = false
        for(let entrance of [this.entrance, this.ahead_entrance]) {
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
                const cell          = entrance_map.getCell(entrance_x, entrance_z);
                if(cell.value2 > value2) {
                    value2 = cell.value2
                    value2_changed = true
                }
            }
        }
        if(value2_changed && value2 > this.cluster.clusterManager.chunkManager.world.generator.options.WATER_LINE) {
            this.setY(value2 - 1)
            if(!this.biome) {
                this.setBiome({}, 0, 0)
            }
            return true
        }
        return false
    }

}