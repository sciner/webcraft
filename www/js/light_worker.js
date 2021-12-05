/**
 * light worker sends messages periodically, separating light waves
 */

/**
 * settings
 */
import {AABB} from "./core/AABB";
import {BaseChunk} from "./core/BaseChunk";
import {DataChunk} from "./core/DataChunk";

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
const world = {
    chunkManager: null,
    queue: null
}

const maxLight = 15;
const MASK_BLOCK = 127;
const MASK_AO = 128;

const OFFSET_SOURCE = 0;
const OFFSET_LIGHT = 1;
const OFFSET_PREV = 2;
const OFFSET_AO = 3;

const dx = [1, -1, 0, 0, 0, 0];
const dy = [0, 0, 1, -1, 0, 0];
const dz = [0, 0, 0, 0, 1, -1];

const edge = [
    [1, -1, 1, -1, 1, -1, 1, -1, 0, 0, 0, 0],
    [1, 1, -1, -1, 0, 0, 0, 0, 1, 1, 1, -1],
    [0, 0, 0, 0, 1, 1, -1, -1, 1, -1, 1, -1],
]

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
        let chunkAddr = new Vector();
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
                const { uint8View, outerSize, size, strideBytes, innerAABB, outerAABB, portals } = lightChunk;
                const coord = wavesCoord[wn].pop();
                const coordBytes = coord * strideBytes;
                chunk.waveCounter--;
                if (chunk.removed) {
                    continue;
                }

                const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;

                let tmp = coord;
                const x = tmp % outerSize.x + outerAABB.x_min;
                tmp -= x;
                tmp /= outerSize.x;
                const z = tmp % outerSize.z + outerAABB.z_min;
                tmp -= z;
                tmp /= outerSize.z;
                const y = tmp + outerAABB.y_min;

                let val = uint8View[coordBytes + OFFSET_SOURCE];
                let ao = uint8View[coordBytes + OFFSET_AO];
                if (val === MASK_BLOCK) {
                    val = 0;
                } else {
                    for (let d = 0; d < 6; d++) {
                        let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                        val = Math.max(val, uint8View[coord2 * strideBytes + OFFSET_LIGHT]);
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
                if (innerAABB.contains(x, y, z)) {
                    // super fast case - we are inside data chunk
                    for (let d = 0; d < 6; d++) {
                        let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                        wavesChunk[waveNum].push(chunk);
                        wavesCoord[waveNum].push(coord2);
                        chunk.waveCounter++;
                    }
                } else {
                    // one of neighbours is inside another chunk
                    for (let d = 0; d < 6; d++) {
                        //might be portals!
                        let x2 = x + dx[d],
                            y2 = y + dy[d],
                            z2 = z + dz[d];
                        let flag = true;
                        for (let p = 0; p < portals.length; p++) {
                            if (p.aabb.contains(x2, y2, z2)) {
                                const chunk2 = p.aabb.toRegion;
                                chunk2.setUint32ByCoord(x, y, z, OFFSET_LIGHT, val);
                                chunk2.lastID++;

                                if (chunk2.aabb.contains(x, y, z)) {
                                    wavesChunk[waveNum].push(chunk2.rev);
                                    wavesCoord[waveNum].push(chunk2.indexByWorld(x2, y2, z2));
                                    chunk2.waveCounter++;
                                    flag = false;
                                }
                            }
                        }
                        if (flag) {
                            let coord2 = coord + dx[d] * sx + dy[d] * sy + dz[d] * sz;
                            if (lightChunk.aabb.contains(x2, y2, z2)) {
                                wavesChunk[waveNum].push(chunk);
                                wavesCoord[waveNum].push(coord2);
                                chunk.waveCounter++;
                            } else {
                                uint8View[coord2 * strideBytes + OFFSET_LIGHT] = Math.max(val - 1, 0);
                                wavesChunk[waveNum].push(chunk);
                                wavesCoord[waveNum].push(coord);
                                chunk.waveCounter++;
                            }
                        }
                    }
                }
            }
            endTime = performance.now();
        } while (endTime < startTime + msLimit);
    }

    /**
     * @param chunk
     * @param ind
     * @param coord
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

    fixEdge(chunk) {
        const { size, outerSize } = chunk;
        const dest = chunk.lightMap;

        const chunkAddr = new Vector();

        const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;

        for (let i = 0; i < 12; i++)
        {
            chunkAddr.copyFrom(chunk.addr);
            const dx = edge[0][i], dy = edge[1][i], dz = edge[2][i];
            const tx = 1 - Math.abs(dx), ty = 1 - Math.abs(dy), tz = 1 - Math.abs(dz);
            const len = size.x * tx + size.y * ty + size.z * tz + 2;
            const x1 = dx > 0 ? size.x + 1 : 0;
            const y1 = dy > 0 ? size.y + 1 : 0;
            const z1 = dz > 0 ? size.z + 1 : 0;


            chunkAddr.x += dx;
            chunkAddr.y += dy;
            chunkAddr.z += dz;

            const chunk2 = world.chunkManager.getChunk(chunkAddr);
            if (chunk2)
            {
                const src = chunk2.lightMap;
                const shift = dx * size.x * sx + dy * size.y * sy + dz * size.z * sz;
                for (let t = 0; t < len; t++) {
                    const coord = (x1 + t * tx) * sx + (y1 + t * ty) * sy + (z1 + t * tz) * sz;
                    dest[coord] = src[coord - shift];
                }
            } else
            {
                const shift = dx * sx + dy * sy + dz * sz;
                for (let t = 0; t < len; t++) {
                    const coord = (x1 + t * tx) * sx + (y1 + t * ty) * sy + (z1 + t * tz) * sz;
                    dest[coord] = Math.max((dest[coord - shift] & MASK_BLOCK) - 1, 0);
                }
            }
        }
    }

    calcResult(chunk) {
        const { size, lightChunk } = chunk;
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
                    A = Math.max(A, 0);

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
        this.lightBase.addSub(chunk);
    }

    delete(chunk) {
        if (this.chunks.delete(chunk.addr)) {
            this.list.splice(this.list.indexOf(chunk), 1);
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

        this.lightChunk = new DataChunk({ size: args.size , strideBytes: 4 }).setPos(args.addr.mul(args.size));
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
        const { uint8View, padding, outerSize, strideBytes } = this.lightChunk;
        const src = new Uint8Array(buf);
        for (let y = 0; y < size.y; y++) {
            for (let z = 0; z < size.z; z++) {
                const indFrom = (y * size.z + z) * size.x;
                let indTo = (((y + padding) * outerSize.z + (z + padding)) * outerSize.x + padding) * strideBytes;
                for (let x = 0; x < size.x; x++) {
                    uint8View[indTo + OFFSET_SOURCE] = src[indFrom + x] & MASK_BLOCK;
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
        const {size, outerSize, lightSource} = this;
        const sy = outerSize.x * outerSize.z, sx = 1, sz = outerSize.x;
        const iy = size.x * size.z, ix = 1, iz = size.x;
        let neibAddr = new Vector();
        let dest = this.lightMap;
        let neib;

        neibAddr.copyFrom(this.addr).x--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sx * size.x, shift2 = sx;
            for (let i = 0; i < outerSize.y; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    dest[ind] = src[ind + shift];
                    dest[ind + shift2] = src[ind + shift + shift2] & MASK_BLOCK;
                }
            for (let i = 1; i + 1 < outerSize.y; i++)
                for (let j = 1; j + 1 < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    let inner = iy * (i - 1) + iz * (j - 1);
                    if (lightSource[inner] & MASK_AO) {
                        //TODO: check if its different from src (stored old value?)
                        dest[ind + shift2] |= MASK_AO;
                        src[ind + shift + shift2] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }
        neibAddr.copyFrom(this.addr).x++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sx * size.x, shift2 = sx;
            for (let i = 0; i < outerSize.y; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    dest[ind + shift] = src[ind] & MASK_BLOCK;
                    dest[ind + shift + shift2] = src[ind + shift2];
                }
            for (let i = 1; i + 1 < outerSize.y; i++)
                for (let j = 1; j + 1 < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    let inner = iy * (i - 1) + iz * (j - 1) + ix * (size.x - 1);
                    if (lightSource[inner] & MASK_AO) {
                        dest[ind + shift] |= MASK_AO;
                        src[ind] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }
        neibAddr.copyFrom(this.addr).y--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sy * size.y, shift2 = sy;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    dest[ind] = src[ind + shift];
                    dest[ind + shift2] = src[ind + shift + shift2] & MASK_BLOCK;
                }
            for (let i = 1; i + 1 < outerSize.x; i++)
                for (let j = 1; j + 1 < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    let inner = ix * (i - 1) + iz * (j - 1);
                    if (lightSource[inner] & MASK_AO) {
                        dest[ind + shift2] |= MASK_AO;
                        src[ind + shift + shift2] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }
        neibAddr.copyFrom(this.addr).y++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sy * size.y, shift2 = sy;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    dest[ind + shift] = src[ind] & MASK_BLOCK;
                    dest[ind + shift + shift2] = src[ind + shift2];
                }
            for (let i = 1; i + 1 < outerSize.x; i++)
                for (let j = 1; j + 1 < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    let inner = ix * (i - 1) + iz * (j - 1) + iy * (size.y - 1);
                    if (lightSource[inner] & MASK_AO) {
                        dest[ind + shift] |= MASK_AO;
                        src[ind] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }
        neibAddr.copyFrom(this.addr).z--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sz * size.z, shift2 = sz;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    dest[ind] = src[ind + shift];
                    dest[ind + shift2] = src[ind + shift + shift2] & MASK_BLOCK;
                }
            for (let i = 1; i + 1 < outerSize.x; i++)
                for (let j = 1; j + 1 < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    let inner = ix * (i - 1) + iy * (j - 1);
                    if (lightSource[inner] & MASK_AO) {
                        dest[ind + shift2] |= MASK_AO;
                        src[ind + shift + shift2] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }
        neibAddr.copyFrom(this.addr).z++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sz * size.z, shift2 = sz;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    dest[ind + shift] = src[ind] & MASK_BLOCK;
                    dest[ind + shift + shift2] = src[ind + shift2];
                }
            for (let i = 1; i + 1 < outerSize.x; i++)
                for (let j = 1; j + 1 < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    let inner = ix * (i - 1) + iy * (j - 1) + iz * (size.z - 1);
                    if (lightSource[inner] & MASK_AO) {
                        dest[ind + shift] |= MASK_AO;
                        src[ind] |= MASK_AO;
                        neib.lastID++;
                    }
                }
        }

        let found = false;
        for (let y = 0; y < size.y; y++)
            for (let z = 0; z < size.z; z++)
                for (let x=0; x < size.x; x++) {
                    const inner = x * ix + y * iy + z * iz;
                    const outer = (x + 1) * sx + (y + 1) * sy + (z + 1) * sz;
                    const ao = lightSource[inner] & MASK_AO;
                    let val = lightSource[inner] & MASK_BLOCK;
                    if (val === MASK_BLOCK) {
                        val = 0;
                    }
                    const m = Math.max(val, dest[outer] & MASK_BLOCK);
                    if (m > 0) {
                        world.light.add(this, outer, m);
                    } else {
                        if (ao || dest[outer]) {
                            dest[outer] = ao;
                            found = true;
                        }
                    }
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

        world.light.fixEdge(chunk);
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
                const { innerCoord, outerCoord, light_source } = args;
                chunk.lightSource[innerCoord] = light_source;
                world.light.add(chunk, outerCoord, Math.max(chunk.lightMap[outerCoord] & MASK_BLOCK, light_source & MASK_BLOCK));
            }
        }
    }
}

if(typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}