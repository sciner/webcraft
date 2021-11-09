// Modules
let Vector              = null;
let BLOCK               = null;
let WorldManager        = null;
let worlds              = null;
let world               = null;


/**
 * @param {string} terrain_type
 */
async function importModules(terrain_type, seed, world_id) {
    // load module
    await import('./helpers.js').then(module => {
        Vector = module.Vector;
    });
    // load module
    await import('./worker/world.js').then(module => {
        WorldManager = module.WorldManager;
    });
    // load module
    await import('./blocks.js').then(module => {
        BLOCK = module.BLOCK;
        return BLOCK.init();
    });
    //
    worlds = new WorldManager();
    await worlds.InitTerrainGenerators();
    world = worlds.add(terrain_type, seed, world_id);
    // Worker inited
    postMessage(['world_inited', null]);
}

// On message callback function
onmessage = async function(e) {
    const cmd = e.data[0];
    const args = e.data[1];
    if(cmd == 'init') {
        // Init modules
        let seed = e.data[2];
        let world_id = e.data[3];
        return await importModules(args.id, seed, world_id);
    }
    switch(cmd) {
        case 'createChunk': {
            if(!world.chunks.has(args.addr)) {
                let ci = world.createChunk(args);
                postMessage(['blocks_generated', ci]);
            }
            break;
        }
        case 'destructChunk': {
            world.destructChunk(args.addr);
            break;
        }
        case 'buildVertices': {
            let result = [];
            for(let addr of args.addrs) {
                let chunk = world.chunks.get(addr);
                if(chunk) {
                    // 4. Rebuild vertices list
                    result.push(buildVertices(chunk, true));
                    chunk.vertices = null;
                }
            }
            postMessage(['vertices_generated', result]);
            break;
        }
        case 'setBlock': {
            let result = [];
            for(let m of args) {
                // 1. Get chunk
                let chunk = world.chunks.get(m.addr);
                if(chunk) {
                    // 2. Set block
                    if(m.type) {
                        chunk.setBlock(m.x, m.y, m.z, m.type, m.is_modify, m.power, m.rotate, null, m.extra_data);
                    }
                    let pos = new Vector(m.x - chunk.coord.x, m.y - chunk.coord.y, m.z - chunk.coord.z);
                    // 3. Clear vertices for block and around near
                    chunk.setDirtyBlocks(pos);
                    // 4. Rebuild vertices list
                    result.push(buildVertices(chunk, false));
                    chunk.vertices = null;
                }
            }
            // 5. Send result to chunk manager
            postMessage(['vertices_generated', result]);
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

// Rebuild vertices list
function buildVertices(chunk, return_map) {
    chunk.dirty = true;
    chunk.timers.build_vertices = performance.now();
    chunk.buildVertices();
    chunk.timers.build_vertices = Math.round((performance.now() - chunk.timers.build_vertices) * 1000) / 1000;
    let resp = {
        key:                    chunk.key,
        addr:                   chunk.addr,
        vertices:               chunk.vertices,
        gravity_blocks:         chunk.gravity_blocks,
        fluid_blocks:           chunk.fluid_blocks,
        timers:                 chunk.timers,
        tm:                     chunk.tm,
        lightmap:               chunk.lightmap
    };
    if(return_map) {
        resp.map = chunk.map.info;
    }
    return resp;
}