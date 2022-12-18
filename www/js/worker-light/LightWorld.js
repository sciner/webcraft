import {VectorCollector, Vector, ArrayHelpers, Mth} from '../helpers.js';
import {BaseChunk} from '../core/BaseChunk.js';
import {
    OFFSET_DAY,
    DEFAULT_LIGHT_DAY_DISPERSE,
    maxPotential,
    dlen,
    adjustSrc,
    OFFSET_LIGHT,
    OFFSET_SOURCE, MASK_SRC_AO, MASK_SRC_REST, maxLight, DISPERSE_MIN,
    GROUND_ESTIMATION_MIN_DIST, GROUND_ESTIMATION_MAX_DIST, GROUND_ESTIMATION_COLUMN_CENTER_MAX_DIST_SQR,
    GROUND_ESTIMATION_FAR_BIAS, GROUND_ESTIMATION_FAR_BIAS_MIN_DIST, GROUND_BUCKET_SIZE
} from "./LightConst.js";
import {LightQueue} from "./LightQueue.js";
import {DirNibbleQueue} from "./DirNibbleQueue.js";

const MIN_LIGHT_Y_MIN_PERCENT = 0.05;
const MIN_LIGHT_Y_MAX_PERCENT = 0.15;

export class ChunkManager {
    constructor(world) {
        this.chunks = new VectorCollector();
        this.list = [];

        this.world = world;
        const INF = 1000000000;
        this.lightBase = new BaseChunk({size: new Vector(INF, INF, INF)}).setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
        this.chunkById = [null];
        this.activePotentialCenter = null;
        this.nextPotentialCenter = null;
        this.prevGroundLevelPlayerPos = null;
        this.columns = new Map();
        this.minLightYDirty = false;
    }

    // Get
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    add(chunk) {
        this.list.push(chunk);
        this.chunks.add(chunk.addr, chunk);
        this.lightBase.addSub(chunk.lightChunk);

        this.chunkById[chunk.dataId] = chunk;

        var column = this.columns.get(chunk.xzKey);
        if (column == null) {
            column = {
                chunks: [],
                minLightY: chunk.minLightY.map(function (it) { return {
                    x: it.x,
                    z: it.z,
                    key: it.key,
                    y: Infinity,
                    distSqr: 0
                }}),
                minLightYDirty: false, // it'll become dirty when the light is calculated
                centerX: chunk.pos.x + chunk.size.x / 2,
                centerZ: chunk.pos.z + chunk.size.z / 2,
            };
            this.columns.set(chunk.xzKey, column);
        }
        column.chunks.push(chunk);
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.chunkById[chunk.dataId] = null;
            this.list.splice(this.list.indexOf(chunk), 1);
            this.lightBase.removeSub(chunk.lightChunk);
            
            // remove the column and/or the chunk from the colum
            const column = this.columns.get(chunk.xzKey);
            ArrayHelpers.fastDeleteValue(column.chunks, chunk);
            if (column.chunks.length) {
                // if this chunk had one of the minimums in the colum, make minLightY dirty
                if (chunk.hasMinLightY) {
                    for (var i = 0; i < chunk.minLightY.length; i++) {
                        const y = chunk.minLightY[i].y;
                        if (y !== Infinity && y === column.minLightY[i].y) {
                            column.minLightYDirty = true;
                            this.minLightYDirty = true;
                            break;
                        }
                    }
                }
            } else {
                delete this.columns.delete(chunk.xzKey);
                this.minLightYDirty |= chunk.hasMinLightY;
            }
        }
    }

    // How may cunks from this colums must have their minLightY calculated
    // before we can use the column.
    countMissingInColumn(column) {
        for (let i = 0; i < column.minLightY.length; i++) {
            if (column.minLightY[i] != Infinity) {
                return 0;
            }
        }
        return ArrayHelpers.sum(column.chunks, (it) => it.hasMinLightY ? 0 : 1);
    }

    columnsIsFarAway(column) {
        const playerPos = this.nextPotentialCenter;
        if (!playerPos) {
            return true;
        }
        return (column.centerX - playerPos.x) * (column.centerX - playerPos.x) +
            (column.centerZ - playerPos.z) * (column.centerZ - playerPos.z) >
            GROUND_ESTIMATION_COLUMN_CENTER_MAX_DIST_SQR;
    }
}

