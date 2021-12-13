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
    queue: null,
    dayLight: 0,
}

const maxLight = 31;
const MASK_BLOCK = 127;
const MASK_AO = 128;

const OFFSET_SOURCE = 0;
const OFFSET_LIGHT = 1;
const OFFSET_PREV = 2;
const OFFSET_AO = 3;
const OFFSET_DAY_SOURCE = 4;
const OFFSET_DAY_LIGHT = 5;

const dx = [1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0, /*|*/ 1, -1, 1, -1, 1, -1, 1, -1];
const dy = [0, 0, 1, -1, 0, 0, /*|*/ 1, 1, -1, -1, 0, 0, 0, 0, 1, 1, -1, -1, /*|*/ 1, 1, -1, -1, 1, 1, -1, -1];
const dz = [0, 0, 0, 0, 1, -1, /*|*/ 0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1, /*|*/ 1, 1, 1, 1, -1, -1, -1, -1];
const dlen = [];
const dmask = [];
const DIR_COUNT = 26;

function adjustSrc(srcLight) {
    srcLight = srcLight & MASK_BLOCK;
    if (srcLight * 2 < MASK_BLOCK && srcLight > 0) {
        srcLight = srcLight * 2 + 2;
    }
    return srcLight;
}

world.dayLight = adjustSrc(15);

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

initMasks();

class LightQueue {
    constructor() {
        this.wavesChunk = [];
        for (let i = 0; i <= maxLight; i++) {
            this.wavesChunk.push([]);
        }
        this.wavesCoord = [];
        for (let i = 0; i <= maxLight; i++) {
            this.wavesCoord.push([]);
        }
    }

    doWaves(msLimit) {
        msLimit = msLimit || globalStepMs;
        const startTime = performance.now();
        let endTime = performance.now();
        const {wavesChunk, wavesCoord} = this;
        let wn = maxLight;
        do {
            for (let tries = 0; tries < 1000; tries++) {
                while (wn >= 0 && wavesChunk[wn].length === 0) {
                    wn--;
                }
                if (wn < 0) {
                    break;
                }
                let chunk = wavesChunk[wn].pop();
                let { lightChunk } = chunk;
                const { uint8View, outerSize, strideBytes, safeAABB, outerAABB, portals } = lightChunk;
                const coord = wavesCoord[wn].pop();
                const coordBytes = coord * strideBytes;
                chunk.waveCounter--;
                if (chunk.removed) {
                    continue;
                }

                const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;

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
                if (val === MASK_BLOCK) {
                    val = 0;
                } else {
                    for (let d = 0; d < DIR_COUNT; d++) {
                        if ((mask & (1<<d)) !== 0) {
                            continue;
                        }
                        let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                        const src = uint8View[coord2 * strideBytes + OFFSET_SOURCE];
                        const light = uint8View[coord2 * strideBytes + OFFSET_LIGHT];
                        val = Math.max(val, light - dlen[d]);
                        if (src === MASK_BLOCK) {
                            mask |= dmask[d];
                        }
                    }
                }
                const old = uint8View[coordBytes + OFFSET_LIGHT];
                const prev = uint8View[coordBytes + OFFSET_PREV]
                if (old === val && prev === val) {
                    continue;
                }
                uint8View[coordBytes + OFFSET_LIGHT] = val;
                uint8View[coordBytes + OFFSET_PREV] = val;
                chunk.lastID++;

                //TODO: copy to neib chunks

                const waveNum = Math.max(Math.max(old, val) - 1, 0);
                if (safeAABB.contains(x, y, z)) {
                    // super fast case - we are inside data chunk
                    for (let d = 0; d < DIR_COUNT; d++) {
                        //TODO: better condition: dont add if there's a block
                        let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                        wavesChunk[waveNum].push(chunk);
                        wavesCoord[waveNum].push(coord2);
                        chunk.waveCounter++;
                    }
                } else {
                    for (let p = 0; p < portals.length; p++) {
                        const chunk2 = portals[p].toRegion;
                        if (!portals[p].aabb.contains(x, y, z)) {
                            continue;
                        }
                        chunk2.setUint8ByInd(chunk2.indexByWorld(x, y, z), OFFSET_LIGHT, val);
                        chunk2.lastID++;
                        for (let d = 0; d < DIR_COUNT; d++) {
                            if ((mask & (1<<d)) !== 0) {
                                continue;
                            }
                            let x2 = x + dx[d],
                                y2 = y + dy[d],
                                z2 = z + dz[d];
                            if (chunk2.aabb.contains(x2, y2, z2)) {
                                wavesChunk[waveNum].push(chunk2.rev);
                                wavesCoord[waveNum].push(chunk2.indexByWorld(x2, y2, z2));
                                chunk2.rev.waveCounter++;
                                mask |= 1 << d;
                            }
                        }
                    }
                    let hitEdge = false;
                    for (let d = 0; d < DIR_COUNT; d++) {
                        if ((mask & (1<<d)) !== 0) {
                            continue;
                        }
                        let x2 = x + dx[d],
                            y2 = y + dy[d],
                            z2 = z + dz[d];
                        let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                        if (lightChunk.aabb.contains(x2, y2, z2)) {
                            wavesChunk[waveNum].push(chunk);
                            wavesCoord[waveNum].push(coord2);
                            chunk.waveCounter++;
                        } else {
                            uint8View[coord2 * strideBytes + OFFSET_LIGHT] = Math.max(val - 1, 0);
                            hitEdge = true;
                        }
                    }
                    if (hitEdge) {
                        //TODO: do this only if light decreased
                        wavesChunk[waveNum].push(chunk);
                        wavesCoord[waveNum].push(coord);
                        chunk.waveCounter++;
                    }
                }
            }
            endTime = performance.now();
        } while (endTime < startTime + msLimit);
    }

