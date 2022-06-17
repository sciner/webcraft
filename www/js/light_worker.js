/**
 * light worker sends messages periodically, separating light waves
 */

/**
 * settings
 */

/**
 * max time spent in light loop
 */
let globalStepMs = 1000.0 / 120.0;

/**
 * inited or not
 * @type {boolean}
 */
let modulesReady = false;
let VectorCollector = null;
let Vector = null;
let DataChunk = null;
let BaseChunk = null;
const world = {
    chunkManager: null,
    defDayLight: 0,
    //queues
    light: null,
    dayLight: null,
    dayLightSrc: null,
}

const maxLight = 31;
const MASK_SRC_AMOUNT = 31;
const MASK_SRC_BLOCK = 96;
const MASK_SRC_AO = 128;
const MASK_SRC_REST = 224;

const OFFSET_SOURCE = 0;
const OFFSET_LIGHT = 1;
const OFFSET_DAY = 2;

const BITS_QUEUE_BLOCK_INDEX = 16;
const BITS_QUEUE_CHUNK_ID = 15;
const MASK_QUEUE_BLOCK_INDEX = (1 << BITS_QUEUE_BLOCK_INDEX) - 1;
const MASK_QUEUE_CHUNK_ID = ((1 << BITS_QUEUE_CHUNK_ID) - 1) << BITS_QUEUE_BLOCK_INDEX;
const MASK_QUEUE_FORCE = (1 << 31);

const dx = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
const dy = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
const dz = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
const dlen = [];
const dmask = [];
const DIR_COUNT = 26; //26 // 26 is full 3d light approx
const DIR_DOWN = 5;
const DIR_MAX_MASK = (1 << 26) - (1 << 6);

const DEFAULT_LIGHT_DAY_DISPERSE = Math.ceil(maxLight / 11);

function adjustSrc(srcLight) {
    const amount = srcLight & MASK_SRC_AMOUNT;
    if (amount > 0) {
        return (Math.min(31, amount * 2 + 1)) | (srcLight & MASK_SRC_REST);
    }
    return srcLight;
}

world.defDayLight = adjustSrc(15);

function adjustLight(dstLight) {
    return Math.max((dstLight - 1) / 2, 0);
}

function initMasks() {
    for (let i = 0; i < DIR_COUNT; i++) {
        let mask = 1 << i;
        for (let j = i + 1; j < DIR_COUNT; j++) {
            if ((dx[i] === 0 || dx[i] === dx[j])
                && (dy[i] === 0 || dy[i] === dy[j])
                && (dz[i] === 0 || dz[i] === dz[j])) {
                mask |= 1 << j;
            }
        }
        dlen.push(1 + Math.abs(dx[i]) + Math.abs(dy[i]) + Math.abs(dz[i]));
        dmask.push(mask);
    }
}

function calcDif26(size, out) {
    //TODO: move to BaseChunk
    const sx = 1, sz = size.x, sy = size.x * size.z;
    for (let i = 0; i < DIR_COUNT; i++) {
        out.push(sx * dx[i] + sy * dy[i] + sz * dz[i]);
    }
}

initMasks();

class MultiQueuePage {
    constructor(size) {
        this.size = size;
        this.arr = new Uint32Array(size);
        this.clear();
    }

    clear() {
        this.start = this.finish = 0;
        this.next = null;
    }
}

class MultiQueue {
    constructor({maxPriority, pageSize}) {
        this.headsTails = [];
        this.pageSize = pageSize;
        this.headsTails.push(null, null);
        this.maxPriority = maxPriority || 0;
        if (maxPriority) {
            for (let i = 0; i < maxPriority; i++) {
                this.headsTails.push(null, null);
            }
        }

        this.pages = [];
        this.freePageStack = [];
        this.freePageCount = 0;
    }

    push(priority, value) {
        while (this.headsTails.length < priority * 2) {
            this.headsTails.push(null, null);
            this.maxPriority++;
        }

        let curPage = this.headsTails[priority * 2 + 1];
        if (curPage && curPage.finish < curPage.size) {
            curPage.arr[curPage.finish++] = value;
            return;
        }

        // alloc page
        if (this.freePageCount === 0) {
            // create page
            this.pages.push(new MultiQueuePage(this.pageSize));
            this.freePageStack.push(null);
            this.freePageStack[0] = this.pages[this.pages.length - 1];
            this.freePageCount++;
        }

        const newPage = this.freePageStack[--this.freePageCount];
        newPage.arr[newPage.finish++] = value;
        if (curPage) {
            curPage.next = newPage;
        } else {
            // set head
            this.headsTails[priority * 2] = newPage;
        }
        // set tail
        this.headsTails[priority * 2 + 1] = newPage;
    }

    has(priority) {
        return this.headsTails[priority * 2];
    }

    freeHeadPage(priority) {
        const head = this.headsTails[priority * 2];
        this.headsTails[priority * 2] = head.next;
        if (head.next === null) {
            this.headsTails[priority * 2 + 1] = null;
        }
        head.clear();
        this.freePageStack[this.freePageCount++] = head;
    }

