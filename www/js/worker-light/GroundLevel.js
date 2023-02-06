import { ArrayHelpers } from '../helpers.js';
import { CHUNK_SIZE_X } from "../chunk_const.js";
import { MASK_SRC_BLOCK, OFFSET_SOURCE } from "./LightConst.js";

const GROUND_SKIP_CHUNKS = 10; // If queue is not empty, update ground level once per N chunks

const GROUND_STRIDE = 2;   // we fin minY not in each column
const GROUND_BUCKET_SIZE = 8; // we store one minY per bucket

const GROUND_ESTIMATION_MIN_DIST = GROUND_BUCKET_SIZE * 2;
const GROUND_ESTIMATION_MAX_DIST = 75;
// points far away from the player are "rised up" by up to this amount, making them matter less
const GROUND_ESTIMATION_FAR_BIAS = 12;
const GROUND_ESTIMATION_FAR_BIAS_MIN_DIST = 40;

const GROUND_BUCKET_MIN_PERCENT = 0.05;
const GROUND_BUCKET_MAX_PERCENT = 0.15;

// derived consts
const GROUND_ESTIMATION_COLUMN_CENTER_MAX_DIST_SQR =
    (GROUND_ESTIMATION_MAX_DIST + CHUNK_SIZE_X / 2) * (GROUND_ESTIMATION_MAX_DIST + CHUNK_SIZE_X / 2);

export class ChunkGroundLevel {

    constructor(chunk) {
        this.chunk = chunk;
        this.worldGroundLevel = chunk.world.groundLevel;

        this.dayID = 0;
        this.minLightY = [];
        for(let z = 0; z < chunk.size.z; z += GROUND_BUCKET_SIZE) {
            for(let x = 0; x < chunk.size.x; x += GROUND_BUCKET_SIZE) {
                const wx = chunk.pos.x + x + GROUND_BUCKET_SIZE / 2 | 0;
                const wz = chunk.pos.z + z + GROUND_BUCKET_SIZE / 2 | 0;
                this.minLightY.push({
                    x: wx,
                    z: wz,
                    key: wx.toString() + ' ' + wz,
                    y: Infinity,
                    oldY: Infinity
                });
            }
        }
        this.hasMinLightY = false;
        this.xzKey = chunk.addr.x.toString() + '_' + chunk.addr.z;
    }

    check() {
        if (this.dayID === this.chunk.calc.dayID) {
            return false;
        }
        this.dayID = this.chunk.calc.dayID;
        this.calcMinLightY();
        return true;
    }

    calcMinLightY() {
        const chunk = this.chunk;
        const {outerSize, size, lightChunk} = chunk;
        const {lightData} = chunk.calc;

        // strides for chunk.lightResult
        const rsx = 1;
        const rsz = rsx * outerSize.x;
        const rsy = rsz * outerSize.z;

        // strides for lightChunk.uint8View
        const {uint8View, strideBytes, padding} = lightChunk;
        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;

        // strides for this.minLightY
        const szBucket = size.x / GROUND_BUCKET_SIZE | 0;

        function isDryLit(ind, indUint8View) {
            const hasLight = (lightData[ind] & 0xF0) !== 0;
            return hasLight && (uint8View[indUint8View + OFFSET_SOURCE] & MASK_SRC_BLOCK) === 0;
        }

        for(let i = 0; i < this.minLightY.length; i++) {
            this.minLightY[i].y = Infinity;
        }
        // for each column
        for (let z = padding; z < outerSize.z - padding; z += GROUND_STRIDE) {
            for (let x = padding; x < outerSize.x - padding; x += GROUND_STRIDE) {
                const base = x * rsx + z * rsz;
                const baseUint8View = sx * x + sz * z;
                // find the lowest lit block
                var bestY = Infinity;
                // we start from (padding + 1), so we can then look at (y - 1)
                for(let y = padding + 1; y < outerSize.y - padding; y += 2) {
                    var ind = base + y * rsy;
                    var indUint8View = baseUint8View + sy * y;
                    if (isDryLit(ind, indUint8View)) {
                        // improve Y accuracy to 1 block
                        if (isDryLit(ind - rsy, indUint8View - sy)) {
                            y--;
                        }
                        // we found it!
                        bestY = chunk.pos.y + y - padding;
                        break;
                    }
                }
                // save it in the bucket
                const outInd = (x / GROUND_BUCKET_SIZE | 0) + (z / GROUND_BUCKET_SIZE | 0) * szBucket;
                if (this.minLightY[outInd].y > bestY) {
                    this.minLightY[outInd].y = bestY;
                }
            }
        }
        // check if this chunk may affect the column
        const column = this.worldGroundLevel.columns.get(this.xzKey);
        const isCloseEnough = !this.worldGroundLevel.columnsIsFarAway(column);
        const lastChunkMising = (this.worldGroundLevel.countMissingInColumn(column) === 1);
        for (var i = 0; i < this.minLightY.length; i++) {
            const v = this.minLightY[i];
            if (lastChunkMising ||
                v.y < column.minLightY[i].y ||
                v.y !== v.oldY && v.oldY === column.minLightY[i].y
            ) {
                column.minLightYDirty = true;
                this.worldGroundLevel.minLightYDirty |= isCloseEnough;
            }
            v.oldY = v.y;
        }
        this.hasMinLightY = true;
    }
}