export class LightWorld {
    constructor() {
        this.chunkManager = new ChunkManager(this);
        this.light = new LightQueue(this, {offset: 0, dirCount: 6});
        this.dayLight = new LightQueue(this,
            {
                offset: OFFSET_DAY - 1,
                dirCount: 6,
                nibbleSource: true,
            });
        //this.dayLight.deque.debugName = 'DayLight';
        this.dayLightSrc = new DirNibbleQueue(this, {
            offset: OFFSET_DAY,
            disperse: DISPERSE_MIN, //DEFAULT_LIGHT_DAY_DISPERSE
        })
        //this.dayLightSrc.waves.debugName = 'DayLightSrc';
        this.defDayLight = adjustSrc(15);
        this.isEmptyQueue = true;
    }

    getPotential(wx, wy, wz) {
        const {activePotentialCenter} = this.chunkManager;
        if (!activePotentialCenter) {
            return 0;
        }
        const dist = (Math.abs(wx - activePotentialCenter.x)
            + Math.abs(wy - activePotentialCenter.y)
            + Math.abs(wz - activePotentialCenter.z)) * dlen[0];
        return maxPotential - Math.min(maxPotential, dist);
    }

    checkPotential() {
        if (this.isEmptyQueue && this.chunkManager.nextPotentialCenter) {
            this.chunkManager.activePotentialCenter = this.chunkManager.nextPotentialCenter;
        }
        // if the player moved far enough, update the ground level estimation
        this.chunkManager.minLightYDirty |=
            this.prevGroundLevelPlayerPos
            ? this.prevGroundLevelPlayerPos.distance(this.chunkManager.nextPotentialCenter) > GROUND_BUCKET_SIZE
            : true;
    }

    setChunkBlock({addr, list}) {
        let chunk = this.chunkManager.getChunk(addr);
        if (!chunk) {
            return;
        }
        const {lightChunk} = chunk;
        const {portals, uint8View, strideBytes} = lightChunk;
        for (let j = 0; j < list.length; j += 4) {
            const x = list[j] + lightChunk.pos.x;
            const y = list[j + 1] + lightChunk.pos.y;
            const z = list[j + 2] + lightChunk.pos.z;
            const light_source = list[j + 3];
            const ind = lightChunk.indexByWorld(x, y, z);
            const light = uint8View[ind * strideBytes + OFFSET_LIGHT];
            const src = adjustSrc(light_source);
            const old_src = uint8View[ind * strideBytes + OFFSET_SOURCE];
            uint8View[ind * strideBytes + OFFSET_SOURCE] = src;
            const potential = this.getPotential(x, y, z);
            this.light.add(chunk, ind, Math.max(light, src), potential);
            // push ao
            const setAo = ((src & MASK_SRC_AO) !== (old_src & MASK_SRC_AO));
            //TODO: move it to adjust func
            if ((src & MASK_SRC_REST) !== (old_src & MASK_SRC_REST)) {
                this.dayLightSrc.addWithChange(chunk, ind);
                this.dayLight.add(chunk, ind, this.defDayLight, potential);
            }
            for (let i = 0; i < portals.length; i++) {
                const portal = portals[i];
                if (portal.aabb.contains(x, y, z)) {
                    const other = portal.toRegion;
                    const ind = other.indexByWorld(x, y, z);
                    other.setUint8ByInd(ind, OFFSET_SOURCE, src)
                    if (setAo) {
                        other.rev.lastID++;
                    }
                }
            }
        }
    }

