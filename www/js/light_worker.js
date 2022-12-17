/**
 * light worker sends messages periodically, separating light waves
 */
let modulesReady = false;
let Vector = null;
let LightConst = null;
let LightWorld = null;
let Chunk = null;
let world = null;

function run() {
    const msLimit = 16;
    const resultLimit = 5;
    const startTime = performance.now();
    let endTime = performance.now();
    let endChunks = 0;
    let ready;
    do {
        ready = 3;
        if (world.light.doIter(10000)) {
            ready--;
        }
        endTime = performance.now();
        // if (endTime > startTime + msLimit) {
        //     break;
        // }
        if (world.dayLightSrc.doIter(40000)) {
            ready--;
        }
        // if (endTime > startTime + msLimit) {
        //     break;
        // }
        endTime = performance.now();
        if (world.dayLight.doIter(20000)) {
            ready--;
        }
        endTime = performance.now();
    } while (endTime < startTime + msLimit && ready > 0);
    // if (endTime - startTime > 0.3) {
    //     console.log(`Light took ${endTime - startTime}`);
    // }

    world.isEmptyQueue = ready === 0;
    world.groundLevelSkipCounter = 1;
    world.checkPotential();

    world.chunkManager.list.forEach((chunk) => {
        if (chunk.waveCounter !== 0)
            return;
        if (chunk.sentID === chunk.lastID)
            return;
        chunk.sentID = chunk.lastID;

        chunk.calcResult(renderFormat === 'rgba4unorm', hasNormals);

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
                    lightID: chunk.lastID,
                    uniqId: chunk.uniqId,
                }]);
            }
            // update ground level
            world.groundLevelSkipCounter = (world.groundLevelSkipCounter + 1) % LightConst.GROUND_SKIP_CHUNKS;
            if (world.isEmptyQueue || world.groundLevelSkipCounter === 0) {
                world.estimateGroundLevel();
            }
        }

        endChunks++;
        if (endChunks >= resultLimit) {
            return;
        }
    })
}

let renderFormat = 'rgba8';
let hasNormals = false;

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
    });
    await import('./worker-light/LightConst.js').then(module => {
        LightConst = module;
    });
    await import('./worker-light/LightWorld.js').then(module => {
        LightWorld = module.LightWorld;
    });
    await import('./worker-light/Chunk.js').then(module => {
        Chunk = module.Chunk;
    });
    modulesReady = true;

    console.debug('[LightWorker] Preloaded, load time:', performance.now() - start);
}

async function initWorld() {

    if (!modulesReady) {
        await preLoad();
    }

    world = new LightWorld();
    world.light.setNormals(hasNormals);
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
            hasNormals = !!args.hasNormals;
            if (world && world.light) {
                world.light.setNormals(hasNormals);
            }
            break;
        }
        case 'createChunk': {
            if (!world.chunkManager.getChunk(args.addr)) {
                let chunk = new Chunk(world, args);
                chunk.init();
                world.chunkManager.add(chunk);
                chunk.fillOuter();
            }
            break;
        }
        case 'destructChunk': {
            var changed = false;
            for (let addr of args) {
                let chunk = world.chunkManager.getChunk(addr);
                if (chunk) {
                    chunk.removed = true;
                    world.chunkManager.delete(chunk);
                    changed = true;
                }
            }
            if (changed) {
                world.estimateGroundLevel();
            }
            break;
        }
        case 'setChunkBlock': {
            world.setChunkBlock(args);
            break;
        }
        case 'setPotentialCenter': {
            world.chunk_render_dist = args.chunk_render_dist;
            if (args.pos) {
                world.chunkManager.nextPotentialCenter = new Vector().copyFrom(args.pos).round();
                world.checkPotential();
            }
            // if the player moved far enough, update the ground level estimation
            if ((world.isEmptyQueue || world.groundLevelSkipCounter === 0) && 
                world.prevGroundLevelPlayerPos && 
                world.prevGroundLevelPlayerPos.distance(world.chunkManager.nextPotentialCenter) > LightConst.GROUND_BUCKET_SIZE
            ) {
                world.estimateGroundLevel();
            }
            break;
        }
    }
}

if (typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}
