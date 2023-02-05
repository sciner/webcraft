import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "./chunk_const.js";
import { getChunkAddr, chunkAddrToCoord, Vector, SimpleShifted3DArray, ArrayHelpers, Mth } from "./helpers.js";
import { VOLUMETRIC_SOUND_TYPES, VOLUMETRIC_SOUND_TYPE_WATER, VOLUMETRIC_SOUND_TYPE_LAVA,
    VOLUMETRIC_SOUND_SECTORS, VOLUMETRIC_SOUND_SECTOR_INDEX_MASK, VOLUMETRIC_SOUND_ANGLE_TO_SECTOR,
    VOLUMETRIC_SOUND_REF_DISTANCE, VOLUMETRIC_SOUND_MAX_DISTANCE,
    VOLUMETRIC_SOUND_DIRTY_BLOCKS_TTL, VOLUMETRIC_SOUND_SUMMARY_VALID_DISTANCE } from "./constant.js";
import { FLUID_WATER_ID, FLUID_LAVA_ID, FLUID_TYPE_MASK } from "./fluid/FluidConst.js";

// How often does it ask FluidWorld for the mising chunks
const PERIODIC_QUERY_MILLIS = 2000

let MAX_LEVEL
// Cell sizes by Y (and only by Y) may start from size bigger than 1.
// Cell size by Y in each next level must be same size size as in the previous, or 2 times bigger.
let CELL_SIZE_Y
/**
 * The size of sound map in chunks.
 * 
 * It must be even. The player always is in one of the 2x2x2 central chunks.
 * It's to handle when a player walks between two neighbouring chunks often.
 */
let SOUND_MAP_CHUNKS_RADIUS_XZ
const SOUND_MAP_CHUNKS_RADIUS_Y = 1 // it's the minimum

// Define fine-tuned constants for different chunk sizes
if (CHUNK_SIZE_X === 16 && CHUNK_SIZE_Y === 40 && CHUNK_SIZE_Z === CHUNK_SIZE_Z) {
    MAX_LEVEL           = 3
    CELL_SIZE_Y         = [8, 8, 8, 8]
    SOUND_MAP_CHUNKS_RADIUS_XZ  = 2
} else {
    throw Error() // choose good values for other sizes manually
}
if (VOLUMETRIC_SOUND_MAX_DISTANCE > (SOUND_MAP_CHUNKS_RADIUS_XZ + 0.5) * CHUNK_SIZE_X * 1.1) {
    throw Error('VOLUMETRIC_SOUND_MAX_DISTANCE is too big')
}

const MAX_SUMMARY_LEVEL     = 2     // (value <= MAX_LEVEL)

// It must be even because the smaller map must cover a whole numer of the bigger map's cells.
// 6 is the minimal size: it covers 1 central cell of the bigger map + 2 side cells
// The top level's size is odd, 1 less than this number.
const SUMMARY_MIP_SIZE_XY   = 6

const SECTOR_TO_ANGLE = 2 * Math.PI / VOLUMETRIC_SOUND_SECTORS
const EPS = 0.000001

const REF_DISTANCE_SQR = VOLUMETRIC_SOUND_REF_DISTANCE * VOLUMETRIC_SOUND_REF_DISTANCE
const MAX_DISTANCE_SQR = VOLUMETRIC_SOUND_MAX_DISTANCE * VOLUMETRIC_SOUND_MAX_DISTANCE
/** The distance squared, from which an additional volume falloff is applied. See {@link falloffExtraFar} */
const MID_DISTANCE_SQR = MAX_DISTANCE_SQR * 0.75 * 0.75

/**
 * Here the volume falls off with the distance squared.
 * But after the final adjustemnts, the volume will fall off inversely to the distance.
 * 
 * The genral idea:
 * - at the end, {@link toVolume} applies sqrt() from the sum of volumes of blocks as a range compresson, so 100 blocks
 *   sound only 10 times louder than 1.
 * - it also turns the previously applied quadratic distance adjustment to linear.
 * 
 * After {@link toVolume} and not counting {@link falloffExtraFar},
 * the result should be identical to PannerNode with
 *  - distanceModel = "inverse"
 *  - refDistance   = {@link VOLUMETRIC_SOUND_REF_DISTANCE}
 *  - rolloffFactor = 1
 * altough the formula is simplified for this particular case.
 * see {@link https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel}
 * 
 * @param {Float} distanceSqr - distance^2 to the sound source
 * @return volume multiplier
 */
function falloffByDistanceSqr(distanceSqr) {
    return REF_DISTANCE_SQR / Math.max(distanceSqr, REF_DISTANCE_SQR)
}

/**
 * @return {Float} falloffByDistanceSqr(distanceSqrFar) / falloffByDistanceSqr(distanceSqrNear),
 *   but it's faster than computing by that formula.
 */
function relativeFalloffByDistanceSqr(distanceSqrNear, distanceSqrFar) {
    return Math.max(distanceSqrNear, REF_DISTANCE_SQR) / Math.max(distanceSqrFar, REF_DISTANCE_SQR)
}

