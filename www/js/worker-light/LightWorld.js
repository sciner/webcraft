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
    GROUND_ESTIMATION_MIN_DIST, GROUND_ESTIMATION_MAX_DIST,
    GROUND_ESTIMATION_FAR_BIAS, GROUND_ESTIMATION_FAR_BIAS_MIN_DIST
} from "./LightConst.js";
import {LightQueue} from "./LightQueue.js";
import {DirNibbleQueue} from "./DirNibbleQueue.js";
import { CHUNK_SIZE_X } from '../chunk_const.js';

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
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.chunkById[chunk.dataId] = null;
            this.list.splice(this.list.indexOf(chunk), 1);
            this.lightBase.removeSub(chunk.lightChunk);
        }
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
        const maxDist = Math.min(GROUND_ESTIMATION_MAX_DIST,
            Math.max(GROUND_ESTIMATION_MIN_DIST,
                (this.chunk_render_dist || 0) * CHUNK_SIZE_X
            ));
        const maxDistSqr = maxDist * maxDist;
        // For each (X, Z) bucket, find the lowest block with any light.
        const byXZ = {};
        for(let chunk of this.chunkManager.list) {
            const minLightY = chunk.minLightY;
            if (minLightY == null) {
                continue;
            }
            for(let i = 0; i < minLightY.length; i++) {
                const v = minLightY[i];
                if (playerPos) {
                    v.distSqr = (v.x - playerPos.x) * (v.x - playerPos.x) +
                        (v.z - playerPos.z) * (v.z - playerPos.z);
                    if (v.distSqr > maxDistSqr) {
                        continue;
                    }
                }
                var exV = byXZ[v.key];
                if (exV == null) {
                    byXZ[v.key] = v;
                } else {
                    exV.y = Math.min(v.y, exV.y);
                }
            }
        }
        // apply distance bias, sort by distance;
        const byDist = [];
        for(let key in byXZ) {
            const v = byXZ[key];
            // don't apply the bias closer than GROUND_BUCKET_SIZE
            v.biasedY = v.y + Mth.lerpAny(v.distSqr,
                GROUND_ESTIMATION_FAR_BIAS_MIN_DIST * GROUND_ESTIMATION_FAR_BIAS_MIN_DIST, 0,
                maxDistSqr, GROUND_ESTIMATION_FAR_BIAS);
            byDist.push(v);
        }
        byDist.sort((a, b) => a.distSqr - b.distSqr);

        var groundLevel = Infinity;
        const list = [];
        // look at the surface at 5 different scales, to account for small nearby and big far-away changes
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
        this.prevGroundLevelPlayerPos = playerPos;
        worker.postMessage(['ground_level_estimated', groundLevel]);
    }
}
