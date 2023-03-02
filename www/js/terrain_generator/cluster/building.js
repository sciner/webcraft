import { impl as alea } from '../../../vendors/alea.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { AABB } from '../../core/AABB.js';
import { ShiftedMatrix, Vector, VectorCardinalTransformer } from "../../helpers.js";
import { findLowestNonSolidYFromAboveInChunkAABBRelative } from "../../block_helpers.js";
import { BlockDrawer } from './block_drawer.js';
import { getAheadMove } from './building_cluster_base.js';
export const BUILDING_AABB_MARGIN = 3; // because building must calling to draw from neighbours chunks
// roof types
export const ROOF_TYPE_PITCHED = 'pitched';
export const ROOF_TYPE_FLAT = 'flat';
const DEFAULT_DOOR_POS = new Vector(0, 0, 0);
// It describes the shape of the basement's borders.
// For each horizontal distance from the ground floor, it's minimum and maximum depth to draw earth blocks.
export const BASEMNET_DEPTHS_BY_DISTANCE = [
    { min: 0, max: 7 },
    { min: 1, max: 7 },
    { min: 2, max: 6 },
    { min: 3, max: 6 },
    { min: 4, max: 5 },
    { min: 5, max: 5 }
];
export const BASEMENT_BORDER_SCALE_XZ = 0.7; // How wide/narrow the rounded borders around the basement are
export const BASEMENT_MAX_PAD = 6; // The maximum additional basement width. Integer.
export const BASEMENT_ADDITIONAL_WIDTH = 1; // How much additional blocks are added around the ground floor. Can be non-integer, from 0.
export const BASEMENT_SIDE_BULGE = 0.5;
export const BASEMENT_BOTTOM_BULGE_BLOCKS = 2; // How many bllocks are added to the depth of the basement at its center
export const BASEMENT_BOTTOM_BULGE_PERCENT = 0.1; // Which fraction of the basement's width is added to its depth at its center
const BASEMENT_MAX_CLUSTER_BLOCKS_HEIGHT = 1; // From 0. The maximum height at which clster blocks are used at the top of the basement
const BASEMENT_NOISE_HARSHNESS = 1.3; // from 1. Higher values make it more pronounced, often clamped to its range.
const BASEMENT_NOISE_SCALE = 1 / 12;
const BASEMENT_NOISE_AMPLITUDE = 2.0;
const CHUNK_AABB = new AABB(0, 0, 0, CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const tmpTransformer = new VectorCardinalTransformer();
const tmpYMatrix = new ShiftedMatrix(0, 0, 1, 1);
// Base building
export class Building {
    _autoBasementAABB;
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
        _entrance = new Vector(_entrance);
        _entrance.y = Infinity;
        _size = building_template ? new Vector(building_template.size) : _size;
        // other props
        this.randoms = new alea(coord.toHash());
        this.cluster = cluster;
        this.id = coord.toHash();
        this.seed = seed;
        //
        this.building_template = building_template;
        this.door_direction = door_direction;
        this.coord = coord;
        this.mirror_x = false;
        this.mirror_z = false;
        this.entrance = _entrance;
        this.size = _size;
        this.materials = null;
        this.draw_entrance = true;
        this.aabb = this.building_template ? this.getRealAABB() : new AABB(coord.x, coord.y, coord.z, coord.x + _size.x, coord.y + _size.y, coord.z + _size.z);
        this._autoBasementAABB = this.building_template?.autoBasement && new AABB();
        // blocks
        this.blocks = new BlockDrawer(this);
    }
    get generator() { return this.cluster.clusterManager.world.generator; }
    /**
     * @returns {Vector}
     */
    get pos() {
        return this.entrance.add(Vector.YP);
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
            .addSelf(getAheadMove(this.door_direction + 2));
    }
    addBlocks() { }
    /**
     * @param {*} biome
     * @param {float} temperature
     * @param {float} humidity
     */
    setBiome(biome, temperature, humidity) {
        this.biome = biome;
        this.temperature = temperature;
        this.humidity = humidity;
        this.addBlocks();
    }
    draw(cluster, chunk, draw_natural_basement = true) {
        // TODO: need to draw one block of air ahead door bottom
        // This code draws a rectangular basement if the new "autoBasement" is absent.
        // The new "autoBasement" is drawn in a separate place because it requires checking its own AABB, instead of the building's AABB
        if (draw_natural_basement && !this.building_template?.autoBasement) {
            const height = 4;
            const dby = 0; // this.building_template ? this.building_template.world.entrance.y - 2 : 0 // 2 == 1 уровень ниже пола + изначально вход в конструкторе стоит на высоте 1 метра над землей
            const coord = new Vector(this.aabb.x_min, this.coord.y + dby, this.aabb.z_min);
            const size = new Vector(this.size.x, -height, this.size.z);
            const bm = cluster.clusterManager.world.block_manager;
            cluster.drawNaturalBasement(chunk, coord, size, bm.STONE);
        }
        const minFloorYbyXZ = this.minFloorYbyXZ ?? this.building_template?.minFloorYbyXZ;
        if (minFloorYbyXZ) {
            this.fixBlocksBelowBuilding(chunk, minFloorYbyXZ);
        }
    }
    drawAutoBasement(chunk) {
        const cluster = this.cluster;
        const basement = this.building_template.autoBasement;
        const objToChunk = new VectorCardinalTransformer();
        this.initToChunk(objToChunk, chunk.coord);
        const chunkToObj = new VectorCardinalTransformer().initInverse(objToChunk);
        const chunkAabbInObj = chunkToObj.tranformAABB(CHUNK_AABB, new AABB());
        // AABB of the part of the basement in this chunk, clamped to chunk
        const aabbInObj = basement.aabb.clone().setIntersect(chunkAabbInObj);
        const aabbInChunk = objToChunk.tranformAABB(aabbInObj, new AABB());
        // find the lowest surface points
        const minNonSolidYInChunkMatrix = tmpYMatrix.initHorizontalInAABB(aabbInChunk);
        const yMinNonSolidInChunk = findLowestNonSolidYFromAboveInChunkAABBRelative(chunk, aabbInChunk, minNonSolidYInChunkMatrix);
        const yMinNonSolidInObj = chunkToObj.transformY(yMinNonSolidInChunk);
        if (yMinNonSolidInObj >= aabbInObj.y_max) {
            return; // there is nothing to draw
        }
        const sizeInObj = basement.aabb.size;
        const posInObj = new Vector();
        const centerInObj = basement.aabb.center;
        const centerInChunk = objToChunk.transform(centerInObj);
        const noise2d = this.generator.noise2d;
        const borderScaleInv = 1 / BASEMENT_BORDER_SCALE_XZ;
        const circleRadius = sizeInObj.horizontalLength() / 2;
        for (let cx = aabbInChunk.x_min; cx < aabbInChunk.x_max; cx++) {
            for (let cz = aabbInChunk.z_min; cz < aabbInChunk.z_max; cz++) {
                chunkToObj.transformXZ(cx, cz, posInObj);
                let distance = basement.distances.get(posInObj.x, posInObj.z); // distance to the ground floor
                // For points outside the ground floor, subtract a random amount from the distace,
                // thus randomly making the basement wider
                if (distance) {
                    // map the basement point to a point of a circle around the basement
                    const dxCenterInChunk = cx - centerInChunk.x;
                    const dzCenterInChunk = cz - centerInChunk.z;
                    const fromChunkCenterDist = Math.sqrt(dxCenterInChunk * dxCenterInChunk + dzCenterInChunk * dzCenterInChunk) + 1e-10;
                    const multilpler = circleRadius / fromChunkCenterDist;
                    const circleXInChunk = centerInChunk.x + dxCenterInChunk * multilpler;
                    const circleZInChunk = centerInChunk.z + dzCenterInChunk * multilpler;
                    const circleXInWorld = chunk.coord.x + circleXInChunk;
                    const circleZInWorld = chunk.coord.z + circleZInChunk;
                    // calculate noise in that point of circle. It's the aditional basement radius.
                    let noise = noise2d(circleXInWorld * BASEMENT_NOISE_SCALE, circleZInWorld * BASEMENT_NOISE_SCALE);
                    noise = Math.max(-1, Math.min(1, noise * BASEMENT_NOISE_HARSHNESS)); // make it higher values more likely
                    noise = (noise + 1) * 0.5 * BASEMENT_NOISE_AMPLITUDE; // to 0..BASEMENT_NOISE_AMPLITUDE
                    distance = Math.max(0, distance - noise);
                }
                const depths = BASEMNET_DEPTHS_BY_DISTANCE[Math.round(distance * borderScaleInv)];
                if (!depths) {
                    continue;
                }
                const columnIndex = chunk.getColumnIndex(cx, cz);
                const cell = chunk.map.getCell(cx, cz);
                // find the max Y
                const y_max = -depths.min;
                const y_max_incl = y_max - 1;
                let y_max_clamped = Math.min(aabbInObj.y_max, y_max + 1);
                // find the min Y
                const minNonSolidYInChunk = minNonSolidYInChunkMatrix.get(cx, cz);
                const minNonSolidYInObj = chunkToObj.transformY(minNonSolidYInChunk);
                const y_min = -depths.max - Math.round(basement.bulge.bulgeByXY(posInObj.x, posInObj.z));
                const y_min_clamped = Math.max(aabbInObj.y_min, y_min, minNonSolidYInObj);
                // apply blocks from the cluster, but only to the lower levels of the basement (otherweise it looks wierd)
                if (minNonSolidYInChunk > 0 && // don't apply it for the lowest level of hucnk, because we don't know the real floor
                    y_max_incl < y_max_clamped && // if the tp basement block is actually drawn
                    // if the basement isn't too high relative to the real floor
                    y_max_incl <= minNonSolidYInObj + BASEMENT_MAX_CLUSTER_BLOCKS_HEIGHT) {
                    const clusterPoint = cluster.getMaskByWorldXZ(cx + chunk.coord.x, cz + chunk.coord.z);
                    const clusterBlockId = clusterPoint?.block_id;
                    if (clusterBlockId) {
                        // draw the cluster block (dirt path, stone floor, etc.)
                        const cy = objToChunk.transformY(y_max_incl);
                        chunk.setBlockIndirect(cx, cy, cz, clusterBlockId);
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
                        y_max_clamped = Math.min(y_max_clamped, y_max - 1); // start 1 block below the dirt path
                    }
                }
                // fill the column of blocks, including the cap
                for (let y = y_min_clamped; y < y_max_clamped; y++) {
                    const cy = objToChunk.transformY(y);
                    chunk.setGroundLayerInColumnIndirect(columnIndex, cx, cy, cz, cell, y_max_incl - y);
                }
                // turn grass block into dirt below the column
                if (y_min_clamped < y_max && // if the colum is actually drawn (in this chunk or not - doesn't matter)
                    y_min_clamped - 1 >= aabbInObj.y_min // if the block below the column is in this chunk
                ) {
                    const belowBasementY = objToChunk.transformY(y_min_clamped - 1);
                    chunk.fixBelowSolidIndirect(cx, belowBasementY, cz);
                }
            }
        }
    }
    /**
     * Fixes blocks below the lowest floor blocks, in particulaer, turns grass_block into dirt.
     */
    fixBlocksBelowBuilding(chunk, minFloorYbyXZ) {
        const objToChunk = new VectorCardinalTransformer();
        this.initToChunk(objToChunk, chunk.coord);
        const chunkToObj = new VectorCardinalTransformer().initInverse(objToChunk);
        const chunkAabbInObj = chunkToObj.tranformAABB(CHUNK_AABB, new AABB());
        const vec = new Vector();
        for (const [x, z, y] of minFloorYbyXZ.entries(chunkAabbInObj.x_min, chunkAabbInObj.z_min, chunkAabbInObj.x_max, chunkAabbInObj.z_max)) {
            if (y > chunkAabbInObj.y_min) {
                vec.set(x, y - 1, z);
                objToChunk.transform(vec, vec);
                chunk.fixBelowSolidIndirect(vec.x, vec.y, vec.z);
            }
        }
    }
    setY(y) {
        if (this.building_template) {
            y += 1; // this.building_template.door_pos.y
        }
        this.entrance.y = y - 1 + this.coord.y;
        this.coord.y = this.entrance.y + this.coord.y;
        const height = this.building_template ? (this.building_template.size.y + BUILDING_AABB_MARGIN) : this.aabb.height;
        this.aabb.y_min = this.entrance.y - BUILDING_AABB_MARGIN;
        this.aabb.y_max = this.aabb.y_min + height;
        if (this.building_template) {
            const bdpy = this.building_template.world.pos1.y; // this.building_template.door_pos.y
            this.aabb.translate(0, bdpy, 0);
        }
    }
    static makeRandomSizeList(sizes) {
        const resp = [];
        for (let i = 0; i < sizes.length; i++) {
            const x = sizes[i];
            for (let j = 0; j < sizes.length; j++) {
                const z = sizes[j];
                resp.push({ size: { x, z } });
            }
        }
        return resp;
    }
    /**
     * Limit building size
     */
    static selectSize(building_template, coord, size, entrance, door_direction) {
        const MOVE_TO_BACK = 0; // door_pos.z // 1
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
            if (signed_size.x < 0)
                corner1.x += size.x;
            if (signed_size.z < 0)
                corner1.z += size.z;
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
        const size = new Vector(1, 0, 1);
        const entrance = new Vector(0, 0, 0);
        Building.selectSize(this.building_template, coord, size, entrance, this.door_direction);
        coord.x += this.coord.x - entrance.x;
        coord.y = this.coord.y;
        coord.z += this.coord.z - entrance.z;
        return new AABB(coord.x, coord.y, coord.z, coord.x + this.size.x, coord.y + this.size.y, coord.z + this.size.z).translate(0, this.building_template.door_pos.y, 0);
    }
    /**
     * Call it only after getRealAABB(), because getRealAABB() modifies the buildng's position.
     * @return {AABB} of basement in the worlds's coordinate system.
     */
    getautoBasementAABB() {
        if (this._autoBasementAABB) {
            this.initToWorld(tmpTransformer);
            tmpTransformer.tranformAABB(this.building_template.autoBasement.aabb, this._autoBasementAABB);
        }
        return this._autoBasementAABB;
    }
    // Translate position
    translate(vec) {
        this.aabb.translate(vec.x, vec.y, vec.z);
        this.coord.addSelf(vec);
        this.entrance.addSelf(vec);
    }
    translateXZ(vec) {
        // aabb
        const aabb_y_min = this.aabb.y_min;
        const aabb_y_max = this.aabb.y_max;
        this.aabb.translate(vec.x, vec.y, vec.z);
        this.aabb.y_min = aabb_y_min;
        this.aabb.y_max = aabb_y_max;
        // coord
        const orig_coord_y = this.coord.y;
        this.coord.translate(vec.x, vec.y, vec.z);
        this.coord.y = orig_coord_y;
        // entrance
        const orig_entrance_y = this.entrance.y;
        this.entrance.translate(vec.x, vec.y, vec.z);
        this.entrance.y = orig_entrance_y;
    }
    moveXZTo(vec) {
        const aabb = this.aabb; // this.getRealAABB()
        const diff = new Vector(aabb.x_min, aabb.y_min, aabb.z_min).subSelf(vec).multiplyScalarSelf(-1);
        this.translateXZ(diff);
    }
    /**
     * For old style generators
     * @param {*} chunk
     * @param {*} maps
     * @deprecated
     */
    findYOld(chunk, maps) {
        if (this.entrance.y != Infinity) {
            return false;
        }
        // забираем карту того участка, где дверь, чтобы определить точный уровень пола
        let value2 = 0;
        let value2_changed = false;
        for (let entrance of [this.entrance, this.ahead_entrance]) {
            const map_addr = Vector.toChunkAddr(entrance);
            map_addr.y = 0;
            let entrance_map = maps.get(map_addr);
            if (entrance_map) {
                // if map not smoothed
                if (!entrance_map.smoothed) {
                    // generate around maps and smooth current
                    entrance_map = maps.generateAround(chunk, map_addr, true, false)[4];
                }
                const entrance_x = entrance.x - entrance_map.chunk.coord.x;
                const entrance_z = entrance.z - entrance_map.chunk.coord.z;
                const cell = entrance_map.getCell(entrance_x, entrance_z);
                if (cell.value2 > value2) {
                    value2 = cell.value2;
                    value2_changed = true;
                }
            }
        }
        if (value2_changed && value2 > this.cluster.clusterManager.chunkManager.world.generator.options.WATER_LEVEL) {
            this.setY(value2 - 1);
            if (!this.biome) {
                this.setBiome({}, 0, 0);
            }
            return true;
        }
        return false;
    }
    /**
     * Initializes this transformer to transofrm from the coordinate system of
     * a building to the coordinate system of a chunk.
     */
    initToChunk(transformer, chunk_coord) {
        return transformer.init(this.pos.sub(chunk_coord), this.direction, this.mirror_x, this.mirror_z);
    }
    /**
     * Initializes this transformer to transofrm from the coordinate system of
     * a building to the coordinate system of the world.
     */
    initToWorld(transformer) {
        return transformer.init(this.pos, this.direction, this.mirror_x, this.mirror_z);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGRpbmcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdGVycmFpbl9nZW5lcmF0b3IvY2x1c3Rlci9idWlsZGluZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsSUFBSSxJQUFJLElBQUksRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2hGLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ3BGLE9BQU8sRUFBRSwrQ0FBK0MsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBQ3pGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFJMUQsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUksQ0FBQyxDQUFDLENBQUMsK0RBQStEO0FBRXZHLGFBQWE7QUFDYixNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLENBQUM7QUFDM0MsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQztBQUVyQyxNQUFNLGdCQUFnQixHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFFN0Msb0RBQW9EO0FBQ3BELDJHQUEyRztBQUMzRyxNQUFNLENBQUMsTUFBTSwyQkFBMkIsR0FBRztJQUN2QyxFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztJQUNoQixFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztJQUNoQixFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztJQUNoQixFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztJQUNoQixFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztJQUNoQixFQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQztDQUNuQixDQUFBO0FBQ0QsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxDQUFBLENBQUUsOERBQThEO0FBQzNHLE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQSxDQUFZLGtEQUFrRDtBQUMvRixNQUFNLENBQUMsTUFBTSx5QkFBeUIsR0FBRyxDQUFDLENBQUEsQ0FBRyw0RkFBNEY7QUFDekksTUFBTSxDQUFDLE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFBO0FBRXRDLE1BQU0sQ0FBQyxNQUFNLDRCQUE0QixHQUFHLENBQUMsQ0FBQSxDQUFHLHdFQUF3RTtBQUN4SCxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyxHQUFHLENBQUEsQ0FBQyw2RUFBNkU7QUFFOUgsTUFBTSxrQ0FBa0MsR0FBRyxDQUFDLENBQUEsQ0FBQyx3RkFBd0Y7QUFFckksTUFBTSx3QkFBd0IsR0FBRyxHQUFHLENBQUEsQ0FBQyw2RUFBNkU7QUFDbEgsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBQ25DLE1BQU0sd0JBQXdCLEdBQUcsR0FBRyxDQUFBO0FBRXBDLE1BQU0sVUFBVSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUE7QUFDOUUsTUFBTSxjQUFjLEdBQUcsSUFBSSx5QkFBeUIsRUFBRSxDQUFBO0FBQ3RELE1BQU0sVUFBVSxHQUFHLElBQUksYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBRWhELGdCQUFnQjtBQUNoQixNQUFNLE9BQU8sUUFBUTtJQUdqQixpQkFBaUIsQ0FBTTtJQUV2Qjs7Ozs7Ozs7T0FRRztJQUNILFlBQVksT0FBTyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsaUJBQXdCO1FBRXhGLFNBQVMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQTtRQUNqQyxTQUFTLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQTtRQUN0QixLQUFLLEdBQUcsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUE7UUFFdEUsY0FBYztRQUNkLElBQUksQ0FBQyxPQUFPLEdBQWMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUE7UUFDbEQsSUFBSSxDQUFDLE9BQU8sR0FBYyxPQUFPLENBQUE7UUFDakMsSUFBSSxDQUFDLEVBQUUsR0FBbUIsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFBO1FBQ3hDLElBQUksQ0FBQyxJQUFJLEdBQWlCLElBQUksQ0FBQTtRQUU5QixFQUFFO1FBQ0YsSUFBSSxDQUFDLGlCQUFpQixHQUFJLGlCQUFpQixDQUFBO1FBQzNDLElBQUksQ0FBQyxjQUFjLEdBQU8sY0FBYyxDQUFBO1FBQ3hDLElBQUksQ0FBQyxLQUFLLEdBQWdCLEtBQUssQ0FBQTtRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFhLEtBQUssQ0FBQTtRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFhLEtBQUssQ0FBQTtRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFhLFNBQVMsQ0FBQTtRQUNuQyxJQUFJLENBQUMsSUFBSSxHQUFpQixLQUFLLENBQUE7UUFDL0IsSUFBSSxDQUFDLFNBQVMsR0FBWSxJQUFJLENBQUE7UUFDOUIsSUFBSSxDQUFDLGFBQWEsR0FBUSxJQUFJLENBQUE7UUFDOUIsSUFBSSxDQUFDLElBQUksR0FBaUIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUNoRCxLQUFLLENBQUMsQ0FBQyxFQUNQLEtBQUssQ0FBQyxDQUFDLEVBQ1AsS0FBSyxDQUFDLENBQUMsRUFDUCxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQ2pCLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFDakIsS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUNwQixDQUFBO1FBQzdCLElBQUksQ0FBQyxpQkFBaUIsR0FBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUE7UUFFNUUsU0FBUztRQUNULElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFdkMsQ0FBQztJQUVELElBQUksU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQSxDQUFDLENBQUM7SUFFdEU7O09BRUc7SUFDSCxJQUFJLEdBQUc7UUFDSCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQTtJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLFNBQVM7UUFDVCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxjQUFjO1FBQ2QsT0FBTyxJQUFJLENBQUMsUUFBUTthQUNmLEtBQUssRUFBRTthQUNQLE9BQU8sQ0FDSixZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUMsQ0FDeEMsQ0FBQTtJQUNULENBQUM7SUFFRCxTQUFTLEtBQUksQ0FBQztJQUVkOzs7O09BSUc7SUFDSCxRQUFRLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxRQUFRO1FBQ2pDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQTtJQUNwQixDQUFDO0lBRUQsSUFBSSxDQUFDLE9BQW9CLEVBQUUsS0FBdUIsRUFBRSxxQkFBcUIsR0FBRyxJQUFJO1FBQzVFLHdEQUF3RDtRQUN4RCw4RUFBOEU7UUFDOUUsZ0lBQWdJO1FBQ2hJLElBQUcscUJBQXFCLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsWUFBWSxFQUFFO1lBQy9ELE1BQU0sTUFBTSxHQUFHLENBQUMsQ0FBQTtZQUNoQixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUEsQ0FBQywyS0FBMks7WUFDekwsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUE7WUFDOUUsTUFBTSxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtZQUMxRCxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUE7WUFDckQsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQTtTQUM1RDtRQUVELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLGFBQWEsQ0FBQTtRQUNqRixJQUFJLGFBQWEsRUFBRTtZQUNmLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsYUFBYSxDQUFDLENBQUE7U0FDcEQ7SUFDTCxDQUFDO0lBRUQsZ0JBQWdCLENBQUMsS0FBdUI7UUFDcEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQTtRQUM1QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFBO1FBQ3BELE1BQU0sVUFBVSxHQUFHLElBQUkseUJBQXlCLEVBQUUsQ0FBQTtRQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDekMsTUFBTSxVQUFVLEdBQUcsSUFBSSx5QkFBeUIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQTtRQUMxRSxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLENBQUE7UUFDdEUsbUVBQW1FO1FBQ25FLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFBO1FBQ3BFLE1BQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQTtRQUVsRSxpQ0FBaUM7UUFDakMsTUFBTSx5QkFBeUIsR0FBRyxVQUFVLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLENBQUE7UUFDOUUsTUFBTSxtQkFBbUIsR0FBRywrQ0FBK0MsQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLHlCQUF5QixDQUFDLENBQUE7UUFDMUgsTUFBTSxpQkFBaUIsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUE7UUFDcEUsSUFBSSxpQkFBaUIsSUFBSSxTQUFTLENBQUMsS0FBSyxFQUFFO1lBQ3RDLE9BQU0sQ0FBQywyQkFBMkI7U0FDckM7UUFFRCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQTtRQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLE1BQU0sRUFBRSxDQUFBO1FBQzdCLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFBO1FBQ3hDLE1BQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUE7UUFDdkQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUE7UUFDdEMsTUFBTSxjQUFjLEdBQUcsQ0FBQyxHQUFHLHdCQUF3QixDQUFBO1FBQ25ELE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsQ0FBQTtRQUNyRCxLQUFJLElBQUksRUFBRSxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUU7WUFDMUQsS0FBSSxJQUFJLEVBQUUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLEVBQUUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFO2dCQUMxRCxVQUFVLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUE7Z0JBQ3hDLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFBLENBQUMsK0JBQStCO2dCQUM3RixrRkFBa0Y7Z0JBQ2xGLDBDQUEwQztnQkFDMUMsSUFBSSxRQUFRLEVBQUU7b0JBQ1Ysb0VBQW9FO29CQUNwRSxNQUFNLGVBQWUsR0FBRyxFQUFFLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQTtvQkFDNUMsTUFBTSxlQUFlLEdBQUcsRUFBRSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUE7b0JBQzVDLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxHQUFHLGVBQWUsR0FBRyxlQUFlLENBQUMsR0FBRyxLQUFLLENBQUE7b0JBQ3BILE1BQU0sVUFBVSxHQUFHLFlBQVksR0FBRyxtQkFBbUIsQ0FBQTtvQkFDckQsTUFBTSxjQUFjLEdBQUcsYUFBYSxDQUFDLENBQUMsR0FBRyxlQUFlLEdBQUcsVUFBVSxDQUFBO29CQUNyRSxNQUFNLGNBQWMsR0FBRyxhQUFhLENBQUMsQ0FBQyxHQUFHLGVBQWUsR0FBRyxVQUFVLENBQUE7b0JBQ3JFLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQTtvQkFDckQsTUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFBO29CQUNyRCwrRUFBK0U7b0JBQy9FLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQyxjQUFjLEdBQUcsb0JBQW9CLEVBQUUsY0FBYyxHQUFHLG9CQUFvQixDQUFDLENBQUE7b0JBQ2pHLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssR0FBRyx3QkFBd0IsQ0FBQyxDQUFDLENBQUEsQ0FBQyxvQ0FBb0M7b0JBQ3hHLEtBQUssR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsd0JBQXdCLENBQUEsQ0FBQyxpQ0FBaUM7b0JBQ3RGLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUE7aUJBQzNDO2dCQUNELE1BQU0sTUFBTSxHQUFHLDJCQUEyQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUE7Z0JBQ2pGLElBQUksQ0FBQyxNQUFNLEVBQUU7b0JBQ1QsU0FBUTtpQkFDWDtnQkFDRCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQTtnQkFDaEQsTUFBTSxJQUFJLEdBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFBO2dCQUN2QyxpQkFBaUI7Z0JBQ2pCLE1BQU0sS0FBSyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQTtnQkFDekIsTUFBTSxVQUFVLEdBQUcsS0FBSyxHQUFHLENBQUMsQ0FBQTtnQkFDNUIsSUFBSSxhQUFhLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQTtnQkFDeEQsaUJBQWlCO2dCQUNqQixNQUFNLG1CQUFtQixHQUFHLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUE7Z0JBQ2pFLE1BQU0saUJBQWlCLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFBO2dCQUNwRSxNQUFNLEtBQUssR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO2dCQUN4RixNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLENBQUE7Z0JBQ3pFLDBHQUEwRztnQkFDMUcsSUFBSSxtQkFBbUIsR0FBRyxDQUFDLElBQUkscUZBQXFGO29CQUNoSCxVQUFVLEdBQUcsYUFBYSxJQUFNLDZDQUE2QztvQkFDN0UsNERBQTREO29CQUM1RCxVQUFVLElBQUksaUJBQWlCLEdBQUcsa0NBQWtDLEVBQ3RFO29CQUNFLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7b0JBQ3JGLE1BQU0sY0FBYyxHQUFHLFlBQVksRUFBRSxRQUFRLENBQUE7b0JBQzdDLElBQUksY0FBYyxFQUFFO3dCQUNoQix3REFBd0Q7d0JBQ3hELE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUE7d0JBQzVDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxjQUFjLENBQUMsQ0FBQTt3QkFDbEQ7Ozs7Ozs7Ozs7Ozs7MEJBYUU7d0JBQ0YsYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQSxDQUFDLG9DQUFvQztxQkFDMUY7aUJBQ0o7Z0JBQ0QsK0NBQStDO2dCQUMvQyxLQUFJLElBQUksQ0FBQyxHQUFHLGFBQWEsRUFBRSxDQUFDLEdBQUcsYUFBYSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUMvQyxNQUFNLEVBQUUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFBO29CQUNuQyxLQUFLLENBQUMsOEJBQThCLENBQUMsV0FBVyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUE7aUJBQ3RGO2dCQUNELDhDQUE4QztnQkFDOUMsSUFBSSxhQUFhLEdBQUcsS0FBSyxJQUFJLHlFQUF5RTtvQkFDbEcsYUFBYSxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsS0FBSyxDQUFDLGlEQUFpRDtrQkFDeEY7b0JBQ0UsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLENBQUE7b0JBQy9ELEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLEVBQUUsY0FBYyxFQUFFLEVBQUUsQ0FBQyxDQUFBO2lCQUN0RDthQUNKO1NBQ0o7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxzQkFBc0IsQ0FBQyxLQUF1QixFQUFFLGFBQTRCO1FBQ3hFLE1BQU0sVUFBVSxHQUFHLElBQUkseUJBQXlCLEVBQUUsQ0FBQTtRQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUE7UUFDekMsTUFBTSxVQUFVLEdBQUcsSUFBSSx5QkFBeUIsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQTtRQUMxRSxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLENBQUE7UUFDdEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQTtRQUN4QixLQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQ3hDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsY0FBYyxDQUFDLEtBQUssRUFDMUMsY0FBYyxDQUFDLEtBQUssRUFBRSxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQzdDO1lBQ0UsSUFBSSxDQUFDLEdBQUcsY0FBYyxDQUFDLEtBQUssRUFBRTtnQkFDMUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtnQkFDcEIsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUE7Z0JBQzlCLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO2FBQ25EO1NBQ0o7SUFDTCxDQUFDO0lBRUQsSUFBSSxDQUFDLENBQU87UUFFUixJQUFHLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUN2QixDQUFDLElBQUksQ0FBQyxDQUFBLENBQUMsb0NBQW9DO1NBQzlDO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtRQUM3QyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBYSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtRQUV2RCxNQUFNLE1BQU0sR0FBYSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUE7UUFFM0gsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsb0JBQW9CLENBQUE7UUFDL0QsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQVUsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFBO1FBRWpELElBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQ3ZCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxDQUFDLG9DQUFvQztZQUNyRixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFBO1NBQ2xDO0lBRUwsQ0FBQztJQUVELE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQyxLQUFhO1FBQ25DLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNoQixLQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUNsQyxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7WUFDbEIsS0FBSSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQ2xDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtnQkFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFDLElBQUksRUFBRSxFQUFDLENBQUMsRUFBRSxDQUFDLEVBQUMsRUFBQyxDQUFDLENBQUE7YUFDNUI7U0FDSjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxVQUFVLENBQUMsaUJBQWlGLEVBQUUsS0FBYSxFQUFFLElBQVksRUFBRSxRQUFnQixFQUFFLGNBQW1CO1FBRW5LLE1BQU0sWUFBWSxHQUFHLENBQUMsQ0FBQSxDQUFDLGtCQUFrQjtRQUV6QyxpQkFBaUI7UUFDakIsK0RBQStEO1FBRS9ELHdDQUF3QztRQUN4QyxJQUFJLE9BQU8sR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzdDLHNDQUFzQztRQUN0QyxJQUFJLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyRCwyQkFBMkI7UUFDM0IsSUFBSSxjQUFjLEdBQUcsSUFBSSxNQUFNLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxJQUFJLGdCQUFnQixDQUFDLENBQUM7UUFFakYsSUFBSSxjQUFjLEVBQUU7WUFDaEIsd0NBQXdDO1lBQ3hDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN6QyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDN0MsSUFBSSxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUM7Z0JBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzNDLElBQUksV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQztZQUMzQyx5Q0FBeUM7WUFDekMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxJQUFJLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQzlFO1FBRUQsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQztRQUNwRCxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBRXBELDhDQUE4QztRQUM5QyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEMsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssQ0FBQyxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDNUIsS0FBSyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUU3QixJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELFdBQVc7UUFDUCxNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7UUFDaEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUNwQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUE7UUFDdkYsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFBO1FBQ3BDLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7UUFDdEIsS0FBSyxDQUFDLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFBO1FBQ3BDLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBQ3RLLENBQUM7SUFFRDs7O09BR0c7SUFDSCxtQkFBbUI7UUFDZixJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUN4QixJQUFJLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFBO1lBQ2hDLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUE7U0FDaEc7UUFDRCxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQTtJQUNqQyxDQUFDO0lBRUQscUJBQXFCO0lBQ3JCLFNBQVMsQ0FBQyxHQUFZO1FBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDeEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDdkIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDOUIsQ0FBQztJQUVELFdBQVcsQ0FBQyxHQUFZO1FBRXBCLE9BQU87UUFDUCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQTtRQUNsQyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQTtRQUNsQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQTtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUE7UUFFNUIsUUFBUTtRQUNSLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO1FBQ2pDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFBO1FBRTNCLFdBQVc7UUFDWCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtRQUN2QyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQzVDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLGVBQWUsQ0FBQTtJQUVyQyxDQUFDO0lBRUQsUUFBUSxDQUFDLEdBQVk7UUFDakIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLHFCQUFxQjtRQUM1QyxNQUFNLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQy9GLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDMUIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsUUFBUSxDQUFDLEtBQUssRUFBRSxJQUFJO1FBQ2hCLElBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksUUFBUSxFQUFFO1lBQzVCLE9BQU8sS0FBSyxDQUFDO1NBQ2hCO1FBQ0QsK0VBQStFO1FBQy9FLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQTtRQUNkLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQTtRQUMxQixLQUFJLElBQUksUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLEVBQUU7WUFDdEQsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM5QyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNmLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEMsSUFBRyxZQUFZLEVBQUU7Z0JBQ2Isc0JBQXNCO2dCQUN0QixJQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRTtvQkFDdkIsMENBQTBDO29CQUMxQyxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDdkU7Z0JBQ0QsTUFBTSxVQUFVLEdBQU0sUUFBUSxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzlELE1BQU0sVUFBVSxHQUFNLFFBQVEsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO2dCQUM5RCxNQUFNLElBQUksR0FBWSxZQUFZLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDbkUsSUFBRyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sRUFBRTtvQkFDckIsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUE7b0JBQ3BCLGNBQWMsR0FBRyxJQUFJLENBQUE7aUJBQ3hCO2FBQ0o7U0FDSjtRQUNELElBQUcsY0FBYyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFO1lBQ3hHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO1lBQ3JCLElBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUNaLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTthQUMxQjtZQUNELE9BQU8sSUFBSSxDQUFBO1NBQ2Q7UUFDRCxPQUFPLEtBQUssQ0FBQTtJQUNoQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFdBQXVDLEVBQUUsV0FBb0I7UUFDckUsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUE7SUFDcEcsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxXQUFzQztRQUM5QyxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFBO0lBQ25GLENBQUM7Q0FFSiJ9