/**
 * The final adjustment to the volume, whih oes dynamic range compression, and changes the
 * how the volume falls off with distance.
 */
function toVolume(sum) {
    return Math.sqrt(sum)
}

/**
 * Starting from some distance, an additional falloff is applied, down to 0 at the max distance.
 * It's to remove "popping" effect when the sounds enter and exit the maximum range.
 */
function falloffExtraFar(distanceSqr) {
    return Mth.lerpAny(distanceSqr, MID_DISTANCE_SQR, 1, MAX_DISTANCE_SQR, 0)
}

// See the comment to VOLUMETRIC_SOUND_SECTOR_BITS
function toSector(x, z) {
    return Math.round(Math.atan2(z, x) * VOLUMETRIC_SOUND_ANGLE_TO_SECTOR) & VOLUMETRIC_SOUND_SECTOR_INDEX_MASK
}

// descriptions of MIP levels
const MIPS = new Array(MAX_LEVEL + 1)

function initMIPS() {
    let cellXZ = 1
    let sizeXZ = CHUNK_SIZE_X
    let strideZ = 2 // [volume, 2 * SUM(y + 0.5)]
    let prevCellY = 1
    for(let level = 0; level <= MAX_LEVEL; level++) {
        const cellY = CELL_SIZE_Y[level]
        const sizeY = CHUNK_SIZE_Y / cellY

        const strideY = strideZ * sizeXZ
        const strideX = strideY * sizeY
        // the upper bounds of the maximum possible element value: sum coordinates (CHUNK_SIZE_Y - 1) multiplied by volume
        const maxValue = cellXZ * cellY * cellXZ * (2 * (CHUNK_SIZE_Y - 1) + 1)

        MIPS[level] = {
            level,
            smaller: MIPS[level - 1],
            cellXZ,
            cellY,
            cellYinv:   1 / cellY,          // we don't compute cellXZinv, because we can use >> level
            dividerY:   cellY / prevCellY,  // we don't compute divisorXZ, it's known to be 1 or 2
            sizeXZ,
            sizeY,
            strideX, strideY, strideZ,
            size: sizeXZ * strideX,
            arrayClass: ArrayHelpers.uintArrayClassForMaxValue(maxValue)
        }
        prevCellY = cellY
        sizeXZ *= 0.5
        cellXZ *= 2
        strideZ = 4 // [volume, 2 * SUM(x + 0.5), 2 * SUM(y + 0.5), 2 * SUM(z + 0.5)]
    }
}
initMIPS()

const MIP0 = MIPS[0]
const MIP_MAX = MIPS[MAX_LEVEL]

/** Used insetad of {@link SoundChunk} until we get the data. */
class SoundChunkPlaceholder {
    
    static queryId = 0

    constructor(x, y, z) {
        this.lastQueryTime = performance.now()
        this.query = {
            x, y, z,
            queryId: ++SoundChunkPlaceholder.queryId
        }
        // If it's true, we don't know the chunk data yet.
        // If it's false, we know that this chunk has no sound data.
        this.waitignForData = true
    }

    addToPeriodicQueiry(queriedChunks) {
        if (this.waitignForData &&
            this.lastQueryTime + PERIODIC_QUERY_MILLIS < performance.now()
        ) {
            this.lastQueryTime = performance.now()
            queriedChunks.push(this.query)
        }
    }
}

/** Contains hierarchical data of sound blocks in one chunk */
class SoundChunk {

    /**
     * @param {Vector} addr
     * @param {Int} queryId it stays the same for {@link SoundChunkPlaceholder} and the chunk
     *   created on its place. But it'll be diferent after the chunk is forgotten aand a new
     *   placeholder is created. It's used to skip diffs that come to a previous instance of this chunk.
     */
    constructor(addr, queryId) {
        this.queryId = queryId
        this.coord = new Vector()
        chunkAddrToCoord(addr, this.coord)

        // for each block index (non-flat), type of the sound block
        this.byIndex = new Map()
        // for each mip level, 3D array. Each cell is described by a groups of comsecutive elements
        this.mipsByType = new Array(VOLUMETRIC_SOUND_TYPES)
    }

    _getOrCreateMips(type) {
        let res = this.mipsByType[type]
        if (res == null) {
            res = {
                arr: ArrayHelpers.create(MAX_LEVEL + 1, level => {
                    const arrayClass = MIPS[level].arrayClass
                    return new arrayClass(MIPS[level].size)
                }),
                // Min/max coordinates in the smalest mip map level that have any content.
                // We never decrease these limits when the blocks are removed, but it's still a useful optimization
                maxLevelMinX: Infinity,
                maxLevelMinY: Infinity,
                maxLevelMinZ: Infinity,
                maxLevelMaxX: -Infinity,
                maxLevelMaxY: -Infinity,
                maxLevelMaxZ: -Infinity
            }
            this.mipsByType[type] = res
        }
        return res
    }