    shift(priority) {
        const head = this.headsTails[priority * 2];
        const val = head.arr[head.start++];
        if (head.start === head.finish) {
            this.freeHeadPage(priority);
        }
        return val;
    }
}

class LightQueue {
    constructor({offset, dirCount, capacity}) {
        // deque structure
        this.deque = new MultiQueue({maxPriority: maxLight, pageSize: 1 << 16});
        this.filled = 0;
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
        if (waveNum < 0 || waveNum > maxLight) {
            waveNum = maxLight;
        }
        this.deque.push(waveNum, chunk.dataIdShift + coord + (force ? MASK_QUEUE_FORCE : 0));
        this.filled++;
        chunk.waveCounter++;
    }

    doIter(times) {
        const {qOffset, dirCount, deque} = this;
        const {chunkById} = world.chunkManager;
        let wn = maxLight;

        let chunk = null;
        let lightChunk = null;
        let uint8View = null;
        let outerSize = null;
        let strideBytes = 0;
        let outerAABB = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let sx = 0, sy = 0, sz = 0;

        for (let tries = 0; tries < times; tries++) {
            while (wn >= 0 && !deque.has(wn)) {
                wn--;
            }
            if (wn < 0) {
                return true;
            }

            const prevLight = wn;
            //that's a pop
            let coord = deque.shift(wn);
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
            if (chunk !== newChunk) {
                chunk = newChunk;
                lightChunk = chunk.lightChunk;
                uint8View = lightChunk.uint8View;
                outerSize = lightChunk.outerSize;
                strideBytes = lightChunk.strideBytes;
                outerAABB = lightChunk.outerAABB;
                safeAABB = lightChunk.safeAABB;
                portals = lightChunk.portals;
                dif26 = lightChunk.dif26;
                sx = 1;
                sz = outerSize.x;
                sy = outerSize.x * outerSize.z;
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

            let mask = 0;
            let val = uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AMOUNT;
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
            const waveNum = Math.max(Math.max(old, val) - 1, 0);
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
                    this.add(chunk, coord2, waveNum);
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
                        let x2 = x + dx[d],
                            y2 = y + dy[d],
                            z2 = z + dz[d];
                        if (chunk2.aabb.contains(x2, y2, z2)) {
                            const coord2 = chunk2.indexByWorld(x2, y2, z2);
                            const light = chunk2.uint8ByInd(coord2, qOffset + OFFSET_LIGHT);
                            mask |= 1 << d;
                            // a4fa-12 , not obvious optimization
                            if (light >= prevLight && light >= val && light >= old) {
                                continue;
                            }
                            this.add(chunk2.rev, coord2, waveNum);
                        }
                    }
                }
                for (let d = 0; d < dirCount; d++) {
                    if ((mask & (1 << d)) !== 0) {
                        continue;
                    }
                    let x2 = x + dx[d],
                        y2 = y + dy[d],
                        z2 = z + dz[d];
                    let coord2 = coord + dif26[d];
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        this.add(chunk, coord2, waveNum);
                    }
                }
            }
        }
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

class WaveLevel {
    constructor(level) {
        this.coords = [];
        this.level = level;
    }

    setVal(level) {
        this.level = level;
        return this;
    }
}

class DirLightQueue {
    constructor({offset, disperse}) {
        this.waveLevels = [];
        this.qOffset = offset || 4;
        this.disperse = disperse || 0;
    }

    getWave(level) {
        const {waveLevels} = this;

        let len = waveLevels.length, L = -1, R = len;

        while (L + 1 < R) {
            let mid = (L + R) >> 1;
            if (waveLevels[mid].level === level) {
                return waveLevels[mid];
            }
            if (waveLevels[mid].level < level) {
                L = mid;
            } else {
                R = mid;
            }
        }

        for (let i = len; i > R; i--) {
            waveLevels[i] = waveLevels[i - 1];
        }
        waveLevels[R] = new WaveLevel(level);
        return waveLevels[R];
    }

    add(chunk, coord, force) {
        const {outerSize} = chunk;
        let lvl = chunk.lightChunk.outerAABB.y_min + Math.floor(coord / outerSize.x / outerSize.z); // get Y

        const wave = this.getWave(lvl);
        wave.coords.push(chunk.dataIdShift + coord + (force ? MASK_QUEUE_FORCE : 0));
        chunk.waveCounter++;
    }

