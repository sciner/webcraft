'use strict';

function _interopNamespace(e) {
	if (e && e.__esModule) return e;
	var n = Object.create(null);
	if (e) {
		Object.keys(e).forEach(function (k) {
			if (k !== 'default') {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	}
	n["default"] = e;
	return Object.freeze(n);
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getDefaultExportFromNamespaceIfPresent (n) {
	return n && Object.prototype.hasOwnProperty.call(n, 'default') ? n['default'] : n;
}

function getDefaultExportFromNamespaceIfNotNamed (n) {
	return n && Object.prototype.hasOwnProperty.call(n, 'default') && Object.keys(n).length === 1 ? n['default'] : n;
}

function getAugmentedNamespace(n) {
  var f = n.default;
	if (typeof f == "function") {
		var a = function () {
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var light_worker = {};

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
let VectorCollector$1 = null;
let Vector$1 = null;
let DataChunk$2 = null;
let BaseChunk$2 = null;
const world = {
    chunkManager: null,
    defDayLight: 0,
    //queues
    light: null,
    dayLight: null,
    dayLightSrc: null,
};

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

            let maxVal = uint8View[coordBytes + OFFSET_LIGHT];
            if (maxVal < val) {
                // mxdl-13 not obvious, good for big amount of lights
                maxVal = uint8View[coordBytes + OFFSET_LIGHT] = val;
                chunk.lastID++;
            }
            world.dayLight.add(chunk, coord, maxVal);
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
        this.chunks = new VectorCollector$1();
        this.list = [];

        const INF = 1000000000;
        this.lightBase = new BaseChunk$2({size: new Vector$1(INF, INF, INF)}).setPos(new Vector$1(-INF / 2, -INF / 2, -INF / 2));
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
        this.addr = new Vector$1(args.addr.x, args.addr.y, args.addr.z);
        this.size = new Vector$1(args.size.x, args.size.y, args.size.z);
        this.lastID = 0;
        this.sentID = 0;
        this.removed = false;
        this.waveCounter = 0;
        this.crc = 0;

        this.lightChunk = new DataChunk$2({
            size: args.size,
            strideBytes: 8
        }).setPos(new Vector$1().copyFrom(args.addr).mul(args.size));

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
                            if (bytes2[coord2 + OFFSET_AO] !== uint8View[coord1 + OFFSET_AO]) {
                                other.rev.lastID++;
                                bytes2[coord2 + OFFSET_AO] = uint8View[coord1 + OFFSET_AO];
                            }
                        }
                        if (f2) {
                            uint8View[coord1 + OFFSET_SOURCE] = bytes2[coord2 + OFFSET_SOURCE];
                            if (uint8View[coord1 + OFFSET_AO] !== bytes2[coord2 + OFFSET_AO]) {
                                found = true;
                                uint8View[coord1 + OFFSET_AO] = bytes2[coord2 + OFFSET_AO];
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

                    foundDay = foundDay || uint8View[coordBytes + OFFSET_AO] > 0 || isBlock;
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
                                coordBytes = coord * strideBytes + OFFSET_DAY;
                            uint8View[coordBytes + OFFSET_SOURCE] = defLight;
                            uint8View[coordBytes + OFFSET_LIGHT] = defLight;
                            uint8View[coordBytes + OFFSET_PREV] = defLight;
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
                this.lightResult = new Uint16Array(this.resultLen * 2 * elemPerBlock);
            } else {
                this.lightResult = new Uint8Array(this.resultLen * 2 * elemPerBlock);
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
        const addResult1 = (A, A2) => {
            if (is565) {
                const prev_value = result[ind];
                const new_value = (Math.round(A * 31.0 / 15.0) << 11)
                    + (Math.round(31.0 - (A2 * 31.0 / 15.0)) << 0);
                result[ind++] = new_value;
                if(prev_value != new_value) {
                    changed = true;
                }
                this.result_crc_sum += new_value;
            } else {
                if(!changed) {
                    pv1 = result[ind + 0];
                    pv2 = result[ind + 1];
                    pv3 = result[ind + 2];
                    pv4 = result[ind + 3];
                }
                result[ind++] = Math.round(A * 255.0 / 15.0);
                result[ind++] = 0;
                result[ind++] = Math.round(255.0 - (A2 * 255.0 / 15.0));
                result[ind++] = 0;
                if(!changed) {
                    if(pv1 != result[ind - 4] || pv2 != result[ind - 3] || pv3 != result[ind - 2] || pv4 != result[ind - 1]) {
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

        const addResult2 = (A, A2, R, G, B) => {
            if (is565) {
                const prev_value = result[ind2];
                const new_value = (Math.round(R * 31.0 / 4.0) << 11)
                    + (Math.round(G * 63.0 / 4.0) << 5)
                    + (Math.round(B * 31.0 / 4.0) << 0);
                result[ind2++] = new_value;
                if(prev_value != new_value) {
                    changed = true;
                }
                this.result_crc_sum += new_value;
            } else {
                if(!changed) {
                    pv1 = result[ind2 + 0];
                    pv2 = result[ind2 + 1];
                    pv3 = result[ind2 + 2];
                    pv4 = result[ind2 + 3];
                    pv5 = result[ind2 + 4];
                    pv6 = result[ind2 + 5];
                    pv7 = result[ind2 + 6];
                    pv8 = result[ind2 + 7];
                }
                result[ind2++] = Math.round(R * 255.0 / 4.0);
                result[ind2++] = Math.round(G * 255.0 / 4.0);
                result[ind2++] = Math.round(B * 255.0 / 4.0);
                result[ind2++] = 0;
                result[ind2++] = Math.round(A * 255.0 / 15.0);
                result[ind2++] = 0;
                result[ind2++] = Math.round(255.0 - (A2 * 255.0 / 15.0));
                result[ind2++] = 0;
                if(!changed) {
                    if(
                        pv1 != result[ind2 - 8] || pv2 != result[ind2 - 7] ||
                        pv3 != result[ind2 - 6] || pv4 != result[ind2 - 5] ||
                        pv5 != result[ind2 - 4] || pv6 != result[ind2 - 3] ||
                        pv7 != result[ind2 - 2] || pv8 != result[ind2 - 1]
                       ) {
                        changed = true;
                    }
                }
                this.result_crc_sum += (
                    result[ind2 - 8] +
                    result[ind2 - 7] +
                    result[ind2 - 6] +
                    result[ind2 - 5] +
                    result[ind2 - 4] +
                    result[ind2 - 3] +
                    result[ind2 - 2] +
                    result[ind2 - 1]
                );
            }
        };

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

                    addResult1(A, A2);

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

                    addResult2(A, A2, R, G, B);
                }

        //
        if(changed) {
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
        if(chunk.crc != chunk.crcO) {
            chunk.crcO = chunk.crc;
            const is_zero = (chunk.result_crc_sum == 0 && (
                (!('result_crc_sumO' in chunk)) ||
                (chunk.result_crc_sumO == 0)
            ));
            chunk.result_crc_sumO = chunk.result_crc_sum;
            if(!is_zero) {
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
    });
}

let renderFormat = 'rgba8';

const msgQueue = [];

const worker = {

    init: function () {
        if (typeof process !== 'undefined') {
            Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('fs')); }).then(fs => commonjsGlobal.fs = fs);
            Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('worker_threads')); }).then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = onMessageFunc;
        }
    },

    postMessage: function (message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

};

worker.init();

preLoad().then();

async function preLoad() {
    const start = performance.now();

    await Promise.resolve().then(function () { return helpers; }).then(module => {
        Vector$1 = module.Vector;
        VectorCollector$1 = module.VectorCollector;
    });
    await Promise.resolve().then(function () { return BaseChunk$1; }).then(module => {
        BaseChunk$2 = module.BaseChunk;
    });
    await Promise.resolve().then(function () { return DataChunk$1; }).then(module => {
        DataChunk$2 = module.DataChunk;
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
    world.dayLightSrc = new DirLightQueue({offset: OFFSET_DAY,
        disperse: DEFAULT_LIGHT_DAY_DISPERSE
    });
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
            for(let addr of args) {
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
                for (let i = 0; i < portals.length; i++) {
                    const portal = portals[i];
                    if (portal.aabb.contains(x, y, z)) {
                        const other = portal.toRegion;
                        const ind = other.indexByWorld(x, y, z);
                        other.setUint8ByInd(ind, OFFSET_SOURCE, src);
                        if (setAo) {
                            other.setUint8ByInd(ind, OFFSET_AO, ao);
                            other.rev.lastID++;
                        }
                    }
                }
            }
        }
    }
}

if (typeof process !== 'undefined') {
    Promise.resolve().then(function () { return /*#__PURE__*/_interopNamespace(require('worker_threads')); }).then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc;
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
                let chunk = new Chunk({addr: new Vector$1(x, y, z), size: new Vector$1(w, w, w), light_buffer});
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
                let chunk = new Chunk({addr: new Vector$1(x, y, z), size: new Vector$1(w, w, w), light_buffer});
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

/*!
@fileoverview gl-matrix - High performance matrix and vector operations
@author Brandon Jones
@author Colin MacKenzie IV
@version 3.3.0

Copyright (c) 2015-2021, Brandon Jones, Colin MacKenzie IV.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n((t="undefined"!=typeof globalThis?globalThis:t||self).glMatrix={});}(undefined,(function(t){"use strict";var n=1e-6,a="undefined"!=typeof Float32Array?Float32Array:Array,r=Math.random,u="zyx";var e=Math.PI/180;Math.hypot||(Math.hypot=function(){for(var t=0,n=arguments.length;n--;)t+=arguments[n]*arguments[n];return Math.sqrt(t)});var o=Object.freeze({__proto__:null,EPSILON:n,get ARRAY_TYPE(){return a},RANDOM:r,ANGLE_ORDER:u,setMatrixArrayType:function(t){a=t;},toRadian:function(t){return t*e},equals:function(t,a){return Math.abs(t-a)<=n*Math.max(1,Math.abs(t),Math.abs(a))}});function i(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*i+e*h,t[1]=u*i+o*h,t[2]=r*c+e*s,t[3]=u*c+o*s,t}function h(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t}var c=i,s=h,M=Object.freeze({__proto__:null,create:function(){var t=new a(4);return a!=Float32Array&&(t[1]=0,t[2]=0),t[0]=1,t[3]=1,t},clone:function(t){var n=new a(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t},fromValues:function(t,n,r,u){var e=new a(4);return e[0]=t,e[1]=n,e[2]=r,e[3]=u,e},set:function(t,n,a,r,u){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t},transpose:function(t,n){if(t===n){var a=n[1];t[1]=n[2],t[2]=a;}else t[0]=n[0],t[1]=n[2],t[2]=n[1],t[3]=n[3];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*e-u*r;return o?(o=1/o,t[0]=e*o,t[1]=-r*o,t[2]=-u*o,t[3]=a*o,t):null},adjoint:function(t,n){var a=n[0];return t[0]=n[3],t[1]=-n[1],t[2]=-n[2],t[3]=a,t},determinant:function(t){return t[0]*t[3]-t[2]*t[1]},multiply:i,rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+e*i,t[1]=u*h+o*i,t[2]=r*-i+e*h,t[3]=u*-i+o*h,t},scale:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1];return t[0]=r*i,t[1]=u*i,t[2]=e*h,t[3]=o*h,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=-a,t[3]=r,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t},str:function(t){return "mat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3])},LDU:function(t,n,a,r){return t[2]=r[2]/r[0],a[0]=r[0],a[1]=r[1],a[3]=r[3]-t[2]*a[1],[t,n,a]},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t},subtract:h,exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=a[0],h=a[1],c=a[2],s=a[3];return Math.abs(r-i)<=n*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(u-h)<=n*Math.max(1,Math.abs(u),Math.abs(h))&&Math.abs(e-c)<=n*Math.max(1,Math.abs(e),Math.abs(c))&&Math.abs(o-s)<=n*Math.max(1,Math.abs(o),Math.abs(s))},multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t},mul:c,sub:s});function f(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1],M=a[2],f=a[3],l=a[4],v=a[5];return t[0]=r*c+e*s,t[1]=u*c+o*s,t[2]=r*M+e*f,t[3]=u*M+o*f,t[4]=r*l+e*v+i,t[5]=u*l+o*v+h,t}function l(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t}var v=f,b=l,m=Object.freeze({__proto__:null,create:function(){var t=new a(6);return a!=Float32Array&&(t[1]=0,t[2]=0,t[4]=0,t[5]=0),t[0]=1,t[3]=1,t},clone:function(t){var n=new a(6);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t},fromValues:function(t,n,r,u,e,o){var i=new a(6);return i[0]=t,i[1]=n,i[2]=r,i[3]=u,i[4]=e,i[5]=o,i},set:function(t,n,a,r,u,e,o){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=a*e-r*u;return h?(h=1/h,t[0]=e*h,t[1]=-r*h,t[2]=-u*h,t[3]=a*h,t[4]=(u*i-e*o)*h,t[5]=(r*o-a*i)*h,t):null},determinant:function(t){return t[0]*t[3]-t[1]*t[2]},multiply:f,rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=Math.sin(a),s=Math.cos(a);return t[0]=r*s+e*c,t[1]=u*s+o*c,t[2]=r*-c+e*s,t[3]=u*-c+o*s,t[4]=i,t[5]=h,t},scale:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1];return t[0]=r*c,t[1]=u*c,t[2]=e*s,t[3]=o*s,t[4]=i,t[5]=h,t},translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=a[0],s=a[1];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=r*c+e*s+i,t[5]=u*c+o*s+h,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=-a,t[3]=r,t[4]=0,t[5]=0,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=n[1],t[4]=0,t[5]=0,t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t[4]=n[0],t[5]=n[1],t},str:function(t){return "mat2d("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],1)},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t},subtract:l,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=a[0],s=a[1],M=a[2],f=a[3],l=a[4],v=a[5];return Math.abs(r-c)<=n*Math.max(1,Math.abs(r),Math.abs(c))&&Math.abs(u-s)<=n*Math.max(1,Math.abs(u),Math.abs(s))&&Math.abs(e-M)<=n*Math.max(1,Math.abs(e),Math.abs(M))&&Math.abs(o-f)<=n*Math.max(1,Math.abs(o),Math.abs(f))&&Math.abs(i-l)<=n*Math.max(1,Math.abs(i),Math.abs(l))&&Math.abs(h-v)<=n*Math.max(1,Math.abs(h),Math.abs(v))},mul:v,sub:b});function d(){var t=new a(9);return a!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[5]=0,t[6]=0,t[7]=0),t[0]=1,t[4]=1,t[8]=1,t}function p(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=a[0],l=a[1],v=a[2],b=a[3],m=a[4],d=a[5],p=a[6],x=a[7],y=a[8];return t[0]=f*r+l*o+v*c,t[1]=f*u+l*i+v*s,t[2]=f*e+l*h+v*M,t[3]=b*r+m*o+d*c,t[4]=b*u+m*i+d*s,t[5]=b*e+m*h+d*M,t[6]=p*r+x*o+y*c,t[7]=p*u+x*i+y*s,t[8]=p*e+x*h+y*M,t}function x(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t[6]=n[6]-a[6],t[7]=n[7]-a[7],t[8]=n[8]-a[8],t}var y=p,q=x,g=Object.freeze({__proto__:null,create:d,fromMat4:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[4],t[4]=n[5],t[5]=n[6],t[6]=n[8],t[7]=n[9],t[8]=n[10],t},clone:function(t){var n=new a(9);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},fromValues:function(t,n,r,u,e,o,i,h,c){var s=new a(9);return s[0]=t,s[1]=n,s[2]=r,s[3]=u,s[4]=e,s[5]=o,s[6]=i,s[7]=h,s[8]=c,s},set:function(t,n,a,r,u,e,o,i,h,c){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t[8]=c,t},identity:function(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},transpose:function(t,n){if(t===n){var a=n[1],r=n[2],u=n[5];t[1]=n[3],t[2]=n[6],t[3]=a,t[5]=n[7],t[6]=r,t[7]=u;}else t[0]=n[0],t[1]=n[3],t[2]=n[6],t[3]=n[1],t[4]=n[4],t[5]=n[7],t[6]=n[2],t[7]=n[5],t[8]=n[8];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=s*o-i*c,f=-s*e+i*h,l=c*e-o*h,v=a*M+r*f+u*l;return v?(v=1/v,t[0]=M*v,t[1]=(-s*r+u*c)*v,t[2]=(i*r-u*o)*v,t[3]=f*v,t[4]=(s*a-u*h)*v,t[5]=(-i*a+u*e)*v,t[6]=l*v,t[7]=(-c*a+r*h)*v,t[8]=(o*a-r*e)*v,t):null},adjoint:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8];return t[0]=o*s-i*c,t[1]=u*c-r*s,t[2]=r*i-u*o,t[3]=i*h-e*s,t[4]=a*s-u*h,t[5]=u*e-a*i,t[6]=e*c-o*h,t[7]=r*h-a*c,t[8]=a*o-r*e,t},determinant:function(t){var n=t[0],a=t[1],r=t[2],u=t[3],e=t[4],o=t[5],i=t[6],h=t[7],c=t[8];return n*(c*e-o*h)+a*(-c*u+o*i)+r*(h*u-e*i)},multiply:p,translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=a[0],l=a[1];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=i,t[5]=h,t[6]=f*r+l*o+c,t[7]=f*u+l*i+s,t[8]=f*e+l*h+M,t},rotate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=Math.sin(a),l=Math.cos(a);return t[0]=l*r+f*o,t[1]=l*u+f*i,t[2]=l*e+f*h,t[3]=l*o-f*r,t[4]=l*i-f*u,t[5]=l*h-f*e,t[6]=c,t[7]=s,t[8]=M,t},scale:function(t,n,a){var r=a[0],u=a[1];return t[0]=r*n[0],t[1]=r*n[1],t[2]=r*n[2],t[3]=u*n[3],t[4]=u*n[4],t[5]=u*n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=n[0],t[7]=n[1],t[8]=1,t},fromRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=0,t[3]=-a,t[4]=r,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=n[1],t[5]=0,t[6]=0,t[7]=0,t[8]=1,t},fromMat2d:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=0,t[3]=n[2],t[4]=n[3],t[5]=0,t[6]=n[4],t[7]=n[5],t[8]=1,t},fromQuat:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a+a,i=r+r,h=u+u,c=a*o,s=r*o,M=r*i,f=u*o,l=u*i,v=u*h,b=e*o,m=e*i,d=e*h;return t[0]=1-M-v,t[3]=s-d,t[6]=f+m,t[1]=s+d,t[4]=1-c-v,t[7]=l-b,t[2]=f-m,t[5]=l+b,t[8]=1-c-M,t},normalFromMat4:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m,E=p*j-x*O+y*R+q*z-g*w+_*A;return E?(E=1/E,t[0]=(i*j-h*O+c*R)*E,t[1]=(h*z-o*j-c*w)*E,t[2]=(o*O-i*z+c*A)*E,t[3]=(u*O-r*j-e*R)*E,t[4]=(a*j-u*z+e*w)*E,t[5]=(r*z-a*O-e*A)*E,t[6]=(b*_-m*g+d*q)*E,t[7]=(m*y-v*_-d*x)*E,t[8]=(v*g-b*y+d*p)*E,t):null},projection:function(t,n,a){return t[0]=2/n,t[1]=0,t[2]=0,t[3]=0,t[4]=-2/a,t[5]=0,t[6]=-1,t[7]=1,t[8]=1,t},str:function(t){return "mat3("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7],t[8])},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t[8]=n[8]+a[8],t},subtract:x,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t[8]=n[8]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t[6]=n[6]+a[6]*r,t[7]=n[7]+a[7]*r,t[8]=n[8]+a[8]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=t[8],f=a[0],l=a[1],v=a[2],b=a[3],m=a[4],d=a[5],p=a[6],x=a[7],y=a[8];return Math.abs(r-f)<=n*Math.max(1,Math.abs(r),Math.abs(f))&&Math.abs(u-l)<=n*Math.max(1,Math.abs(u),Math.abs(l))&&Math.abs(e-v)<=n*Math.max(1,Math.abs(e),Math.abs(v))&&Math.abs(o-b)<=n*Math.max(1,Math.abs(o),Math.abs(b))&&Math.abs(i-m)<=n*Math.max(1,Math.abs(i),Math.abs(m))&&Math.abs(h-d)<=n*Math.max(1,Math.abs(h),Math.abs(d))&&Math.abs(c-p)<=n*Math.max(1,Math.abs(c),Math.abs(p))&&Math.abs(s-x)<=n*Math.max(1,Math.abs(s),Math.abs(x))&&Math.abs(M-y)<=n*Math.max(1,Math.abs(M),Math.abs(y))},mul:y,sub:q});function _(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function A(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=n[9],l=n[10],v=n[11],b=n[12],m=n[13],d=n[14],p=n[15],x=a[0],y=a[1],q=a[2],g=a[3];return t[0]=x*r+y*i+q*M+g*b,t[1]=x*u+y*h+q*f+g*m,t[2]=x*e+y*c+q*l+g*d,t[3]=x*o+y*s+q*v+g*p,x=a[4],y=a[5],q=a[6],g=a[7],t[4]=x*r+y*i+q*M+g*b,t[5]=x*u+y*h+q*f+g*m,t[6]=x*e+y*c+q*l+g*d,t[7]=x*o+y*s+q*v+g*p,x=a[8],y=a[9],q=a[10],g=a[11],t[8]=x*r+y*i+q*M+g*b,t[9]=x*u+y*h+q*f+g*m,t[10]=x*e+y*c+q*l+g*d,t[11]=x*o+y*s+q*v+g*p,x=a[12],y=a[13],q=a[14],g=a[15],t[12]=x*r+y*i+q*M+g*b,t[13]=x*u+y*h+q*f+g*m,t[14]=x*e+y*c+q*l+g*d,t[15]=x*o+y*s+q*v+g*p,t}function w(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=r+r,h=u+u,c=e+e,s=r*i,M=r*h,f=r*c,l=u*h,v=u*c,b=e*c,m=o*i,d=o*h,p=o*c;return t[0]=1-(l+b),t[1]=M+p,t[2]=f-d,t[3]=0,t[4]=M-p,t[5]=1-(s+b),t[6]=v+m,t[7]=0,t[8]=f+d,t[9]=v-m,t[10]=1-(s+l),t[11]=0,t[12]=a[0],t[13]=a[1],t[14]=a[2],t[15]=1,t}function z(t,n){return t[0]=n[12],t[1]=n[13],t[2]=n[14],t}function R(t,n){var a=n[0],r=n[1],u=n[2],e=n[4],o=n[5],i=n[6],h=n[8],c=n[9],s=n[10];return t[0]=Math.hypot(a,r,u),t[1]=Math.hypot(e,o,i),t[2]=Math.hypot(h,c,s),t}function O(t,n){var r=new a(3);R(r,n);var u=1/r[0],e=1/r[1],o=1/r[2],i=n[0]*u,h=n[1]*e,c=n[2]*o,s=n[4]*u,M=n[5]*e,f=n[6]*o,l=n[8]*u,v=n[9]*e,b=n[10]*o,m=i+M+b,d=0;return m>0?(d=2*Math.sqrt(m+1),t[3]=.25*d,t[0]=(f-v)/d,t[1]=(l-c)/d,t[2]=(h-s)/d):i>M&&i>b?(d=2*Math.sqrt(1+i-M-b),t[3]=(f-v)/d,t[0]=.25*d,t[1]=(h+s)/d,t[2]=(l+c)/d):M>b?(d=2*Math.sqrt(1+M-i-b),t[3]=(l-c)/d,t[0]=(h+s)/d,t[1]=.25*d,t[2]=(f+v)/d):(d=2*Math.sqrt(1+b-i-M),t[3]=(h-s)/d,t[0]=(l+c)/d,t[1]=(f+v)/d,t[2]=.25*d),t}function j(t,n,a,r,u){var e=1/Math.tan(n/2);if(t[0]=e/a,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=e,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=u&&u!==1/0){var o=1/(r-u);t[10]=(u+r)*o,t[14]=2*u*r*o;}else t[10]=-1,t[14]=-2*r;return t}var E=j;function P(t,n,a,r,u,e,o){var i=1/(n-a),h=1/(r-u),c=1/(e-o);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*h,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=2*c,t[11]=0,t[12]=(n+a)*i,t[13]=(u+r)*h,t[14]=(o+e)*c,t[15]=1,t}var T=P;function S(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t[4]=n[4]-a[4],t[5]=n[5]-a[5],t[6]=n[6]-a[6],t[7]=n[7]-a[7],t[8]=n[8]-a[8],t[9]=n[9]-a[9],t[10]=n[10]-a[10],t[11]=n[11]-a[11],t[12]=n[12]-a[12],t[13]=n[13]-a[13],t[14]=n[14]-a[14],t[15]=n[15]-a[15],t}var D=A,F=S,I=Object.freeze({__proto__:null,create:function(){var t=new a(16);return a!=Float32Array&&(t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0),t[0]=1,t[5]=1,t[10]=1,t[15]=1,t},clone:function(t){var n=new a(16);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n[8]=t[8],n[9]=t[9],n[10]=t[10],n[11]=t[11],n[12]=t[12],n[13]=t[13],n[14]=t[14],n[15]=t[15],n},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},fromValues:function(t,n,r,u,e,o,i,h,c,s,M,f,l,v,b,m){var d=new a(16);return d[0]=t,d[1]=n,d[2]=r,d[3]=u,d[4]=e,d[5]=o,d[6]=i,d[7]=h,d[8]=c,d[9]=s,d[10]=M,d[11]=f,d[12]=l,d[13]=v,d[14]=b,d[15]=m,d},set:function(t,n,a,r,u,e,o,i,h,c,s,M,f,l,v,b,m){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t[8]=c,t[9]=s,t[10]=M,t[11]=f,t[12]=l,t[13]=v,t[14]=b,t[15]=m,t},identity:_,transpose:function(t,n){if(t===n){var a=n[1],r=n[2],u=n[3],e=n[6],o=n[7],i=n[11];t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=a,t[6]=n[9],t[7]=n[13],t[8]=r,t[9]=e,t[11]=n[14],t[12]=u,t[13]=o,t[14]=i;}else t[0]=n[0],t[1]=n[4],t[2]=n[8],t[3]=n[12],t[4]=n[1],t[5]=n[5],t[6]=n[9],t[7]=n[13],t[8]=n[2],t[9]=n[6],t[10]=n[10],t[11]=n[14],t[12]=n[3],t[13]=n[7],t[14]=n[11],t[15]=n[15];return t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m,E=p*j-x*O+y*R+q*z-g*w+_*A;return E?(E=1/E,t[0]=(i*j-h*O+c*R)*E,t[1]=(u*O-r*j-e*R)*E,t[2]=(b*_-m*g+d*q)*E,t[3]=(f*g-M*_-l*q)*E,t[4]=(h*z-o*j-c*w)*E,t[5]=(a*j-u*z+e*w)*E,t[6]=(m*y-v*_-d*x)*E,t[7]=(s*_-f*y+l*x)*E,t[8]=(o*O-i*z+c*A)*E,t[9]=(r*z-a*O-e*A)*E,t[10]=(v*g-b*y+d*p)*E,t[11]=(M*y-s*g-l*p)*E,t[12]=(i*w-o*R-h*A)*E,t[13]=(a*R-r*w+u*A)*E,t[14]=(b*x-v*q-m*p)*E,t[15]=(s*q-M*x+f*p)*E,t):null},adjoint:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=n[4],i=n[5],h=n[6],c=n[7],s=n[8],M=n[9],f=n[10],l=n[11],v=n[12],b=n[13],m=n[14],d=n[15],p=a*i-r*o,x=a*h-u*o,y=a*c-e*o,q=r*h-u*i,g=r*c-e*i,_=u*c-e*h,A=s*b-M*v,w=s*m-f*v,z=s*d-l*v,R=M*m-f*b,O=M*d-l*b,j=f*d-l*m;return t[0]=i*j-h*O+c*R,t[1]=u*O-r*j-e*R,t[2]=b*_-m*g+d*q,t[3]=f*g-M*_-l*q,t[4]=h*z-o*j-c*w,t[5]=a*j-u*z+e*w,t[6]=m*y-v*_-d*x,t[7]=s*_-f*y+l*x,t[8]=o*O-i*z+c*A,t[9]=r*z-a*O-e*A,t[10]=v*g-b*y+d*p,t[11]=M*y-s*g-l*p,t[12]=i*w-o*R-h*A,t[13]=a*R-r*w+u*A,t[14]=b*x-v*q-m*p,t[15]=s*q-M*x+f*p,t},determinant:function(t){var n=t[0],a=t[1],r=t[2],u=t[3],e=t[4],o=t[5],i=t[6],h=t[7],c=t[8],s=t[9],M=t[10],f=t[11],l=t[12],v=t[13],b=t[14],m=n*o-a*e,d=n*i-r*e,p=a*i-r*o,x=c*v-s*l,y=c*b-M*l,q=s*b-M*v;return h*(n*q-a*y+r*x)-u*(e*q-o*y+i*x)+t[15]*(c*p-s*d+M*m)-f*(l*p-v*d+b*m)},multiply:A,translate:function(t,n,a){var r,u,e,o,i,h,c,s,M,f,l,v,b=a[0],m=a[1],d=a[2];return n===t?(t[12]=n[0]*b+n[4]*m+n[8]*d+n[12],t[13]=n[1]*b+n[5]*m+n[9]*d+n[13],t[14]=n[2]*b+n[6]*m+n[10]*d+n[14],t[15]=n[3]*b+n[7]*m+n[11]*d+n[15]):(r=n[0],u=n[1],e=n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=n[8],f=n[9],l=n[10],v=n[11],t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=i,t[5]=h,t[6]=c,t[7]=s,t[8]=M,t[9]=f,t[10]=l,t[11]=v,t[12]=r*b+i*m+M*d+n[12],t[13]=u*b+h*m+f*d+n[13],t[14]=e*b+c*m+l*d+n[14],t[15]=o*b+s*m+v*d+n[15]),t},scale:function(t,n,a){var r=a[0],u=a[1],e=a[2];return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=n[3]*r,t[4]=n[4]*u,t[5]=n[5]*u,t[6]=n[6]*u,t[7]=n[7]*u,t[8]=n[8]*e,t[9]=n[9]*e,t[10]=n[10]*e,t[11]=n[11]*e,t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t},rotate:function(t,a,r,u){var e,o,i,h,c,s,M,f,l,v,b,m,d,p,x,y,q,g,_,A,w,z,R,O,j=u[0],E=u[1],P=u[2],T=Math.hypot(j,E,P);return T<n?null:(j*=T=1/T,E*=T,P*=T,e=Math.sin(r),i=1-(o=Math.cos(r)),h=a[0],c=a[1],s=a[2],M=a[3],f=a[4],l=a[5],v=a[6],b=a[7],m=a[8],d=a[9],p=a[10],x=a[11],y=j*j*i+o,q=E*j*i+P*e,g=P*j*i-E*e,_=j*E*i-P*e,A=E*E*i+o,w=P*E*i+j*e,z=j*P*i+E*e,R=E*P*i-j*e,O=P*P*i+o,t[0]=h*y+f*q+m*g,t[1]=c*y+l*q+d*g,t[2]=s*y+v*q+p*g,t[3]=M*y+b*q+x*g,t[4]=h*_+f*A+m*w,t[5]=c*_+l*A+d*w,t[6]=s*_+v*A+p*w,t[7]=M*_+b*A+x*w,t[8]=h*z+f*R+m*O,t[9]=c*z+l*R+d*O,t[10]=s*z+v*R+p*O,t[11]=M*z+b*R+x*O,a!==t&&(t[12]=a[12],t[13]=a[13],t[14]=a[14],t[15]=a[15]),t)},rotateX:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[4],o=n[5],i=n[6],h=n[7],c=n[8],s=n[9],M=n[10],f=n[11];return n!==t&&(t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[4]=e*u+c*r,t[5]=o*u+s*r,t[6]=i*u+M*r,t[7]=h*u+f*r,t[8]=c*u-e*r,t[9]=s*u-o*r,t[10]=M*u-i*r,t[11]=f*u-h*r,t},rotateY:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[0],o=n[1],i=n[2],h=n[3],c=n[8],s=n[9],M=n[10],f=n[11];return n!==t&&(t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[0]=e*u-c*r,t[1]=o*u-s*r,t[2]=i*u-M*r,t[3]=h*u-f*r,t[8]=e*r+c*u,t[9]=o*r+s*u,t[10]=i*r+M*u,t[11]=h*r+f*u,t},rotateZ:function(t,n,a){var r=Math.sin(a),u=Math.cos(a),e=n[0],o=n[1],i=n[2],h=n[3],c=n[4],s=n[5],M=n[6],f=n[7];return n!==t&&(t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[0]=e*u+c*r,t[1]=o*u+s*r,t[2]=i*u+M*r,t[3]=h*u+f*r,t[4]=c*u-e*r,t[5]=s*u-o*r,t[6]=M*u-i*r,t[7]=f*u-h*r,t},fromTranslation:function(t,n){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=n[0],t[13]=n[1],t[14]=n[2],t[15]=1,t},fromScaling:function(t,n){return t[0]=n[0],t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=n[1],t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=n[2],t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromRotation:function(t,a,r){var u,e,o,i=r[0],h=r[1],c=r[2],s=Math.hypot(i,h,c);return s<n?null:(i*=s=1/s,h*=s,c*=s,u=Math.sin(a),o=1-(e=Math.cos(a)),t[0]=i*i*o+e,t[1]=h*i*o+c*u,t[2]=c*i*o-h*u,t[3]=0,t[4]=i*h*o-c*u,t[5]=h*h*o+e,t[6]=c*h*o+i*u,t[7]=0,t[8]=i*c*o+h*u,t[9]=h*c*o-i*u,t[10]=c*c*o+e,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t)},fromXRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=r,t[6]=a,t[7]=0,t[8]=0,t[9]=-a,t[10]=r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromYRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=0,t[2]=-a,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=a,t[9]=0,t[10]=r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromZRotation:function(t,n){var a=Math.sin(n),r=Math.cos(n);return t[0]=r,t[1]=a,t[2]=0,t[3]=0,t[4]=-a,t[5]=r,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},fromRotationTranslation:w,fromQuat2:function(t,n){var r=new a(3),u=-n[0],e=-n[1],o=-n[2],i=n[3],h=n[4],c=n[5],s=n[6],M=n[7],f=u*u+e*e+o*o+i*i;return f>0?(r[0]=2*(h*i+M*u+c*o-s*e)/f,r[1]=2*(c*i+M*e+s*u-h*o)/f,r[2]=2*(s*i+M*o+h*e-c*u)/f):(r[0]=2*(h*i+M*u+c*o-s*e),r[1]=2*(c*i+M*e+s*u-h*o),r[2]=2*(s*i+M*o+h*e-c*u)),w(t,n,r),t},getTranslation:z,getScaling:R,getRotation:O,decompose:function(t,n,a,r){n[0]=r[12],n[1]=r[13],n[2]=r[14];var u=r[0],e=r[1],o=r[2],i=r[4],h=r[5],c=r[6],s=r[8],M=r[9],f=r[10];a[0]=Math.hypot(u,e,o),a[1]=Math.hypot(i,h,c),a[2]=Math.hypot(s,M,f);var l=1/a[0],v=1/a[1],b=1/a[2],m=u*l,d=e*v,p=o*b,x=i*l,y=h*v,q=c*b,g=s*l,_=M*v,A=f*b,w=m+y+A,z=0;return w>0?(z=2*Math.sqrt(w+1),t[3]=.25*z,t[0]=(q-_)/z,t[1]=(g-p)/z,t[2]=(d-x)/z):m>y&&m>A?(z=2*Math.sqrt(1+m-y-A),t[3]=(q-_)/z,t[0]=.25*z,t[1]=(d+x)/z,t[2]=(g+p)/z):y>A?(z=2*Math.sqrt(1+y-m-A),t[3]=(g-p)/z,t[0]=(d+x)/z,t[1]=.25*z,t[2]=(q+_)/z):(z=2*Math.sqrt(1+A-m-y),t[3]=(d-x)/z,t[0]=(g+p)/z,t[1]=(q+_)/z,t[2]=.25*z),t},fromRotationTranslationScale:function(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=n[3],h=u+u,c=e+e,s=o+o,M=u*h,f=u*c,l=u*s,v=e*c,b=e*s,m=o*s,d=i*h,p=i*c,x=i*s,y=r[0],q=r[1],g=r[2];return t[0]=(1-(v+m))*y,t[1]=(f+x)*y,t[2]=(l-p)*y,t[3]=0,t[4]=(f-x)*q,t[5]=(1-(M+m))*q,t[6]=(b+d)*q,t[7]=0,t[8]=(l+p)*g,t[9]=(b-d)*g,t[10]=(1-(M+v))*g,t[11]=0,t[12]=a[0],t[13]=a[1],t[14]=a[2],t[15]=1,t},fromRotationTranslationScaleOrigin:function(t,n,a,r,u){var e=n[0],o=n[1],i=n[2],h=n[3],c=e+e,s=o+o,M=i+i,f=e*c,l=e*s,v=e*M,b=o*s,m=o*M,d=i*M,p=h*c,x=h*s,y=h*M,q=r[0],g=r[1],_=r[2],A=u[0],w=u[1],z=u[2],R=(1-(b+d))*q,O=(l+y)*q,j=(v-x)*q,E=(l-y)*g,P=(1-(f+d))*g,T=(m+p)*g,S=(v+x)*_,D=(m-p)*_,F=(1-(f+b))*_;return t[0]=R,t[1]=O,t[2]=j,t[3]=0,t[4]=E,t[5]=P,t[6]=T,t[7]=0,t[8]=S,t[9]=D,t[10]=F,t[11]=0,t[12]=a[0]+A-(R*A+E*w+S*z),t[13]=a[1]+w-(O*A+P*w+D*z),t[14]=a[2]+z-(j*A+T*w+F*z),t[15]=1,t},fromQuat:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a+a,i=r+r,h=u+u,c=a*o,s=r*o,M=r*i,f=u*o,l=u*i,v=u*h,b=e*o,m=e*i,d=e*h;return t[0]=1-M-v,t[1]=s+d,t[2]=f-m,t[3]=0,t[4]=s-d,t[5]=1-c-v,t[6]=l+b,t[7]=0,t[8]=f+m,t[9]=l-b,t[10]=1-c-M,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t},frustum:function(t,n,a,r,u,e,o){var i=1/(a-n),h=1/(u-r),c=1/(e-o);return t[0]=2*e*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=2*e*h,t[6]=0,t[7]=0,t[8]=(a+n)*i,t[9]=(u+r)*h,t[10]=(o+e)*c,t[11]=-1,t[12]=0,t[13]=0,t[14]=o*e*2*c,t[15]=0,t},perspectiveNO:j,perspective:E,perspectiveZO:function(t,n,a,r,u){var e=1/Math.tan(n/2);if(t[0]=e/a,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=e,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[11]=-1,t[12]=0,t[13]=0,t[15]=0,null!=u&&u!==1/0){var o=1/(r-u);t[10]=u*o,t[14]=u*r*o;}else t[10]=-1,t[14]=-r;return t},perspectiveFromFieldOfView:function(t,n,a,r){var u=Math.tan(n.upDegrees*Math.PI/180),e=Math.tan(n.downDegrees*Math.PI/180),o=Math.tan(n.leftDegrees*Math.PI/180),i=Math.tan(n.rightDegrees*Math.PI/180),h=2/(o+i),c=2/(u+e);return t[0]=h,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=c,t[6]=0,t[7]=0,t[8]=-(o-i)*h*.5,t[9]=(u-e)*c*.5,t[10]=r/(a-r),t[11]=-1,t[12]=0,t[13]=0,t[14]=r*a/(a-r),t[15]=0,t},orthoNO:P,ortho:T,orthoZO:function(t,n,a,r,u,e,o){var i=1/(n-a),h=1/(r-u),c=1/(e-o);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*h,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=c,t[11]=0,t[12]=(n+a)*i,t[13]=(u+r)*h,t[14]=e*c,t[15]=1,t},lookAt:function(t,a,r,u){var e,o,i,h,c,s,M,f,l,v,b=a[0],m=a[1],d=a[2],p=u[0],x=u[1],y=u[2],q=r[0],g=r[1],A=r[2];return Math.abs(b-q)<n&&Math.abs(m-g)<n&&Math.abs(d-A)<n?_(t):(M=b-q,f=m-g,l=d-A,e=x*(l*=v=1/Math.hypot(M,f,l))-y*(f*=v),o=y*(M*=v)-p*l,i=p*f-x*M,(v=Math.hypot(e,o,i))?(e*=v=1/v,o*=v,i*=v):(e=0,o=0,i=0),h=f*i-l*o,c=l*e-M*i,s=M*o-f*e,(v=Math.hypot(h,c,s))?(h*=v=1/v,c*=v,s*=v):(h=0,c=0,s=0),t[0]=e,t[1]=h,t[2]=M,t[3]=0,t[4]=o,t[5]=c,t[6]=f,t[7]=0,t[8]=i,t[9]=s,t[10]=l,t[11]=0,t[12]=-(e*b+o*m+i*d),t[13]=-(h*b+c*m+s*d),t[14]=-(M*b+f*m+l*d),t[15]=1,t)},targetTo:function(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=r[0],h=r[1],c=r[2],s=u-a[0],M=e-a[1],f=o-a[2],l=s*s+M*M+f*f;l>0&&(s*=l=1/Math.sqrt(l),M*=l,f*=l);var v=h*f-c*M,b=c*s-i*f,m=i*M-h*s;return (l=v*v+b*b+m*m)>0&&(v*=l=1/Math.sqrt(l),b*=l,m*=l),t[0]=v,t[1]=b,t[2]=m,t[3]=0,t[4]=M*m-f*b,t[5]=f*v-s*m,t[6]=s*b-M*v,t[7]=0,t[8]=s,t[9]=M,t[10]=f,t[11]=0,t[12]=u,t[13]=e,t[14]=o,t[15]=1,t},str:function(t){return "mat4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+", "+t[8]+", "+t[9]+", "+t[10]+", "+t[11]+", "+t[12]+", "+t[13]+", "+t[14]+", "+t[15]+")"},frob:function(t){return Math.hypot(t[0],t[1],t[2],t[3],t[4],t[5],t[6],t[7],t[8],t[9],t[10],t[11],t[12],t[13],t[14],t[15])},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t[8]=n[8]+a[8],t[9]=n[9]+a[9],t[10]=n[10]+a[10],t[11]=n[11]+a[11],t[12]=n[12]+a[12],t[13]=n[13]+a[13],t[14]=n[14]+a[14],t[15]=n[15]+a[15],t},subtract:S,multiplyScalar:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=n[11]*a,t[12]=n[12]*a,t[13]=n[13]*a,t[14]=n[14]*a,t[15]=n[15]*a,t},multiplyScalarAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t[4]=n[4]+a[4]*r,t[5]=n[5]+a[5]*r,t[6]=n[6]+a[6]*r,t[7]=n[7]+a[7]*r,t[8]=n[8]+a[8]*r,t[9]=n[9]+a[9]*r,t[10]=n[10]+a[10]*r,t[11]=n[11]+a[11]*r,t[12]=n[12]+a[12]*r,t[13]=n[13]+a[13]*r,t[14]=n[14]+a[14]*r,t[15]=n[15]+a[15]*r,t},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]&&t[8]===n[8]&&t[9]===n[9]&&t[10]===n[10]&&t[11]===n[11]&&t[12]===n[12]&&t[13]===n[13]&&t[14]===n[14]&&t[15]===n[15]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=t[8],f=t[9],l=t[10],v=t[11],b=t[12],m=t[13],d=t[14],p=t[15],x=a[0],y=a[1],q=a[2],g=a[3],_=a[4],A=a[5],w=a[6],z=a[7],R=a[8],O=a[9],j=a[10],E=a[11],P=a[12],T=a[13],S=a[14],D=a[15];return Math.abs(r-x)<=n*Math.max(1,Math.abs(r),Math.abs(x))&&Math.abs(u-y)<=n*Math.max(1,Math.abs(u),Math.abs(y))&&Math.abs(e-q)<=n*Math.max(1,Math.abs(e),Math.abs(q))&&Math.abs(o-g)<=n*Math.max(1,Math.abs(o),Math.abs(g))&&Math.abs(i-_)<=n*Math.max(1,Math.abs(i),Math.abs(_))&&Math.abs(h-A)<=n*Math.max(1,Math.abs(h),Math.abs(A))&&Math.abs(c-w)<=n*Math.max(1,Math.abs(c),Math.abs(w))&&Math.abs(s-z)<=n*Math.max(1,Math.abs(s),Math.abs(z))&&Math.abs(M-R)<=n*Math.max(1,Math.abs(M),Math.abs(R))&&Math.abs(f-O)<=n*Math.max(1,Math.abs(f),Math.abs(O))&&Math.abs(l-j)<=n*Math.max(1,Math.abs(l),Math.abs(j))&&Math.abs(v-E)<=n*Math.max(1,Math.abs(v),Math.abs(E))&&Math.abs(b-P)<=n*Math.max(1,Math.abs(b),Math.abs(P))&&Math.abs(m-T)<=n*Math.max(1,Math.abs(m),Math.abs(T))&&Math.abs(d-S)<=n*Math.max(1,Math.abs(d),Math.abs(S))&&Math.abs(p-D)<=n*Math.max(1,Math.abs(p),Math.abs(D))},mul:D,sub:F});function L(){var t=new a(3);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t}function V(t){var n=t[0],a=t[1],r=t[2];return Math.hypot(n,a,r)}function k(t,n,r){var u=new a(3);return u[0]=t,u[1]=n,u[2]=r,u}function Q(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t}function Y(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t[2]=n[2]*a[2],t}function Z(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t[2]=n[2]/a[2],t}function N(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2];return Math.hypot(a,r,u)}function X(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2];return a*a+r*r+u*u}function B(t){var n=t[0],a=t[1],r=t[2];return n*n+a*a+r*r}function U(t,n){var a=n[0],r=n[1],u=n[2],e=a*a+r*r+u*u;return e>0&&(e=1/Math.sqrt(e)),t[0]=n[0]*e,t[1]=n[1]*e,t[2]=n[2]*e,t}function G(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]}function W(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[0],i=a[1],h=a[2];return t[0]=u*h-e*i,t[1]=e*o-r*h,t[2]=r*i-u*o,t}var C,H=Q,J=Y,K=Z,$=N,tt=X,nt=V,at=B,rt=(C=L(),function(t,n,a,r,u,e){var o,i;for(n||(n=3),a||(a=0),i=r?Math.min(r*n+a,t.length):t.length,o=a;o<i;o+=n)C[0]=t[o],C[1]=t[o+1],C[2]=t[o+2],u(C,C,e),t[o]=C[0],t[o+1]=C[1],t[o+2]=C[2];return t}),ut=Object.freeze({__proto__:null,create:L,clone:function(t){var n=new a(3);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n},length:V,fromValues:k,copy:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t},set:function(t,n,a,r){return t[0]=n,t[1]=a,t[2]=r,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t},subtract:Q,multiply:Y,divide:Z,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t[2]=Math.min(n[2],a[2]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t[2]=Math.max(n[2],a[2]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t},scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t},scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t},distance:N,squaredDistance:X,squaredLength:B,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t},normalize:U,dot:G,cross:W,lerp:function(t,n,a,r){var u=n[0],e=n[1],o=n[2];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t[2]=o+r*(a[2]-o),t},slerp:function(t,n,a,r){var u=Math.acos(Math.min(Math.max(G(n,a),-1),1)),e=Math.sin(u),o=Math.sin((1-r)*u)/e,i=Math.sin(r*u)/e;return t[0]=o*n[0]+i*a[0],t[1]=o*n[1]+i*a[1],t[2]=o*n[2]+i*a[2],t},hermite:function(t,n,a,r,u,e){var o=e*e,i=o*(2*e-3)+1,h=o*(e-2)+e,c=o*(e-1),s=o*(3-2*e);return t[0]=n[0]*i+a[0]*h+r[0]*c+u[0]*s,t[1]=n[1]*i+a[1]*h+r[1]*c+u[1]*s,t[2]=n[2]*i+a[2]*h+r[2]*c+u[2]*s,t},bezier:function(t,n,a,r,u,e){var o=1-e,i=o*o,h=e*e,c=i*o,s=3*e*i,M=3*h*o,f=h*e;return t[0]=n[0]*c+a[0]*s+r[0]*M+u[0]*f,t[1]=n[1]*c+a[1]*s+r[1]*M+u[1]*f,t[2]=n[2]*c+a[2]*s+r[2]*M+u[2]*f,t},random:function(t,n){n=n||1;var a=2*r()*Math.PI,u=2*r()-1,e=Math.sqrt(1-u*u)*n;return t[0]=Math.cos(a)*e,t[1]=Math.sin(a)*e,t[2]=u*n,t},transformMat4:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[3]*r+a[7]*u+a[11]*e+a[15];return o=o||1,t[0]=(a[0]*r+a[4]*u+a[8]*e+a[12])/o,t[1]=(a[1]*r+a[5]*u+a[9]*e+a[13])/o,t[2]=(a[2]*r+a[6]*u+a[10]*e+a[14])/o,t},transformMat3:function(t,n,a){var r=n[0],u=n[1],e=n[2];return t[0]=r*a[0]+u*a[3]+e*a[6],t[1]=r*a[1]+u*a[4]+e*a[7],t[2]=r*a[2]+u*a[5]+e*a[8],t},transformQuat:function(t,n,a){var r=a[0],u=a[1],e=a[2],o=a[3],i=n[0],h=n[1],c=n[2],s=u*c-e*h,M=e*i-r*c,f=r*h-u*i,l=u*f-e*M,v=e*s-r*f,b=r*M-u*s,m=2*o;return s*=m,M*=m,f*=m,l*=2,v*=2,b*=2,t[0]=i+s+l,t[1]=h+M+v,t[2]=c+f+b,t},rotateX:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[0],e[1]=u[1]*Math.cos(r)-u[2]*Math.sin(r),e[2]=u[1]*Math.sin(r)+u[2]*Math.cos(r),t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},rotateY:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[2]*Math.sin(r)+u[0]*Math.cos(r),e[1]=u[1],e[2]=u[2]*Math.cos(r)-u[0]*Math.sin(r),t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},rotateZ:function(t,n,a,r){var u=[],e=[];return u[0]=n[0]-a[0],u[1]=n[1]-a[1],u[2]=n[2]-a[2],e[0]=u[0]*Math.cos(r)-u[1]*Math.sin(r),e[1]=u[0]*Math.sin(r)+u[1]*Math.cos(r),e[2]=u[2],t[0]=e[0]+a[0],t[1]=e[1]+a[1],t[2]=e[2]+a[2],t},angle:function(t,n){var a=t[0],r=t[1],u=t[2],e=n[0],o=n[1],i=n[2],h=Math.sqrt((a*a+r*r+u*u)*(e*e+o*o+i*i)),c=h&&G(t,n)/h;return Math.acos(Math.min(Math.max(c,-1),1))},zero:function(t){return t[0]=0,t[1]=0,t[2]=0,t},str:function(t){return "vec3("+t[0]+", "+t[1]+", "+t[2]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=a[0],i=a[1],h=a[2];return Math.abs(r-o)<=n*Math.max(1,Math.abs(r),Math.abs(o))&&Math.abs(u-i)<=n*Math.max(1,Math.abs(u),Math.abs(i))&&Math.abs(e-h)<=n*Math.max(1,Math.abs(e),Math.abs(h))},sub:H,mul:J,div:K,dist:$,sqrDist:tt,len:nt,sqrLen:at,forEach:rt});function et(){var t=new a(4);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[3]=0),t}function ot(t){var n=new a(4);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n}function it(t,n,r,u){var e=new a(4);return e[0]=t,e[1]=n,e[2]=r,e[3]=u,e}function ht(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t}function ct(t,n,a,r,u){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t}function st(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t}function Mt(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t[2]=n[2]-a[2],t[3]=n[3]-a[3],t}function ft(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t[2]=n[2]*a[2],t[3]=n[3]*a[3],t}function lt(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t[2]=n[2]/a[2],t[3]=n[3]/a[3],t}function vt(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t}function bt(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2],e=n[3]-t[3];return Math.hypot(a,r,u,e)}function mt(t,n){var a=n[0]-t[0],r=n[1]-t[1],u=n[2]-t[2],e=n[3]-t[3];return a*a+r*r+u*u+e*e}function dt(t){var n=t[0],a=t[1],r=t[2],u=t[3];return Math.hypot(n,a,r,u)}function pt(t){var n=t[0],a=t[1],r=t[2],u=t[3];return n*n+a*a+r*r+u*u}function xt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*a+r*r+u*u+e*e;return o>0&&(o=1/Math.sqrt(o)),t[0]=a*o,t[1]=r*o,t[2]=u*o,t[3]=e*o,t}function yt(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]+t[3]*n[3]}function qt(t,n,a,r){var u=n[0],e=n[1],o=n[2],i=n[3];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t[2]=o+r*(a[2]-o),t[3]=i+r*(a[3]-i),t}function gt(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]}var _t=Mt,At=ft,wt=lt,zt=bt,Rt=mt,Ot=dt,jt=pt,Et=function(){var t=et();return function(n,a,r,u,e,o){var i,h;for(a||(a=4),r||(r=0),h=u?Math.min(u*a+r,n.length):n.length,i=r;i<h;i+=a)t[0]=n[i],t[1]=n[i+1],t[2]=n[i+2],t[3]=n[i+3],e(t,t,o),n[i]=t[0],n[i+1]=t[1],n[i+2]=t[2],n[i+3]=t[3];return n}}(),Pt=Object.freeze({__proto__:null,create:et,clone:ot,fromValues:it,copy:ht,set:ct,add:st,subtract:Mt,multiply:ft,divide:lt,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t[2]=Math.ceil(n[2]),t[3]=Math.ceil(n[3]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t[2]=Math.floor(n[2]),t[3]=Math.floor(n[3]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t[2]=Math.min(n[2],a[2]),t[3]=Math.min(n[3],a[3]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t[2]=Math.max(n[2],a[2]),t[3]=Math.max(n[3],a[3]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t[2]=Math.round(n[2]),t[3]=Math.round(n[3]),t},scale:vt,scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t[2]=n[2]+a[2]*r,t[3]=n[3]+a[3]*r,t},distance:bt,squaredDistance:mt,length:dt,squaredLength:pt,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=-n[3],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t[2]=1/n[2],t[3]=1/n[3],t},normalize:xt,dot:yt,cross:function(t,n,a,r){var u=a[0]*r[1]-a[1]*r[0],e=a[0]*r[2]-a[2]*r[0],o=a[0]*r[3]-a[3]*r[0],i=a[1]*r[2]-a[2]*r[1],h=a[1]*r[3]-a[3]*r[1],c=a[2]*r[3]-a[3]*r[2],s=n[0],M=n[1],f=n[2],l=n[3];return t[0]=M*c-f*h+l*i,t[1]=-s*c+f*o-l*e,t[2]=s*h-M*o+l*u,t[3]=-s*i+M*e-f*u,t},lerp:qt,random:function(t,n){var a,u,e,o,i,h;n=n||1;do{i=(a=2*r()-1)*a+(u=2*r()-1)*u;}while(i>=1);do{h=(e=2*r()-1)*e+(o=2*r()-1)*o;}while(h>=1);var c=Math.sqrt((1-i)/h);return t[0]=n*a,t[1]=n*u,t[2]=n*e*c,t[3]=n*o*c,t},transformMat4:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3];return t[0]=a[0]*r+a[4]*u+a[8]*e+a[12]*o,t[1]=a[1]*r+a[5]*u+a[9]*e+a[13]*o,t[2]=a[2]*r+a[6]*u+a[10]*e+a[14]*o,t[3]=a[3]*r+a[7]*u+a[11]*e+a[15]*o,t},transformQuat:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=a[0],i=a[1],h=a[2],c=a[3],s=c*r+i*e-h*u,M=c*u+h*r-o*e,f=c*e+o*u-i*r,l=-o*r-i*u-h*e;return t[0]=s*c+l*-o+M*-h-f*-i,t[1]=M*c+l*-i+f*-o-s*-h,t[2]=f*c+l*-h+s*-i-M*-o,t[3]=n[3],t},zero:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=0,t},str:function(t){return "vec4("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},exactEquals:gt,equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=a[0],h=a[1],c=a[2],s=a[3];return Math.abs(r-i)<=n*Math.max(1,Math.abs(r),Math.abs(i))&&Math.abs(u-h)<=n*Math.max(1,Math.abs(u),Math.abs(h))&&Math.abs(e-c)<=n*Math.max(1,Math.abs(e),Math.abs(c))&&Math.abs(o-s)<=n*Math.max(1,Math.abs(o),Math.abs(s))},sub:_t,mul:At,div:wt,dist:zt,sqrDist:Rt,len:Ot,sqrLen:jt,forEach:Et});function Tt(){var t=new a(4);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0),t[3]=1,t}function St(t,n,a){a*=.5;var r=Math.sin(a);return t[0]=r*n[0],t[1]=r*n[1],t[2]=r*n[2],t[3]=Math.cos(a),t}function Dt(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*s+o*i+u*c-e*h,t[1]=u*s+o*h+e*i-r*c,t[2]=e*s+o*c+r*h-u*i,t[3]=o*s-r*i-u*h-e*c,t}function Ft(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+o*i,t[1]=u*h+e*i,t[2]=e*h-u*i,t[3]=o*h-r*i,t}function It(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h-e*i,t[1]=u*h+o*i,t[2]=e*h+r*i,t[3]=o*h-u*i,t}function Lt(t,n,a){a*=.5;var r=n[0],u=n[1],e=n[2],o=n[3],i=Math.sin(a),h=Math.cos(a);return t[0]=r*h+u*i,t[1]=u*h-r*i,t[2]=e*h+o*i,t[3]=o*h-e*i,t}function Vt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=Math.sqrt(a*a+r*r+u*u),i=Math.exp(e),h=o>0?i*Math.sin(o)/o:0;return t[0]=a*h,t[1]=r*h,t[2]=u*h,t[3]=i*Math.cos(o),t}function kt(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=Math.sqrt(a*a+r*r+u*u),i=o>0?Math.atan2(o,e)/o:0;return t[0]=a*i,t[1]=r*i,t[2]=u*i,t[3]=.5*Math.log(a*a+r*r+u*u+e*e),t}function Qt(t,a,r,u){var e,o,i,h,c,s=a[0],M=a[1],f=a[2],l=a[3],v=r[0],b=r[1],m=r[2],d=r[3];return (o=s*v+M*b+f*m+l*d)<0&&(o=-o,v=-v,b=-b,m=-m,d=-d),1-o>n?(e=Math.acos(o),i=Math.sin(e),h=Math.sin((1-u)*e)/i,c=Math.sin(u*e)/i):(h=1-u,c=u),t[0]=h*s+c*v,t[1]=h*M+c*b,t[2]=h*f+c*m,t[3]=h*l+c*d,t}function Yt(t,n){var a,r=n[0]+n[4]+n[8];if(r>0)a=Math.sqrt(r+1),t[3]=.5*a,a=.5/a,t[0]=(n[5]-n[7])*a,t[1]=(n[6]-n[2])*a,t[2]=(n[1]-n[3])*a;else {var u=0;n[4]>n[0]&&(u=1),n[8]>n[3*u+u]&&(u=2);var e=(u+1)%3,o=(u+2)%3;a=Math.sqrt(n[3*u+u]-n[3*e+e]-n[3*o+o]+1),t[u]=.5*a,a=.5/a,t[3]=(n[3*e+o]-n[3*o+e])*a,t[e]=(n[3*e+u]+n[3*u+e])*a,t[o]=(n[3*o+u]+n[3*u+o])*a;}return t}var Zt=ot,Nt=it,Xt=ht,Bt=ct,Ut=st,Gt=Dt,Wt=vt,Ct=yt,Ht=qt,Jt=dt,Kt=Jt,$t=pt,tn=$t,nn=xt,an=gt;var rn,un,en,on,hn,cn,sn=(rn=L(),un=k(1,0,0),en=k(0,1,0),function(t,n,a){var r=G(n,a);return r<-.999999?(W(rn,un,n),nt(rn)<1e-6&&W(rn,en,n),U(rn,rn),St(t,rn,Math.PI),t):r>.999999?(t[0]=0,t[1]=0,t[2]=0,t[3]=1,t):(W(rn,n,a),t[0]=rn[0],t[1]=rn[1],t[2]=rn[2],t[3]=1+r,nn(t,t))}),Mn=(on=Tt(),hn=Tt(),function(t,n,a,r,u,e){return Qt(on,n,u,e),Qt(hn,a,r,e),Qt(t,on,hn,2*e*(1-e)),t}),fn=(cn=d(),function(t,n,a,r){return cn[0]=a[0],cn[3]=a[1],cn[6]=a[2],cn[1]=r[0],cn[4]=r[1],cn[7]=r[2],cn[2]=-n[0],cn[5]=-n[1],cn[8]=-n[2],nn(t,Yt(t,cn))}),ln=Object.freeze({__proto__:null,create:Tt,identity:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t},setAxisAngle:St,getAxisAngle:function(t,a){var r=2*Math.acos(a[3]),u=Math.sin(r/2);return u>n?(t[0]=a[0]/u,t[1]=a[1]/u,t[2]=a[2]/u):(t[0]=1,t[1]=0,t[2]=0),r},getAngle:function(t,n){var a=Ct(t,n);return Math.acos(2*a*a-1)},multiply:Dt,rotateX:Ft,rotateY:It,rotateZ:Lt,calculateW:function(t,n){var a=n[0],r=n[1],u=n[2];return t[0]=a,t[1]=r,t[2]=u,t[3]=Math.sqrt(Math.abs(1-a*a-r*r-u*u)),t},exp:Vt,ln:kt,pow:function(t,n,a){return kt(t,n),Wt(t,t,a),Vt(t,t),t},slerp:Qt,random:function(t){var n=r(),a=r(),u=r(),e=Math.sqrt(1-n),o=Math.sqrt(n);return t[0]=e*Math.sin(2*Math.PI*a),t[1]=e*Math.cos(2*Math.PI*a),t[2]=o*Math.sin(2*Math.PI*u),t[3]=o*Math.cos(2*Math.PI*u),t},invert:function(t,n){var a=n[0],r=n[1],u=n[2],e=n[3],o=a*a+r*r+u*u+e*e,i=o?1/o:0;return t[0]=-a*i,t[1]=-r*i,t[2]=-u*i,t[3]=e*i,t},conjugate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t},fromMat3:Yt,fromEuler:function(t,n,a,r){var e=arguments.length>4&&void 0!==arguments[4]?arguments[4]:u,o=Math.PI/360;n*=o,r*=o,a*=o;var i=Math.sin(n),h=Math.cos(n),c=Math.sin(a),s=Math.cos(a),M=Math.sin(r),f=Math.cos(r);switch(e){case"xyz":t[0]=i*s*f+h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f-i*c*M;break;case"xzy":t[0]=i*s*f-h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f+i*c*M;break;case"yxz":t[0]=i*s*f+h*c*M,t[1]=h*c*f-i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f+i*c*M;break;case"yzx":t[0]=i*s*f+h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f-i*c*M;break;case"zxy":t[0]=i*s*f-h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M+i*c*f,t[3]=h*s*f-i*c*M;break;case"zyx":t[0]=i*s*f-h*c*M,t[1]=h*c*f+i*s*M,t[2]=h*s*M-i*c*f,t[3]=h*s*f+i*c*M;break;default:throw new Error("Unknown angle order "+e)}return t},str:function(t){return "quat("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+")"},clone:Zt,fromValues:Nt,copy:Xt,set:Bt,add:Ut,mul:Gt,scale:Wt,dot:Ct,lerp:Ht,length:Jt,len:Kt,squaredLength:$t,sqrLen:tn,normalize:nn,exactEquals:an,equals:function(t,n){return Math.abs(yt(t,n))>=.999999},rotationTo:sn,sqlerp:Mn,setAxes:fn});function vn(t,n,a){var r=.5*a[0],u=.5*a[1],e=.5*a[2],o=n[0],i=n[1],h=n[2],c=n[3];return t[0]=o,t[1]=i,t[2]=h,t[3]=c,t[4]=r*c+u*h-e*i,t[5]=u*c+e*o-r*h,t[6]=e*c+r*i-u*o,t[7]=-r*o-u*i-e*h,t}function bn(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t}var mn=Xt;var dn=Xt;function pn(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[4],h=a[5],c=a[6],s=a[7],M=n[4],f=n[5],l=n[6],v=n[7],b=a[0],m=a[1],d=a[2],p=a[3];return t[0]=r*p+o*b+u*d-e*m,t[1]=u*p+o*m+e*b-r*d,t[2]=e*p+o*d+r*m-u*b,t[3]=o*p-r*b-u*m-e*d,t[4]=r*s+o*i+u*c-e*h+M*p+v*b+f*d-l*m,t[5]=u*s+o*h+e*i-r*c+f*p+v*m+l*b-M*d,t[6]=e*s+o*c+r*h-u*i+l*p+v*d+M*m-f*b,t[7]=o*s-r*i-u*h-e*c+v*p-M*b-f*m-l*d,t}var xn=pn;var yn=Ct;var qn=Jt,gn=qn,_n=$t,An=_n;var wn=Object.freeze({__proto__:null,create:function(){var t=new a(8);return a!=Float32Array&&(t[0]=0,t[1]=0,t[2]=0,t[4]=0,t[5]=0,t[6]=0,t[7]=0),t[3]=1,t},clone:function(t){var n=new a(8);return n[0]=t[0],n[1]=t[1],n[2]=t[2],n[3]=t[3],n[4]=t[4],n[5]=t[5],n[6]=t[6],n[7]=t[7],n},fromValues:function(t,n,r,u,e,o,i,h){var c=new a(8);return c[0]=t,c[1]=n,c[2]=r,c[3]=u,c[4]=e,c[5]=o,c[6]=i,c[7]=h,c},fromRotationTranslationValues:function(t,n,r,u,e,o,i){var h=new a(8);h[0]=t,h[1]=n,h[2]=r,h[3]=u;var c=.5*e,s=.5*o,M=.5*i;return h[4]=c*u+s*r-M*n,h[5]=s*u+M*t-c*r,h[6]=M*u+c*n-s*t,h[7]=-c*t-s*n-M*r,h},fromRotationTranslation:vn,fromTranslation:function(t,n){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=.5*n[0],t[5]=.5*n[1],t[6]=.5*n[2],t[7]=0,t},fromRotation:function(t,n){return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},fromMat4:function(t,n){var r=Tt();O(r,n);var u=new a(3);return z(u,n),vn(t,r,u),t},copy:bn,identity:function(t){return t[0]=0,t[1]=0,t[2]=0,t[3]=1,t[4]=0,t[5]=0,t[6]=0,t[7]=0,t},set:function(t,n,a,r,u,e,o,i,h){return t[0]=n,t[1]=a,t[2]=r,t[3]=u,t[4]=e,t[5]=o,t[6]=i,t[7]=h,t},getReal:mn,getDual:function(t,n){return t[0]=n[4],t[1]=n[5],t[2]=n[6],t[3]=n[7],t},setReal:dn,setDual:function(t,n){return t[4]=n[0],t[5]=n[1],t[6]=n[2],t[7]=n[3],t},getTranslation:function(t,n){var a=n[4],r=n[5],u=n[6],e=n[7],o=-n[0],i=-n[1],h=-n[2],c=n[3];return t[0]=2*(a*c+e*o+r*h-u*i),t[1]=2*(r*c+e*i+u*o-a*h),t[2]=2*(u*c+e*h+a*i-r*o),t},translate:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=.5*a[0],h=.5*a[1],c=.5*a[2],s=n[4],M=n[5],f=n[6],l=n[7];return t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=o*i+u*c-e*h+s,t[5]=o*h+e*i-r*c+M,t[6]=o*c+r*h-u*i+f,t[7]=-r*i-u*h-e*c+l,t},rotateX:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return Ft(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateY:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return It(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateZ:function(t,n,a){var r=-n[0],u=-n[1],e=-n[2],o=n[3],i=n[4],h=n[5],c=n[6],s=n[7],M=i*o+s*r+h*e-c*u,f=h*o+s*u+c*r-i*e,l=c*o+s*e+i*u-h*r,v=s*o-i*r-h*u-c*e;return Lt(t,n,a),r=t[0],u=t[1],e=t[2],o=t[3],t[4]=M*o+v*r+f*e-l*u,t[5]=f*o+v*u+l*r-M*e,t[6]=l*o+v*e+M*u-f*r,t[7]=v*o-M*r-f*u-l*e,t},rotateByQuatAppend:function(t,n,a){var r=a[0],u=a[1],e=a[2],o=a[3],i=n[0],h=n[1],c=n[2],s=n[3];return t[0]=i*o+s*r+h*e-c*u,t[1]=h*o+s*u+c*r-i*e,t[2]=c*o+s*e+i*u-h*r,t[3]=s*o-i*r-h*u-c*e,i=n[4],h=n[5],c=n[6],s=n[7],t[4]=i*o+s*r+h*e-c*u,t[5]=h*o+s*u+c*r-i*e,t[6]=c*o+s*e+i*u-h*r,t[7]=s*o-i*r-h*u-c*e,t},rotateByQuatPrepend:function(t,n,a){var r=n[0],u=n[1],e=n[2],o=n[3],i=a[0],h=a[1],c=a[2],s=a[3];return t[0]=r*s+o*i+u*c-e*h,t[1]=u*s+o*h+e*i-r*c,t[2]=e*s+o*c+r*h-u*i,t[3]=o*s-r*i-u*h-e*c,i=a[4],h=a[5],c=a[6],s=a[7],t[4]=r*s+o*i+u*c-e*h,t[5]=u*s+o*h+e*i-r*c,t[6]=e*s+o*c+r*h-u*i,t[7]=o*s-r*i-u*h-e*c,t},rotateAroundAxis:function(t,a,r,u){if(Math.abs(u)<n)return bn(t,a);var e=Math.hypot(r[0],r[1],r[2]);u*=.5;var o=Math.sin(u),i=o*r[0]/e,h=o*r[1]/e,c=o*r[2]/e,s=Math.cos(u),M=a[0],f=a[1],l=a[2],v=a[3];t[0]=M*s+v*i+f*c-l*h,t[1]=f*s+v*h+l*i-M*c,t[2]=l*s+v*c+M*h-f*i,t[3]=v*s-M*i-f*h-l*c;var b=a[4],m=a[5],d=a[6],p=a[7];return t[4]=b*s+p*i+m*c-d*h,t[5]=m*s+p*h+d*i-b*c,t[6]=d*s+p*c+b*h-m*i,t[7]=p*s-b*i-m*h-d*c,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t[2]=n[2]+a[2],t[3]=n[3]+a[3],t[4]=n[4]+a[4],t[5]=n[5]+a[5],t[6]=n[6]+a[6],t[7]=n[7]+a[7],t},multiply:pn,mul:xn,scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t[2]=n[2]*a,t[3]=n[3]*a,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t},dot:yn,lerp:function(t,n,a,r){var u=1-r;return yn(n,a)<0&&(r=-r),t[0]=n[0]*u+a[0]*r,t[1]=n[1]*u+a[1]*r,t[2]=n[2]*u+a[2]*r,t[3]=n[3]*u+a[3]*r,t[4]=n[4]*u+a[4]*r,t[5]=n[5]*u+a[5]*r,t[6]=n[6]*u+a[6]*r,t[7]=n[7]*u+a[7]*r,t},invert:function(t,n){var a=_n(n);return t[0]=-n[0]/a,t[1]=-n[1]/a,t[2]=-n[2]/a,t[3]=n[3]/a,t[4]=-n[4]/a,t[5]=-n[5]/a,t[6]=-n[6]/a,t[7]=n[7]/a,t},conjugate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t[2]=-n[2],t[3]=n[3],t[4]=-n[4],t[5]=-n[5],t[6]=-n[6],t[7]=n[7],t},length:qn,len:gn,squaredLength:_n,sqrLen:An,normalize:function(t,n){var a=_n(n);if(a>0){a=Math.sqrt(a);var r=n[0]/a,u=n[1]/a,e=n[2]/a,o=n[3]/a,i=n[4],h=n[5],c=n[6],s=n[7],M=r*i+u*h+e*c+o*s;t[0]=r,t[1]=u,t[2]=e,t[3]=o,t[4]=(i-r*M)/a,t[5]=(h-u*M)/a,t[6]=(c-e*M)/a,t[7]=(s-o*M)/a;}return t},str:function(t){return "quat2("+t[0]+", "+t[1]+", "+t[2]+", "+t[3]+", "+t[4]+", "+t[5]+", "+t[6]+", "+t[7]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]&&t[2]===n[2]&&t[3]===n[3]&&t[4]===n[4]&&t[5]===n[5]&&t[6]===n[6]&&t[7]===n[7]},equals:function(t,a){var r=t[0],u=t[1],e=t[2],o=t[3],i=t[4],h=t[5],c=t[6],s=t[7],M=a[0],f=a[1],l=a[2],v=a[3],b=a[4],m=a[5],d=a[6],p=a[7];return Math.abs(r-M)<=n*Math.max(1,Math.abs(r),Math.abs(M))&&Math.abs(u-f)<=n*Math.max(1,Math.abs(u),Math.abs(f))&&Math.abs(e-l)<=n*Math.max(1,Math.abs(e),Math.abs(l))&&Math.abs(o-v)<=n*Math.max(1,Math.abs(o),Math.abs(v))&&Math.abs(i-b)<=n*Math.max(1,Math.abs(i),Math.abs(b))&&Math.abs(h-m)<=n*Math.max(1,Math.abs(h),Math.abs(m))&&Math.abs(c-d)<=n*Math.max(1,Math.abs(c),Math.abs(d))&&Math.abs(s-p)<=n*Math.max(1,Math.abs(s),Math.abs(p))}});function zn(){var t=new a(2);return a!=Float32Array&&(t[0]=0,t[1]=0),t}function Rn(t,n,a){return t[0]=n[0]-a[0],t[1]=n[1]-a[1],t}function On(t,n,a){return t[0]=n[0]*a[0],t[1]=n[1]*a[1],t}function jn(t,n,a){return t[0]=n[0]/a[0],t[1]=n[1]/a[1],t}function En(t,n){var a=n[0]-t[0],r=n[1]-t[1];return Math.hypot(a,r)}function Pn(t,n){var a=n[0]-t[0],r=n[1]-t[1];return a*a+r*r}function Tn(t){var n=t[0],a=t[1];return Math.hypot(n,a)}function Sn(t){var n=t[0],a=t[1];return n*n+a*a}var Dn=Tn,Fn=Rn,In=On,Ln=jn,Vn=En,kn=Pn,Qn=Sn,Yn=function(){var t=zn();return function(n,a,r,u,e,o){var i,h;for(a||(a=2),r||(r=0),h=u?Math.min(u*a+r,n.length):n.length,i=r;i<h;i+=a)t[0]=n[i],t[1]=n[i+1],e(t,t,o),n[i]=t[0],n[i+1]=t[1];return n}}(),Zn=Object.freeze({__proto__:null,create:zn,clone:function(t){var n=new a(2);return n[0]=t[0],n[1]=t[1],n},fromValues:function(t,n){var r=new a(2);return r[0]=t,r[1]=n,r},copy:function(t,n){return t[0]=n[0],t[1]=n[1],t},set:function(t,n,a){return t[0]=n,t[1]=a,t},add:function(t,n,a){return t[0]=n[0]+a[0],t[1]=n[1]+a[1],t},subtract:Rn,multiply:On,divide:jn,ceil:function(t,n){return t[0]=Math.ceil(n[0]),t[1]=Math.ceil(n[1]),t},floor:function(t,n){return t[0]=Math.floor(n[0]),t[1]=Math.floor(n[1]),t},min:function(t,n,a){return t[0]=Math.min(n[0],a[0]),t[1]=Math.min(n[1],a[1]),t},max:function(t,n,a){return t[0]=Math.max(n[0],a[0]),t[1]=Math.max(n[1],a[1]),t},round:function(t,n){return t[0]=Math.round(n[0]),t[1]=Math.round(n[1]),t},scale:function(t,n,a){return t[0]=n[0]*a,t[1]=n[1]*a,t},scaleAndAdd:function(t,n,a,r){return t[0]=n[0]+a[0]*r,t[1]=n[1]+a[1]*r,t},distance:En,squaredDistance:Pn,length:Tn,squaredLength:Sn,negate:function(t,n){return t[0]=-n[0],t[1]=-n[1],t},inverse:function(t,n){return t[0]=1/n[0],t[1]=1/n[1],t},normalize:function(t,n){var a=n[0],r=n[1],u=a*a+r*r;return u>0&&(u=1/Math.sqrt(u)),t[0]=n[0]*u,t[1]=n[1]*u,t},dot:function(t,n){return t[0]*n[0]+t[1]*n[1]},cross:function(t,n,a){var r=n[0]*a[1]-n[1]*a[0];return t[0]=t[1]=0,t[2]=r,t},lerp:function(t,n,a,r){var u=n[0],e=n[1];return t[0]=u+r*(a[0]-u),t[1]=e+r*(a[1]-e),t},random:function(t,n){n=n||1;var a=2*r()*Math.PI;return t[0]=Math.cos(a)*n,t[1]=Math.sin(a)*n,t},transformMat2:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[2]*u,t[1]=a[1]*r+a[3]*u,t},transformMat2d:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[2]*u+a[4],t[1]=a[1]*r+a[3]*u+a[5],t},transformMat3:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[3]*u+a[6],t[1]=a[1]*r+a[4]*u+a[7],t},transformMat4:function(t,n,a){var r=n[0],u=n[1];return t[0]=a[0]*r+a[4]*u+a[12],t[1]=a[1]*r+a[5]*u+a[13],t},rotate:function(t,n,a,r){var u=n[0]-a[0],e=n[1]-a[1],o=Math.sin(r),i=Math.cos(r);return t[0]=u*i-e*o+a[0],t[1]=u*o+e*i+a[1],t},angle:function(t,n){var a=t[0],r=t[1],u=n[0],e=n[1],o=Math.sqrt((a*a+r*r)*(u*u+e*e)),i=o&&(a*u+r*e)/o;return Math.acos(Math.min(Math.max(i,-1),1))},zero:function(t){return t[0]=0,t[1]=0,t},str:function(t){return "vec2("+t[0]+", "+t[1]+")"},exactEquals:function(t,n){return t[0]===n[0]&&t[1]===n[1]},equals:function(t,a){var r=t[0],u=t[1],e=a[0],o=a[1];return Math.abs(r-e)<=n*Math.max(1,Math.abs(r),Math.abs(e))&&Math.abs(u-o)<=n*Math.max(1,Math.abs(u),Math.abs(o))},len:Dn,sub:Fn,mul:In,div:Ln,dist:Vn,sqrDist:kn,sqrLen:Qn,forEach:Yn});t.glMatrix=o,t.mat2=M,t.mat2d=m,t.mat3=g,t.mat4=I,t.quat=ln,t.quat2=wn,t.vec2=Zn,t.vec3=ut,t.vec4=Pt,Object.defineProperty(t,"__esModule",{value:!0});}));

var glMatrix$1 = glMatrix;

const {mat3: mat3$1} = glMatrix$1;

const CubeSym = {
    ID: 0,
    ROT_Y: 1,
    ROT_Y2: 2,
    ROT_Y3: 3,
    ROT_Z: 4,
    ROT_Z2: 5,
    ROT_Z3: 6,
    ROT_X: 7,
    ROT_X2: 8,
    ROT_X3: 9,
    NEG_Y: 24,
    /**
     * generated
     */
    NEG_Z: 29,
    /**
     * generated
     */
    NEG_X: 32,
    matrices: [],
    _byScale: [0,0,0,0,0,0,0,0],
    _symCayley: [],
    _inv: [],

    fromScale(sx, sy, sz) {
        return CubeSym._byScale[((sx < 0) ? 1 : 0)
            + ((sy < 0) ? 2 : 0)
            + ((sz < 0) ? 4 : 0)];
    },
    fromXVec(sx, sy, sz) {
        if (sx > 0) {
            return CubeSym.ROT_Y3;
        }
        if (sx < 0) {
            return CubeSym.ROT_Y;
        }
        if (sy > 0) {
            return CubeSym.ROT_X;
        }
        if (sy < 0) {
            return CubeSym.ROT_X3;
        }
        if (sz > 0) {
            return CubeSym.ID;
        }
        if (sz < 0) {
            return CubeSym.ROT_Y2;
        }
        return CubeSym.ID;
    },
    dirAdd(sym, dir) {
        const mat = this.matrices[this.add(sym, dir)];
        return this.fromXVec(mat[2], mat[5], mat[8]);
    },
    add(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][symFirst];
    },
    sub(symSecond, symFirst) {
        return CubeSym._symCayley[symSecond][CubeSym._inv[symFirst]];
    },
    inv(sym) {
        return CubeSym._inv[sym];
    }
};

const tmp = new Float32Array(9);

function fill(startIndex, finishIndex, current) {
    const {matrices, _symCayley} = CubeSym;
    for (let i = startIndex; i < finishIndex; i++) {
        for (let j = 0; j < current; j++) {
            mat3$1.multiply(tmp, matrices[j], matrices[i]);
            let flag = false;
            for (let k=0;k<current; k++) {
                flag = true;
                for (let s=0;s<9;s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
            if (!flag) {
                matrices[current].set(tmp, 0);
                _symCayley[j][i] = current++;
            }
        }
    }
    return current;
}

function fillRest() {
    const {matrices, _symCayley, _inv, _byScale} = CubeSym;
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] >=0) {
                continue;
            }
            mat3$1.multiply(tmp, matrices[j], matrices[i]);
            for (let k = 0; k < 48; k++) {
                let flag = true;
                for (let s = 0; s < 9; s++) {
                    if (matrices[k][s] !== tmp[s]) {
                        flag = false;
                        break;
                    }
                }
                if (flag) {
                    _symCayley[j][i] = k;
                    break;
                }
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) {
            if (_symCayley[j][i] === 0) {
                _inv[i] = j;
                break;
            }
        }
    }

    for (let i = 0; i < 48; i++) {
        const mat = matrices[i];
        if (mat[0] !== 0 && mat[4] !== 0 && mat[8] !== 0) {
            const ind = (mat[0]<0?1:0) + (mat[4]<0?2:0) + (mat[8]<0?4:0);
            _byScale[ind] = i;
        }
    }
}

function init() {
    const {matrices, _symCayley, ROT_Y, ROT_Z, ROT_X, NEG_Y, NEG_Z, NEG_X} = CubeSym;
    for (let i = 0; i < 48; i++) {
        matrices[i] = new Float32Array(9);
        _symCayley[i] = [];
        for (let j=0;j<48;j++) {
            _symCayley[i].push(-1);
        }
    }
    let current = 0;
    // ID
    matrices[0][0] = 1;
    matrices[0][4] = 1;
    matrices[0][8] = 1;
    current++;
    matrices[ROT_Y][2] = -1;
    matrices[ROT_Y][4] = 1;
    matrices[ROT_Y][6] = 1;
    current++;
    mat3$1.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y]);
    mat3$1.multiply(matrices[current++], matrices[ROT_Y], matrices[ROT_Y+1]);
    matrices[ROT_Z][1] = -1;
    matrices[ROT_Z][3] = 1;
    matrices[ROT_Z][8] = 1;
    current++;
    mat3$1.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z]);
    mat3$1.multiply(matrices[current++], matrices[ROT_Z], matrices[ROT_Z+1]);
    matrices[ROT_X][0] = 1;
    matrices[ROT_X][5] = 1;
    matrices[ROT_X][7] = -1;
    current++;
    mat3$1.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X]);
    mat3$1.multiply(matrices[current++], matrices[ROT_X], matrices[ROT_X+1]);
    current = fill(0, 24, current);
    matrices[NEG_Y][0] = 1;
    matrices[NEG_Y][4] = -1;
    matrices[NEG_Y][8] = 1;
    current++;
    current = fill(24, 48, current);
    fillRest();
}