    /**
     * @param chunk
     * @param coord
     * @param waveNum
     */
    add(chunk, coord, waveNum) {
        const {wavesChunk, wavesCoord} = this;
        if (waveNum < 0 || waveNum > maxLight) {
            waveNum = maxLight;
        }
        wavesChunk[waveNum].push(chunk);
        wavesCoord[waveNum].push(coord);
        chunk.waveCounter++;
    }

    calcResult(chunk) {
        const { lightChunk } = chunk;
        const { outerSize, uint8View, strideBytes } = lightChunk;
        const result = chunk.lightResult;

        const sy = outerSize.x * outerSize.z * strideBytes, sx = strideBytes, sz = outerSize.x * strideBytes;

        //TODO: separate multiple cycle

        // Light + AO
        let ind = 0;
        for (let y=0; y < outerSize.y; y++)
            for (let z=0; z < outerSize.z; z++)
                for (let x=0; x < outerSize.x; x++) {
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

                    result[ind++] = R * 16.0;
                    result[ind++] = G * 16.0;
                    result[ind++] = B * 16.0;
                    result[ind++] = A * 16.0;
                }
    }
}

class ChunkManager {
    constructor() {
        this.chunks = new VectorCollector();
        this.list = [];

        const INF = 1000000000;
        this.lightBase = new BaseChunk({ size: new Vector(INF, INF, INF) }).setPos(new Vector(-INF/2, -INF/2, -INF/2));
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

        this.lightChunk = new DataChunk({ size: args.size , strideBytes: 8 }).setPos(new Vector().copyFrom(args.addr).mul(args.size));
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
        const { uint8View, padding, size, outerSize, strideBytes } = this.lightChunk;
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
        this.lightResult = new Uint8Array(this.resultLen * 4);
    }