    estimateGroundLevel() {
        const playerPos = this.chunkManager.nextPotentialCenter;
        if (!playerPos) {
            return;
        }
        const columns = this.chunkManager.columns;
        const maxDistSqr = GROUND_ESTIMATION_MAX_DIST * GROUND_ESTIMATION_MAX_DIST;
        const biasMaxDist = GROUND_ESTIMATION_MAX_DIST - GROUND_ESTIMATION_FAR_BIAS_MIN_DIST;
        const biasMaxDistSqr = biasMaxDist * biasMaxDist;
        const byDist = [];
        // For each (X, Z) bucket, collect known values of lowest light Y
        for(let column of columns.values()) {
            if (this.chunkManager.countMissingInColumn(column) ||
                this.chunkManager.columnsIsFarAway(column)
            ) {
                continue;
            }
            // update dirty columns that
            if (column.minLightYDirty) {
                column.minLightY.forEach((v) => { v.y = Infinity; });
                for(var i = 0; i < column.chunks.length; i++) {
                    const chunk = column.chunks[i];
                    if (chunk.hasMinLightY) {
                        for(var j = 0; j < chunk.minLightY.length; j++) {
                            const y = chunk.minLightY[j].y;
                            if (column.minLightY[j].y > y) {
                                column.minLightY[j].y = y;
                            }
                        }
                    }
                }
                column.minLightYDirty = false;
            }
            // calculate the distances to the player, apply dustance bias, collect into the array
            column.minLightY.forEach((v) => { 
                v.distSqr = (v.x - playerPos.x) * (v.x - playerPos.x) +
                    (v.z - playerPos.z) * (v.z - playerPos.z);
                if (v.distSqr <= maxDistSqr) {
                    // Don't apply the bias closer than GROUND_BUCKET_SIZE.
                    // Beyound the threshold, bias rises quadratically - slow, then fast.
                    const distBeyoundThreshold = Math.max(0, Math.sqrt(v.distSqr) - GROUND_ESTIMATION_FAR_BIAS_MIN_DIST);
                    v.biasedY = v.y + 
                        distBeyoundThreshold * distBeyoundThreshold / biasMaxDistSqr * GROUND_ESTIMATION_FAR_BIAS;
                    byDist.push(v);
                }
            });
        }
        byDist.sort((a, b) => a.distSqr - b.distSqr);
        // look at the surface at 5 different scales, to account for small nearby and big far-away changes
        var groundLevel = Infinity;
        const list = [];
        const multiplier = Math.sqrt(Math.sqrt(GROUND_ESTIMATION_MAX_DIST / GROUND_ESTIMATION_MIN_DIST));
        for(var radius = GROUND_ESTIMATION_MIN_DIST; radius <= GROUND_ESTIMATION_MAX_DIST + 1; radius *= multiplier) {
            // select close enough points
            const maxDistSqr = radius * radius;
            list.length = 0;
            var i = 0;
            while (i < byDist.length && byDist[i].distSqr <= maxDistSqr) {
                list.push(byDist[i++].biasedY);
            }
            if (list.length === 0) {
                continue;
            }
            // select the average Y from the MIN_LIGHT_Y_MIN_PERCENT..MIN_LIGHT_Y_MAX_PERCENT of values
            var minInd = Math.round((list.length - 1) * MIN_LIGHT_Y_MIN_PERCENT);
            var maxInd = Math.round((list.length - 1) * MIN_LIGHT_Y_MAX_PERCENT);
            ArrayHelpers.partialSort(list, maxInd + 1, (a, b) => a - b);
            var sum = 0;
            for(var i = minInd; i <= maxInd; i++) {
                sum += list[i];
            }
            const level = sum / (maxInd - minInd + 1);
            groundLevel = Math.min(groundLevel, level);
        }
        this.chunkManager.minLightYDirty = false;
        this.prevGroundLevelPlayerPos = playerPos;
        worker.postMessage(['ground_level_estimated', groundLevel]);
    }
}