    doIter(times) {
        const {waveLevels, qOffset, disperse} = this;
        const {chunkById} = world.chunkManager;
        let wn = maxLight;

        let curWave = null;
        let nextWave = null;
        let chunk = null;

        let lightChunk = null;
        let uint8View = null;
        let outerSize = null;
        let strideBytes = 0;
        let outerAABB = null;
        let safeAABB = null;
        let portals = null;
        let dif26 = null;
        let chunkDataId = 0;
        let sx = 0, sy = 0, sz = 0;

        for (let tries = 0; tries < times; tries++) {
            if (curWave && curWave.coords.length === 0) {
                curWave = null;
            }
            while (!curWave) {
                if (waveLevels.length === 0) {
                    return;
                }
                curWave = waveLevels.pop();
                if (curWave.coords.length === 0) {
                    curWave = null;
                    continue;
                }
                nextWave = waveLevels[waveLevels.length - 1];
                if (!nextWave || nextWave.level + 1 !== curWave.level) {
                    nextWave = new WaveLevel(curWave.level - 1);
                    waveLevels.push(nextWave);
                }
            }

            let coord = curWave.coords.pop();
            const force = coord & MASK_QUEUE_FORCE;
            coord = coord & ~MASK_QUEUE_FORCE;
            const newChunk = chunkById[coord >> BITS_QUEUE_BLOCK_INDEX];
            coord = coord & MASK_QUEUE_BLOCK_INDEX;
            if (!newChunk || newChunk.removed) {
                continue;
            }
            if (chunk !== newChunk) {
                chunk = newChunk;
                lightChunk = chunk.lightChunk;
                uint8View = lightChunk.uint8View;
                outerSize = lightChunk.outerSize;
                strideBytes = lightChunk.strideBytes;
                outerAABB = lightChunk.outerAABB;
                safeAABB = lightChunk.safeAABB;
                portals = lightChunk.portals;
                dif26 = lightChunk.dif26;
                sx = 1;
                sz = outerSize.x;
                sy = outerSize.x * outerSize.z;
                chunkDataId = chunk.dataIdShift;
            }
            chunk.waveCounter--;

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

            let mask = 0;
            const coordBytes = coord * strideBytes + qOffset;
            const old = uint8View[coordBytes + OFFSET_SOURCE];
            let val;
            if ((uint8View[coord * strideBytes + OFFSET_SOURCE] & MASK_SRC_REST) > 0) {
                val = 0;
            } else {
                val = uint8View[coordBytes + sy * strideBytes + OFFSET_SOURCE];
                if (disperse > 0) {
                    if (val === maxLight && val === old && !force) {
                        continue;
                    }
                    let cnt = 0;
                    for (let d = 0; d < 4; d++) {
                        if (uint8View[coordBytes + dif26[d] * strideBytes + OFFSET_SOURCE] === maxLight) {
                            cnt++;
                            if (uint8View[coordBytes + (dif26[d] + sy) * strideBytes + OFFSET_SOURCE] === maxLight) {
                                mask |= 1 << d;
                            }
                        }
                    }
                    if (val < maxLight) {
                        if (cnt > 0) {
                            val = Math.min(val + disperse, maxLight);
                        } else {
                            val = 0;
                        }
                    }
                }
            }
            if (old === val && !force) {
                continue;
            }
            let changedDisperse = (disperse > 0) && (((val === maxLight) ^ (old === maxLight)) || force);
            uint8View[coordBytes + OFFSET_SOURCE] = val;
            // add to queue for light calc
            let maxVal = uint8View[coordBytes + OFFSET_LIGHT];
            if (maxVal < val) {
                // mxdl-13 not obvious, good for big amount of lights
                maxVal = uint8View[coordBytes + OFFSET_LIGHT] = val;
                world.dayLight.add(chunk, coord, maxVal, true);
                chunk.lastID++;
            } else {
                world.dayLight.add(chunk, coord, maxVal);
            }
            //TODO: copy to neib chunks
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                nextWave.coords.push(chunkDataId + coord - sy);
                chunk.waveCounter++;
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        curWave.coords.push(chunkDataId + coord + dif26[d]);
                        chunk.waveCounter++;
                    }
                }
            } else {
                for (let p = 0; p < portals.length; p++) {
                    const chunk2 = portals[p].toRegion;
                    if (!portals[p].aabb.contains(x, y, z)) {
                        continue;
                    }
                    const coord2 = chunk2.indexByWorld(x, y, z);
                    chunk2.setUint8ByInd(coord2, qOffset + OFFSET_SOURCE, val);
                    chunk2.setUint8ByInd(coord2, qOffset + OFFSET_LIGHT, maxVal);
                    let x2 = x,
                        y2 = y - 1,
                        z2 = z;
                    const dataIdShift2 = chunk2.rev.dataIdShift;
                    if (chunk2.aabb.contains(x2, y2, z2)) {
                        nextWave.coords.push(dataIdShift2 + chunk2.indexByWorld(x2, y2, z2));
                        chunk2.rev.waveCounter++;
                        mask |= (1 << DIR_DOWN); //down
                    }
                    if (changedDisperse) {
                        for (let d = 0; d < 4; d++) {
                            if ((mask & (1 << d)) !== 0) {
                                continue;
                            }
                            x2 = x + dx[d];
                            y2 = y;
                            z2 = z + dz[d];
                            if (chunk2.aabb.contains(x2, y2, z2)) {
                                mask |= 1 << d;
                                curWave.coords.push(dataIdShift2 + chunk2.indexByWorld(x2, y2, z2));
                                chunk2.rev.waveCounter++;
                            }
                        }
                    }
                }
                if ((mask & (1 << DIR_DOWN)) === 0) {
                    let x2 = x,
                        y2 = y - 1,
                        z2 = z;
                    let coord2 = coord - sy;
                    if (lightChunk.aabb.contains(x2, y2, z2)) {
                        nextWave.coords.push(chunkDataId + coord2);
                        chunk.waveCounter++;
                    }
                }
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        let x2 = x + dx[d],
                            y2 = y,
                            z2 = z + dz[d];
                        let coord2 = coord + dif26[d];
                        if (lightChunk.aabb.contains(x2, y2, z2)) {
                            curWave.coords.push(chunkDataId + coord2);
                            chunk.waveCounter++;
                        }
                    }
                }
            }
        }
        if (curWave && curWave.coords.length > 0) {
            //its still alive, push it
            waveLevels.push(curWave);
        }
        return false;
    }
}


