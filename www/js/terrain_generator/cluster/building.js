import { impl as alea } from '../../../vendors/alea.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { AABB } from '../../core/AABB.js';
import { getChunkAddr, Vector, VectorCardinalTransformer } from "../../helpers.js";
import { findLowestNonSolidYFromAboveInChunkAABBRelative } from "../../block_helpers.js";
import { BlockDrawer } from './block_drawer.js';
import { getAheadMove } from './building_cluster_base.js';

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

// roof types
export const ROOF_TYPE_PITCHED = 'pitched';
export const ROOF_TYPE_FLAT = 'flat';

const DEFAULT_DOOR_POS = new Vector(0, 0, 0);

// It describes the shape of the basement's borders.
// For each horizontal distance from the ground floor, it's minimum and maximum depth to draw earth blocks.
export const BASEMNET_DEPTHS_BY_DISTANCE = [
    {min: 0, max: 7},
    {min: 1, max: 7},
    {min: 2, max: 6},
    {min: 3, max: 6},
    {min: 4, max: 5},
    {min: 5, max: 5}
]
export const BASEMENT_BORDER_SCALE_XZ = 0.7  // How wide/narrow the rounded borders around the basement are
export const BASEMENT_MAX_PAD = 6
export const BASEMENT_SIDE_BULGE = 0.5

export const BASEMENT_BOTTOM_BULGE_BLOCKS = 2   // How many bllocks are added to the depth of the basement at its center
export const BASEMENT_BOTTOM_BULGE_PERCENT = 0.1 // Which fraction of the basement's width is added to its depth at its center

const BASEMENT_NOISE_HARSHNESS = 1.3 // from 1. Higher values make it more pronounced, often clamped to its range.
const BASEMENT_NOISE_SCALE = 1 / 12
const BASEMENT_NOISE_AMPLITUDE = 2.0