    onFlowingDiff(flowingDiff) {
        for(let [ind, diff] of flowingDiff) {
            diff &= FLUID_TYPE_MASK
            const type = diff === FLUID_WATER_ID
                ? VOLUMETRIC_SOUND_TYPE_WATER
                : diff === FLUID_LAVA_ID
                    ? VOLUMETRIC_SOUND_TYPE_LAVA
                    : null
            this.setByInd(ind, type)
        }
    }

    setByInd(ind, type) {
        tmpVec.fromChunkIndex(ind)
        const exType = this.byIndex.get(ind) ?? null
        if (exType !== type) {
            if (exType !== null) {
                this.addToMips(tmpVec.x, tmpVec.y, tmpVec.z, exType, -1)
            }
            if (type !== null) {
                this.addToMips(tmpVec.x, tmpVec.y, tmpVec.z, type, 1)
                this.byIndex.set(ind, type)
            } else if (exType !== null) {
                this.byIndex.delete(ind)
            }
        }
    }

    /**
     * Adds or subtracts a sound block from all mip levels.
     * @param {Int} x0 - the x coordinate relative to the chunk
     * @param {Int} y0
     * @param {Int} z0
     * @param {Int} type from 0 to ({@link VOLUMETRIC_SOUND_TYPES} - 1)
     * @param {Int} delta -1 or 1
     */
    addToMips(x0, y0, z0, type, delta) {
        // Add 0.5 to coordinates to make the sound come from the center of the block.
        // dx = 2 * (x0 + 0.5) * delta,
        // but in integer arithmetic, so it can be stored in Uint8 or Uint16 array
        const dx = ((x0 << 1) + 1) * delta
        const dy = ((y0 << 1) + 1) * delta
        const dz = ((z0 << 1) + 1) * delta

        let x = x0 | 0
        let y = Math.floor(y0 * MIP0.cellYinv)
        let z = z0 | 0
        let ind = x * MIP0.strideX + y * MIP0.strideY + z * MIP0.strideZ
        const mips = this._getOrCreateMips(type)
        let arr = mips.arr[0]
        arr[ind] += delta
        arr[ind + 1] += dy

        for(let level = 1; level <= MAX_LEVEL; level++) {
            const mip = MIPS[level]
            x >>= 1
            y = Math.floor(y0 * mip.cellYinv)
            z >>= 1
            ind = x * mip.strideX + y * mip.strideY + z * mip.strideZ
            arr = mips.arr[level]
            arr[ind] += delta
            arr[ind + 1] += dx
            arr[ind + 2] += dy
            arr[ind + 3] += dz
        }
        if (mips.maxLevelMinX > x) mips.maxLevelMinX = x
        if (mips.maxLevelMinY > y) mips.maxLevelMinY = y
        if (mips.maxLevelMinZ > z) mips.maxLevelMinZ = z
        if (mips.maxLevelMaxX < x) mips.maxLevelMaxX = x
        if (mips.maxLevelMaxY < y) mips.maxLevelMaxY = y
        if (mips.maxLevelMaxZ < z) mips.maxLevelMaxZ = z
    }
}

/**
 * Data that describes one type of sounds around the player.
 * It's much smaller than SoundMap, and can be used to quickly compute the resulting volume and stereo.
 * It's accurate only when the player is within a few blocks of the initial position.
 * When a player moves farther away, the summary must be re-calculated.
 */
class SoundSummary {

    /**
     * Pre-calculate LUT.
     * The keys are ((sound's secotor) - (player's heading sector) + VOLUMETRIC_SOUND_SECTORS).
     * The values are the values of sin and cos used in the final stage of
     * https://webaudio.github.io/web-audio-api/#Spatialization-equal-power-panning
     */
    static SECTOR_DIFF_TO_COS = new Array(2 * VOLUMETRIC_SOUND_SECTORS)
    static SECTOR_DIFF_TO_SIN = new Array(2 * VOLUMETRIC_SOUND_SECTORS)
    static {
        for(let srctorDiff = -(VOLUMETRIC_SOUND_SECTORS - 1); srctorDiff < VOLUMETRIC_SOUND_SECTORS; srctorDiff++) {
            let azimuth = srctorDiff * SECTOR_TO_ANGLE
            if (azimuth > Math.PI) { // to -PI..PI
                azimuth -= Mth.PI_MUL2
            } else if (azimuth < -Math.PI) {
                azimuth += Mth.PI_MUL2
            }
            if (azimuth < -Mth.PI_DIV2) { // to -PI/2..PI/2
                azimuth = -Math.PI - azimuth
            } else if (azimuth > Mth.PI_DIV2) {
                azimuth = Math.PI - azimuth
            }
            // some redundant operations, but it's for clarity, to match the equal-power panning algorithm
            const stereoX = (azimuth + Mth.PI_DIV2) * Mth.PI_INV    // 0..1
            const stereoAngle = stereoX * Mth.PI_DIV2               // 0..PI/2
            const ind = srctorDiff + VOLUMETRIC_SOUND_SECTORS
            this.SECTOR_DIFF_TO_COS[ind] = Math.cos(stereoAngle)
            this.SECTOR_DIFF_TO_SIN[ind] = Math.sin(stereoAngle)
        }
    }