class ChunkManager {
    constructor() {
        this.chunks = new VectorCollector();
        this.list = [];

        const INF = 1000000000;
        this.lightBase = new BaseChunk({size: new Vector(INF, INF, INF)}).setPos(new Vector(-INF / 2, -INF / 2, -INF / 2));
        this.chunkById = [null];
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

class Chunk {
    constructor(args) {
        this.dataId = args.dataId;
        this.dataIdShift = args.dataId << BITS_QUEUE_BLOCK_INDEX;
        this.addr = new Vector(args.addr.x, args.addr.y, args.addr.z);
        this.size = new Vector(args.size.x, args.size.y, args.size.z);
        this.lastID = 0;
        this.sentID = 0;
        this.removed = false;
        this.waveCounter = 0;
        this.crc = 0;

        this.lightChunk = new DataChunk({
            size: args.size,
            strideBytes: 4
        }).setPos(new Vector().copyFrom(args.addr).mul(args.size));

        calcDif26(this.lightChunk.outerSize, this.lightChunk.dif26);

        this.lightChunk.rev = this;
        if (args.light_buffer) {
            this.setLightFromBuffer(args.light_buffer);
        }

        this.outerSize = this.lightChunk.outerSize;
        this.len = this.lightChunk.insideLen;
        this.outerLen = this.lightChunk.outerLen;
    }

    get chunkManager() {
        return world.chunkManager;
    }

    setLightFromBuffer(buf) {
        const {uint8View, padding, size, outerSize, strideBytes} = this.lightChunk;
        const src = new Uint8Array(buf);
        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                const indFrom = (y * size.z + z) * size.x;
                let indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                for (let x = 0; x < size.x; x++) {
                    uint8View[indTo + OFFSET_SOURCE] = adjustSrc(src[indFrom + x]);
                    indTo += strideBytes;
                }
            }
        }
    }

    init() {
        this.resultLen = this.outerLen;
        this.lightResult = null;
    }

