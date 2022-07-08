import {MultiQueue} from '../light/MultiQueue.js';
import {
    maxLight, maxPotential,
    dmask, dlen, dx, dy, dz,
    defPageSize, globalStepMs,
    DIR_COUNT,
    MASK_QUEUE_FORCE,
    BITS_QUEUE_BLOCK_INDEX,
    MASK_QUEUE_BLOCK_INDEX,
    OFFSET_SOURCE,
    OFFSET_LIGHT,
    MASK_SRC_BLOCK, MASK_SRC_AMOUNT, OFFSET_COLUMN_DAY, OFFSET_COLUMN_TOP,
} from './LightConst.js';

export class LightQueue {
    constructor(world, {offset, dirCount, capacity, nibbleSource}) {
        this.world = world;
        // deque structure=
        this.deque = new MultiQueue({pageSize: defPageSize, maxPriority: maxLight + maxPotential});
        this.filled = 0;
        this.nibbleSource = nibbleSource || false;
        // offset in data
        this.qOffset = offset || 0;
        this.dirCount = dirCount || DIR_COUNT;
    }

    /**
     * @param chunk
     * @param coord
     * @param waveNum
     */
    add(chunk, coord, waveNum, force) {
        if (waveNum < 0 || waveNum > maxLight + maxPotential) {
            waveNum = maxLight + maxPotential;
        }
        this.deque.push(waveNum, chunk.dataIdShift + coord + (force ? MASK_QUEUE_FORCE : 0));
        this.filled++;
        chunk.waveCounter++;
    }

    doIter(times) {
        const {qOffset, dirCount, deque, world, nibbleSource} = this;
        const {chunkById} = world.chunkManager;
        const apc = world.chunkManager.activePotentialCenter;

        let chunk = null;
        let lightChunk = null;
        let uint8View = null;
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
            const force = coord & MASK_QUEUE_FORCE;
            coord = coord & ~MASK_QUEUE_FORCE;
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

            let prevLight = wn;
            let curPotential = 0, curDist = 0;
            if (apc) {
                curDist = (Math.abs(x - apc.x) + Math.abs(y - apc.y) + Math.abs(z - apc.z)) * dlen[0];
                curPotential = maxPotential - Math.min(maxPotential, curDist);
                prevLight = wn - curPotential;
            }

            let mask = 0;
            let val = uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AMOUNT
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
            if ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK) {
                val = 0;
            } else {
                if (val === maxLight && val === old && !force) {
                    continue;
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        // if (d >= 6 && mask >= DIR_MAX_MASK) {
                        //     break;
                        // }
                        continue;
                    }
                    let coord2 = coord + dif26[d];
                    let light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                    if ((uint8View[coord2 * strideBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK) {
                        light = 0;
                        mask |= dmask[d];
                    }
                    val = Math.max(val, light - dlen[d]);
                }
            }
            if (old === val && !force) {
                continue;
            }
            uint8View[coordBytes + OFFSET_LIGHT] = val;
            if (old !== val) {
                chunk.lastID++;
            }

            //TODO: copy to neib chunks

            // TODO: swap -1 to real -dlen
            let neibDist = 0, neibPotential = 0;
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        continue;
                    }
                    let coord2 = coord + dif26[d];
                    const light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                    // a4fa-12 , not obvious optimization
                    if (light >= prevLight && light >= val && light >= old) {
                        continue;
                    }
                    if (apc) {
                        neibDist = (Math.abs(x - apc.x + dx[d]) + Math.abs(y - apc.y + dy[d]) + Math.abs(z - apc.z + dz[d])) * dlen[0];
                        neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                    }
                    const waveNum = Math.max(light, val - dlen[d]);
                    this.add(chunk, coord2, neibPotential + waveNum);
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
                    chunk2.rev.lastID++;
                    for (let d = 0; d < DIR_COUNT; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        let x2 = x + dx[d], y2 = y + dy[d], z2 = z + dz[d];
                        if (chunk2.aabb.contains(x2, y2, z2)) {
                            const coord2 = chunk2.indexByWorld(x2, y2, z2);
                            const light = chunk2.uint8ByInd(coord2, qOffset + OFFSET_LIGHT);
                            mask |= 1 << d;
                            // a4fa-12 , not obvious optimization
                            if (light >= prevLight && light >= val && light >= old) {
                                continue;
                            }
                            if (apc) {
                                neibDist = (Math.abs(x2 - apc.x) + Math.abs(y2 - apc.y) + Math.abs(z2 - apc.z)) * dlen[0];
                                neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                            }
                            const waveNum = Math.max(light, val - dlen[d]);
                            this.add(chunk2.rev, coord2, neibPotential + waveNum);
                        }
                    }
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        continue;
                    }
                    let x2 = x + dx[d], y2 = y + dy[d], z2 = z + dz[d];
                    let coord2 = coord + dif26[d];
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        const light = uint8View[coord2 * strideBytes + qOffset + OFFSET_LIGHT];
                        // a4fa-12 , not obvious optimization
                        if (light >= prevLight && light >= val && light >= old) {
                            continue;
                        }
                        if (apc) {
                            neibDist = (Math.abs(x2 - apc.x) + Math.abs(y2 - apc.y) + Math.abs(z2 - apc.z)) * dlen[0];
                            neibPotential = maxPotential - Math.min(maxPotential, neibDist);
                        }
                        const waveNum = Math.max(light, val - dlen[d]);
                        this.add(chunk, coord2, neibPotential + waveNum);
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