// let perf = Date.now();
init();
// perf = Date.now()-perf;
// console.log(`matrices generated for ${perf} ms`);
function pushSym(
        vertices, sym,
        cx, cz, cy,
        x0, z0, y0,
        ux, uz, uy, vx, vz, vy,
        c0, c1, c2, c3,
        r, g, b,
        flags
    ) {
    const mat = CubeSym.matrices[sym];
    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2],
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8],
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5],

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

// A port of an algorithm by Johannes Baagøe <baagoe@baagoe.com>, 2010
// http://baagoe.com/en/RandomMusings/javascript/
// https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
// Original work is under MIT license -

// Copyright (C) 2010 by Johannes Baagøe <baagoe@baagoe.org>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function Alea(seed) {
  var me = this, mash = Mash();

  me.next = function() {
    var t = 2091639 * me.s0 + me.c * 2.3283064365386963e-10; // 2^-32
    me.s0 = me.s1;
    me.s1 = me.s2;
    return me.s2 = t - (me.c = t | 0);
  };

  // Apply the seeding algorithm from Baagoe.
  me.c = 1;
  me.s0 = mash(' ');
  me.s1 = mash(' ');
  me.s2 = mash(' ');
  me.s0 -= mash(seed);
  if (me.s0 < 0) { me.s0 += 1; }
  me.s1 -= mash(seed);
  if (me.s1 < 0) { me.s1 += 1; }
  me.s2 -= mash(seed);
  if (me.s2 < 0) { me.s2 += 1; }
  mash = null;
}