    fillOuter() {
        //checks neighbour chunks
        const {lightChunk} = this;
        const {outerSize, portals, shiftCoord, aabb, uint8View, strideBytes, safeAABB, dif26} = lightChunk;
        const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;
        let found = false;
        let foundDay = false;

        // default value for daylight
        const defLight = lightChunk.pos.y >= 0 ? world.defDayLight : 0;
        const disperse = world.dayLightSrc.disperse;
        if (defLight > 0) {
            let y = aabb.y_max;
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = x * sx + y * sy + z * sz + shiftCoord;
                    uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] = defLight;
                }
        }

        let upPortal = false;

        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            const other = portal.toRegion;
            const p = portal.aabb;
            const outer2 = other.outerSize;
            const inside2 = other.aabb;
            const shift2 = other.shiftCoord;
            const bytes2 = other.uint8View;
            const sy2 = outer2.x * outer2.z, sx2 = 1, sz2 = outer2.x;

            if (other.aabb.y_min > aabb.y_min) {
                upPortal = true;
            }

            for (let x = p.x_min; x < p.x_max; x++)
                for (let y = p.y_min; y < p.y_max; y++)
                    for (let z = p.z_min; z < p.z_max; z++) {
                        const coord1 = (sx * x + sy * y + sz * z + shiftCoord) * strideBytes;
                        const coord2 = (sx2 * x + sy2 * y + sz2 * z + shift2) * strideBytes;
                        //TODO: optimize contains here?
                        const f1 = aabb.contains(x, y, z);
                        const f2 = inside2.contains(x, y, z);

                        // copy light
                        const light = bytes2[coord2 + OFFSET_LIGHT];
                        if (light > 0) {
                            uint8View[coord1 + OFFSET_LIGHT] = light;
                        }

                        // copy AO through border
                        if (f1) {
                            if ((bytes2[coord2 + OFFSET_SOURCE] & MASK_SRC_AO) !== (uint8View[coord1 + OFFSET_SOURCE] & MASK_SRC_AO)) {
                                other.rev.lastID++;
                            }
                            bytes2[coord2 + OFFSET_SOURCE] = uint8View[coord1 + OFFSET_SOURCE]
                        }
                        if (f2) {
                            if ((uint8View[coord1 + OFFSET_SOURCE] & MASK_SRC_AO) !== (bytes2[coord2 + OFFSET_SOURCE] & MASK_SRC_AO)) {
                                found = true;
                            }
                            uint8View[coord1 + OFFSET_SOURCE] = bytes2[coord2 + OFFSET_SOURCE]
                        }

                        // daylight
                        const dayLight = bytes2[coord2 + OFFSET_DAY + OFFSET_LIGHT];
                        const dayLightSrc = bytes2[coord2 + OFFSET_DAY + OFFSET_SOURCE];
                        uint8View[coord1 + OFFSET_DAY + OFFSET_LIGHT] = dayLight;
                        if (f2 || f1 && dayLightSrc > 0) {
                            uint8View[coord1 + OFFSET_DAY + OFFSET_SOURCE] = dayLightSrc;
                        }
                        if (f2 && dayLightSrc !== defLight) {
                            foundDay = true;
                        }
                    }
        }

        if (upPortal) {
            // fix for black chunks in case respawn above y=80
            // there's a chunk above us => dont try to upload texture before the queue goes down to center of chunk
            world.dayLightSrc.add(this, (outerSize.x >> 1) * sx + (outerSize.z >> 1) * sz + (outerSize.y >> 1) * sy);
        }


        // add light to queue
        for (let y = aabb.y_min; y < aabb.y_max; y++)
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = x * sx + y * sy + z * sz + shiftCoord, coordBytes = coord * strideBytes;

                    let m = 0;
                    for (let d = 0; d < 6; d++) {
                        m = Math.max(m, uint8View[(coord + dif26[d]) * strideBytes + OFFSET_LIGHT]);
                    }
                    m = Math.max(m, uint8View[coordBytes + OFFSET_LIGHT]);
                    const isBlock = (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_BLOCK) === MASK_SRC_BLOCK;
                    if (!isBlock) {
                        //TODO: check if its water or something advanced blocking light
                        m = Math.max(m, uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AMOUNT);
                    }
                    if (m > 0) {
                        world.light.add(this, coord, m);
                    }
                    found = found || (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AO) > 0;

                    foundDay = foundDay || (uint8View[coordBytes + OFFSET_SOURCE] & MASK_SRC_AO) > 0 || isBlock
                }

        if (foundDay) {
            for (let y = aabb.y_min; y < aabb.y_max; y++)
                for (let z = aabb.z_min; z < aabb.z_max; z++)
                    for (let x = aabb.x_min; x < aabb.x_max; x++) {
                        if (safeAABB.contains(x, y, z)) {
                            continue;
                        }
                        const coord = x * sx + y * sy + z * sz + shiftCoord, coordBytes = coord * strideBytes;
                        if (uint8View[coordBytes + sy * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                            world.dayLightSrc.add(this, coord);
                        } else /* if (disperse > 0) */ // somehow there's a bug with this thing
                        {
                            for (let d = 0; d < 4; d++) {
                                if (uint8View[(coord + dif26[d]) * strideBytes + OFFSET_DAY + OFFSET_SOURCE] === maxLight) {
                                    world.dayLightSrc.add(this, coord);
                                    break;
                                }
                            }
                        }
                        let m = uint8View[coordBytes + OFFSET_LIGHT];
                        for (let d = 0; d < 6; d++) {
                            m = Math.max(m, uint8View[(coord + dif26[d]) * strideBytes + OFFSET_DAY + OFFSET_LIGHT]);
                        }
                        if (m > 0) {
                            world.dayLight.add(this, coord, m);
                        }
                    }
        } else {
            if (defLight > 0) {
                for (let y = aabb.y_min; y < aabb.y_max; y++)
                    for (let z = aabb.z_min; z < aabb.z_max; z++)
                        for (let x = aabb.x_min; x < aabb.x_max; x++) {
                            const coord = x * sx + y * sy + z * sz + shiftCoord,
                                coordBytes = coord * strideBytes + OFFSET_DAY
                            uint8View[coordBytes + OFFSET_SOURCE] = defLight;
                            uint8View[coordBytes + OFFSET_LIGHT] = defLight
                        }
                // copy found dayLight to portals
                for (let i = 0; i < portals.length; i++) {
                    const portal = portals[i];
                    const other = portal.toRegion;
                    const p = portal.aabb;
                    const outer2 = other.outerSize;
                    const inside2 = other.aabb;
                    const shift2 = other.shiftCoord;
                    const bytes2 = other.uint8View;
                    const sy2 = outer2.x * outer2.z, sx2 = 1, sz2 = outer2.x;

                    for (let x = p.x_min; x < p.x_max; x++)
                        for (let y = p.y_min; y < p.y_max; y++)
                            for (let z = p.z_min; z < p.z_max; z++) {
                                if (aabb.contains(x, y, z)) {
                                    const coord2 = (sx2 * x + sy2 * y + sz2 * z + shift2) * strideBytes + OFFSET_DAY;
                                    bytes2[coord2 + OFFSET_SOURCE] = defLight;
                                    bytes2[coord2 + OFFSET_LIGHT] = defLight;
                                }
                            }
                }
            }
        }
        if (found || foundDay) {
            this.lastID++;
        }
    }

    calcResult(is565) {
        const {lightChunk} = this;
        const {outerSize, uint8View, strideBytes} = lightChunk;
        const elemPerBlock = is565 ? 1 : 4;
        if (!this.lightResult) {
            if (is565) {
                this.lightResult = new Uint16Array(this.resultLen * elemPerBlock);
            } else {
                this.lightResult = new Uint8Array(this.resultLen * elemPerBlock);
            }
        }

        const result = this.lightResult;
        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;

        //TODO: separate multiple cycle

        // Light + AO
        let changed = false;
        let pv1, pv2, pv3, pv4, pv5, pv6, pv7, pv8;
        let ind = 0, ind2 = lightChunk.outerLen * elemPerBlock;

        this.result_crc_sum = 0;

        //
        const addResult1 = (A, A2, G) => {
            if (is565) {
                const prev_value = result[ind];
                const new_value = (Math.round(A * 31.0 / 15.0) << 11)
                    + (Math.round(G * 63.0) << 5)
                    + (Math.round(31.0 - (A2 * 31.0 / 15.0)) << 0);
                result[ind++] = new_value;
                if (prev_value != new_value) {
                    changed = true;
                }
                this.result_crc_sum += new_value;
            } else {
                if (!changed) {
                    pv1 = result[ind + 0];
                    pv2 = result[ind + 1];
                    pv3 = result[ind + 2];
                    pv4 = result[ind + 3];
                }
                result[ind++] = Math.round(A * 255.0 / 15.0);
                result[ind++] = Math.round(G * 255.0);
                result[ind++] = Math.round(255.0 - (A2 * 255.0 / 15.0));
                result[ind++] = 0;
                if (!changed) {
                    if (pv1 != result[ind - 4] || pv2 != result[ind - 3] || pv3 != result[ind - 2] || pv4 != result[ind - 1]) {
                        changed = true;
                    }
                }
                this.result_crc_sum += (
                    result[ind - 4] +
                    result[ind - 3] +
                    result[ind - 2] +
                    result[ind - 1]
                );
            }
        };

        // const addResult2 = (A, A2, R, G, B) => {
        //     if (is565) {
        //         const prev_value = result[ind2];
        //         const new_value = (Math.round(R * 31.0 / 4.0) << 11)
        //             + (Math.round(G * 63.0 / 4.0) << 5)
        //             + (Math.round(B * 31.0 / 4.0) << 0);
        //         result[ind2++] = new_value
        //         if(prev_value != new_value) {
        //             changed = true;
        //         }
        //         this.result_crc_sum += new_value;
        //     } else {
        //         if(!changed) {
        //             pv1 = result[ind2 + 0];
        //             pv2 = result[ind2 + 1];
        //             pv3 = result[ind2 + 2];
        //             pv4 = result[ind2 + 3];
        //             pv5 = result[ind2 + 4];
        //             pv6 = result[ind2 + 5];
        //             pv7 = result[ind2 + 6];
        //             pv8 = result[ind2 + 7];
        //         }
        //         result[ind2++] = Math.round(R * 255.0 / 4.0);
        //         result[ind2++] = Math.round(G * 255.0 / 4.0);
        //         result[ind2++] = Math.round(B * 255.0 / 4.0);
        //         result[ind2++] = 0;
        //         result[ind2++] = Math.round(A * 255.0 / 15.0);
        //         result[ind2++] = 0;
        //         result[ind2++] = Math.round(255.0 - (A2 * 255.0 / 15.0));
        //         result[ind2++] = 0;
        //         if(!changed) {
        //             if(
        //                 pv1 != result[ind2 - 8] || pv2 != result[ind2 - 7] ||
        //                 pv3 != result[ind2 - 6] || pv4 != result[ind2 - 5] ||
        //                 pv5 != result[ind2 - 4] || pv6 != result[ind2 - 3] ||
        //                 pv7 != result[ind2 - 2] || pv8 != result[ind2 - 1]
        //             ) {
        //                 changed = true;
        //             }
        //         }
        //         this.result_crc_sum += (
        //             result[ind2 - 8] +
        //             result[ind2 - 7] +
        //             result[ind2 - 6] +
        //             result[ind2 - 5] +
        //             result[ind2 - 4] +
        //             result[ind2 - 3] +
        //             result[ind2 - 2] +
        //             result[ind2 - 1]
        //         );
        //     }
        // };

        for (let y = 0; y < outerSize.y; y++)
            for (let z = 0; z < outerSize.z; z++)
                for (let x = 0; x < outerSize.x; x++) {
                    const coord0 = sx * x + sy * y + sz * z;

                    const boundX = (x === outerSize.x - 1) ? sx : 0;
                    const boundY = (y === outerSize.y - 1) ? sy : 0;
                    const boundZ = (z === outerSize.z - 1) ? sz : 0;

                    let coord = coord0 - boundX - boundY - boundZ + OFFSET_LIGHT;
                    let A = Math.max(Math.max(Math.max(uint8View[coord], uint8View[coord + sx])),
                        Math.max(uint8View[coord + sy], uint8View[coord + sx + sy]),
                        Math.max(Math.max(uint8View[coord + sz], uint8View[coord + sx + sz]),
                            Math.max(uint8View[coord + sy + sz], uint8View[coord + sx + sy + sz])));
                    A = adjustLight(A);

                    // add day light
                    coord = coord0 - boundX - boundY - boundZ + OFFSET_DAY + OFFSET_LIGHT;
                    let A2 = Math.max(Math.max(Math.max(uint8View[coord], uint8View[coord + sx])),
                        Math.max(uint8View[coord + sy], uint8View[coord + sx + sy]),
                        Math.max(Math.max(uint8View[coord + sz], uint8View[coord + sx + sz]),
                            Math.max(uint8View[coord + sy + sz], uint8View[coord + sx + sy + sz])));
                    A2 = adjustLight(A2);

                    addResult1(A, A2, (uint8View[coord0 + OFFSET_SOURCE] & MASK_SRC_AO) > 0 ? 1 : 0);
                    // coord = coord0 - boundY - boundZ + OFFSET_AO;
                    // const R1 = uint8View[coord] + uint8View[coord + sy + sz];
                    // const R2 = uint8View[coord + sy] + uint8View[coord + sz];
                    // const R = R1 + R2 + (R1 === 0 && R2 === 2) + (R1 === 2 && R2 === 0);
                    //
                    // coord = coord0 - boundX - boundY + OFFSET_AO;
                    // const G1 = uint8View[coord] + uint8View[coord + sy + sx];
                    // const G2 = uint8View[coord + sy] + uint8View[coord + sx];
                    // const G = G1 + G2 + (G1 === 0 && G2 === 2) + (G1 === 2 && G2 === 0);
                    //
                    // coord = coord0 - boundX - boundZ + OFFSET_AO;
                    // const B1 = uint8View[coord] + uint8View[coord + sx + sz];
                    // const B2 = uint8View[coord + sx] + uint8View[coord + sz];
                    // const B = B1 + B2 + (B1 === 0 && B2 === 2) + (B1 === 2 && B2 === 0);

                    // addResult2(A, A2, R, G, B);
                }

        //
        if (changed) {
            this.crc++;
        } else {
            // TODO: find out why are there so many calcResults
            // console.log('WTF');
        }
    }
}

