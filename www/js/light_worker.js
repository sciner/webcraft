/**
 * light worker sends messages periodically, separating light waves
 */

import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "./blocks";

/**
 * inited or not
 * @type {boolean}
 */
let modulesReady = false;
let VectorCollector = null;
let Vector = null;
let chunks = null;
const world = {
    chunkManager: null
}

class ChunkManager {
    constructor() {
    }

    // Get
    getChunk(addr) {
        return chunks.get(addr);
    }
}

class Chunk {
    constructor(args) {
        Object.assign(this, args);
        this.addr = new Vector(args.addr.x, args.addr.y, args.addr.z);
        this.size = new Vector(args.size.x, args.size.y, args.size.z);
        this.outerSize = new Vector(args.size.x + 2, args.size.y + 2, args.size.z + 2);
    }

    get chunkManager() {
        return world.chunkManager;
    }

    init() {
        this.len = this.size.x * this.size.y * this.size.z;
        this.outerLen = (this.size.x + 1) * (this.size.y + 1) * (this.size.z + 1);
        this.lightSource = new Uint8Array(this.len);
        this.lightMap = new Uint8Array(this.len);
    }

    fillOuter() {
        //checks neighbour chunks
        const {size, outerSize} = this;
        const sy = outerSize.x * outerSize.z, sx = outerSize.x, sz = 1;
        let neibAddr = new Vector();
        let dest = this.lightMap;
        let neib;
        neibAddr.copyFrom(this.addr).x--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sx * (outerSize.x - 1), shift2 = sx;
            for (let i = 0; i < outerSize.y; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    dest[ind] = src[ind + shift - shift2];
                    dest[ind + shift2] = src[ind + shift];
                }
        }
        neibAddr.copyFrom(this.addr).x++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sx * (outerSize.x - 1), shift2 = sx;
            for (let i = 0; i < outerSize.y; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sy * i + sz * j;
                    dest[ind + shift - shift2] = src[ind];
                    dest[ind + shift] = src[ind + shift2];
                }
        }
        neibAddr.copyFrom(this.addr).y--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sy * (outerSize.y - 1), shift2 = sy;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    dest[ind] = src[ind + shift - shift2];
                    dest[ind + shift2] = src[ind + shift];
                }
        }
        neibAddr.copyFrom(this.addr).y++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sy * (outerSize.y - 1), shift2 = sy;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.z; j++) {
                    let ind = sx * i + sz * j;
                    dest[ind] = src[ind + shift - shift2];
                    dest[ind + shift2] = src[ind + shift];
                }
        }
        neibAddr.copyFrom(this.addr).z--;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sz * (outerSize.z - 1), shift2 = sz;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    dest[ind] = src[ind + shift - shift2];
                    dest[ind + shift2] = src[ind + shift];
                }
        }
        neibAddr.copyFrom(this.addr).z++;
        neib = this.chunkManager.getChunk(neibAddr);
        if (neib) {
            let src = neib.lightMap;
            let shift = sz * (outerSize.z - 1), shift2 = sz;
            for (let i = 0; i < outerSize.x; i++)
                for (let j = 0; j < outerSize.y; j++) {
                    let ind = sx * i + sy * j;
                    dest[ind] = src[ind + shift - shift2];
                    dest[ind + shift2] = src[ind + shift];
                }
        }
    }
}

async function importModules() {
    await import("./helpers.js").then(module => {
        Vector = module.Vector;
        VectorCollector = module.VectorCollector;
        chunks = new VectorCollector();
    });
    modulesReady = true;
    //for now , its nothing
    for (let item of queue) {
        await onmessage(item);
    }
    queue = [];
}

onmessage = async function (e) {
    const cmd = e.data[0];
    const args = e.data[1];
    if (cmd == 'init') {
        // Init modules
        importModules();
        return;
    }
    if (!modulesReady) {
        return queue.push(e);
    }
    //do stuff

    switch (cmd) {
        case 'createChunk': {
            if (!chunks.has(args.addr)) {
                let chunk = new Chunk(args);
                chunk.init();
                chunks.add(args.addr, chunk);
            }
            break;
        }
        case 'destructChunk': {
            if (chunks.has(args.addr)) {
                chunks.delete(args.addr);
            }
            break;
        }
        case 'lightChunk': {
            break;
        }
    }
}