function copy(f, t) {
  t.c = f.c;
  t.s0 = f.s0;
  t.s1 = f.s1;
  t.s2 = f.s2;
  return t;
}

function impl(seed, opts) {
  var xg = new Alea(seed),
      state = opts && opts.state,
      prng = xg.next;
      prng.int32 = function() { return (xg.next() * 0x100000000) | 0; };
      prng.nextInt = function(max) { return (xg.next() * max) | 0; };
  prng.double = function() {
    return prng() + (prng() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
  };
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); };
  }
  return prng;
}

function Mash() {
  var n = 0xefc8249d;

  var mash = function(data) {
    data = String(data);
    for (var i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      var h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    }
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  };

  return mash;
}

'use strict';
let exports$1={};
//Object.defineProperty(exports, "__esModule", { value: true });
exports$1.substr = exports$1.substring = exports$1.betweenInclusive = exports$1.codePointFromSurrogatePair = exports$1.isZeroWidthJoiner = exports$1.isGraphem = exports$1.isDiacriticalMark = exports$1.isVariationSelector = exports$1.isFitzpatrickModifier = exports$1.isRegionalIndicator = exports$1.isFirstOfSurrogatePair = exports$1.nextUnits = exports$1.runes = exports$1.GRAPHEMS = exports$1.ZWJ = exports$1.DIACRITICAL_MARKS_END = exports$1.DIACRITICAL_MARKS_START = exports$1.VARIATION_MODIFIER_END = exports$1.VARIATION_MODIFIER_START = exports$1.FITZPATRICK_MODIFIER_END = exports$1.FITZPATRICK_MODIFIER_START = exports$1.REGIONAL_INDICATOR_END = exports$1.REGIONAL_INDICATOR_START = exports$1.LOW_SURROGATE_START = exports$1.HIGH_SURROGATE_END = exports$1.HIGH_SURROGATE_START = void 0;
exports$1.HIGH_SURROGATE_START = 0xd800;
exports$1.HIGH_SURROGATE_END = 0xdbff;
exports$1.LOW_SURROGATE_START = 0xdc00;
exports$1.REGIONAL_INDICATOR_START = 0x1f1e6;
exports$1.REGIONAL_INDICATOR_END = 0x1f1ff;
exports$1.FITZPATRICK_MODIFIER_START = 0x1f3fb;
exports$1.FITZPATRICK_MODIFIER_END = 0x1f3ff;
exports$1.VARIATION_MODIFIER_START = 0xfe00;
exports$1.VARIATION_MODIFIER_END = 0xfe0f;
exports$1.DIACRITICAL_MARKS_START = 0x20d0;
exports$1.DIACRITICAL_MARKS_END = 0x20ff;
exports$1.ZWJ = 0x200d;
exports$1.GRAPHEMS = [
    0x0308,
    0x0937,
    0x0937,
    0x093F,
    0x093F,
    0x0BA8,
    0x0BBF,
    0x0BCD,
    0x0E31,
    0x0E33,
    0x0E40,
    0x0E49,
    0x1100,
    0x1161,
    0x11A8, // ( ᆨ ) HANGUL JONGSEONG KIYEOK
];
function runes(string) {
    if (typeof string !== 'string') {
        throw new Error('string cannot be undefined or null');
    }
    const result = [];
    let i = 0;
    let increment = 0;
    while (i < string.length) {
        increment += nextUnits(i + increment, string);
        if (isGraphem(string[i + increment])) {
            increment++;
        }
        if (isVariationSelector(string[i + increment])) {
            increment++;
        }
        if (isDiacriticalMark(string[i + increment])) {
            increment++;
        }
        if (isZeroWidthJoiner(string[i + increment])) {
            increment++;
            continue;
        }
        result.push(string.substring(i, i + increment));
        i += increment;
        increment = 0;
    }
    return result;
}
exports$1.runes = runes;
// Decide how many code units make up the current character.
// BMP characters: 1 code unit
// Non-BMP characters (represented by surrogate pairs): 2 code units
// Emoji with skin-tone modifiers: 4 code units (2 code points)
// Country flags: 4 code units (2 code points)
// Variations: 2 code units
function nextUnits(i, string) {
    const current = string[i];
    // If we don't have a value that is part of a surrogate pair, or we're at
    // the end, only take the value at i
    if (!isFirstOfSurrogatePair(current) || i === string.length - 1) {
        return 1;
    }
    const currentPair = current + string[i + 1];
    let nextPair = string.substring(i + 2, i + 5);
    // Country flags are comprised of two regional indicator symbols,
    // each represented by a surrogate pair.
    // See http://emojipedia.org/flags/
    // If both pairs are regional indicator symbols, take 4
    if (isRegionalIndicator(currentPair) && isRegionalIndicator(nextPair)) {
        return 4;
    }
    // If the next pair make a Fitzpatrick skin tone
    // modifier, take 4
    // See http://emojipedia.org/modifiers/
    // Technically, only some code points are meant to be
    // combined with the skin tone modifiers. This function
    // does not check the current pair to see if it is
    // one of them.
    if (isFitzpatrickModifier(nextPair)) {
        return 4;
    }
    return 2;
}
exports$1.nextUnits = nextUnits;
function isFirstOfSurrogatePair(string) {
    return string && betweenInclusive(string[0].charCodeAt(0), exports$1.HIGH_SURROGATE_START, exports$1.HIGH_SURROGATE_END);
}
exports$1.isFirstOfSurrogatePair = isFirstOfSurrogatePair;
function isRegionalIndicator(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports$1.REGIONAL_INDICATOR_START, exports$1.REGIONAL_INDICATOR_END);
}
exports$1.isRegionalIndicator = isRegionalIndicator;
function isFitzpatrickModifier(string) {
    return betweenInclusive(codePointFromSurrogatePair(string), exports$1.FITZPATRICK_MODIFIER_START, exports$1.FITZPATRICK_MODIFIER_END);
}
exports$1.isFitzpatrickModifier = isFitzpatrickModifier;
function isVariationSelector(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports$1.VARIATION_MODIFIER_START, exports$1.VARIATION_MODIFIER_END);
}
exports$1.isVariationSelector = isVariationSelector;
function isDiacriticalMark(string) {
    return typeof string === 'string' && betweenInclusive(string.charCodeAt(0), exports$1.DIACRITICAL_MARKS_START, exports$1.DIACRITICAL_MARKS_END);
}
exports$1.isDiacriticalMark = isDiacriticalMark;
function isGraphem(string) {
    return typeof string === 'string' && exports$1.GRAPHEMS.indexOf(string.charCodeAt(0)) !== -1;
}
exports$1.isGraphem = isGraphem;
function isZeroWidthJoiner(string) {
    return typeof string === 'string' && string.charCodeAt(0) === exports$1.ZWJ;
}
exports$1.isZeroWidthJoiner = isZeroWidthJoiner;
function codePointFromSurrogatePair(pair) {
    const highOffset = pair.charCodeAt(0) - exports$1.HIGH_SURROGATE_START;
    const lowOffset = pair.charCodeAt(1) - exports$1.LOW_SURROGATE_START;
    return (highOffset << 10) + lowOffset + 0x10000;
}
exports$1.codePointFromSurrogatePair = codePointFromSurrogatePair;
function betweenInclusive(value, lower, upper) {
    return value >= lower && value <= upper;
}
exports$1.betweenInclusive = betweenInclusive;
function substring(string, start, width) {
    const chars = runes(string);
    if (start === undefined) {
        return string;
    }
    if (start >= chars.length) {
        return '';
    }
    const rest = chars.length - start;
    const stringWidth = width === undefined ? rest : width;
    let endIndex = start + stringWidth;
    if (endIndex > (start + rest)) {
        endIndex = undefined;
    }
    return chars.slice(start, endIndex).join('');
}
exports$1.substring = substring;
exports$1.substr = substring;
runes.substr = substring;
runes.substring = substring;
runes.default = runes;
runes.runes = runes;
Object.defineProperty(runes, "__esModule", { value: true });