    constructor() {
        // ========== The summary's data. It's computed by SoundMap ==========

        // volume with no stereo sepation
        this.uniform = 0
        // the list of nearby sources: { x, z, volume }
        this.near = []
        // Volumes of faraway sources in the sectors of 360 degree arc.
        this.far = new Array(VOLUMETRIC_SOUND_SECTORS)

        // ========== Temporary values used to compute the final sound properties ==========

        // distant sources by sector. They get full stereo sepration, depending on the player's rotation
        this.sumBySector    = new Array(VOLUMETRIC_SOUND_SECTORS)
        // volume with no stereo sepation
        this.sumUniform     = 0 // volume with no stereo sepation
    }

    /**
     * @param {Vector} playerPos
     * @returns {Array of ?Object} {
     *  volume: 0..1,
     *  stereo: Array[VOLUMETRIC_SOUND_SECTORS] of -1..1 - lookup table of stereo for each player heading angle
     * }
     * If i-th element of the resul is null, it means there is no sound of i-th type (its volume === 0).
     * Otherwise, its volume is > 0.
     */
    toResult(playerPos) {
        // add uniform sources
        this.sumUniform = this.uniform
        // add far sources to the sum by sector
        ArrayHelpers.copyToFrom(this.sumBySector, this.far)

        this.addNearSources(playerPos)

        const sum = this.sumUniform + ArrayHelpers.sum(this.sumBySector)
        if (!sum) {
            return null
        }
        const stereo = new Array(VOLUMETRIC_SOUND_SECTORS) // LUT by player's heading angle

        // for each player heading, estimate the stereo sound
        for(let playerHeadingSector = 0; playerHeadingSector < VOLUMETRIC_SOUND_SECTORS; playerHeadingSector++) {
            // This should give the same result as https://webaudio.github.io/web-audio-api/#Spatialization-equal-power-panning
            let sumL = this.sumUniform * Math.SQRT1_2
            let sumR = sumL
            for(let sector = 0; sector < VOLUMETRIC_SOUND_SECTORS; sector++) {
                const sectorValue = this.sumBySector[sector]
                if (!sectorValue) {
                    continue
                }
                const sectorDiffInd = playerHeadingSector - sector + VOLUMETRIC_SOUND_SECTORS
                sumL += sectorValue * SoundSummary.SECTOR_DIFF_TO_COS[sectorDiffInd]
                sumR += sectorValue * SoundSummary.SECTOR_DIFF_TO_SIN[sectorDiffInd]
            }

            // convert sumL and sumR to the stereo value used by StereoPannerNode, or Howler's stereo
            const norm = Math.sqrt(sumL * sumL + sumR * sumR)
            const stereoAngle = Math.acos(sumL / norm)
            stereo[playerHeadingSector] = stereoAngle / (Math.PI / 4) - 1 // -1..1
        }
        return {
            volume: toVolume(sum),
            stereo
        }
    }

    /** Adds {@link near} to {@link sumUniform} and {@link sumBySector} */
    addNearSources(playerPos) {
        // add near sources to the sum by sector
        for(const src of this.near) {
            // The volume is already adjusted for the difference in height.
            // Adjust it only for the horizontal distance
            const dx    = src.x - playerPos.x
            const dySqr = src.dySqr
            const dz    = src.z - playerPos.z
            const horizDistSqr  = dx * dx + dz * dz
            const distSqr       = horizDistSqr + dySqr
            const volume        = src.volume * relativeFalloffByDistanceSqr(dySqr, distSqr)

            // Replace this sound source with two: one is at the same Y as the player, with the maximum stereo separation.
            // The other is at the same (x, z) as the player, with no stereo separation.
            const stereoSeparatedPart = Math.sqrt(horizDistSqr / (distSqr + EPS))            
            this.sumBySector[toSector(dx, dz)]  += volume * stereoSeparatedPart
            this.sumUniform                     += volume * (1 - stereoSeparatedPart)
        }
    }
}

/**
 * It maintains all the volumetric sound data.
 * It computes SoundSummary for different locations by the complete data.
 */