function run() {
    const msLimit = 16;
    const resultLimit = 5;
    const startTime = performance.now();
    let endTime = performance.now();
    let endChunks = 0;
    let ready;
    do {
        ready = 2;
        if (world.light.doIter(10000)) {
            ready--;
        }
        endTime = performance.now();
        // if (endTime > startTime + msLimit) {
        //     break;
        // }
        if (world.dayLightSrc.doIter(20000)) {
            ready--;
        }
        // if (endTime > startTime + msLimit) {
        //     break;
        // }
        endTime = performance.now();
        if (world.dayLight.doIter(10000)) {
            ready--;
        }
        endTime = performance.now();
    } while (endTime < startTime + msLimit && ready > 0);

    world.chunkManager.list.forEach((chunk) => {
        if (chunk.waveCounter !== 0)
            return;
        if (chunk.sentID === chunk.lastID)
            return;
        chunk.sentID = chunk.lastID;

        chunk.calcResult(renderFormat === 'rgb565unorm');

        // no need to send if no changes
        if (chunk.crc != chunk.crcO) {
            chunk.crcO = chunk.crc;
            const is_zero = (chunk.result_crc_sum == 0 && (
                (!('result_crc_sumO' in chunk)) ||
                (chunk.result_crc_sumO == 0)
            ));
            chunk.result_crc_sumO = chunk.result_crc_sum;
            if (!is_zero) {
                // console.log(8)
                worker.postMessage(['light_generated', {
                    addr: chunk.addr,
                    lightmap_buffer: chunk.lightResult.buffer,
                    lightID: chunk.lastID
                }]);
            }
        }

        endChunks++;
        if (endChunks >= resultLimit) {
            return;
        }
    })
}