const CHUNK_AABB = new AABB(0, 0, 0, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z)
const tmpTransformer = new VectorCardinalTransformer()

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
        this.mirror_x           = false
        this.mirror_z           = false
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
        this._autoBasemntAABB       = this.building_template?.autoBasement && new AABB()

        // blocks
        this.blocks = new BlockDrawer(this)

    }

    get generator() { return this.cluster.clusterManager.world.generator }

    /**
     * @returns {Vector}
     */
    get pos() {
        return this.entrance.add(Vector.YP)
    }

    /**
     * @returns {int}
     */
    get direction() {
        return this.door_direction;
    }

    /**
     * @returns {Vector}
     */
    get ahead_entrance() {
        return this.entrance
            .clone()
            .addSelf(
                getAheadMove(this.door_direction + 2)
            )
    }

    addBlocks() {}
    
    /**
     * @param {*} biome 
     * @param {float} temperature 
     * @param {float} humidity 
     */
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
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @param {boolean} draw_natural_basement
     */
    draw(cluster, chunk, draw_natural_basement = true) {
        // TODO: need to draw one block of air ahead door bottom
        // This code draws a rectangular basement if the new "autoBasement" is absent.
        // The new "autoBasement" is drawn in a separate place because it requires checking its own AABB, instead of the building's AABB
        if(draw_natural_basement && !this.building_template?.autoBasement) {
            const height = 4
            const dby = 0 // this.building_template ? this.building_template.world.entrance.y - 2 : 0 // 2 == 1 уровень ниже пола + изначально вход в конструкторе стоит на высоте 1 метра над землей
            const coord = new Vector(this.aabb.x_min, this.coord.y + dby, this.aabb.z_min)
            const size = new Vector(this.size.x, -height, this.size.z)
            const bm = cluster.clusterManager.world.block_manager
            cluster.drawNaturalBasement(chunk, coord, size, bm.STONE)
        }
    }

    /**
     * @param {import("../../worker/chunk.js").ChunkWorkerChunk} chunk
     */
    drawAutoBasement(chunk) {
        const basement = this.building_template.autoBasement
        const objToChunk = new VectorCardinalTransformer().initBuildingToChunk(this, chunk)
        const chunkToObj = new VectorCardinalTransformer().initInverse(objToChunk)
        const chunkAabbInObj = chunkToObj.tranformAABB(CHUNK_AABB, new AABB())
        // AABB of the part of the basement in this chunk, clamped to chunk
        const centerInObj = basement.aabb.center
        const sizeInObj = basement.aabb.size
        const aabbInObj = basement.aabb.clone().setIntersect(chunkAabbInObj)
        const centerInChunk = objToChunk.transform(centerInObj)
        const aabbInChunk = objToChunk.tranformAABB(aabbInObj, new AABB())
        const posInObj = new Vector()

        // find the lowest surface point (approximately)
        const yMinNonSolidInChunk = findLowestNonSolidYFromAboveInChunkAABBRelative(chunk, aabbInChunk)
        const yMinNonSolidInObj = chunkToObj.transformY(yMinNonSolidInChunk)
        if (yMinNonSolidInObj >= aabbInObj.y_max) {
            return // there is nothing to draw
        }

        const noise2d = this.generator.noise2d
        const borderScaleInv = 1 / BASEMENT_BORDER_SCALE_XZ
        const circleRadius = sizeInObj.horizontalLength() / 2
        for(let cx = aabbInChunk.x_min; cx < aabbInChunk.x_max; cx++) {
            for(let cz = aabbInChunk.z_min; cz < aabbInChunk.z_max; cz++) {
                chunkToObj.transformXZ(cx, cz, posInObj)
                let distance = basement.distances.get(posInObj.x, posInObj.z) // distance to the ground floor
                // For points outside the ground floor, subtract a random amount from the distace,
                // thus randomly making the basement wider
                if (distance) {
                    // map the basement point to a point of a circle around the basement
                    const dxCenterInChunk = cx - centerInChunk.x
                    const dzCenterInChunk = cz - centerInChunk.z
                    const fromChunkCenterDist = Math.sqrt(dxCenterInChunk * dxCenterInChunk + dzCenterInChunk * dzCenterInChunk) + 1e-10
                    const multilpler = circleRadius / fromChunkCenterDist
                    const circleXInChunk = centerInChunk.x + dxCenterInChunk * multilpler
                    const circleZInChunk = centerInChunk.z + dzCenterInChunk * multilpler
                    const circleXInWorld = chunk.coord.x + circleXInChunk
                    const circleZInWorld = chunk.coord.z + circleZInChunk
                    // calculate noise in that point of circle. It's the aditional basement radius.
                    let noise = noise2d(circleXInWorld * BASEMENT_NOISE_SCALE, circleZInWorld * BASEMENT_NOISE_SCALE)
                    noise = Math.max(-1, Math.min(1, noise * BASEMENT_NOISE_HARSHNESS)) // make it higher values more likely
                    noise = (noise + 1) * 0.5 * BASEMENT_NOISE_AMPLITUDE // to 0..BASEMENT_NOISE_AMPLITUDE
                    distance = Math.max(0, distance - noise)
                }
                const depths = BASEMNET_DEPTHS_BY_DISTANCE[Math.round(distance * borderScaleInv)]
                if (!depths) {
                    continue
                }
                // find the properties of the column of blocks
                const y_max = -depths.min
                const y_min = -depths.max - Math.round(basement.bulge.bulgeByXY(posInObj.x, posInObj.z))
                const y_max_incl = y_max - 1
                const y_min_clamped = Math.max(aabbInObj.y_min, y_min, yMinNonSolidInObj)
                const y_max_clamped = Math.min(aabbInObj.y_max, y_max + 1)
                const cell  = chunk.map.getCell(cx, cz)
                // fill the column of blocks, including the cap
                for(let y = y_min_clamped; y < y_max_clamped; y++) {
                    const cy = objToChunk.transformY(y)
                    chunk.setGroundLayerIndirect(cx, cy, cz, cell, y_max_incl - y)
                }
                // turn grass block into dirt below the column
                if (y_min - 1 >= aabbInObj.y_min) {
                    const belowBasementY = objToChunk.transformY(y_min - 1)
                    chunk.fixBelowSolidIndirect(cx, belowBasementY, cz)
                }
            }
        }
    }

    /**
     * @param {int} y 
     */
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

    /**
     * @returns {AABB}
     */
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
     * Call it only after getRealAABB(), because getRealAABB() modifies the buildng's position.
     * @return {AABB} of basement in the worlds's coordinate system.
     */
    getautoBasementAABB() {
        if (this._autoBasemntAABB) {
            tmpTransformer.initBuildingToWorld(this)
            tmpTransformer.tranformAABB(this.building_template.autoBasement.aabb, this._autoBasemntAABB)
        }
        return this._autoBasemntAABB
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

    /**
     * @param {Vector} vec 
     */
    moveXZTo(vec) {
        const aabb = this.aabb // this.getRealAABB()
        const diff = new Vector(aabb.x_min, aabb.y_min, aabb.z_min).subSelf(vec).multiplyScalarSelf(-1)
        this.translateXZ(diff)
    }

    /**
     * For old style generators
     * @param {*} chunk
     * @param {*} maps
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