export class SoundMap {
    constructor() {
        this.playerPos  = null          // the current world position of the player's head
        this.playerAddr = new Vector()  // the address of the current player's head chunk

        const chunksXZ  = 2 * (1 + SOUND_MAP_CHUNKS_RADIUS_XZ)
        const chunksY   = 2 * (1 + SOUND_MAP_CHUNKS_RADIUS_Y)
        this.chunks = new SimpleShifted3DArray(0, 0, 0, chunksXZ, chunksY, chunksXZ)

        this.earliestDirtyChunkTime = Infinity // dirty means "not in the summary"
        this.summaryPlayerPos       = new Vector(Infinity, Infinity, Infinity)
        this.resultPlayerPos        = new Vector()

        // the last time we made a periodic query about the mising chunks
        this.lastPeriodicQueryTime = performance.now()
        // Contains objects {x, y, z, queryId}
        this.chunksQuery = []
        this.hasMissingChunks = true

        this.summaries = ArrayHelpers.create(VOLUMETRIC_SOUND_TYPES, () => new SoundSummary())
        this.lastSummaryTime = performance.now()
        
        // temporary values used to compute SoundSummary

        // 2D mip maps of sound sources
        this.summaryMips = ArrayHelpers.create(MAX_SUMMARY_LEVEL + 1, level => {
            const sizeXY = SUMMARY_MIP_SIZE_XY - (level === MAX_SUMMARY_LEVEL ? 1 : 0)
            return {
                arr: ArrayHelpers.create(sizeXY * sizeXY * VOLUMETRIC_SOUND_TYPES, i => {
                    return {
                        type:   i % VOLUMETRIC_SOUND_TYPES,
                        sum:    0,  // sum of sound source volumes, adjusted by difference in height
                        sumX:   0,  // sum of sound sources X, weightd by their adjusted volumes
                        /**
                         * Sum of ((soundY - playerPos.y) ^ 2) * volume
                         * Here's how and why it's used. Compare:
                         * Case A. A column of 2 blocks with Y colse to playerPos.y
                         * Case B. A column of 2 groups of blocks: far above, and far below the player.
                         * If the player stands in this coumn, the volume might be the same.
                         * If the player moves away, the volume falloff and stereo effect must be much less pronounced in case B.
                         * This field preserves some of that information, while still flattining the map to 2D.
                         */
                        sumDYSqr: 0,
                        sumZ:   0
                    }
                }),
                sizeXY,
                // world coordinates of the cell biundaries
                minX: 0,        // left of the left-most cell
                minZ: 0,
                minXcenter: 0,  // left of the left-most of the central two cells
                minZcenter: 0,
                maxXcenter: 0,  // exclusive, right of the right-most of the central 2 cells
                maxZcenter: 0,  // exclusive
                maxX: 0,        // exclusive, right of the right-most cell
                maxZ: 0         // exclusive
            }
        })

        this.sendQueryFn = null
        this.sendResultFn = null
    }

    *chunksAroundPlayer() {
        const addr = this.playerAddr
        yield *this.chunks.xyzIndValues(
            addr.x - SOUND_MAP_CHUNKS_RADIUS_XZ, addr.x + SOUND_MAP_CHUNKS_RADIUS_XZ,
            addr.y - SOUND_MAP_CHUNKS_RADIUS_Y,  addr.y + SOUND_MAP_CHUNKS_RADIUS_Y,
            addr.z - SOUND_MAP_CHUNKS_RADIUS_XZ, addr.z + SOUND_MAP_CHUNKS_RADIUS_XZ)
    }

    onPlayerPos(playerPos) {
        const queriedChunks = []
        this.playerPos = playerPos
        const addr = getChunkAddr(playerPos, this.playerAddr)

        // coordinates of the "lower-left" of the central chunks
        const x = this.chunks.minX + SOUND_MAP_CHUNKS_RADIUS_XZ
        const y = this.chunks.minY + SOUND_MAP_CHUNKS_RADIUS_Y
        const z = this.chunks.minZ + SOUND_MAP_CHUNKS_RADIUS_XZ
        // shift the 3D arrays to make playerAddr one of the central elements
        const dx = (addr.x <= x) ? (addr.x - x) : (addr.x - (x + 1))
        const dy = (addr.y <= y) ? (addr.y - y) : (addr.y - (y + 1))
        const dz = (addr.z <= z) ? (addr.z - z) : (addr.z - (z + 1))
        
        // Move if necessary
        if (this.chunks.shift(dx, dy, dz, null)) {
            // if we moved - query the mising chunks
            for(const [x, y, z, ind, v] of this.chunksAroundPlayer()) {
                if (v == null) {
                    const placeholder = new SoundChunkPlaceholder(x, y, z)
                    this.chunks.setByInd(ind, placeholder)
                    queriedChunks.push(placeholder.query)
                    this.hasMissingChunks = true
                }
            }
        }
        // query the missing chunks periodically
        if (this.lastPeriodicQueryTime + PERIODIC_QUERY_MILLIS < performance.now()) {
            this.lastPeriodicQueryTime = performance.now()
            for(const [x, y, z, ind, v] of this.chunksAroundPlayer()) {
                if (v instanceof SoundChunkPlaceholder) {
                    v.addToPeriodicQueiry(queriedChunks)
                }
            }
        }
        // send the query
        if (queriedChunks.length) {
            this.sendQueryFn(queriedChunks)
        }

        // update the sound summary if necessary
        let sumaryChanged = false
        const summaryInputChanged =
            this.earliestDirtyChunkTime + VOLUMETRIC_SOUND_DIRTY_BLOCKS_TTL < performance.now() ||
            this.summaryPlayerPos.distanceSqr(playerPos) > VOLUMETRIC_SOUND_SUMMARY_VALID_DISTANCE * VOLUMETRIC_SOUND_SUMMARY_VALID_DISTANCE
        if (summaryInputChanged &&
            // If we have mising chunks, dely the summary update - maybe they'll come soon.
            // If we don't have missing chunks, there is no reason to delay.
            (!this.hasMissingChunks || this.lastSummaryTime + VOLUMETRIC_SOUND_DIRTY_BLOCKS_TTL < performance.now())
        ) {
            this.earliestDirtyChunkTime = Infinity
            this.lastSummaryTime = performance.now()
            this.summaryPlayerPos.copyFrom(playerPos)
            this.rebuildSummary()
            sumaryChanged = true
        }

        // update the result if anything changed at all
        if (sumaryChanged || !this.resultPlayerPos.equal(playerPos)) {
            this.resultPlayerPos.copyFrom(playerPos)
            const result = this.summaries.map(summary => summary.toResult(playerPos))
            this.sendResultFn(result)
        }
    }