    fillOuter() {
        //checks neighbour chunks
        const {lightChunk} = this;
        const {outerSize, portals, shiftCoord, aabb, uint8View, strideBytes, outerLen} = lightChunk;
        const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;
        let found = false;

        // default value for daylight
        const defLight = world.dayLight;
        if (defLight > 0) {
            for (let coord = 0; coord < outerLen; coord++) {
                // max daylight everywhere
                uint8View[coord * shiftCoord + OFFSET_DAY_LIGHT] = defLight;
                uint8View[coord * shiftCoord + OFFSET_DAY_SOURCE] = defLight;
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
                        uint8View[coord1 + OFFSET_LIGHT] = bytes2[coord2 + OFFSET_LIGHT];

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
                        const dayLight = bytes2[coord2 + OFFSET_DAY_LIGHT];
                        uint8View[coord1 + OFFSET_DAY_LIGHT] = dayLight;
                        if (f1) {
                            if (dayLight !== defLight) {
                                // add to special daylight queue calc
                            }
                        }
                        if (f2) {
                            uint8View[coord1 + OFFSET_DAY_SOURCE] = bytes2[coord2 + OFFSET_DAY_SOURCE];
                            // if source is different, it wont affect us - we already handled it in previous condition
                        }
                    }
        }
        // add light to queue
        for (let y = aabb.y_min; y < aabb.y_max; y++)
            for (let z = aabb.z_min; z < aabb.z_max; z++)
                for (let x = aabb.x_min; x < aabb.x_max; x++) {
                    const coord = x * sx + y * sy + z * sz + shiftCoord, coordBytes = coord * strideBytes;

                    const m = Math.max(uint8View[coordBytes + OFFSET_LIGHT], uint8View[coordBytes + OFFSET_SOURCE]);
                    if (m > 0) {
                        world.light.add(this, coord, m);
                    }
                    found = found || uint8View[coordBytes + OFFSET_AO] > 0;

                    // filling daylight
                }
        if (found) {
            this.lastID++;
        }
    }
}

function run() {
    world.light.doWaves(16);

    world.chunkManager.list.forEach((chunk) => {
        if (chunk.waveCounter !== 0)
            return;
        if (chunk.sentID === chunk.lastID)
            return;
        chunk.sentID = chunk.lastID;

        world.light.calcResult(chunk);

        worker.postMessage(['light_generated', {
            addr: chunk.addr,
            lightmap_buffer: chunk.lightResult.buffer,
            lightID: chunk.lastID
        }]);
    })
}

const msgQueue = [];

const worker = {

    init: function() {
        if(typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs);
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = onMessageFunc
        }
    },

    postMessage: function(message) {
        if(this.parentPort) {
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
    //for now , its nothing
    world.chunkManager = new ChunkManager();
    world.light = new LightQueue();
    for (let item of msgQueue) {
        await onmessage(item);
    }
    msgQueue.length = 0;
    worker.postMessage(['worker_inited', null]);

    setInterval(run, 20);
}

async function onMessageFunc(e) {
    let data = e;
    if(typeof e == 'object' && 'data' in e) {
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
                const { light_source, x, y, z } = args;
                const { lightChunk } = chunk;
                const { portals, uint8View, strideBytes } = lightChunk;
                const ind = lightChunk.indexByWorld(x, y, z);
                const light = uint8View[ind * strideBytes + OFFSET_LIGHT];
                const src = adjustSrc(light_source);
                uint8View[ind * strideBytes + OFFSET_SOURCE] = src;
                world.light.add(chunk, ind, Math.max(light, src));
                // push ao
                const ao = (light_source & MASK_AO) > 0 ? 1 : 0;
                let setAo = uint8View[ind * strideBytes + OFFSET_AO] !== ao;
                if (setAo) {
                    uint8View[ind * strideBytes + OFFSET_AO] = ao;
                }
                for (let portal of portals) {
                    if (portal.aabb.contains(x, y, z)) {
                        const other = portal.toRegion;
                        const ind = other.indexByWorld(x, y, z);
                        other.setUint8ByInd(ind, OFFSET_SOURCE, src)
                        if (setAo) {
                            other.setUint8ByInd(ind, OFFSET_AO, ao)
                            other.lastID++;
                        }
                    }
                }
            }
        }
    }
}

if(typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}