let renderFormat = 'rgba8';

const msgQueue = [];

const worker = {

    init: function () {
        if (typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs);
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = onMessageFunc
        }
    },

    postMessage: function (message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

}

worker.init();

preLoad().then();

async function preLoad() {
    const start = performance.now();

    await import("./helpers.js").then(module => {
        Vector = module.Vector;
        VectorCollector = module.VectorCollector;
    });
    await import('./core/BaseChunk.js').then(module => {
        BaseChunk = module.BaseChunk;
    });
    await import('./core/DataChunk.js').then(module => {
        DataChunk = module.DataChunk;
    });
    modulesReady = true;

    console.debug('[LightWorker] Preloaded, load time:', performance.now() - start);
}

async function initWorld() {

    if (!modulesReady) {
        await preLoad();
    }

    // if (!testDayLight()) {
    //     console.log("day test failed");
    // }
    // if (!testDisperse()) {
    //     console.log("disperse test failed");
    // }

    //for now , its nothing
    world.chunkManager = new ChunkManager();
    world.light = new LightQueue({offset: 0, dirCount: 6});
    world.dayLight = new LightQueue({offset: OFFSET_DAY, dirCount: 6});
    world.dayLightSrc = new DirLightQueue({
        offset: OFFSET_DAY,
        disperse: DEFAULT_LIGHT_DAY_DISPERSE
    })
    for (let item of msgQueue) {
        await onmessage(item);
    }
    msgQueue.length = 0;
    worker.postMessage(['worker_inited', null]);

    setInterval(run, 20);
}

