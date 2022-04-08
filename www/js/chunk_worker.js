// Modules
let Vector              = null;
let Helpers             = null;
let VectorCollector     = null;
// let BLOCK               = null;
let WorkerWorldManager  = null;
let worlds              = null;
// let world               = null;

const worker = {

    init: function() {
        if(typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs);
            import('path').then(module => global.path = module);
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

preLoad().then();

async function preLoad () {
    const start = performance.now();

    await import('./helpers.js').then(module => {
        Vector = module.Vector;
        Helpers = module.Helpers;
        VectorCollector = module.VectorCollector;
    });
    // load module
    await import('./worker/world.js').then(module => {
        WorkerWorldManager = module.WorkerWorldManager;
    });
    // load module
    await import('./blocks.js').then(module => {
        globalThis.BLOCK = module.BLOCK;
        // return BLOCK.init(settings);
    });
    // load module
    await import('./terrain_generator/cluster/manager.js').then(module => {
        globalThis.ClusterManager = module.ClusterManager;
    });

    console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
}
/**
* @param {string} terrain_type
*/
async function initWorld(
    terrain_type,
    world_seed,
    world_guid,
    settings,
    cache
) {
    if (cache) {
        Helpers.setCache(cache);
    }

    // legacy
    if (!globalThis.BLOCK) {
        await preLoad();
    }

    await globalThis.BLOCK.init(settings);
    //
    worlds = new WorkerWorldManager();
    await worlds.InitTerrainGenerators([terrain_type]);
    globalThis.world = await worlds.add(terrain_type, world_seed, world_guid);
    // Worker inited
    worker.postMessage(['world_inited', null]);
}

// On message callback function
async function onMessageFunc(e) {
    let data = e;
    if(typeof e == 'object' && 'data' in e) {
        data = e.data;
    }
    const cmd = data[0];
    const args = data[1];
    if(cmd == 'init') {
        // Init modules
        return await initWorld(
            args.generator.id,
            args.world_seed,
            args.world_guid,
            args.settings,
            args.resource_cache
        );
    }
    switch(cmd) {
        case 'createMaps': {
            let pn = performance.now();
            const addr = new Vector(args.addr);
            const maps = world.generator.maps.generateAround(addr, false, false, 8);
            const CELLS_COUNT = 256;
            const CELL_LENGTH = 4;
            const resp = new Float32Array(new Array((CELLS_COUNT * CELL_LENGTH + CELL_LENGTH) * maps.length));
            let offset = 0;
            for(let map of maps) {
                resp[offset + 0] = map.chunk.addr.x;
                resp[offset + 1] = map.chunk.addr.y;
                resp[offset + 2] = map.chunk.addr.z;
                resp[offset + 3] = 0;
                offset += CELL_LENGTH;
                for(let x = 0; x < map.info.cells.length; x++) {
                    const line = map.info.cells[x];
                    for(let z = 0; z < line.length; z++) {
                        const cell = line[z];
                        resp[offset + 0] = cell.value2;
                        resp[offset + 1] = cell.block;
                        resp[offset + 2] = cell.biome.dirt_color.r;
                        resp[offset + 3] = cell.biome.dirt_color.g;
                        offset += CELL_LENGTH;
                    }
                }
            }
            console.log(performance.now() - pn);
            worker.postMessage(['maps_created', resp]);
            break;
        }
        case 'createChunk': {
            let from_cache = world.chunks.has(args.addr);
            const update = ('update' in args) && args.update;
            if(update) {
                if(from_cache) {
                    world.chunks.delete(args.addr);
                    from_cache = false;
                }
            }
            if(from_cache) {
                let chunk = world.chunks.get(args.addr);
                worker.postMessage(['blocks_generated', {
                    key:            chunk.key,
                    addr:           chunk.addr,
                    tblocks:        chunk.tblocks,
                    ticking_blocks: Array.from(chunk.ticking_blocks.keys()),
                    map:            chunk.map
                }]);
            } else {
                let ci = world.createChunk(args);
                worker.postMessage(['blocks_generated', ci]);
            }
            break;
        }
        case 'destructChunk': {
            world.destructChunk(args.addr);
            break;
        }
        case 'buildVertices': {
            let results = [];
            for(let addr of args.addrs) {
                let chunk = world.chunks.get(addr);
                if(chunk) {
                    // 4. Rebuild vertices list
                    const item = buildVertices(chunk, false);
                    if(item) {
                        item.dirt_colors = new Float32Array(chunk.size.x * chunk.size.z * 2);
                        let index = 0;
                        for(let z = 0; z < chunk.size.z; z++) {
                            for(let x = 0; x < chunk.size.x; x++) {
                                item.dirt_colors[index++] = chunk.map.info.cells[x][z].biome.dirt_color.r;
                                item.dirt_colors[index++] = chunk.map.info.cells[x][z].biome.dirt_color.g;
                            }
                        }
                        results.push(item);
                        chunk.vertices = null;
                    }
                }
            }
            worker.postMessage(['vertices_generated', results]);
            break;
        }
        case 'setBlock': {
            let chunks = new VectorCollector();
            for(let m of args) {
                // 1. Get chunk
                let chunk = world.getChunk(m.addr);
                if(chunk) {
                    // 2. Set block
                    if(m.type) {
                        chunk.setBlock(m.x, m.y, m.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    let pos = new Vector(m.x - chunk.coord.x, m.y - chunk.coord.y, m.z - chunk.coord.z);
                    // 3. Clear vertices for block and around near
                    chunk.setDirtyBlocks(pos);
                    chunks.set(m.addr, chunk);
                } else {
                    console.error('worker.setBlock: chunk not found at addr: ', m.addr);
                }
            }
            // 4. Rebuild vertices list
            let result = [];
            for(let chunk of chunks) {
                let item = buildVertices(chunk, false);
                if(item) {
                    result.push(item);
                    chunk.vertices = null;
                } else {
                    chunk.dirty = true;
                }
            }
            // 5. Send result to chunk manager
            worker.postMessage(['vertices_generated', result]);
            break;
        }
        case 'stat': {
            try {
                console.table({
                    maps_cache_count: world.generator.maps_cache.size,
                    maps_cache_size: JSON.stringify(world.generator.maps_cache).length/1024/1024,
                    chunks_count: world.chunks.size,
                });
            } catch(e) {
                console.error(e);
            }
            break;
        }
    }
}

if(typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}

// Rebuild vertices list
function buildVertices(chunk, return_map) {
    let prev_dirty = chunk.dirty;
    let pm = performance.now();
    chunk.dirty = true;
    let is_builded = chunk.buildVertices();
    if(!is_builded) {
        chunk.dirty = prev_dirty;
        return null;
    }
    chunk.timers.build_vertices = Math.round((performance.now() - pm) * 1000) / 1000;
    let resp = {
        key:                    chunk.key,
        addr:                   chunk.addr,
        vertices:               Object.fromEntries(chunk.vertices),
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
    };
    if(return_map) {
        resp.map = chunk.map.info;
    }
    return resp;
}