const {mat4: mat4$1} = glMatrix$1;

const SNEAK_MINUS_Y_MUL      = 0.2; // decrease player height to this percent value
const MOB_EYE_HEIGHT_PERCENT = 1 - 1/16;

const CAMERA_MODE = {
    COUNT: 3,
    SHOOTER: 0,
    THIRD_PERSON: 1,
    THIRD_PERSON_FRONT: 2
};

const TX_CNT = 32;

/*Object.defineProperty(String.prototype, 'hashCode', {
    value: function() {
        var hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
});*/

/**
 * Lerp any value between
 * @param {*} a
 * @param {*} b
 * @param {number} t
 * @param {*} res
 * @returns
 */
function lerpComplex (a, b, t, res) {
    const typeA = typeof a;
    const typeB = typeof b;

    if (typeA !== typeB) {
        return res; // no emit
    }

    if (a == null || b == null) {
        return null;
    }

    if (typeA == 'boolean' || typeA === 'string') {
        return t > 0.5 ? b : a; // if < 0.5 return a, or b
    }

    if (typeA === 'number') {
        return a * (1 - t) + b * t;
    }

    if (Array.isArray(a)) {
        res = res || [];

        for (let i = 0; i < Math.min(a.length, b.length); i ++) {
            res[i] = a[i] * (1 - t) + b[i] * t;
        }

        return res;
    }

    res = res || {};

    for (const key in a) {

        res[key] = lerpComplex(
            a[key],
            b[key],
            t,
            res[key]
        );
    }

    return res;
}

