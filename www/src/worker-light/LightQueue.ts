import {MultiQueue} from '../light/MultiQueue.js';
import {
    maxLight,
    maxPotential,
    dmask,
    dlen,
    dx,
    dy,
    dz,
    defPageSize,
    globalStepMs,
    DIR_COUNT,
    BITS_QUEUE_BLOCK_INDEX,
    MASK_QUEUE_BLOCK_INDEX,
    MASK_WAVE_FORCE,
    OFFSET_SOURCE,
    OFFSET_LIGHT,
    MASK_SRC_BLOCK,
    MASK_SRC_AMOUNT,
    OFFSET_COLUMN_DAY,
    OFFSET_COLUMN_TOP,
    OFFSET_WAVE,
    NORMAL_DX,
    NORMAL_MASK,
    OFFSET_NORMAL, NORMAL_DEF,
} from './LightConst.js';

export class LightQueue {
    [key: string]: any;
    constructor(world, {offset, dirCount, capacity, nibbleSource}) {
        this.world = world;
        // deque structure=
        this.deque = new MultiQueue({pageSize: defPageSize, maxPriority: maxLight + maxPotential});
        this.filled = 0;
        this.nibbleSource = nibbleSource || false;
        // offset in data
        this.qOffset = offset || 0;
        this.dirCount = dirCount || DIR_COUNT;

        this.counter = {
            incr: 0,
            decr: 0,
            now: 0,
        }

        this.tmpLights = [];
        for (let i = 0; i < 2 * this.dirCount; i++) {
            this.tmpLights.push(0);
        }
    }

    setNormals(hasNormals) {
        this.offsetNormal = hasNormals ? OFFSET_NORMAL: 0;
    }

    /**
     * @param chunk
     * @param coord
     * @param waveNum
     */
    add(chunk, coord, waveNum, potential, force) {
        if (waveNum < 0 || waveNum > maxLight) {
            waveNum = maxLight;
        }
        const {uint8View, strideBytes} = chunk.lightChunk;
        const coordBytes = coord * strideBytes + this.qOffset + OFFSET_WAVE;
        if (uint8View[coordBytes] > waveNum) {
            return;
        }
        uint8View[coordBytes] = waveNum + 1;
        if (potential < 0) {
            potential = 0;
        }
        if (potential > maxPotential) {
            potential = maxPotential;
        }
        this.deque.push(waveNum + potential, chunk.dataIdShift + coord);
        this.filled++;
        chunk.waveCounter++;
    }

    addNow(chunk, coord, x, y, z, value) {
        //test demo before force: {incr: 410461, decr: 68832}
        //test demo with force: {incr: 422083, decr: 3503}
        const qOffset = this.qOffset;
        const {uint8View, strideBytes, portals, safeAABB} = chunk.lightChunk;
        const coordBytes = coord * strideBytes + qOffset;
        if (uint8View[coordBytes + OFFSET_WAVE] >= MASK_WAVE_FORCE) {
            uint8View[coordBytes + OFFSET_LIGHT] = value;
            return;
        }
        const old = uint8View[coordBytes + OFFSET_LIGHT];
        uint8View[coordBytes + OFFSET_WAVE] = old + MASK_WAVE_FORCE;
        const waveNum = Math.max(value, old);

        let potential = this.world.getPotential(x, y, z);
        this.deque.push(waveNum + potential, chunk.dataIdShift + coord);
        this.filled++;
        chunk.waveCounter++;
        chunk.lastID++;
        this.counter.now++;

        //TODO: inline setting to dirNibbleQueue
        uint8View[coordBytes + OFFSET_LIGHT] = value;
        if (!safeAABB.contains(x, y, z)) {
            for (let p = 0; p < portals.length; p++) {
                if (portals[p].aabb.contains(x, y, z)) {
                    let other = portals[p].toRegion;
                    other.setUint8ByInd(other.indexByWorld(x, y, z), qOffset + OFFSET_LIGHT, value);
                    other.rev.lastID++;
                }
            }
        }
    }