export class WorldGroundLevel {

    constructor(world) {
        this.world = world;
        this.chunkManager = world.chunkManager;

        this.groundLevelSkipCounter = 0;
        this.prevGroundLevelPlayerPos = null;
        this.columns = new Map();
        this.minLightYDirty = false;
    }

    onAddChunk(chunk) {
        var column = this.columns.get(chunk.groundLevel.xzKey);
        if (column == null) {
            column = {
                chunks: [],
                minLightY: chunk.groundLevel.minLightY.map(function (it) { return {
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
            this.columns.set(chunk.groundLevel.xzKey, column);
        }
        column.chunks.push(chunk);
    }

    // remove the column and/or the chunk from the colum
    onDeleteChunk(chunk) {
        const gl = chunk.groundLevel;
        const column = this.columns.get(gl.xzKey);
        ArrayHelpers.fastDeleteValue(column.chunks, chunk);
        if (column.chunks.length) {
            // if this chunk had one of the minimums in the colum, make minLightY dirty
            if (gl.hasMinLightY) {
                for (var i = 0; i < gl.minLightY.length; i++) {
                    const y = gl.minLightY[i].y;
                    if (y !== Infinity && y === column.minLightY[i].y) {
                        column.minLightYDirty = true;
                        this.minLightYDirty = true;
                        break;
                    }
                }
            }
        } else {
            delete this.columns.delete(gl.xzKey);
            this.minLightYDirty |= gl.hasMinLightY;
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
        const playerPos = this.chunkManager.nextPotentialCenter;
        if (!playerPos) {
            return true;
        }
        return (column.centerX - playerPos.x) * (column.centerX - playerPos.x) +
            (column.centerZ - playerPos.z) * (column.centerZ - playerPos.z) >
            GROUND_ESTIMATION_COLUMN_CENTER_MAX_DIST_SQR;
    }

    onCheckPotential() {
        // if the player moved far enough, update the ground level estimation
        if (!this.prevGroundLevelPlayerPos ||
            this.prevGroundLevelPlayerPos.distance(this.chunkManager.nextPotentialCenter) > GROUND_BUCKET_SIZE
        ) {
            this.minLightYDirty = true;
        }
    }

    estimateIfNecessary() {
        const playerPos = this.chunkManager.nextPotentialCenter;
        if (playerPos && this.minLightYDirty) {
            this.groundLevelSkipCounter = (this.groundLevelSkipCounter + 1) % GROUND_SKIP_CHUNKS;
            if (this.world.isEmptyQueue || this.groundLevelSkipCounter === 0) {
                this.estimate(playerPos);
                this.groundLevelSkipCounter = 0;
            }
        }
    }

    estimate(playerPos) {
        const columns = this.columns;
        const maxDistSqr = GROUND_ESTIMATION_MAX_DIST * GROUND_ESTIMATION_MAX_DIST;
        const biasMinusSqr = GROUND_ESTIMATION_FAR_BIAS_MIN_DIST * GROUND_ESTIMATION_FAR_BIAS_MIN_DIST;
        const biasDistSqrMultiplier = GROUND_ESTIMATION_FAR_BIAS /
            (GROUND_ESTIMATION_MAX_DIST * GROUND_ESTIMATION_MAX_DIST - biasMinusSqr);
        const byDist = [];
        // For each (X, Z) bucket, collect known values of lowest light Y
        for(let column of columns.values()) {
            if (this.countMissingInColumn(column) ||
                this.columnsIsFarAway(column)
            ) {
                continue;
            }
            // update dirty columns that
            if (column.minLightYDirty) {
                column.minLightY.forEach((v) => { v.y = Infinity; });
                for(var i = 0; i < column.chunks.length; i++) {
                    const gl = column.chunks[i].groundLevel;
                    if (gl.hasMinLightY) {
                        for(var j = 0; j < gl.minLightY.length; j++) {
                            const y = gl.minLightY[j].y;
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
                    const distSqrBeyoundThreshold = Math.max(0, v.distSqr - biasMinusSqr);
                    v.biasedY = v.y + distSqrBeyoundThreshold * biasDistSqrMultiplier;
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
            // select the average Y from the GROUND_BUCKET_MIN_PERCENT..GROUND_BUCKET_MAX_PERCENT of values
            var minInd = Math.round((list.length - 1) * GROUND_BUCKET_MIN_PERCENT);
            var maxInd = Math.round((list.length - 1) * GROUND_BUCKET_MAX_PERCENT);
            ArrayHelpers.partialSort(list, maxInd + 1, (a, b) => a - b);
            var sum = 0;
            for(var i = minInd; i <= maxInd; i++) {
                sum += list[i];
            }
            const level = sum / (maxInd - minInd + 1);
            groundLevel = Math.min(groundLevel, level);
        }
        this.minLightYDirty = false;
        this.prevGroundLevelPlayerPos = playerPos;
        this.world.postMessage(['ground_level_estimated', groundLevel]);
    }
}