class Mth {
    /**
     * Lerp any value between
     * @param {*} a
     * @param {*} b
     * @param {number} t
     * @param {*} res
     * @returns
     */
    static lerpComplex = lerpComplex;

    static lerp(amount, value1, value2) {
        amount = amount < 0 ? 0 : amount;
        amount = amount > 1 ? 1 : amount;
        return value1 + (value2 - value1) * amount;
    }

    static sin(a) {
        return Math.sin(a);
    }

    static cos(a) {
        return Math.cos(a);
    }

    static clamp (value, min, max) {
        return value < min
            ? min : (
                value > max
                    ? max
                    : value
            );
    }

    static repeat(value, length) {
        return Mth.clamp(value - Math.floor(value / length) * length, 0.0, length);
    }

    /**
     * Compute a distance between over minimal arc
     * @param {number} current
     * @param {number} target
     * @returns {number}
     */
    static deltaAngle(current, target) {
        const delta = Mth.repeat((target - current), 360.0);

        return delta > 180
            ? delta - 360.0
            : delta;
    }

    /**
     * Lerp angle with over minimal distance
     * @param {number} a - start angle
     * @param {number} b - target angle
     * @param {number} t - lerp factor
     * @returns {number}
     */
    static lerpAngle(a, b, t) {
        let delta = Mth.repeat((b - a), 360);

        if (delta > 180)
            delta -= 360;

        return a + delta * Mth.clamp(t, 0, 1);
    }

}