    onFlowingDiff(msg) {
        const chunkInd = this.chunks.vecToIndOrNull(msg.addr)
        if (chunkInd == null) {
            // This chunk is not in the sound neighbourhood. Ignore the message.
            return
        }
        let chunk = this.chunks.getByInd(chunkInd)
        if (chunk == null) {
            return // we havent't queried this chunk, so ignore this update
        }
        if (msg.queryId !== chunk.queryId) {
            return // it's an update for the previous instance of this chunk. Ignore it. We'll get our update eventually.
        }
        if (chunk instanceof SoundChunkPlaceholder) {
            // The first reply (possible sevaral first replies) must be full data, not diffs.
            if (!msg.all && chunk.waitignForData) {
                throw new Error('chunk instanceof SoundChunkPlaceholder && !msg.all')
            }
            if (msg.map.size === 0) {
                // keep it as a placeholder, but now we don't wait for its data
                chunk.waitignForData = false
                this.onChunkAcquired()
                return
            }
            chunk = new SoundChunk(msg.addr, msg.queryId)
            this.chunks.setByInd(chunkInd, chunk)
            this.onChunkAcquired()
        }
        chunk.onFlowingDiff(msg.map)
        // Don't update the summary right now. Maybe maybe another diff will come soon.
        this.earliestDirtyChunkTime = Math.min(this.earliestDirtyChunkTime, performance.now())
    }

    onChunkAcquired() {
        for(const [x, y, z, ind, v] of this.chunksAroundPlayer()) {
            if (v instanceof SoundChunkPlaceholder && v.waitignForData) {
                return
            }
        }
        this.hasMissingChunks = false
    }

    rebuildSummary() {
        this.prepareSummaryCalculation()
        // add all from chunk mips to the summary mips, or to the far sources
        for(const [x, y, z, ind, chunk] of this.chunksAroundPlayer()) {
            if (!(chunk instanceof SoundChunk && chunk.byIndex.size)) {
                continue
            }
            for(let type = 0; type < VOLUMETRIC_SOUND_TYPES; type++) {
                const mips = chunk.mipsByType[type]
                if (mips == null) {
                    continue
                }
                for(let mipX = mips.maxLevelMinX; mipX <= mips.maxLevelMaxX; mipX++) {
                    const worldX = chunk.coord.x + (mipX << MAX_LEVEL) + 0.5
                    const indX = mipX * MIP_MAX.strideX
                    for(let mipY = mips.maxLevelMinY; mipY <= mips.maxLevelMaxY; mipY++) {
                        const worldY = chunk.coord.y + mipY * MIP_MAX.cellY + 0.5
                        const indY = indX + mipY * MIP_MAX.strideY
                        for(let mipZ = mips.maxLevelMinZ; mipZ <= mips.maxLevelMaxZ; mipZ++) {
                            const worldZ = chunk.coord.z + (mipZ << MAX_LEVEL) + 0.5
                            const ind = indY + mipZ * MIP_MAX.strideZ
                        
                            this.playerRelativeX = this.playerPos.x - chunk.coord.x
                            this.playerRelativeY = this.playerPos.y - chunk.coord.y
                            this.playerRelativeZ = this.playerPos.z - chunk.coord.z
                            this.addToSummary(mips, 
                                mipX, worldX, mipY, worldY, mipZ, worldZ,
                                MIP_MAX, type, ind)
                        }
                    }
                }
            }
        }
        this.calcSummaryNear()
    }

