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

const maxLight = 32;
const MASK_BLOCK = 127;
const MASK_AO = 128;

const OFFSET_SOURCE = 0;
const OFFSET_LIGHT = 1;
const OFFSET_PREV = 2;
const OFFSET_AO = 3;
const OFFSET_SOURCE_PREV = 3;
const OFFSET_DAY = 4;

const dx = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
const dy = [0, 0, 0, 0, 1, -1, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
const dz = [0, 0, 1, -1, 0, 0, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
const dlen = [];
const dmask = [];
const DIR_COUNT = 26; //26 // 26 is full 3d light approx
const DIR_DOWN = 5;
const DIR_MAX_MASK = (1<<26) - (1<<6);

const DEFAULT_LIGHT_DAY_DISPERSE = Math.ceil(maxLight / 11);

function adjustSrc(srcLight) {
    srcLight = srcLight & MASK_BLOCK;
    if (srcLight * 2 < MASK_BLOCK && srcLight > 0) {
        srcLight = srcLight * 2 + 2;
    }
    return srcLight;
}

world.defDayLight = adjustSrc(15);

function adjustLight(dstLight) {
    return Math.max((dstLight - 2) / 2, 0);
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
    for (let i=0;i<DIR_COUNT;i++) {
        out.push(sx * dx[i] + sy * dy[i] + sz * dz[i]);
    }
}

initMasks();

class LightQueue {
    constructor({offset, dirCount, capacity}) {
        // deque structure
        this.dequeChunk = [];
        this.dequeCoord = new Int32Array(0);
        this.capacity = 0;
        this.filled = 0;
        this.position = 0;
        this.heads = [];
        for (let i = 0; i <= maxLight; i++) {
            this.heads.push(-1);
        }
        this.resizeQueue(capacity || 32768);

        // offset in data
        this.qOffset = offset || 0;
        this.dirCount = dirCount || DIR_COUNT;
    }

    resizeQueue(newCap) {
        const oldCoord = this.dequeCoord;
        const newCoord = this.dequeCoord = new Int32Array(newCap * 2);
        newCoord.set(oldCoord, 0);
        this.dequeChunk.length = this.capacity = newCap;
    }

    /**
     * @param chunk
     * @param coord
     * @param waveNum
     */
    add(chunk, coord, waveNum) {
        if (waveNum < 0 || waveNum > maxLight) {
            waveNum = maxLight;
        }
        if (this.filled * 3 > this.capacity * 2) {
            this.resizeQueue(this.capacity * 2);
        }
        const cap = this.capacity;
        const {dequeChunk} = this;
        let {position} = this;
        while (dequeChunk[position]) {
            position = (position + 1) % cap;
        }
        dequeChunk[position] = chunk;
        this.dequeCoord[position * 2] = coord;
        this.dequeCoord[position * 2 + 1] = this.heads[waveNum];
        this.heads[waveNum] = position;
        this.position = (position + 1) % cap;
        this.filled++;
        chunk.waveCounter++;
    }

    doIter(times) {
        const {qOffset, dirCount, heads} = this;
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
            while (wn >= 0 && heads[wn] < 0) {
                wn--;
            }
            if (wn < 0) {
                return true;
            }
            //that's a pop
            const pos = heads[wn];
            let newChunk = this.dequeChunk[pos];
            this.dequeChunk[pos] = null;
            const coord = this.dequeCoord[pos * 2];
            heads[wn] = this.dequeCoord[pos * 2 + 1];
            newChunk.waveCounter--;
            this.filled--;
            // pop end
            if (newChunk.removed) {
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
            let val = uint8View[coordBytes + OFFSET_SOURCE];
            const old = uint8View[coordBytes + OFFSET_LIGHT];
            const prev = uint8View[coordBytes + OFFSET_PREV];
            if (uint8View[coord * strideBytes + OFFSET_SOURCE] === MASK_BLOCK) {
                val = 0;
            } else {
                if (val === maxLight && val === old && val === prev)
                {
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
                    if (uint8View[coord2 * strideBytes + OFFSET_SOURCE] === MASK_BLOCK) {
                        light = 0;
                        mask |= dmask[d];
                    }
                    val = Math.max(val, light - dlen[d]);
                }
            }
            if (old === val && prev === val) {
                continue;
            }
            uint8View[coordBytes + OFFSET_LIGHT] = val;
            uint8View[coordBytes + OFFSET_PREV] = val;
            chunk.lastID++;

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
                    if (light >= prev && light >= val && light >= old) {
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
                            if (light >= prev && light >= val && light >= old) {
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
        this.chunks = [];
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

    add(chunk, coord) {
        const { outerSize } = chunk;
        let lvl = chunk.lightChunk.outerAABB.y_min + Math.floor(coord / outerSize.x / outerSize.z); // get Y

        const wave = this.getWave(lvl);
        wave.chunks.push(chunk);
        wave.coords.push(coord);
        chunk.waveCounter++;
    }

    doIter(times) {
        const {waveLevels, qOffset, disperse} = this;
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

            let newChunk = curWave.chunks.pop();
            const coord = curWave.coords.pop();
            if (newChunk.removed) {
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
            const prev = uint8View[coordBytes + OFFSET_SOURCE_PREV];
            if (uint8View[coord * strideBytes + OFFSET_SOURCE] === MASK_BLOCK ||
                uint8View[coord * strideBytes + OFFSET_AO] !== 0) {
                val = 0;
            } else {
                val = uint8View[coordBytes + sy * strideBytes + OFFSET_SOURCE];
                if (disperse > 0) {
                    if (val === maxLight && val === old && val === prev) {
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
            if (old === val && prev === val) {
                continue;
            }
            let changedDisperse = (disperse > 0) && (((val === maxLight) ^ (prev === maxLight)) || (old !== prev));
            uint8View[coordBytes + OFFSET_SOURCE] = val;
            uint8View[coordBytes + OFFSET_SOURCE_PREV] = val;

            // add to queue for light calc

            const maxVal = Math.max(val, uint8View[coordBytes + OFFSET_LIGHT]);
            world.dayLight.add(chunk, coord, maxVal);
            // mxdl-13 not obvious, good for big amount of lights
            uint8View[coordBytes + OFFSET_LIGHT] = maxVal;
            chunk.lastID++;

            //TODO: copy to neib chunks
            if (safeAABB.contains(x, y, z)) {
                // super fast case - we are inside data chunk
                nextWave.chunks.push(chunk);
                nextWave.coords.push(coord - sy);
                chunk.waveCounter++;
                if (changedDisperse) {
                    for (let d = 0; d < 4; d++) {
                        if ((mask & (1 << d)) !== 0) {
                            continue;
                        }
                        curWave.chunks.push(chunk);
                        curWave.coords.push(coord + dif26[d]);
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
                    if (chunk2.aabb.contains(x2, y2, z2)) {
                        nextWave.chunks.push(chunk2.rev);
                        nextWave.coords.push(chunk2.indexByWorld(x2, y2, z2));
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
                                curWave.chunks.push(chunk2.rev);
                                curWave.coords.push(chunk2.indexByWorld(x2, y2, z2));
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
                        nextWave.chunks.push(chunk);
                        nextWave.coords.push(coord2);
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
                            curWave.chunks.push(chunk);
                            curWave.coords.push(coord2);
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
    }

    // Get
    getChunk(addr) {
        return this.chunks.get(addr);
    }

    add(chunk) {
        this.list.push(chunk);
        this.chunks.add(chunk.addr, chunk);
        this.lightBase.addSub(chunk.lightChunk);
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.list.splice(this.list.indexOf(chunk), 1);
            this.lightBase.removeSub(chunk.lightChunk);
        }
    }
}

class Chunk {
    constructor(args) {
        this.addr = new Vector(args.addr.x, args.addr.y, args.addr.z);
        this.size = new Vector(args.size.x, args.size.y, args.size.z);
        this.lastID = 0;
        this.sentID = 0;
        this.removed = false;
        this.waveCounter = 0;

        this.lightChunk = new DataChunk({
            size: args.size,
            strideBytes: 8
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
                    uint8View[indTo + OFFSET_AO] = (src[indFrom + x] & MASK_AO) > 0 ? 1 : 0;
                    indTo += strideBytes;
                }
            }
        }
    }

    init() {
        this.resultLen = this.outerLen;
        this.lightResult = new Uint8Array(this.resultLen * 4 * 2);
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

        for (let portal of portals) {
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
                            if (bytes2[coord2 + OFFSET_AO] !== uint8View[coord1 + OFFSET_AO]) {
                                other.rev.lastID++;
                                bytes2[coord2 + OFFSET_AO] = uint8View[coord1 + OFFSET_AO]
                            }
                        }
                        if (f2) {
                            uint8View[coord1 + OFFSET_SOURCE] = bytes2[coord2 + OFFSET_SOURCE]
                            if (uint8View[coord1 + OFFSET_AO] !== bytes2[coord2 + OFFSET_AO]) {
                                found = true;
                                uint8View[coord1 + OFFSET_AO] = bytes2[coord2 + OFFSET_AO]
                            }
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

        // add light to queue
        for (let y = aabb.y_min; y < aabb.y_max; y++)
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = x * sx + y * sy + z * sz + shiftCoord, coordBytes = coord * strideBytes;

                    let m = 0;
                    for (let d=0;d<6;d++) {
                        m = Math.max(m, uint8View[(coord + dif26[d]) * strideBytes + OFFSET_LIGHT]);
                    }
                    m = Math.max(m, uint8View[coordBytes + OFFSET_LIGHT]);
                    const isBlock = uint8View[coordBytes + OFFSET_SOURCE] === MASK_BLOCK;
                    if (!isBlock) {
                        m = Math.max(m, uint8View[coordBytes + OFFSET_SOURCE]);
                    }
                    if (m > 0) {
                        world.light.add(this, coord, m);
                    }
                    found = found || uint8View[coordBytes + OFFSET_AO] > 0;

                    foundDay = foundDay || uint8View[coordBytes + OFFSET_AO] > 0 || isBlock
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
                            for (let d=0;d<4;d++) {
                                if (uint8View[(coord + dif26[d]) * strideBytes + OFFSET_DAY + OFFSET_SOURCE] === maxLight) {
                                    world.dayLightSrc.add(this, coord);
                                    break;
                                }
                            }
                        }
                        let m = uint8View[coordBytes + OFFSET_LIGHT];
                        for (let d=0;d<6;d++) {
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
                            uint8View[coordBytes + OFFSET_PREV] = defLight
                        }
                // copy found dayLight to portals
                for (let portal of portals) {
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

    calcResult() {
        const {lightChunk} = this;
        const {outerSize, uint8View, strideBytes} = lightChunk;
        const result = this.lightResult;

        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;

        //TODO: separate multiple cycle

        // Light + AO
        let ind = 0, ind2 = lightChunk.outerLen * 4;
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

                    coord = coord0 - boundY - boundZ + OFFSET_AO;
                    const R1 = uint8View[coord] + uint8View[coord + sy + sz];
                    const R2 = uint8View[coord + sy] + uint8View[coord + sz];
                    const R = R1 + R2 + (R1 === 0 && R2 === 2) + (R1 === 2 && R2 === 0);

                    coord = coord0 - boundX - boundY + OFFSET_AO;
                    const G1 = uint8View[coord] + uint8View[coord + sy + sx];
                    const G2 = uint8View[coord + sy] + uint8View[coord + sx];
                    const G = G1 + G2 + (G1 === 0 && G2 === 2) + (G1 === 2 && G2 === 0);

                    coord = coord0 - boundX - boundZ + OFFSET_AO;
                    const B1 = uint8View[coord] + uint8View[coord + sx + sz];
                    const B2 = uint8View[coord + sx] + uint8View[coord + sz];
                    const B = B1 + B2 + (B1 === 0 && B2 === 2) + (B1 === 2 && B2 === 0);

                    result[ind++] = Math.round(R * 255.0 / 4.0);
                    result[ind++] = Math.round(G * 255.0 / 4.0);
                    result[ind++] = Math.round(B * 255.0 / 4.0);
                    result[ind++] = Math.round(A * 255.0 / 15.0);

                    // add day light
                    coord = coord0 - boundX - boundY - boundZ + OFFSET_DAY + OFFSET_LIGHT;
                    let A2 = Math.max(Math.max(Math.max(uint8View[coord], uint8View[coord + sx])),
                        Math.max(uint8View[coord + sy], uint8View[coord + sx + sy]),
                        Math.max(Math.max(uint8View[coord + sz], uint8View[coord + sx + sz]),
                            Math.max(uint8View[coord + sy + sz], uint8View[coord + sx + sy + sz])));
                    A2 = adjustLight(A2);

                    result[ind2++] = 0;
                    result[ind2++] = 0;
                    result[ind2++] = 0;
                    result[ind2++] = Math.round(255.0 - (A2 * 255.0 / 15.0));
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

        chunk.calcResult();

        worker.postMessage(['light_generated', {
            addr: chunk.addr,
            lightmap_buffer: chunk.lightResult.buffer,
            lightID: chunk.lastID
        }]);

        endChunks++;
        if (endChunks >= resultLimit) {
            return;
        }
    })
}

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

async function importModules() {
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
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY,
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
        importModules();
        return;
    }
    if (!modulesReady) {
        return msgQueue.push(data);
    }
    //do stuff

    switch (cmd) {
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
            let chunk = world.chunkManager.getChunk(args.addr);
            if (chunk) {
                chunk.removed = true;
                world.chunkManager.delete(chunk);
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
                const ao = (light_source & MASK_AO) > 0 ? 1 : 0;
                let setAo = uint8View[ind * strideBytes + OFFSET_AO] !== ao;
                if (setAo) {
                    uint8View[ind * strideBytes + OFFSET_AO] = ao;
                }
                //TODO: move it to adjust func
                if (setAo || ((src === MASK_BLOCK) !== (old_src === MASK_BLOCK))) {
                    world.dayLightSrc.add(chunk, ind);
                    world.dayLight.add(chunk, ind, maxLight);
                }
                for (let portal of portals) {
                    if (portal.aabb.contains(x, y, z)) {
                        const other = portal.toRegion;
                        const ind = other.indexByWorld(x, y, z);
                        other.setUint8ByInd(ind, OFFSET_SOURCE, src)
                        if (setAo) {
                            other.setUint8ByInd(ind, OFFSET_AO, ao)
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
    let innerDataSolid = new Uint8Array([MASK_BLOCK + MASK_AO]);
    let w = 1;

    let centerChunk = [];

    for (let y=0;y<3;y++) {
        for (let x=0;x<3;x++) {
            for (let z=0;z<3;z++) {
                const light_buffer = (y < 2) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x===1 && z===1 && y<=1) {
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
    let innerDataSolid = new Uint8Array([MASK_BLOCK + MASK_AO]);
    let w = 1;

    let centerChunk = [];

    const maxY = 3;
    for (let y=0;y<maxY;y++) {
        for (let x=0;x<3;x++) {
            for (let z=0;z<3;z++) {
                const light_buffer = (y < maxY - 1) ? innerDataEmpty.buffer : innerDataSolid.buffer;
                let chunk = new Chunk({addr: new Vector(x, y, z), size: new Vector(w, w, w), light_buffer});
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();

                if (x===1 && z===1 && y < maxY - 1) {
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