class IvanArray {
    constructor() {
        this.arr = [];
        this.count = 0;
    }

    clear() {
        const { count, arr } = this;
        this.count = 0;
        for (let i = 0; i < count; i++) {
            arr[i] = null;
        }
    }

    push(elem) {
        this.arr[this.count++] = elem;
    }
}

// VectorCollector...
class VectorCollector {

    static sets = 0;

    constructor(list) {
        this.clear(list);
    }

    *[Symbol.iterator]() {
        for (let x of this.list.values()) {
            for (let y of x.values()) {
                for (let value of y.values()) {
                    yield value;
                }
            }
        }
    }

    entries(aabb) {
        const that = this;
        return (function* () {
            let vec = new Vector(0, 0, 0);
            for (let [xk, x] of that.list) {
                if(aabb && (xk < aabb.x_min || xk > aabb.x_max)) continue;
                for (let [yk, y] of x) {
                    if(aabb && (yk < aabb.y_min || yk > aabb.y_max)) continue;
                    for (let [zk, value] of y) {
                        if(aabb && (zk < aabb.z_min || zk > aabb.z_max)) continue;
                        vec.set(xk|0, yk|0, zk|0);
                        yield [vec, value];
                    }
                }
            }
        })()
    }

    kvpIterator(aabb) {
        return this.entries(aabb);
    }

    clear(list) {
        this.list = list ? list : new Map();
        this.size = 0;
    }

    set(vec, value) {
        let size = this.size;
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            this.size++;
        }
        if (typeof value === 'function') {
            value = value(vec);
        }
        this.list.get(vec.x).get(vec.y).set(vec.z, value);
        return this.size > size;
    }

    add(vec, value) {
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            this.list.get(vec.x).get(vec.y).set(vec.z, value);
            this.size++;
        }
        return this.list.get(vec.x).get(vec.y).get(vec.z);
    }

    delete(vec) {
        if(this.list?.get(vec.x)?.get(vec.y)?.delete(vec.z)) {
            this.size--;
            return true;
        }
        return false;
    }

    has(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
        //if(!this.list.has(vec.x)) return false;
        //if(!this.list.get(vec.x).has(vec.y)) return false;
        //if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return false;
        //return true;
    }

    get(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
        // if(!this.list.has(vec.x)) return null;
        // if(!this.list.get(vec.x).has(vec.y)) return null;
        // if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return null;
    }

    keys() {
        let resp = [];
        for (let [xk, x] of this.list) {
            for (let [yk, y] of x) {
                for (let [zk, z] of y) {
                    resp.push(new Vector(xk|0, yk|0, zk|0));
                }
            }
        }
        return resp;
    }

    values() {
        let resp = [];
        for(let item of this) {
            resp.push(item);
        }
        return resp;
    }

    reduce(max_size) {
        if(this.size < max_size) {
            return false;
        }
        /*
        let keys = Object.keys(this.maps_cache);
        if(keys.length > MAX_ENTR) {
            let del_count = Math.floor(keys.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(let key of keys) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[key]);
            }
        }
        */
    }

}

// Color
class Color {

