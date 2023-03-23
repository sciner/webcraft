import { impl as alea } from '../../../vendors/alea.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { AABB } from '../../core/AABB.js';
import { ShiftedMatrix, Vector, VectorCardinalTransformer } from "../../helpers.js";
import { findLowestNonSolidYFromAboveInChunkAABBRelative } from "../../block_helpers.js";
import { BlockDrawer } from './block_drawer.js';
import { getAheadMove } from './building_cluster_base.js';
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { ClusterBase } from "./base.js";

export const BUILDING_AABB_MARGIN  = 3; // because building must calling to draw from neighbours chunks

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
export const BASEMENT_MAX_PAD = 6            // The maximum additional basement width. Integer.
export const BASEMENT_ADDITIONAL_WIDTH = 1   // How much additional blocks are added around the ground floor. Can be non-integer, from 0.
export const BASEMENT_SIDE_BULGE = 0.5

export const BASEMENT_BOTTOM_BULGE_BLOCKS = 2   // How many bllocks are added to the depth of the basement at its center
export const BASEMENT_BOTTOM_BULGE_PERCENT = 0.1 // Which fraction of the basement's width is added to its depth at its center

const DEFAULT_DOOR_POS = new Vector(0, 0, 0);

const BASEMENT_MAX_CLUSTER_BLOCKS_HEIGHT = 1 // From 0. The maximum height at which clster blocks are used at the top of the basement

const BASEMENT_NOISE_HARSHNESS = 1.3 // from 1. Higher values make it more pronounced, often clamped to its range.
const BASEMENT_NOISE_SCALE = 1 / 12
const BASEMENT_NOISE_AMPLITUDE = 2.0

const CHUNK_AABB = new AABB(0, 0, 0, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z)
const tmpTransformer = new VectorCardinalTransformer()
const tmpYMatrix = new ShiftedMatrix(0, 0, 1, 1)

// Base building
export class Building {

    id:                 string
    coord:              Vector
    door_direction:     int
    size:               Vector
    blocks:             BlockDrawer
    mirror_x:           boolean
    mirror_z:           boolean
    entrance:           Vector
    draw_entrance:      boolean
    aabb:               AABB
    _autoBasementAABB:  AABB

    randoms:            any
    cluster:            any
    seed:               any
    building_template:  any
    materials:          any
    biome:              any
    temperature:        any
    humidity:           any
    minFloorYbyXZ:      any

    constructor(cluster: any, seed: any, coord: Vector, _entrance: Vector, door_direction: int, _size: Vector, building_template? : any) {

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
        this._autoBasementAABB  = this.building_template?.autoBasement && new AABB()

        // blocks
        this.blocks = new BlockDrawer(this)

    }

    get generator() { return this.cluster.clusterManager.world.generator }

    get pos() : Vector {
        return this.entrance.add(Vector.YP)
    }

    get direction() : int {
        return this.door_direction;
    }

    get ahead_entrance() : Vector {
        return this.entrance
            .clone()
            .addSelf(
                getAheadMove(this.door_direction + 2)
            )
    }

    addBlocks() {}

    setBiome(biome : any, temperature : float, humidity : float) {
        this.biome = biome;
        this.temperature = temperature;
        this.humidity = humidity;
        this.addBlocks()
    }

    draw(cluster: ClusterBase, chunk: ChunkWorkerChunk, draw_natural_basement = true): void {
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

        const minFloorYbyXZ = this.minFloorYbyXZ ?? this.building_template?.minFloorYbyXZ
        if (minFloorYbyXZ) {
            this.fixBlocksBelowBuilding(chunk, minFloorYbyXZ)
        }
    }