    doIter(times) {
        const {qOffset, dirCount, deque, world, nibbleSource, tmpLights, offsetNormal} = this;
        const {chunkById} = world.chunkManager;
        const apc = world.chunkManager.activePotentialCenter;
        const hasNormals = offsetNormal > 0;

        let chunk = null;
        let lightChunk = null;
        let uint8View = null;
        let dataView = null;
        let outerSize = null;
        let strideBytes = 0;
        let outerAABB = null;
        let aabb = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let sx = 0, sy = 0, sz = 0;
        let curWave = null;

        let nibbles = null;
        let nibDim = 0, nibStride = 0;

        for (let tries = 0; tries < times; tries++) {
            curWave = deque.peekNonEmpty();
            if (!curWave) {
                return true;
            }
            let wn = curWave.priority;
            //that's a pop
            let coord = curWave.shift();
            const newChunk = chunkById[coord >> BITS_QUEUE_BLOCK_INDEX];
            coord = coord & MASK_QUEUE_BLOCK_INDEX;
            this.filled--;
            // pop end
            if (!newChunk || newChunk.removed) {
                continue;
            }
            newChunk.waveCounter--;
            // if (qOffset > 0) {
            //     continue;
            // }
            if (chunk !== newChunk) {
                chunk = newChunk;
                lightChunk = chunk.lightChunk;
                uint8View = lightChunk.uint8View;
                dataView = lightChunk.dataView;
                outerSize = lightChunk.outerSize;
                strideBytes = lightChunk.strideBytes;
                outerAABB = lightChunk.outerAABB;
                aabb = lightChunk.aabb;
                safeAABB = lightChunk.safeAABB;
                portals = lightChunk.portals;
                dif26 = lightChunk.dif26;
                sx = 1;
                sz = outerSize.x;
                sy = outerSize.x * outerSize.z;
                if (nibbleSource) {
                    nibbles = lightChunk.nibbles;
                    if (!nibbles) {
                        continue;
                    }
                    nibDim = nibbles ? lightChunk.nibbleDims.y : 0;
                    nibStride = nibbles ? lightChunk.nibbleStrideBytes : 0;
                }
            } else {
                if (nibbleSource && !nibbles) {
                    continue;
                }
            }
            const coordBytes = coord * strideBytes + qOffset;

            let tmp = coord;
            let x = tmp % outerSize.x;
            tmp -= x;
            tmp /= outerSize.x;
            let z = tmp % outerSize.z;
            tmp -= z;
            tmp /= outerSize.z;
            let y = tmp;
            x += outerAABB.x_min;
            y += outerAABB.y_min;
            z += outerAABB.z_min;

            let blockMask = 0;
            let val = uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AMOUNT
            let normalVal = NORMAL_DEF;
            if (nibbleSource) {
                //TODO: maybe use extra memory here, with OFFSET_SOURCE?
                const localY = y - aabb.y_min;
                const nibY = Math.floor(localY / nibDim);
                const nibCoord = (coord + (nibY - localY) * sy) * nibStride;
                const lim = Math.min(nibDim * (nibY + 1), aabb.y_max - aabb.y_min);
                const nibColumn = nibbles[nibCoord + OFFSET_COLUMN_TOP] - (lim - localY);
                val = (nibColumn >= 0 && nibbles[nibCoord + OFFSET_COLUMN_DAY] > nibColumn) ? world.defDayLight : 0;
            }
            const old = uint8View[coordBytes + OFFSET_LIGHT];
            let prevLight = uint8View[coordBytes + OFFSET_WAVE];
            uint8View[coordBytes + OFFSET_WAVE] = 0;
            let force = prevLight >= MASK_WAVE_FORCE;
            if (force) {
                prevLight -= MASK_WAVE_FORCE;
            } else {
                prevLight = old;
            }
            let normalOld  = NORMAL_DEF;
            if (hasNormals) {
                normalOld = dataView.getUint32(coordBytes + offsetNormal, true);
            }
            let decrMask = 0;
            let block = false;
            if ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK) {
                val = 0;
                block = true;
            }
            if (val === maxLight && val === old && val === prevLight) {
                continue;
            }

            let normalAccX = 0, normalAccY = 0, normalAccZ = 0;
            let foundNormals = 0;
            for (let d = 0; d < dirCount; d++) {
                if ((blockMask & (1 << d)) !== 0) {
                    continue;
                }
                let coord2 = coord + dif26[d];
                let light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                let normal = NORMAL_DEF;
                if (hasNormals) {
                    normal = (dataView.getUint32(coord2 * strideBytes + offsetNormal, true)
                        + NORMAL_DX[d]) & NORMAL_MASK;
                }

                if ((uint8View[coord2 * strideBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK) {
                    light = 0;
                    blockMask |= dmask[d];
                } else {
                    if (val < prevLight && light > 0 && light === prevLight - dlen[d]) {
                        // dependant cell - dont update val on it!
                        decrMask |= 1 << d;
                    } else if (!block) {
                        if (val < light - dlen[d]) {
                            val = light - dlen[d];
                            normalAccX = normalAccY = normalAccZ = 0;
                            foundNormals = 0;
                        }
                        if (hasNormals && val === light - dlen[d]) {
                            foundNormals++;
                            normalAccX += (normal & 0xff) - 0x80;
                            normalAccY += ((normal >> 8) & 0xff) - 0x80;
                            normalAccZ += ((normal >> 16) & 0xff) - 0x80;
                        }
                    }
                }
                tmpLights[d] = light;
                tmpLights[d + 26] = normal;
            }

            if (foundNormals > 0) {
                normalVal = Math.round(normalAccX / foundNormals + 0x80)
                    | (Math.round(normalAccY / foundNormals + 0x80) << 8)
                    | (Math.round(normalAccZ / foundNormals + 0x80) << 16);
            }

            let incMask = 0;
            for (let d = 0; d < dirCount; d++) {
                if ((blockMask & (1 << d)) === 0) {
                    if (tmpLights[d] < val - dlen[d]
                        || tmpLights[d] === val - dlen[d] && tmpLights[d + 26] !== normalVal) {
                        incMask |= 1 << d;
                    }
                }
            }
            // let modMask = (~blockMask & ((1 << dirCount) - 1));
            let modMask = incMask | decrMask;
            if (old === val && old === prevLight
                && (!hasNormals || val === 0 || normalVal === normalOld)
            ) {
                modMask = incMask;
                if (modMask === 0) {
                    continue;
                }
            }
            uint8View[coordBytes + OFFSET_LIGHT] = val;
            if (hasNormals) {
                dataView.setUint32(coordBytes + offsetNormal, normalVal, true);
            }
            if (old !== val || val > 0 && normalVal !== normalOld) {
                chunk.lastID++;
            }
            if (old > val) {
                this.counter.decr++;
            } else {
                this.counter.incr++;
            }
            let neibDist = 0, neibPotential = 0;
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                for (let d = 0; d < dirCount; d++) {
                    if ((modMask & (1 << d)) === 0) {
                        continue;
                    }
                    let coord2 = coord + dif26[d];
                    const light = tmpLights[d];
                    if (apc) {
                        neibDist = (Math.abs(x - apc.x + dx[d]) + Math.abs(y - apc.y + dy[d]) + Math.abs(z - apc.z + dz[d])) * dlen[0];
                        neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                    }
                    const waveNum = Math.max(light, val - dlen[d]);
                    this.add(chunk, coord2, waveNum, neibPotential);
                }
            } else {
                let mask2 = 0;
                for (let p = 0; p < portals.length; p++) {
                    const chunk2 = portals[p].toRegion;
                    if (!portals[p].aabb.contains(x, y, z)) {
                        continue;
                    }
                    mask2 |= 1 << p;
                    chunk2.setUint8ByInd(chunk2.indexByWorld(x, y, z), qOffset + OFFSET_LIGHT, val);
                    if (hasNormals) {
                        chunk2.setUint32ByInd(chunk2.indexByWorld(x, y, z), offsetNormal, normalVal);
                    }
                    chunk2.rev.lastID++;
                    for (let d = 0; d < DIR_COUNT; d++) {
                        if (modMask === 0) {
                            break;
                        }
                        if ((modMask & (1 << d)) === 0) {
                            continue;
                        }
                        let x2 = x + dx[d], y2 = y + dy[d], z2 = z + dz[d];
                        if (chunk2.aabb.contains(x2, y2, z2)) {
                            modMask &= ~(1 << d);
                            const coord2 = chunk2.indexByWorld(x2, y2, z2);
                            const light = tmpLights[d];
                            if (apc) {
                                neibDist = (Math.abs(x2 - apc.x) + Math.abs(y2 - apc.y) + Math.abs(z2 - apc.z)) * dlen[0];
                                neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                            }
                            const waveNum = Math.max(light, val - dlen[d]);
                            this.add(chunk2.rev, coord2, waveNum, neibPotential);
                        }
                    }
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((modMask & (1 << d)) === 0) {
                        continue;
                    }
                    let x2 = x + dx[d], y2 = y + dy[d], z2 = z + dz[d];
                    let coord2 = coord + dif26[d];
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        const light = tmpLights[d];
                        if (apc) {
                            neibDist = (Math.abs(x2 - apc.x) + Math.abs(y2 - apc.y) + Math.abs(z2 - apc.z)) * dlen[0];
                            neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                        }
                        const waveNum = Math.max(light, val - dlen[d]);
                        this.add(chunk, coord2, waveNum, neibPotential);
                    }
                }
            }
        }
        deque.peekNonEmpty();
        return false;
    }

    doWaves(msLimit) {
        msLimit = msLimit || globalStepMs;
        const startTime = performance.now();
        let endTime = performance.now();
        do {
            this.doIter(1000);
            endTime = performance.now();
        } while (endTime < startTime + msLimit);
    }
}