async function onMessageFunc(e) {
    let data = e;
    if (typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    const cmd = data[0];
    const args = data[1];
    if (cmd == 'init') {
        // Init modules
        initWorld();
        return;
    }
    if (!modulesReady) {
        return msgQueue.push(data);
    }
    //do stuff

    switch (cmd) {
        case 'initRender': {
            renderFormat = args.texFormat;
            break;
        }
        case 'createChunk': {
            if (!world.chunkManager.getChunk(args.addr)) {
                let chunk = new Chunk(args);
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();
            }
            break;
        }
        case 'destructChunk': {
            for (let addr of args) {
                let chunk = world.chunkManager.getChunk(addr);
                if (chunk) {
                    chunk.removed = true;
                    world.chunkManager.delete(chunk);
                }
            }
            break;
        }
        case 'setBlock': {
            let chunk = world.chunkManager.getChunk(args.addr);
            if (chunk) {
                const {light_source, x, y, z} = args;
                const {lightChunk} = chunk;
                const {portals, uint8View, strideBytes} = lightChunk;
                const ind = lightChunk.indexByWorld(x, y, z);
                const light = uint8View[ind * strideBytes + OFFSET_LIGHT];
                const src = adjustSrc(light_source);
                const old_src = uint8View[ind * strideBytes + OFFSET_SOURCE];
                uint8View[ind * strideBytes + OFFSET_SOURCE] = src;
                world.light.add(chunk, ind, Math.max(light, src));
                // push ao
                const setAo = ((src & MASK_SRC_AO) !== (old_src & MASK_SRC_AO));
                //TODO: move it to adjust func
                if ((src & MASK_SRC_REST) !== (old_src & MASK_SRC_REST)) {
                    world.dayLightSrc.add(chunk, ind);
                    world.dayLight.add(chunk, ind, maxLight);
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
    }
}

if (typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}

function testDayLight() {
    world.chunkManager = new ChunkManager();
    world.light = new LightQueue({offset: 0});
    world.dayLight = new LightQueue({offset: OFFSET_DAY});
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY});

    let innerDataEmpty = new Uint8Array([0]);
    let innerDataSolid = new Uint8Array([MASK_SRC_BLOCK + MASK_SRC_AO]);
    let w = 1;

    let centerChunk = [];

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            for (let z = 0; z < 3; z++) {
                const light_buffer = (y < 2) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x === 1 && z === 1 && y <= 1) {
                    centerChunk.push(chunk);
                }
            }
        }
    }

    world.dayLightSrc.doIter(10000);
    world.dayLight.doIter(10000);

    for (let cc of centerChunk) {
        let {uint8View, outerLen, strideBytes} = cc.lightChunk;
        for (let coord = 0; coord < outerLen; coord++) {
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_LIGHT] > 0) {
                return false;
            }
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                return false;
            }
        }
    }
    return true;
}

function testDisperse() {
    world.chunkManager = new ChunkManager();
    world.light = new LightQueue({offset: 0});
    world.dayLight = new LightQueue({offset: OFFSET_DAY});
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY, disperse: Math.ceil(maxLight / 2)});

    let innerDataEmpty = new Uint8Array([0]);
    let innerDataSolid = new Uint8Array([MASK_SRC_BLOCK + MASK_SRC_AO]);
    let w = 1;

    let centerChunk = [];

    const maxY = 3;
    for (let y = 0; y < maxY; y++) {
        for (let x = 0; x < 3; x++) {
            for (let z = 0; z < 3; z++) {
                const light_buffer = (y < maxY - 1) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x === 1 && z === 1 && y < maxY - 1) {
                    centerChunk.push(chunk);
                }
                // if (y < maxY - 1) {
                //     centerChunk.push(chunk);
                // }
                world.dayLightSrc.doIter(100);
                world.dayLight.doIter(2000);
            }
        }
    }
    // world.dayLight.doIter(10000);
    for (let cc of centerChunk) {
        let {uint8View, outerLen, strideBytes} = cc.lightChunk;
        for (let coord = 0; coord < outerLen; coord++) {
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_LIGHT] > 0) {
                return false;
            }
            if (uint8View[coord * strideBytes + OFFSET_DAY + OFFSET_SOURCE] > 0) {
                return false;
            }
        }
    }
    return true;
}
