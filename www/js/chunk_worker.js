// Modules
let Vector              = null;
let Helpers             = null;
let getChunkAddr        = null;
let VectorCollector     = null;
// let BLOCK               = null;
let WorkerWorldManager  = null;
let worlds              = null;
let CHUNK_SIZE_X        = null;
let CHUNK_SIZE_Y        = null;
let CHUNK_SIZE_Z        = null;
// let world               = null;

const worker = globalThis.worker = {

    init: function() {
        if(typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs);
            import('path').then(module => global.path = module);
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', onMessageFunc);
                //options.context.parentPort = module.parentPort;
                //options.context.parentPort.on('message', onMessageFunc);

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
    await import('./chunk_const.js').then(module => {
        getChunkAddr = module.getChunkAddr;
        CHUNK_SIZE_X = module.CHUNK_SIZE_X;
        CHUNK_SIZE_Y = module.CHUNK_SIZE_Y;
        CHUNK_SIZE_Z = module.CHUNK_SIZE_Z;
    });
    // load module
    await import('./blocks.js').then(module => {
        globalThis.BLOCK = module.BLOCK;
        // return BLOCK.init(settings);
    });

    console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
}
/**
* @param {string} terrain_type
*/
async function initWorld(
    generator,
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
    await worlds.InitTerrainGenerators([generator.id]);
    globalThis.world = await worlds.add(generator, world_seed, world_guid);
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
            args.generator,
            args.world_seed,
            args.world_guid,
            args.settings,
            args.resource_cache
        );
    }
    switch(cmd) {
        case 'createChunk': {
            for(let i = 0; i < args.length; i++) {
                const item = args[i];
                let from_cache = world.chunks.has(item.addr);
                const update = ('update' in item) && item.update;
                if(update) {
                    if(from_cache) {
                        world.chunks.delete(item.addr);
                        from_cache = false;
                    }
                }
                if(from_cache) {
                    let chunk = world.chunks.get(item.addr);
                    const non_zero = chunk.tblocks.refreshNonZero();
                    worker.postMessage(['blocks_generated', {
                        key:            chunk.key,
                        addr:           chunk.addr,
                        tblocks:        non_zero > 0 ? chunk.tblocks.saveState() : null,

                        ticking_blocks: Array.from(chunk.ticking_blocks.keys()),
                        map:            chunk.map
                    }]);
                } else {
                    let ci = world.createChunk(item);
                    const non_zero = ci.tblocks.refreshNonZero();
                    const ci2 = {
                        addr: ci.addr,
                        // key: ci.key,
                        tblocks: non_zero > 0 ? ci.tblocks.saveState() : null,
                        ticking_blocks: ci.ticking_blocks
                    }
                    worker.postMessage(['blocks_generated', ci2]);
                }
            }
            break;
        }
        case 'destructChunk': {
            for(let addr of args) {
                world.destructChunk(addr);
            }
            break;
        }
        case 'destroyMap': {
            if(world.generator.maps) {
                world.generator.maps.destroyAroundPlayers(args.players);
            }
            break;
        }
        case 'buildVertices': {
            let results = [];
            for (let ind = 0; ind < args.addrs.length; ind++) {
                let addr = args.addrs[ind];
                let dataOffset = args.offsets[ind];

                let chunk = world.chunks.get(addr);
                if(chunk) {
                    chunk.dataOffset = dataOffset;
                    // 4. Rebuild vertices list
                    const item = buildVertices(chunk, false);
                    if(item) {
                        item.dirt_colors = new Float32Array(chunk.size.x * chunk.size.z * 2);
                        let index = 0;
                        for(let z = 0; z < chunk.size.z; z++) {
                            for(let x = 0; x < chunk.size.x; x++) {
                                item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X + x].dirt_color.r;
                                item.dirt_colors[index++] = chunk.map.cells[z * CHUNK_SIZE_X + x].dirt_color.g;
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
            const chunk_addr = new Vector(0, 0, 0);
            const pos_world = new Vector(0, 0, 0);
            //
            const neighbour_chunk_addr = new Vector(0, 0, 0);
            const addNeighbourChunk = (chunk, vec_add) => {
                // console.log(chunk.tblocks.getNeightboursChunks());
                neighbour_chunk_addr.copyFrom(chunk.addr).addSelf(vec_add);
                if(chunks.has(neighbour_chunk_addr)) {
                    return false;
                }
                const neighbour = world.getChunk(neighbour_chunk_addr);
                if(neighbour) {
                    chunks.set(neighbour.addr, neighbour);
                }
            };
            //
            for(let i = 0; i < args.length; i++) {
                const m = args[i];
                // 1. Get chunk
                getChunkAddr(m.pos.x, m.pos.y, m.pos.z, chunk_addr);
                const chunk = world.getChunk(chunk_addr);
                if(chunk) {
                    // 2. Set block
                    if(m.type) {
                        chunk.setBlock(m.pos.x, m.pos.y, m.pos.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    pos_world.set(m.pos.x - chunk.coord.x, m.pos.y - chunk.coord.y, m.pos.z - chunk.coord.z);
                    //
                    if(pos_world.x == CHUNK_SIZE_X - 1) addNeighbourChunk(chunk, Vector.XP);
                    if(pos_world.x == 0) addNeighbourChunk(chunk, Vector.XN);
                    if(pos_world.y == CHUNK_SIZE_Y - 1) addNeighbourChunk(chunk, Vector.YP);
                    if(pos_world.y == 0) addNeighbourChunk(chunk, Vector.YN);
                    if(pos_world.z == CHUNK_SIZE_Z - 1) addNeighbourChunk(chunk, Vector.ZP);
                    if(pos_world.z == 0) addNeighbourChunk(chunk, Vector.ZN);
                    // 3. Clear vertices for block and around near
                    chunk.setDirtyBlocks(pos_world);
                    chunks.set(chunk_addr, chunk);
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
        case 'setDropItemMeshes': {
            worker.drop_item_meshes = args;
            break;
        }
        case 'createMaps': {
            /*let pn = performance.now();
            const addr = new Vector(args.addr);
            const maps = world.generator.maps.generateAround(chunk, addr, false, false, 8);
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
                for(let x = 0; x < map.cells.length; x++) {
                    const line = map.cells[x];
                    for(let z = 0; z < line.length; z++) {
                        const cell = line[z];
                        resp[offset + 0] = cell.value2;
                        resp[offset + 1] = cell.dirt_block_id;
                        resp[offset + 2] = cell.dirt_color.r;
                        resp[offset + 3] = cell.dirt_color.g;
                        offset += CELL_LENGTH;
                    }
                }
            }
            console.log(performance.now() - pn);
            worker.postMessage(['maps_created', resp]);
            */
            break;
        }
    }
}

if(typeof process !== 'undefined') {
    import('worker_threads').then(module => module.parentPort.on('message', onMessageFunc));
} else {
    onmessage = onMessageFunc
}

const buildSettings = {
    enableCache : true,
}
// Rebuild vertices list
function buildVertices(chunk, return_map) {
    let prev_dirty = chunk.dirty;
    let pm = performance.now();
    chunk.dirty = true;
    let is_builded = chunk.buildVertices(buildSettings);
    if(!is_builded) {
        chunk.dirty = prev_dirty;
        return null;
    }
    chunk.timers.build_vertices = Math.round((performance.now() - pm) * 1000) / 1000;
    let resp = {
        key:                    chunk.key,
        addr:                   chunk.addr,
        vertices:               chunk.serializedVertices,
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
    };
    if(return_map) {
        resp.map = chunk.map;
    }
    return resp;
}