    prepareSummaryCalculation() {
        const playerX = this.playerPos.x
        const playerZ = this.playerPos.z
        
        // Postition all the levels centered around the player.
        // Each level covers a whole number of the upper (smaller) level's cells.
        let sizeXZ  = SUMMARY_MIP_SIZE_XY - 1
        let smBig   = null
        let alignSize = MIPS[MAX_SUMMARY_LEVEL].cellXZ
        for(let i = MAX_SUMMARY_LEVEL; i >= 0; i--) {
            const cellXZ = MIPS[i].cellXZ
            const width = cellXZ * sizeXZ
            const sm    = this.summaryMips[i]

            // align this level
            sm.minX = Math.floor(playerX / alignSize) * alignSize - (width - alignSize) * 0.5
            sm.minZ = Math.floor(playerZ / alignSize) * alignSize - (width - alignSize) * 0.5
            sm.maxX = sm.minX + width
            sm.maxZ = sm.minZ + width
            // update the previous level
            if (smBig) {
                smBig.minXcenter = sm.minX
                smBig.minZcenter = sm.minZ
                smBig.maxXcenter = sm.maxX
                smBig.maxZcenter = sm.maxZ
            }
            // clear the values of this mip level
            for(const v of sm.arr) {
                v.sum   = 0
                v.sumX  = 0
                v.sumDYSqr = 0
                v.sumZ  = 0
            }
            // values used for the next level
            sizeXZ  = SUMMARY_MIP_SIZE_XY
            smBig   = sm
            alignSize = cellXZ
        }

        for(const summary of this.summaries) {
            summary.far.fill(0)
            summary.uniform = 0
            summary.near.length = 0
        }
    }

    /**
     * @param {Object} mips - mip maps for this type of sound
     * @param {Int} mipX - from 0 to {@link mip}.sizeXZ
     * @param {Int} mipY - from 0 to {@link mip}.sizeY
     * @param {Int} mipZ - from 0 to {@link mip}.sizeXZ
     * @param {Int} worldX - botom-left corner of the cuboid + 0.5
     * @param {Int} worldY
     * @param {Int} worldZ
     * @param {Object} mip - one of {@link MIPS}
     */
    addToSummary(mips, mipX, worldX, mipY, worldY, mipZ, worldZ, mip, type, ind) {
        const level = mip.level
        const arr = mips.arr[level]
        let volume = arr[ind]
        if (volume === 0) {
            return
        }

        if (level > MAX_SUMMARY_LEVEL) { // if we can't add it whole to the summary mip map
            const sm = this.summaryMips[MAX_SUMMARY_LEVEL]
            // If it's completely ouside the summary mip map, add it whole to the far sources.
            // Account for +0.5 in worldX and worldY.
            if (Math.floor(worldX + mip.cellXZ) <= sm.minX || worldX >= sm.maxX || 
                Math.floor(worldZ + mip.cellXZ) <= sm.minZ || worldZ >= sm.maxZ
            ) {
                this.addToSummaryFar(arr, mip, type, ind)
                return
            }
            // It's patially or completely inside the source mip maps. Continue, and divide it recursively.
        } else {
            const sm = this.summaryMips[level]
            // Check if the current cuboid is outside the mip map only for the maximum level.
            // If we pass this check for the maximum level, we'll pass it for others too.
            if (level === MAX_SUMMARY_LEVEL && 
                (worldX < sm.minX || worldX >= sm.maxX || worldZ < sm.minZ || worldZ >= sm.maxZ)
            ) {
                this.addToSummaryFar(arr, mip, type, ind)
                return
            }

            // If it's 1*Y*1 cell, it can't be divided. Add it to 0th level mip, if it's not empty
            if (level === 0) {
                // replace the sound source with a different worldY by the sound with the same worldY, but lower volume
                const volumeInvDiv2 = 0.5 / volume
                const dx = worldX - this.playerPos.x
                const dy = arr[ind + 1] * volumeInvDiv2 - this.playerRelativeY
                const dz = worldZ - this.playerPos.z
                const horizDistSqr = dx * dx + dz * dz
                const dySqr     = dy * dy
                volume *= relativeFalloffByDistanceSqr(horizDistSqr, horizDistSqr + dySqr)

                // add to the summary mip map cell
                const smX = worldX - sm.minX | 0    // truncate because worldX has +0.5 added
                const smZ = worldZ - sm.minZ | 0
                const summaryInd    = (sm.sizeXY * smX + smZ) * VOLUMETRIC_SOUND_TYPES + type
                const summaryValue  = sm.arr[summaryInd]
                summaryValue.sum        += volume
                summaryValue.sumX       += volume * worldX  // + 0.5 is already included in worldX
                summaryValue.sumDYSqr   += volume * dySqr
                summaryValue.sumZ       += volume * worldZ
                return
            }
             
            // if it's outside the smaller summary mip map, add it to this summary mip level
            if (worldX < sm.minXcenter || worldX >= sm.maxXcenter ||
                worldZ < sm.minZcenter || worldZ >= sm.maxZcenter
            ) {
                // replace the sound source with a different worldY by the sound with the same worldY, but lower volume
                const volumeInvDiv2 = 0.5 / volume
                const dx = arr[ind + 1] * volumeInvDiv2 - this.playerRelativeX
                const dy = arr[ind + 2] * volumeInvDiv2 - this.playerRelativeY
                const dz = arr[ind + 3] * volumeInvDiv2 - this.playerRelativeZ
                const horizDistSqr  = dx * dx + dz * dz
                const dySqr         = dy * dy
                volume *= relativeFalloffByDistanceSqr(horizDistSqr, horizDistSqr + dySqr)

                // add to the summary mip map cell
                const smX = (worldX - sm.minX) >> level
                const smZ = (worldZ - sm.minZ) >> level
                const summaryInd    = (sm.sizeXY * smX + smZ) * VOLUMETRIC_SOUND_TYPES + type
                const summaryValue  = sm.arr[summaryInd]
                summaryValue.sum        += volume
                summaryValue.sumX       += volume * (this.playerPos.x + dx)
                summaryValue.sumDYSqr   += volume * dySqr
                summaryValue.sumZ       += volume * (this.playerPos.z + dz)
                return
            }
            // It's inside the smaller summary mip level. Continue, and divide it recursively.
        }

        // Divide it recursively
        const smaller = mip.smaller
        mipX *= 2
        mipY *= smaller.dividerY
        mipZ *= 2
        const mipX1 = mipX + 1
        const mipZ1 = mipZ + 1
        const worldX1 = worldX + smaller.cellXZ
        const worldZ1 = worldZ + smaller.cellXZ
        ind = mipX * smaller.strideX + mipY * smaller.strideY + mipZ * smaller.strideZ
        let indX1 = ind + smaller.strideX
        this.addToSummary(mips, mipX,  worldX,  mipY, worldY, mipZ,  worldZ,  smaller, type, ind)
        this.addToSummary(mips, mipX,  worldX,  mipY, worldY, mipZ1, worldZ1, smaller, type, ind + smaller.strideZ)
        this.addToSummary(mips, mipX1, worldX1, mipY, worldY, mipZ,  worldZ,  smaller, type, indX1)
        this.addToSummary(mips, mipX1, worldX1, mipY, worldY, mipZ1, worldZ1, smaller, type, indX1 + smaller.strideZ)
        if (mip.dividerY !== 1) { // then mip.dividerY === 2
            mipY++
            worldY  += smaller.cellY
            ind     += smaller.strideY
            indX1   += smaller.strideY
            this.addToSummary(mips, mipX,  worldX,  mipY, worldY, mipZ,  worldZ,  smaller, type, ind)
            this.addToSummary(mips, mipX,  worldX,  mipY, worldY, mipZ1, worldZ1, smaller, type, ind + smaller.strideZ)
            this.addToSummary(mips, mipX1, worldX1, mipY, worldY, mipZ,  worldZ,  smaller, type, indX1)
            this.addToSummary(mips, mipX1, worldX1, mipY, worldY, mipZ1, worldZ1, smaller, type, indX1 + smaller.strideZ)
        }
    }