    drawAutoBasement(chunk: ChunkWorkerChunk): void {
        const cluster = this.cluster
        const basement = this.building_template.autoBasement
        const objToChunk = new VectorCardinalTransformer()
        this.initTransformerToChunk(objToChunk, chunk.coord)
        const chunkToObj = new VectorCardinalTransformer().initInverse(objToChunk)
        const chunkAabbInObj = chunkToObj.tranformAABB(CHUNK_AABB, new AABB())
        // AABB of the part of the basement in this chunk, clamped to chunk
        const aabbInObj = basement.aabb.clone().setIntersect(chunkAabbInObj)
        const aabbInChunk = objToChunk.tranformAABB(aabbInObj, new AABB())

        // find the lowest surface points
        const minNonSolidYInChunkMatrix = tmpYMatrix.initHorizontalInAABB(aabbInChunk)
        const yMinNonSolidInChunk = findLowestNonSolidYFromAboveInChunkAABBRelative(chunk, aabbInChunk, minNonSolidYInChunkMatrix)
        const yMinNonSolidInObj = chunkToObj.transformY(yMinNonSolidInChunk)
        if (yMinNonSolidInObj >= aabbInObj.y_max) {
            return // there is nothing to draw
        }

        const sizeInObj = basement.aabb.size
        const posInObj = new Vector()
        const centerInObj = basement.aabb.center
        const centerInChunk = objToChunk.transform(centerInObj)
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
                const columnIndex = chunk.getColumnIndex(cx, cz)
                const cell  = chunk.map.getCell(cx, cz)
                // find the max Y
                const y_max = -depths.min
                const y_max_incl = y_max - 1
                let y_max_clamped = Math.min(aabbInObj.y_max, y_max + 1)
                // find the min Y
                const minNonSolidYInChunk = minNonSolidYInChunkMatrix.get(cx, cz)
                const minNonSolidYInObj = chunkToObj.transformY(minNonSolidYInChunk)
                const y_min = -depths.max - Math.round(basement.bulge.bulgeByXY(posInObj.x, posInObj.z))
                const y_min_clamped = Math.max(aabbInObj.y_min, y_min, minNonSolidYInObj)
                // apply blocks from the cluster, but only to the lower levels of the basement (otherweise it looks wierd)
                if (minNonSolidYInChunk > 0 && // don't apply it for the lowest level of hucnk, because we don't know the real floor
                    y_max_incl < y_max_clamped &&   // if the tp basement block is actually drawn
                    // if the basement isn't too high relative to the real floor
                    y_max_incl <= minNonSolidYInObj + BASEMENT_MAX_CLUSTER_BLOCKS_HEIGHT
                ) {
                    const clusterPoint = cluster.getMaskByWorldXZ(cx + chunk.coord.x, cz + chunk.coord.z)
                    const clusterBlockId = clusterPoint?.block_id
                    if (clusterBlockId) {
                        // draw the cluster block (dirt path, stone floor, etc.)
                        const cy = objToChunk.transformY(y_max_incl)
                        chunk.setBlockIndirect(cx, cy, cz, clusterBlockId)
                        /* This code draws biome caps on top of the raised cluster blocks.
                        But because the custer itself doesn't draw caps, the basement shouldn't do it also.
                        Uncomment this code if the cluster draws the caps on its sloid ground blocks.

                        // if it's solid, draw the biome cap on top of it
                        const bm = cluster.clusterManager.world.block_manager
                        cy++
                        if (cy < aabbInChunk.y_max && bm.isSolidID(clusterBlockId)) {
                            const capBlockId = cell.getCapBlockId && cell.getCapBlockId()
                            if (capBlockId && !isFluidId(chunk.getBlockID(cx, cy, cz))) {
                                chunk.setBlockIndirect(cx, cy, cz, capBlockId)
                            }
                        }
                        */
                        y_max_clamped = Math.min(y_max_clamped, y_max - 1) // start 1 block below the dirt path
                    }
                }
                // fill the column of blocks, including the cap
                for(let y = y_min_clamped; y < y_max_clamped; y++) {
                    const cy = objToChunk.transformY(y)
                    chunk.setGroundLayerInColumnIndirect(columnIndex, cx, cy, cz, cell, y_max_incl - y)
                }
                // turn grass block into dirt below the column
                if (y_min_clamped < y_max && // if the colum is actually drawn (in this chunk or not - doesn't matter)
                    y_min_clamped - 1 >= aabbInObj.y_min // if the block below the column is in this chunk
                ) {
                    const belowBasementY = objToChunk.transformY(y_min_clamped - 1)
                    chunk.fixBelowSolidIndirect(cx, belowBasementY, cz)
                }
            }
        }
    }

    /**
     * Fixes blocks below the lowest floor blocks, in particulaer, turns grass_block into dirt.
     */
    fixBlocksBelowBuilding(chunk: ChunkWorkerChunk, minFloorYbyXZ: ShiftedMatrix): void {
        const objToChunk = new VectorCardinalTransformer()
        this.initTransformerToChunk(objToChunk, chunk.coord)
        const chunkToObj = new VectorCardinalTransformer().initInverse(objToChunk)
        const chunkAabbInObj = chunkToObj.tranformAABB(CHUNK_AABB, new AABB())
        const vec = new Vector()
        for(const [x, z, y] of minFloorYbyXZ.entries(
            chunkAabbInObj.x_min, chunkAabbInObj.z_min,
            chunkAabbInObj.x_max, chunkAabbInObj.z_max)
        ) {
            if (y > chunkAabbInObj.y_min) {
                vec.set(x, y - 1, z)
                objToChunk.transform(vec, vec)
                chunk.fixBelowSolidIndirect(vec.x, vec.y, vec.z)
            }
        }
    }

    setY(y : int) {

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

    static makeRandomSizeList(sizes : int[]) {
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
     */
    static selectSize(building_template: { size: number | Vector | number[] | IVector; door_pos: any; }, coord: Vector, size: Vector, entrance: Vector, door_direction: any) {

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

    getRealAABB() : AABB {
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
    getAutoBasementAABB() : AABB {
        if (this._autoBasementAABB) {
            this.initToWorld(tmpTransformer)
            tmpTransformer.tranformAABB(this.building_template.autoBasement.aabb, this._autoBasementAABB)
        }
        return this._autoBasementAABB
    }

    // Translate position
    translate(vec : Vector) {
        this.aabb.translate(vec.x, vec.y, vec.z)
        this.coord.addSelf(vec)
        this.entrance.addSelf(vec)
    }

    translateXZ(vec : Vector) {

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

    moveXZTo(vec : Vector) {
        const aabb = this.aabb // this.getRealAABB()
        const diff = new Vector(aabb.x_min, aabb.y_min, aabb.z_min).subSelf(vec).multiplyScalarSelf(-1)
        this.translateXZ(diff)
    }

    /**
     * For old style generators
     * @deprecated
     */
    findYOld(chunk, maps) : boolean {
        if(this.entrance.y != Infinity) {
            return false;
        }
        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
        let value2 = 0
        let value2_changed = false
        for(let entrance of [this.entrance, this.ahead_entrance]) {
            const map_addr = Vector.toChunkAddr(entrance);
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
        if(value2_changed && value2 > this.cluster.clusterManager.chunkManager.world.generator.options.WATER_LEVEL) {
            this.setY(value2 - 1)
            if(!this.biome) {
                this.setBiome({}, 0, 0)
            }
            return true
        }
        return false
    }

    /**
     * Initializes this transformer to transofrm from the coordinate system of
     * a building to the coordinate system of a chunk.
     */
    initTransformerToChunk(transformer : VectorCardinalTransformer, chunk_coord : Vector) : VectorCardinalTransformer {
        return transformer.init(this.pos.sub(chunk_coord), this.direction, this.mirror_x, this.mirror_z)
    }

    /**
     * Initializes this transformer to transofrm from the coordinate system of
     * a building to the coordinate system of the world.
     */
    initToWorld(transformer: VectorCardinalTransformer) : VectorCardinalTransformer {
        return transformer.init(this.pos, this.direction, this.mirror_x, this.mirror_z)
    }

}