    static componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    static hexToColor(hex_color) {
        var c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex_color)) {
            c = hex_color.substring(1).split('');
            if(c.length == 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return new Color((c>>16)&255, (c>>8)&255, c&255, 255); // 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',1)';
        }
        throw new Error('Bad Hex');
    }

    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    add(color) {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        this.a += color.a;
        return this;
    }

    divide(color) {
        this.r /= color.r;
        this.g /= color.g;
        this.b /= color.b;
        this.a /= color.a;
        return this;
    }

    set(r, g, b, a) {
        if(r instanceof Color) {
            g = r.g;
            b = r.b;
            a = r.a;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        return this;
    }

    /**
     * @return {Color}
     */
    toFloat()  {
        return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    /**
     * @return {string}
     */
    toCSS()  {
        return 'rgb(' + [this.r, this.g, this.b, this.a].join(',') + ')';
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    toHex() {
        return "#" + Color.componentToHex(this.r) +
            Color.componentToHex(this.g) +
            Color.componentToHex(this.b) +
            Color.componentToHex(this.a);
    }

    toArray() {
        return [this.r, this.g, this.b, this.a];
    }

}

class Vector {

    // static cnt = 0;
    // static traces = new Map();

    static XN = new Vector(-1.0, 0.0, 0.0);
    static XP = new Vector(1.0, 0.0, 0.0);
    static YN = new Vector(0.0, -1.0, 0.0);
    static YP = new Vector(0.0, 1.0, 0.0);
    static ZN = new Vector(0.0, 0.0, -1.0);
    static ZP = new Vector(0.0, 0.0, 1.0);
    static ZERO = new Vector(0.0, 0.0, 0.0);

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} [x]
     * @param {number} [y]
     * @param {number} [z]
     */
    constructor(x, y, z) {
        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.set(x, y, z);
    }

    //Array like proxy for usign it in gl-matrix
    get [0]() {
        return this.x;
    }

    set [0](v) {
        this.x = v;
    }

    get [1]() {
        return this.y;
    }

    set [1](v) {
        this.y = v;
    }

    get [2]() {
        return this.z;
    }

    set [2](v) {
        this.z = v;
    }

    // array like iterator
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
        yield this.z;
    }

    // array like object lenght
    get length() {
        return 3;
    }

    /**
     * @param {Vector} vec
     */
    copyFrom(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {boolean}
     */
    equal(vec) {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    /**
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @return {void}
     */
    lerpFrom(vec1, vec2, delta) {
        this.x = vec1.x * (1.0 - delta) + vec2.x * delta;
        this.y = vec1.y * (1.0 - delta) + vec2.y * delta;
        this.z = vec1.z * (1.0 - delta) + vec2.z * delta;
        return this;
    }

    /**
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @param {boolean} rad
     * @return {void}
     */
    lerpFromAngle(vec1, vec2, delta, rad = false) {
        const coef = rad
            ? 180 / Math.PI
            : 1;

        this.x = Mth.lerpAngle(vec1.x * coef, vec2.x * coef, delta) / coef;
        this.y = Mth.lerpAngle(vec1.y * coef, vec2.y * coef, delta) / coef;
        this.z = Mth.lerpAngle(vec1.z * coef, vec2.z * coef, delta) / coef;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    add(vec) {
        return new Vector(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    addSelf(vec) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    sub(vec) {
        return new Vector(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    subSelf(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    mul(vec) {
        return new Vector(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    div(vec) {
        return new Vector(this.x / vec.x, this.y / vec.y, this.z / vec.z);
    }

    zero() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    /**
     * @return {Vector}
     */
    swapYZ() {
        return new Vector(this.x, this.z, this.y);
    }

    /**
     * @return {number}
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    distance(vec) {
        // return this.sub(vec).length();
        // Fast method
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    horizontalDistance(vec) {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return Math.sqrt(x * x + z * z);
    }

    // distancePointLine...
    distanceToLine(line_start, line_end, intersection = null) {
        intersection = intersection || new Vector(0, 0, 0);
        let dist = line_start.distance(line_end);
        let u = (((this.x - line_start.x) * (line_end.x - line_start.x)) +
            ((this.y - line_start.y) * (line_end.y - line_start.y)) +
            ((this.z - line_start.z) * (line_end.z - line_start.z))) /
            (dist * dist);
        if(u < 0) u = 0;
        if(u > 1) u = 1;
        intersection.x = line_start.x + u * (line_end.x - line_start.x);
        intersection.y = line_start.y + u * (line_end.y - line_start.y);
        intersection.z = line_start.z + u * (line_end.z - line_start.z);
        return this.distance(intersection);
    }

    /**
     * @return {Vector}
     */
    normal() {
        if(this.x == 0 && this.y == 0 && this.z == 0) return new Vector(0, 0, 0);
        let l = this.length();
        return new Vector(this.x / l, this.y / l, this.z / l);
    }

    normSelf() {
        const l = this.length();
        this.x /= l;
        this.y /= l;
        this.z /= l;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    dot(vec) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    /**
     * @return {Vector}
     */
    round(decimals) {
        return this.roundSelf(decimals).clone();
    }

    /**
     * @returns {Vector}
     */
    roundSelf(decimals) {
        if(decimals) {
            decimals = Math.pow(10, decimals);
            this.x = Math.round(this.x * decimals) / decimals;
            this.y = Math.round(this.y * decimals) / decimals;
            this.z = Math.round(this.z * decimals) / decimals;
            return this;
        }
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.z = Math.round(this.z);
        return this;
    }

    /**
     * @return {Vector}
     */
    toInt() {
        return new Vector(
            this.x | 0,
            this.y | 0,
            this.z | 0
        );
    }

    /**
     * @return {Vector}
     */
    clone() {
        return new Vector(
            this.x,
            this.y,
            this.z
        );
    }

    /**
     * @return {number[]}
     */
    toArray() {
        return [this.x, this.y, this.z];
    }

    /**
     * @return {string}
     */
    toString() {
        return '(' + this.x + ',' + this.y + ',' + this.z + ')';
    }

    /**
     * @return {string}
     */
    toChunkKey() {
        return 'c_' + this.x + '_' + this.y + '_' + this.z;
    }

    /**
     * @return {string}
     */
    toHash() {
        return this.x + ',' + this.y + ',' + this.z;
    }

    /**
     * @return {number}
     */
    norm() {
        return this.length();
    }

    /**
     * @return {Vector}
     */
    normalize() {
        return this.normal();
    }

    offset(x, y, z) {
        return this.add(new Vector(x, y, z));
    }

    /**
     * @return {Vector}
     */
    floored() {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    /**
     * @return {Vector}
     */
    flooredSelf() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        return this;
    }

    translate(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} x
     * @param {number} [y]
     * @param {number} [z]
     */
    set(x, y = x, z = x) {
        if (typeof x == "object" && x) {
            return this.copy(x);
        }

        // maybe undef
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        return this;
    }

    multiplyScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    multiplyVecSelf(vec) {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        return this;
    }

    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

    divScalarVec(vec) {
        this.x /= vec.x;
        this.y /= vec.y;
        this.z /= vec.z;
        return this;
    }

    toAngles() {
        // N = 0
        // W = 1
        // S = 2
        // E = 3
        this.z = this.x * (-Math.PI/2);
        this.x = 0;
        this.y = 0;
        return this;
    }

    volume(vec) {
        const volx = Math.abs(this.x - vec.x) + 1;
        const voly = Math.abs(this.y - vec.y) + 1;
        const volz = Math.abs(this.z - vec.z) + 1;
        return volx * voly * volz;
    }

    /**
     *
     * @param {Vector | number[] | {x: number, y: number, z: number}} from
     */
    copy(from) {
        if (from == null) {
            return this;
        }

        // array like object with length 3 or more
        // for gl-matix
        if (from.length >= 3) {
            this.x = from[0];
            this.y = from[1];
            this.z = from[2];

            return this;
        }

        // object is simple and has x, y, z props
        if ('x' in from) {
            this.x = from.x;
            this.y = from.y;
            this.z = from.z;
        }

        return this;
    }

    /**
     * TO DO EN поворот внутри чанка вокруг y
     * @param {DIRECTION_BIT} dir
     * @return {Vector}
     */
    rotY(dir) {
        let tmp_x = this.x, tmp_y = this.y, tmp_z = this.z;
        if (dir == DIRECTION.EAST){
            this.x = tmp_z;
            this.z = 15 - tmp_x;
        }
        if (dir == DIRECTION.NORTH){
            this.x = 15 - tmp_x;
            this.z = 15 - tmp_z;
        }
        if (dir == DIRECTION.WEST){
            this.x = 15 - tmp_z;
            this.z = tmp_x;
        }
        return this;
    }

    addByCardinalDirectionSelf(vec, dir, mirror_x = false, mirror_z = false) {
        const x_sign = mirror_x ? -1 : 1;
        const z_sign = mirror_z ? -1 : 1;
        dir = dir % 4;
        this.y += vec.y;
        if(dir == DIRECTION.SOUTH) {
            this.x -= vec.x * x_sign;
            this.z -= vec.z * z_sign;
        } else if(dir == DIRECTION.NORTH) {
            this.x += vec.x * x_sign;
            this.z += vec.z * z_sign;
        } else if(dir == DIRECTION.WEST) {
            this.z += vec.x * x_sign;
            this.x -= vec.z * z_sign;
        } else  if(dir == DIRECTION.EAST) {
            this.z -= vec.x * x_sign;
            this.x += vec.z * z_sign;
        }
        return this;
    }

    //
    moveToSelf(rotate, dist) {
        this.x += dist * Math.cos(rotate.x) * Math.sin(rotate.z - Math.PI);
        this.y += dist * Math.sin(-rotate.x);
        this.z += dist * Math.cos(rotate.x) * Math.cos(rotate.z - Math.PI);
        return this;
    }


}

class Vec3 extends Vector {}

let MULTIPLY = {
    COLOR: {
        WHITE: new Color(816 / 1024, 1008 / 1024, 0, 0),
        GRASS: new Color(900 / 1024, 965 / 1024, 0, 0)
    }
};

let QUAD_FLAGS = {};
    QUAD_FLAGS.NORMAL_UP = 1 << 0;
    QUAD_FLAGS.MASK_BIOME = 1 << 1;
    QUAD_FLAGS.NO_AO = 1 << 2;
    QUAD_FLAGS.NO_FOG = 1 << 3;
    QUAD_FLAGS.LOOK_AT_CAMERA = 1 << 4;
    QUAD_FLAGS.FLAG_ANIMATED = 1 << 5;

let ROTATE = {};
    ROTATE.S = CubeSym.ROT_Y2; // front
    ROTATE.W = CubeSym.ROT_Y; // left
    ROTATE.N = CubeSym.ID; // back
    ROTATE.E = CubeSym.ROT_Y3; // right


let NORMALS = {};
    NORMALS.FORWARD          = new Vector(0, 0, 1);
    NORMALS.BACK             = new Vector(0, 0, -1);
    NORMALS.LEFT             = new Vector(-1, 0, 0);
    NORMALS.RIGHT            = new Vector(1, 0, 0);
    NORMALS.UP               = new Vector(0, 1, 0);
    NORMALS.DOWN             = new Vector(0, -1, 0);

// Direction enumeration
let DIRECTION = {};
    DIRECTION.UP        = CubeSym.ROT_X;
    DIRECTION.DOWN      = CubeSym.ROT_X3;
    DIRECTION.LEFT      = CubeSym.ROT_Y;
    DIRECTION.RIGHT     = CubeSym.ROT_Y3;
    DIRECTION.FORWARD   = CubeSym.ID;
    DIRECTION.BACK      = CubeSym.ROT_Y2;
    // Aliases
    DIRECTION.WEST      = DIRECTION.LEFT;
    DIRECTION.EAST      = DIRECTION.RIGHT;
    DIRECTION.NORTH     = DIRECTION.FORWARD;
    DIRECTION.SOUTH     = DIRECTION.BACK;

let DIRECTION_BIT = {};
    DIRECTION_BIT.UP    = 0;
    DIRECTION_BIT.DOWN  = 1;
    DIRECTION_BIT.EAST  = 2;
    DIRECTION_BIT.WEST  = 3;
    DIRECTION_BIT.NORTH = 4;
    DIRECTION_BIT.SOUTH = 5;

// Direction names
let DIRECTION_NAME = {};
    DIRECTION_NAME.up        = DIRECTION.UP;
    DIRECTION_NAME.down      = DIRECTION.DOWN;
    DIRECTION_NAME.left      = DIRECTION.LEFT;
    DIRECTION_NAME.right     = DIRECTION.RIGHT;
    DIRECTION_NAME.forward   = DIRECTION.FORWARD;
    DIRECTION_NAME.back      = DIRECTION.BACK;

class Helpers {

    static cache = new Map();
    static fetch;
    static fs;

    static setCache(cache) {
        Helpers.cache = cache;
    }

    static getCache() {
        return Helpers.cache;
    }

    // 
    angleTo(pos, target) {
        let angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    // clamp
    static clamp(x, min, max) {
        if(!min) {
            min = 0;
        }
        if(!max) {
            max = 1;
        }
        if(x < min) return min;
        if(x > max) return max;
        return x;
    }

    // str byteToHex(uint8 byte)
    // converts a single byte to a hex string
    static byteToHex(byte) {
        return ('0' + byte.toString(16)).slice(-2);
    }

    // str generateId(int len);
    // len - must be an even number (default: 32)
    static generateID() {
        const len = 32;
        let arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, Helpers.byteToHex).join('');
    }

    static distance(p, q) {
        let dx   = p.x - q.x;
        let dy   = p.y - q.y;
        let dz   = p.z - q.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist;
    }

    // getRandomInt...
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; // Максимум не включается, минимум включается
    }

    static createSkinLayer2(text, image, callback) {
        let canvas          = document.createElement('canvas');
        canvas.width        = 64;
        canvas.height       = 64;
        let ctx             = canvas.getContext('2d');
        if(text) {
            ctx.fillStyle       = '#f5f5f5';
            ctx.fillRect(0, 0, 200, 200);
            ctx.font            = 'bold 20px Arial';
            ctx.fillStyle       = '#333333';
            ctx.textAlign       = 'start';
            ctx.textBaseline    = 'top';
            ctx.fillText(text, 10, 10);
        } else {
            // img, sx, sy, swidth, sheight, x, y, width, height
            // head
            ctx.drawImage(image, 32, 0, 32, 16, 0, 0, 32, 16);
            // body + right leg + right arm
            ctx.drawImage(image, 0, 32, 56, 16, 0, 16, 56, 16);
            // left leg
            ctx.drawImage(image, 0, 48, 16, 16, 16, 48, 16, 16);
            // left arm
            ctx.drawImage(image, 0, 48, 48, 16, 32, 48, 16, 16);
        }
        // Debug
        // var link = document.createElement('a');
        // link.download = 'filename.png';
        // link.href = canvas.toDataURL()
        // link.click();
        canvas.toBlob(function(blob) {
            let filefromblob = new File([blob], 'image.png', {type: 'image/png'});
            callback(filefromblob);
        }, 'image/png');
    }

    // Canvas download
    static downloadBlobPNG(blob, filename) {
        /// create an "off-screen" anchor tag
        let lnk = document.createElement('a'), e;
        /// the key here is to set the download attribute of the a tag
        lnk.download = filename;
        /// convert canvas content to data-uri for link. When download
        /// attribute is set the content pointed to by link will be
        /// pushed as "download" in HTML5 capable browsers
        lnk.href = URL.createObjectURL(blob);
        /// create a "fake" click-event to trigger the download
        if (document.createEvent) {
            e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false,
            false, 0, null);
            lnk.dispatchEvent(e);
        } else if (lnk.fireEvent) {
            lnk.fireEvent('onclick');
        }
    }

    // downloadImage
    static downloadImage(image, filename) {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        ctx.canvas.width  = image.width;
        ctx.canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        c.toBlob(function(blob) {
            // here the image is a blob
            Helpers.downloadBlobPNG(blob, filename);
        }, 'image/png');
    }

    static deg2rad(degrees) {
        return degrees * (Math.PI / 180);
    }

    static rad2deg(radians) {
        return radians * 180 / Math.PI;
    }

    static async loadJSON(url, callback) {
        await loadText(url, function(text) {
            callback(JSON.parse(text));
        });
    }

    // createGLProgram...
    static createGLProgram(gl, obj, callback) {
        let program = gl.createProgram();
        // Compile vertex shader
        let vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, obj.vertex);
        gl.compileShader(vertexShader);
        gl.attachShader(program, vertexShader);
        gl.deleteShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw "Could not compile vertex shader!\n" + gl.getShaderInfoLog(vertexShader);
        }
        // Compile fragment shader
        let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, obj.fragment);
        gl.compileShader(fragmentShader);
        gl.attachShader(program, fragmentShader);
        gl.deleteShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw "Could not compile fragment shader!\n" + gl.getShaderInfoLog(fragmentShader);
        }
        // Finish program
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'Could not link the shader program!';
        }

        callback && callback({
            program
        });

        return program;
    }

    // Return from green to red color depend on percentage
    static getColorForPercentage(pct) {
        var percentColors = [
            {pct: 0.0, color: {r: 0xff, g: 0x00, b: 0}},
            {pct: 0.5, color: {r: 0xff, g: 0xff, b: 0}},
            {pct: 1.0, color: {r: 0x00, g: 0xff, b: 0}}
        ];
        for (var i = 1; i < percentColors.length - 1; i++) {
            if (pct < percentColors[i].pct) {
                break;
            }
        }
        var lower = percentColors[i - 1];
        var upper = percentColors[i];
        var range = upper.pct - lower.pct;
        var rangePct = (pct - lower.pct) / range;
        var pctLower = 1 - rangePct;
        var pctUpper = rangePct;
        var color = {
            r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
            g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
            b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
        };
        return new Color(color.r, color.g, color.b, 1);
        // or output as hex if preferred
    }

    // Return speed
    static calcSpeed(pos1, pos2, delta) {
        return Math.round(pos1.distance(pos2) / delta * 360) / 100;
    }

}

// Make fetch functions
if(typeof fetch === 'undefined') {
    eval(`Helpers.fetch = async (url) => import(url);
    Helpers.fetchJSON = async (url) => import(url, {assert: {type: 'json'}}).then(response => response.default);
    Helpers.fetchBinary = async (url) => {
        let binary = fs.readFileSync(url);
        return binary.buffer;
    };`);
} else {
    Helpers.fetch = async (url) => fetch(url);
    Helpers.fetchJSON = async (url, useCache = false, namespace = '') => {
        const cacheKey = namespace + '|' + url;

        if (useCache && Helpers.cache.has(cacheKey)) {
            return Promise.resolve(JSON.parse(Helpers.cache.get(cacheKey)));
        }

        const respt = await fetch(url);

        // if cache is presented - store text response
        // then we can use this inside a worker
        if (useCache) {
            const text = await respt.text();

            Helpers.cache.set(cacheKey, text);

            return JSON.parse(text);
        }

        return respt.json()
    };

    Helpers.fetchBinary = async (url) => fetch(url).then(response => response.arrayBuffer());
}

// SpiralGenerator ...
class SpiralGenerator {

    static cache = new Map();
    static cache3D = {};

    // generate ...
    static generate(margin) {
        let size = margin * 2;
        if(SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];
        function rPush(vec) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if(dist < margin) {
                resp.push(vec);
            }
        }
        let iInd = parseInt(size / 2);
        let jInd = parseInt(size / 2);
        let iStep = 1;
        let jStep = 1;
        rPush(new Vector(iInd, 0, jInd));
        for(let i = 0; i < size; i++) {
            for (let h = 0; h < i; h++) rPush(new Vector(iInd, 0, jInd += jStep));
            for (let v = 0; v < i; v++) rPush(new Vector(iInd += iStep, 0, jInd));
            jStep = -jStep;
            iStep = -iStep;
        }
        for(let h = 0; h < size - 1; h++) {
            rPush(new Vector(iInd, 0, jInd += jStep));
        }
        SpiralGenerator.cache.set(margin, resp);
        return resp;
    }

    /**
     * generate3D
     * @param {Vector} vec_margin
     * @returns
     */
    static generate3D(vec_margin) {
        let cache_key = vec_margin.toString();
        if(SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        let resp        = [];
        let center      = new Vector(0, 0, 0);
        let exists      = [];
        const MAX_DIST  = vec_margin.x;
        for(let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for(let x = -vec_margin.x; x <= vec_margin.x; x++) {
                for(let z = -vec_margin.z; z <= vec_margin.z; z++) {
                    let vec = new Vector(x, y, z);
                    let dist = Math.round(vec.distance(center) * 1000) / 1000;
                    if(dist <= MAX_DIST) {
                        let key = vec.toString();
                        if(exists.indexOf(key) < 0) {
                            resp.push({pos: vec, dist: dist});
                            exists[key] = true;
                        }
                    }
                }
            }
        }
        resp.sort(function(a, b) {
            return a.dist - b.dist;
        });
        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
    }

}

function loadText(url, callback) {
    let xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == '200') {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

class Vector4 {

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}

// AverageClockTimer
class AverageClockTimer {

    constructor() {
        this.prev       = null,
        this.min        = null,
        this.max        = null,
        this.avg        = null,
        this.sum        = 0,
        this.history_index = 0;
        this.history    = new Array(60).fill(0);
    }

    add(value) {
        this.prev = value;
        if(this.min === null || this.min > value) {
            this.min = value;
        }
        if(this.max === null || this.max < value) {
            this.max = value;
        }
        //
        this.sum += value;
        this.history_index++;
        if(this.history_index == this.history.length) {
            this.history_index = 0;
        }
        this.sum -= this.history[this.history_index];
        this.history[this.history_index] = value;
        this.avg = (this.sum / this.history.length) || 0;
    }

}

// FastRandom...
class FastRandom {

    constructor(seed, cnt) {
        const a = new impl(seed);
        this.int32s = new Array(cnt);
        this.doubles = new Array(cnt);
        this.index = 0;
        this.cnt = cnt;
        for(let i = 0; i < cnt; i++) {
            this.int32s[i] = a.int32();
            this.doubles[i] = a.double();
        }
    }

    double(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.doubles[offset];
    }

    int32(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.int32s[offset];
    }

}

class RuneStrings {

    static toArray(str) {
        return runes(str);
    }

    // Разделяет слово на строки, в которых максимум указанное в [chunk] количество букв (с учётом emoji)
    static toChunks(str, chunk) {
        const rs = runes(str);
        if(rs.length > chunk) {
            let i, j, resp = [];
            for (i = 0, j = rs.length; i < j; i += chunk) {
                resp.push(rs.slice(i, i + chunk).join(''));
            }
            return resp;
        }
        return [str];
    }

    // Разделяет длинные слова пробелами (с учётом emoji)
    static splitLongWords(str, max_len) {
        let text = str.replaceAll("\r", "¡");
        let temp = text.split(' ');
        for(let i = 0; i < temp.length; i++) {
            let word = temp[i];
            if(word) {
                temp[i] = RuneStrings.toChunks(word, max_len).join(' ');
            }
        }
        return temp.join(' ').replaceAll("¡", "\r");
    }

}

// AlphabetTexture
class AlphabetTexture {

    static width            = 1024;
    static height           = 1024;
    static char_size        = {width: 32, height: 32};
    static char_size_norm   = {width: this.char_size.width / this.width, height: this.char_size.height / this.height};
    static chars            = new Map();

    static default_runes = RuneStrings.toArray('�•█—абвгдеёжзийклмнопрстуфхцчшщъыьэюя АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ0123456789~`@#№$;:\\/*-+()[]{}-^_&?!%=<>.,|"\'abcdefghjiklmnopqrstuvwxyzABCDEFGHJIKLMNOPQRSTUVWXYZ😂😃🧘🏻‍♂️🌍🌦️🚗📞🎉❤️🍆🏁💩👨‍👩‍👧‍👦👨‍👦‍👦👨‍👧‍👧👍👍🏾');

    static init() {
        if(this.chars_x) {
            return false;
        }
        this.chars_x = Math.floor(this.width / this.char_size.width);
        this.getStringUVs(AlphabetTexture.default_runes.join(''), true);
    }

    static indexToPos(index) {
        const x = (index % this.chars_x) * this.char_size.width;
        const y = Math.floor(index / this.chars_x) * this.char_size.height;
        return {x: x, y: y};
    }

    static getStringUVs(str, init_new) {
        this.init();
        let chars = RuneStrings.toArray(str);
        let resp = [];
        for(let char of chars) {
            if(init_new && !this.chars.has(char)) {
                const index = this.chars.size;
                let pos = this.indexToPos(index);
                pos.xn = pos.x / this.width;
                pos.yn = pos.y / this.height;
                pos.char = char;
                pos.index = index;
                this.chars.set(char, pos);
            }
            let item = this.chars.has(char) ? this.chars.get(char) : this.chars.get('�');
            if(char == "\r") {
                item.char = char;
            }
            resp.push(item);
        }
        return resp;
    }

}

function fromMat3(a, b) {
    a[ 0] = b[ 0];
    a[ 1] = b[ 1];
    a[ 2] = b[ 2];

    a[ 4] = b[ 3];
    a[ 5] = b[ 4];
    a[ 6] = b[ 5];

    a[ 8] = b[ 6];
    a[ 9] = b[ 7];
    a[10] = b[ 8];

    a[ 3] = a[ 7] = a[11] =
    a[12] = a[13] = a[14] = 0;
    a[15] = 1.0;

    return a;
}

// calcRotateMatrix
function calcRotateMatrix(material, rotate, cardinal_direction, matrix) {
    // Can rotate
    if(material.can_rotate) {
        //
        if(rotate) {

            if (CubeSym.matrices[cardinal_direction][4] <= 0) {
                matrix = fromMat3(new Float32Array(16), CubeSym.matrices[cardinal_direction]);
                /*
                // Use matrix instead!
                if (matrix) {
                    mat3.multiply(tempMatrix, matrix, CubeSym.matrices[cardinal_direction]);
                    matrix = tempMatrix;
                } else {
                    matrix = CubeSym.matrices[cardinal_direction];
                }
                */
            } else if(rotate.y != 0) {
                if(material.tags.indexOf('rotate_by_pos_n') >= 0 ) {
                    matrix = mat4$1.create();
                    if(rotate.y == 1) {
                        // on the floor
                        mat4$1.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI);
                    } else {
                        // on the ceil
                        mat4$1.rotateZ(matrix, matrix, Math.PI);
                        mat4$1.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI*2);
                    }
                }
            }
        }
    }
    return matrix;
}

function toType(a) {
    // Get fine type (object, array, function, null, error, date ...)
    return ({}).toString.call(a).match(/([a-z]+)(:?\])/i)[1];
}

function isDeepObject(obj) {
    return "Object" === toType(obj);
}

function deepAssign(options) {
    return function deepAssignWithOptions (target, ...sources) {
        sources.forEach( (source) => {

            if (!isDeepObject(source) || !isDeepObject(target))
                return;

            // Copy source's own properties into target's own properties
            function copyProperty(property) {
                const descriptor = Object.getOwnPropertyDescriptor(source, property);
                //default: omit non-enumerable properties
                if (descriptor.enumerable || options.nonEnum) {
                    // Copy in-depth first
                    if (isDeepObject(source[property]) && isDeepObject(target[property]))
                        descriptor.value = deepAssign(options)(target[property], source[property]);
                    //default: omit descriptors
                    if (options.descriptors)
                        Object.defineProperty(target, property, descriptor); // shallow copy descriptor
                    else
                        target[property] = descriptor.value; // shallow copy value only
                }
            }

            // Copy string-keyed properties
            Object.getOwnPropertyNames(source).forEach(copyProperty);

            //default: omit symbol-keyed properties
            if (options.symbols)
                Object.getOwnPropertySymbols(source).forEach(copyProperty);

            //default: omit prototype's own properties
            if (options.proto)
                // Copy souce prototype's own properties into target prototype's own properties
                deepAssign(Object.assign({},options,{proto:false})) (// Prevent deeper copy of the prototype chain
                    Object.getPrototypeOf(target),
                    Object.getPrototypeOf(source)
                );

        });
        return target;
    }
}

// digestMessage
async function digestMessage(message) {
    const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);           // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

// md5
let md5 = (function() {
    var MD5 = function (d) {
        return M(V(Y(X(d), 8 * d.length)))
    };
    function M (d) {
        for (var _, m = '0123456789abcdef', f = '', r = 0; r < d.length; r++) {
            _ = d.charCodeAt(r);
            f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _);
        }
        return f
    }
    function X (d) {
        for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++) {
            _[m] = 0;
        }
        for (m = 0; m < 8 * d.length; m += 8) {
            _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32;
        }
        return _
    }
    function V (d) {
        for (var _ = '', m = 0; m < 32 * d.length; m += 8) _ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255);
        return _
    }
    function Y (d, _) {
        d[_ >> 5] |= 128 << _ % 32;
        d[14 + (_ + 64 >>> 9 << 4)] = _;
        for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) {
            var h = m;
            var t = f;
            var g = r;
            var e = i;
            f = md5ii(f = md5ii(f = md5ii(f = md5ii(f = md5hh(f = md5hh(f = md5hh(f = md5hh(f = md5gg(f = md5gg(f = md5gg(f = md5gg(f = md5ff(f = md5ff(f = md5ff(f = md5ff(f, r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551);
            m = safeadd(m, h);
            f = safeadd(f, t);
            r = safeadd(r, g);
            i = safeadd(i, e);
        }
        return [m, f, r, i]
    }
    function md5cmn (d, _, m, f, r, i) {
        return safeadd(bitrol(safeadd(safeadd(_, d), safeadd(f, i)), r), m)
    }
    function md5ff (d, _, m, f, r, i, n) {
        return md5cmn(_ & m | ~_ & f, d, _, r, i, n)
    }
    function md5gg (d, _, m, f, r, i, n) {
        return md5cmn(_ & f | m & ~f, d, _, r, i, n)
    }
    function md5hh (d, _, m, f, r, i, n) {
        return md5cmn(_ ^ m ^ f, d, _, r, i, n)
    }
    function md5ii (d, _, m, f, r, i, n) {
        return md5cmn(m ^ (_ | ~f), d, _, r, i, n)
    }
    function safeadd (d, _) {
        var m = (65535 & d) + (65535 & _);
        return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m
    }
    function bitrol (d, _) {
        return d << _ | d >>> 32 - _
    }
    function MD5Unicode(buffer){
        if (!(buffer instanceof Uint8Array)) {
            buffer = new TextEncoder().encode(typeof buffer==='string' ? buffer : JSON.stringify(buffer));
        }
        var binary = [];
        var bytes = new Uint8Array(buffer);
        for (var i = 0, il = bytes.byteLength; i < il; i++) {
            binary.push(String.fromCharCode(bytes[i]));
        }
        return MD5(binary.join(''));
    }

    return MD5Unicode;
})();

var helpers = /*#__PURE__*/Object.freeze({
	__proto__: null,
	SNEAK_MINUS_Y_MUL: SNEAK_MINUS_Y_MUL,
	MOB_EYE_HEIGHT_PERCENT: MOB_EYE_HEIGHT_PERCENT,
	CAMERA_MODE: CAMERA_MODE,
	TX_CNT: TX_CNT,
	lerpComplex: lerpComplex,
	Mth: Mth,
	IvanArray: IvanArray,
	VectorCollector: VectorCollector,
	Color: Color,
	Vector: Vector,
	Vec3: Vec3,
	MULTIPLY: MULTIPLY,
	QUAD_FLAGS: QUAD_FLAGS,
	ROTATE: ROTATE,
	NORMALS: NORMALS,
	DIRECTION: DIRECTION,
	DIRECTION_BIT: DIRECTION_BIT,
	DIRECTION_NAME: DIRECTION_NAME,
	Helpers: Helpers,
	SpiralGenerator: SpiralGenerator,
	Vector4: Vector4,
	AverageClockTimer: AverageClockTimer,
	FastRandom: FastRandom,
	RuneStrings: RuneStrings,
	AlphabetTexture: AlphabetTexture,
	fromMat3: fromMat3,
	calcRotateMatrix: calcRotateMatrix,
	deepAssign: deepAssign,
	digestMessage: digestMessage,
	md5: md5
});

const {mat3, mat4, vec3}      = glMatrix$1;
const defaultPivot      = [0.5, 0.5, 0.5];
const defalutCenter     = [0, 0, 0];
const defaultMatrix     = mat4.create();
const tempMatrix        = mat3.create();

const PLANES = {
    up: {
        // axisX , axisY. axisY is flips sign!
        axes  : [[1, 0, 0], /**/ [0, 1, 0]],
        flip  : [1, 1],
        // origin offset realtive center
        offset : [0.5, 0.5, 1.0],
    },
    down: {
        axes  : [[1, 0, 0], /**/ [0, -1, 0]],
        flip  : [-1, -1],
        offset: [0.5, 0.5, 0.0],
    },
    south: {
        axes  : [[1, 0, 0], /**/ [0, 0, 1]],
        flip  : [1, 1],
        offset: [0.5, 0.0, 0.5],
    },
    north: {
        axes  : [[1, 0, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [0.5, 1.0, 0.5],
    },
    east: {
        axes  : [[0, 1, 0], /**/ [0, 0, 1]],
        flip  : [1, 1],
        offset: [1.0, 0.5, 0.5],
    },
    west: {
        axes  : [[0, 1, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [-0.0, 0.5, 0.5],
    }
};

class AABB {

    constructor() {
        this.x_min = 0;
        this.y_min = 0;
        this.z_min = 0;
        this.x_max = 0;
        this.y_max = 0;
        this.z_max = 0;
    }

    /**
     * @type {Vector}
     */
    get size() {
        this._size = this._size || new Vector(0,0,0);

        this._size.x = this.width;
        this._size.y = this.height;
        this._size.z = this.depth;

        return this._size;
    }

    get width() {
        return this.x_max - this.x_min;
    }

    get height() {
        return this.y_max - this.y_min;
    }

    get depth() {
        return this.z_max - this.z_min;
    }

    get center() {
        this._center = this._center ||  new Vector(0,0,0);
        this._center.set(
            this.x_min + this.width / 2,
            this.y_min + this.height / 2,
            this.z_min + this.depth / 2,
        );

        return this._center;
    }

    clone() {
        return new AABB().copyFrom(this);
    }

    copyFrom(aabb) {
        this.x_min = aabb.x_min;
        this.x_max = aabb.x_max;
        this.y_min = aabb.y_min;
        this.y_max = aabb.y_max;
        this.z_min = aabb.z_min;
        this.z_max = aabb.z_max;
        return this;
    }

    pad(padding) {
        this.x_min -= padding;
        this.x_max += padding;
        this.y_min -= padding;
        this.y_max += padding;
        this.z_min -= padding;
        this.z_max += padding;
        return this;
    }

    set(xMin, yMin, zMin, xMax, yMax, zMax) {
        this.x_min = xMin;
        this.y_min = yMin;
        this.z_min = zMin;
        this.x_max = xMax;
        this.y_max = yMax;
        this.z_max = zMax;
        return this;
    }

    setIntersect(aabb1, aabb2) {
        this.x_min = Math.max(aabb1.x_min, aabb2.x_min);
        this.x_max = Math.min(aabb1.x_max, aabb2.x_max);
        this.y_min = Math.max(aabb1.y_min, aabb2.y_min);
        this.y_max = Math.min(aabb1.y_max, aabb2.y_max);
        this.z_min = Math.max(aabb1.z_min, aabb2.z_min);
        this.z_max = Math.min(aabb1.z_max, aabb2.z_max);
        return this;
    }

    isEmpty() {
        return this.x_min >= this.x_max && this.y_min >= this.y_max && this.z_min >= this.z_max;
    }

    applyMatrix(matrix, pivot) {
        if (pivot) {
            this.x_min -= pivot.x;
            this.y_min -= pivot.y;
            this.z_min -= pivot.z;
            this.x_max -= pivot.x;
            this.y_max -= pivot.y;
            this.z_max -= pivot.z;
        }

        const x0 = this.x_min * matrix[0] + this.y_min * matrix[1] + this.z_min * matrix[2];
        const x1 = this.x_max * matrix[0] + this.y_max * matrix[1] + this.z_max * matrix[2];
        const y0 = this.x_min * matrix[3] + this.y_min * matrix[4] + this.z_min * matrix[5];
        const y1 = this.x_max * matrix[3] + this.y_max * matrix[4] + this.z_max * matrix[5];
        const z0 = this.x_min * matrix[6] + this.y_min * matrix[7] + this.z_min * matrix[8];
        const z1 = this.x_max * matrix[6] + this.y_max * matrix[7] + this.z_max * matrix[8];

        this.x_min = Math.min(x0, x1);
        this.x_max = Math.max(x0, x1);
        this.y_min = Math.min(y0, y1);
        this.y_max = Math.max(y0, y1);
        this.z_min = Math.min(z0, z1);
        this.z_max = Math.max(z0, z1);

        if (pivot) {
            this.x_min += pivot.x;
            this.y_min += pivot.y;
            this.z_min += pivot.z;
            this.x_max += pivot.x;
            this.y_max += pivot.y;
            this.z_max += pivot.z;
        }

        return this;
    }

    contains(x, y, z) {
        return x >= this.x_min && x < this.x_max
            && y >= this.y_min && y < this.y_max
            && z >= this.z_min && z < this.z_max;
    }

    intersect(box) {
        return (box.x_min < this.x_max && this.x_min < box.x_max
            && box.y_min < this.y_max && this.y_min < box.y_max
            && box.z_min < this.z_max && this.z_min < box.z_max);
    }

    /**
     * rotated around 0
     * @param sym
     */
    rotate(sym, pivot) {
        if (sym === 0) {
            return this;
        }

        return this.applyMatrix(CubeSym.matrices[sym], pivot);
    }

    toArray(target = []) {
        target[0] = this.x_min;
        target[1] = this.y_min;
        target[2] = this.z_min;

        target[3] = this.x_max;
        target[4] = this.y_max;
        target[5] = this.z_max;

        return target;
    }

    translate(x, y, z) {
        this.x_min += x;
        this.x_max += x;
        this.y_min += y;
        this.y_max += y;
        this.z_min += z;
        this.z_max += z;
        return this;
    }

    addPoint(x, y, z) {
        if(x < this.x_min) this.x_min = x;
        if(x > this.x_max) this.x_max = x;
        if(y < this.y_min) this.y_min = y;
        if(y > this.y_max) this.y_max = y;
        if(z < this.z_min) this.z_min = z;
        if(z > this.z_max) this.z_max = z;
        return this;
    }

    // Expand same for all sides
    expand(x, y, z) {
        this.x_min -= x;
        this.x_max += x;
        this.y_min -= y;
        this.y_max += y;
        this.z_min -= z;
        this.z_max += z;
        return this;
    }

    div(value) {
        this.x_min /= value;
        this.x_max /= value;
        this.y_min /= value;
        this.y_max /= value;
        this.z_min /= value;
        this.z_max /= value;
        return this;
    }

}

class AABBPool {
    constructor() {
        this._list = [];
    }

    release(elem) {
        this._list.push(elem);
    }

    alloc() {
        return this._list.pop() || new AABB();
    }

    static instance = new AABBPool();
}

class AABBSideParams {

    constructor(uv, flag, anim, lm = null, axes = null, autoUV) {
        this.uv     = uv;
        this.flag   = flag;
        this.anim   = anim;
        this.lm     = lm;
        this.axes   = axes;
        this.autoUV = autoUV;
    }

}

function pushTransformed(
    vertices, mat, pivot,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    r, g, b,
    flags
) {
    pivot = pivot || defaultPivot;
    cx += pivot[0];
    cy += pivot[1];
    cz += pivot[2];
    x0 -= pivot[0];
    y0 -= pivot[1];
    z0 -= pivot[2];

    mat = mat || defaultMatrix;

    let tx = 0;
    let ty = 0;
    let tz = 0;

    // unroll mat4 matrix to mat3 + tx, ty, tz
    if (mat.length === 16) {
        mat3.fromMat4(tempMatrix, mat);

        tx = mat[12];
        ty = mat[14]; // flip
        tz = mat[13]; // flip

        mat = tempMatrix;
    }

    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2] + tx,
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8] + ty,
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5] + tz,

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, r, g, b, flags
    );
}

/**
 * Side params for cube
 * @typedef {{up?: AABBSideParams, down?: AABBSideParams, south?: AABBSideParams, north: AABBSideParams, east?: AABBSideParams, west?: AABBSideParams}} ISideSet
 */

/**
 *
 * @param {number[]} vertices
 * @param {AABB} aabb
 * @param {Vector | number[]} pivot
 * @param {number[]} matrix
 * @param {ISideSet} sides
 * @param {boolean} [autoUV]
 * @param {Vector | number[]} [center] - center wicha AABB is placed, same as [x, y, z] in push transformed
 */
function pushAABB(vertices, aabb, pivot = null, matrix = null, sides, center) {

    matrix = matrix || defaultMatrix;
    center = center || defalutCenter;
    pivot  = pivot  || defaultPivot; 

    const lm_default      = MULTIPLY.COLOR.WHITE;
    const globalFlags     = 0;
    const x               = center.x;
    const y               = center.y;
    const z               = center.z;

    const size = [
        aabb.width, 
        aabb.depth, // fucking flipped ZY
        aabb.height
    ];

    // distance from center to minimal position
    const dist = [
        aabb.x_min - x,
        aabb.z_min - z, // fucking flipped ZY
        aabb.y_min - y
    ];

    for(const key in sides) {

        if (!(key in PLANES)) {
            continue;
        }

        const {
            /*axes,*/ offset, flip
        } = PLANES[key];

        const {
            uv, flag = 0, anim = 1, autoUV = true
        } = sides[key];

        const lm = sides[key].lm || lm_default;
        const axes = sides[key].axes || PLANES[key].axes;

        let uvSize0;
        let uvSize1;

        if(autoUV) {
            uvSize0 = vec3.dot(axes[0], size) * (uv[2]) * flip[0];
            uvSize1 = -vec3.dot(axes[1], size) * (uv[3]) * flip[1];
        } else {
            uvSize0 = uv[2];
            uvSize1 = -uv[3];
        }

        pushTransformed(
            vertices, matrix, pivot,
            // center
            x, z, y,
            // offset
            size[0] * offset[0] + dist[0],
            size[1] * offset[1] + dist[1],
            size[2] * offset[2] + dist[2],
            // axisx
            size[0] * axes[0][0],
            size[1] * axes[0][1],
            size[2] * axes[0][2],
            // axisY
            size[0] * axes[1][0],
            size[1] * axes[1][1],
            size[2] * axes[1][2],
            // UV center
            uv[0], uv[1],
            // UV size
            uvSize0, uvSize1,
            // tint location
            lm.r, lm.g,
            // animation
            anim,
            // flags
            globalFlags | flag
        );
    }

}

const tempAABB = new AABB();

class BaseChunk {
    constructor({size}) {
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.pos = new Vector();
        this.subRegions = [];
        this.subMaxWidth = 0;
        this.portals = [];
        this.initSize(size);
        this.setPos(Vector.ZERO);
        this.dif26 = [];
        this.rev = null;
    }

    initSize(size) {
        const padding = this.padding = 1;
        this.size = size;
        const outerSize = this.outerSize = new Vector(size.x + padding * 2, size.y + padding * 2, size.z + padding * 2);
        this.aabb = new AABB();
        this.outerLen = outerSize.x * outerSize.y * outerSize.z;
        this.insideLen = size.x * size.y * size.z;
        this.outerAABB = new AABB();
        this.safeAABB = new AABB();
        this.shiftCoord = 0;

        this.cx = 1;
        this.cy = outerSize.x * outerSize.z;
        this.cz = outerSize.x;
        this.cw = padding * (this.cx + this.cy + this.cz);
    }

    /**
     *
     * @param {Vector} pos
     * @returns {BaseChunk}
     */
    setPos(pos) {
        const {size, padding, outerSize} = this;
        this.pos.copyFrom(pos);
        this.aabb.set(pos.x, pos.y, pos.z, pos.x + size.x, pos.y + size.y, pos.z + size.z);
        const outer = this.outerAABB.copyFrom(this.aabb).pad(padding);
        this.safeAABB.copyFrom(this.aabb).pad(-1);
        this.shiftCoord = -(outer.x_min + outerSize.x * (outer.z_min + outerSize.z * outer.y_min));
        return this;
    }

    addSub(sub) {
        const {subRegions} = this;
        const x = sub.aabb.x_min;
        let i = 0, len = subRegions.length;
        for (; i < len; i++) {
            if (subRegions[i].aabb.x_min > x) {
                break;
            }
        }
        for (let j = len - 1; j >= i; j--) {
            subRegions[j + 1] = subRegions[j];
        }
        subRegions[i] = sub;

        this.subMaxWidth = Math.max(this.subMaxWidth, sub.aabb.x_max - sub.aabb.x_min);
        sub._addPortalsForBase(this);
    }

    removeSub(sub) {
        let ind = this.subRegions.indexOf(sub);
        if (ind >= 0) {
            sub._removeAllPortals();
            this.subRegions.splice(ind, 1);
        }
    }

    subByWorld(worldCoord) {
        const {subRegions, subMaxWidth} = this;
        const {x, y, z} = worldCoord;
        // easy binary search part 1
        let left = 0, right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let L = right;
        left = L;
        right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min <= x) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const sub = subRegions[i].aabb;
            if (sub.x_min <= x && x <= sub.x_max
                && sub.y_min <= y && y <= sub.y_max
                && sub.z_min <= z && z <= sub.z_max) {
                return sub;
            }
        }
        return null;
    }

    /**
     *
     * @param {number} outerCoord
     */
    subByOuter(outerCoord) {

    }

    _addPortal(portal) {
        this.portals.push(portal);

        const inner = this.safeAABB;
        const aabb = portal.aabb;
        tempAABB.setIntersect(inner, aabb);
        if (tempAABB.isEmpty()) {
            return;
        }
        if (tempAABB.width <= tempAABB.height && tempAABB.width <= tempAABB.depth) {
            if (inner.x_min < aabb.x_min && inner.x_max <= aabb.x_max) {
                inner.x_max = aabb.x_min;
            } else {
                inner.x_min = aabb.x_max;
            }
        } else if (tempAABB.height <= tempAABB.width && tempAABB.height <= tempAABB.depth) {
            if (inner.y_min < aabb.y_min) {
                inner.y_max = aabb.y_min;
            } else {
                inner.y_min = aabb.y_max;
            }
        } else {
            if (inner.z_min < aabb.z_min) {
                inner.z_max = aabb.z_min;
            } else {
                inner.z_min = aabb.z_max;
            }
        }
    }

    _addPortalsForBase(baseChunk) {
        const {subRegions, subMaxWidth} = baseChunk;
        let left = -1, right = subRegions.length;
        const {x_min, x_max, y_min, y_max, z_min, z_max} = this.aabb;

        // easy binary search part 2
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min + subMaxWidth < x_min) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let L = right;
        left = L;
        right = subRegions.length;
        while (left + 1 < right) {
            let mid = (left + right) >> 1;
            if (subRegions[mid].aabb.x_min <= x_max) {
                left = mid;
            } else {
                right = mid;
            }
        }
        let R = right;

        for (let i = L; i < R; i++) {
            const second = subRegions[i];
            if (second === this) {
                continue;
            }
            const neib = subRegions[i].aabb;
            if (neib.x_min <= x_max && x_min <= neib.x_max
                && neib.y_min <= y_max && y_min <= neib.y_max
                && neib.z_min <= z_max && z_min <= neib.z_max) {
                const aabb = new AABB().setIntersect(this.outerAABB, second.outerAABB);
                const portal1 = new Portal({
                    aabb,
                    fromRegion: this,
                    toRegion: second
                });
                const portal2 = new Portal({
                    aabb,
                    fromRegion: second,
                    toRegion: this
                });
                portal1.rev = portal2;
                portal2.rev = portal1;
                this._addPortal(portal1);
                second._addPortal(portal2);
            }
        }
    }

    _removeAllPortals() {
        for (let i = 0; i < this.portals.length; i++) {
            const portal = this.portals[i];
            const {rev} = portal;
            const ind = rev.fromRegion.portals.indexOf(rev);
            if (ind >= 0) {
                rev.fromRegion.portals.splice(ind, 1);
            } else {
                // WTF?
            }
        }
        this.portals.length = 0;
    }
}

class Portal {
    constructor({aabb, fromRegion, toRegion}) {
        this.aabb = aabb;
        this.fromRegion = fromRegion;
        this.toRegion = toRegion;
    }
}

var BaseChunk$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	BaseChunk: BaseChunk,
	Portal: Portal
});

class DataChunk extends BaseChunk {
    constructor({size, strideBytes}) {
        super({size});
        this.initData(strideBytes);
    }

    initData(strideBytes) {
        this.strideBytes = strideBytes;
        this.stride32 = strideBytes >> 2;
        this.stride16 = strideBytes >> 1;
        this.dataBuf = new ArrayBuffer(this.outerLen * strideBytes);
        this.uint8View = new Uint8Array(this.dataBuf);
        if ((strideBytes & 1) === 0) {
            this.uint16View = new Uint16Array(this.dataBuf);
        }
        if ((strideBytes & 3) === 0) {
            this.uint32View = new Uint32Array(this.dataBuf);
        }
    }

    setFromArrayBuffer(buf) {
        // only not-padded data
        if (buf.byteLength !== this.strideBytes * this.insideLen) {
            throw new Error('Wrong data size');
        }
        let { outerSize, size, padding, strideBytes, stride32, uint8View, uint32View } = this;
        if (uint32View) {
            const data = new Uint32Array(buf);
            const amount = size.x * stride32;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * stride32;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint32View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        } else {
            const data = new Uint8Array(buf);
            const amount = size.x * strideBytes;
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const indFrom = (y * size.z + z) * size.x * strideBytes;
                    const indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                    for (let x = 0; x < amount; x++) {
                        this.uint8View[indTo + x] = data[indFrom + x];
                    }
                }
            }
        }
    }

    uint32ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        return uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    uint16ByCoord(localX, localY, localZ, offset = 0) {
        const { outerSize, padding, stride16, uint16View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        return uint16View[offset + stride16 * (localX  + outerSize.x * (localZ + localY * outerSize.z))];
    }

    indexByWorld(worldX, worldY, worldZ) {
        const { outerSize } = this;
        return worldX + outerSize.x * (worldZ + outerSize.z * worldY) + this.shiftCoord;
    }
    setUint32ByCoord(localX, localY, localZ, offset, value) {
        const { outerSize, padding, stride32, uint32View } = this;
        localX += padding;
        localY += padding;
        localZ += padding;
        uint32View[offset + stride32 * (localX  + outerSize.x * (localZ + localY * outerSize.z))] = value;
    }

    uint8ByInd(ind, offset) {
        return this.uint8View[ind * this.strideBytes + offset];
    }

    setUint8ByInd(ind, offset, value) {
        this.uint8View[ind * this.strideBytes + offset] = value;
    }
}

var DataChunk$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	DataChunk: DataChunk
});

module.exports = light_worker;