    addToSummaryFar(arr, mip, type, ind) {
        const sum = arr[ind]
        if (mip.level < MAX_SUMMARY_LEVEL || !sum) {
            throw new Error()
        }
        const sumInvDiv2 = 0.5 / sum
        // chunk.coord.x + (arr[ind + 1] / sum / 2) = average worldX of the sound source
        const dx = arr[ind + 1] * sumInvDiv2 - this.playerRelativeX
        const dy = arr[ind + 2] * sumInvDiv2 - this.playerRelativeY
        const dz = arr[ind + 3] * sumInvDiv2 - this.playerRelativeZ
        const horizDistSqr  = dx * dx + dz * dz
        const distSqr       = horizDistSqr + dy * dy
        if (distSqr > MAX_DISTANCE_SQR) {
            return // it's too far
        }
        const volume = sum * falloffByDistanceSqr(distSqr) * falloffExtraFar(distSqr)

        // Replace this sound source with two: one is at the same Y as the player, with the maximum stereo separation.
        // The other is at the same (x, z) as the player, with no stereo separation.
        const stereoSeparatedPart = Math.sqrt(horizDistSqr / (distSqr + EPS))
        const summary = this.summaries[type]
        summary.far[toSector(dx, dz)]   += volume * stereoSeparatedPart
        summary.uniform                 += volume * (1 - stereoSeparatedPart)
    }

    calcSummaryNear() {
        for(let level = 0; level <= MAX_SUMMARY_LEVEL; level++) {
            for(const v of this.summaryMips[level].arr) {
                const sum = v.sum
                if (sum) {
                    const summary = this.summaries[v.type]
                    const sumInv = 1 / sum
                    summary.near.push({
                        volume: sum,
                        x:      v.sumX * sumInv,
                        dySqr:  v.sumDYSqr * sumInv,
                        z:      v.sumZ * sumInv
                    })
                }
            }
        }
    }

}

const tmpVec = new Vector()