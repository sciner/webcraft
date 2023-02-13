class ChunkWorkerRoot {
    RAF_MS = 20
    Helpers = null
    WorkerWorldManager = null
    BuildingTemplate = null
    worlds = null

    drop_item_meshes = []
    bulding_schemas = []
    parentPort = null
    world = null

    constructor() {
    }

    init() {
        if (typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs);
            import('path').then(module => global.path = module);
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort;
                this.parentPort.on('message', this.onMessageFunc);
                //options.context.parentPort = module.parentPort;
                //options.context.parentPort.on('message', onMessageFunc);
            });
        } else {
            onmessage = this.onMessageFunc
        }
    }

    postMessage(message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        } else {
            postMessage(message);
        }
    }

    _preloadPromise = null;
    preLoad() {
        return this._preloadPromise = (this._preloadPromise || this._preLoad());
    }

    async _preLoad() {
        const start = performance.now();

        await import('./helpers.js').then(module => {
            this.Helpers = module.Helpers;
        });

        await import('./terrain_generator/cluster/building_template.js').then(module => {
            this.BuildingTemplate = module.BuildingTemplate;
        });

        await import('./resources.js').then(async module => {
            await module.Resources.loadBBModels()
        });

        // load font
        if (typeof process == 'undefined') {
            await import('../data/font.js').then(module => {
                globalThis.alphabet = module;
            });
        }
        // load module
        await import('./worker/world.js').then(module => {
            this.WorkerWorldManager = module.WorkerWorldManager;
        });
        // load module
        await import('./blocks.js').then(module => {
            globalThis.BLOCK = module.BLOCK;
            // return BLOCK.init(settings);
        });

        console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
    }

    async initWorld(generator, world_seed, world_guid, settings, cache) {
        if (cache) {
            this.Helpers.setCache(cache);
        }

        // legacy
        if (!globalThis.BLOCK) {
            await this.preLoad();
        }

        await globalThis.BLOCK.init(settings);
        //
        this.worlds = new this.WorkerWorldManager(globalThis.BLOCK);
        await this.worlds.InitTerrainGenerators([generator.id]);

        // bulding_schemas
        if (this.bulding_schemas.length > 0) {
            while (this.bulding_schemas.length > 0) {
                const schema = this.bulding_schemas.shift()
                this.BuildingTemplate.addSchema(schema, globalThis.BLOCK)
            }
        }

        this.world = await this.worlds.add(generator, world_seed, world_guid);
        // Worker inited
        this.postMessage(['world_inited', null]);

        setTimeout(this.run, 0);
    }

    run = () => {
        const now = performance.now();
        try {
            this.worlds.process({maxMs: this.RAF_MS});
        } catch (e) {
            console.error(e);
        }
        const passed = Math.ceil(performance.now() - now);
        setTimeout(this.run, Math.max(0, this.RAF_MS - passed));
    }

    onMessageFunc = async (e) => {
        let data = e;
        if (typeof e == 'object' && 'data' in e) {
            data = e.data;
        }
        const cmd = data[0];
        const args = data[1];
        if (cmd == 'init') {
            // Init modules
            return await this.initWorld(
                args.generator,
                args.world_seed,
                args.world_guid,
                args.settings,
                args.resource_cache
            );
        }
        const world = this.world;
        switch (cmd) {
            case 'createChunk': {
                for (let i = 0; i < args.length; i++) {
                    const item = args[i];
                    // console.log('3. createChunk: receive', new Vector(item.addr).toHash());
                    let from_cache = world.chunks.has(item.addr);
                    const update = ('update' in item) && item.update;
                    if (update) {
                        if (from_cache) {
                            world.chunks.delete(item.addr);
                            from_cache = false;
                        }
                    }
                    if (from_cache) {
                        const chunk = world.chunks.get(item.addr);
                        chunk.uniqId = item.uniqId;
                        const non_zero = chunk.tblocks.refreshNonZero();
                        this.postMessage(['blocks_generated', {
                            key: chunk.key,
                            addr: chunk.addr,
                            uniqId: item.uniqId,
                            tblocks: non_zero > 0 ? chunk.tblocks.saveState() : null,
                            ticking_blocks: Array.from(chunk.ticking_blocks.keys()),
                            packedCells: chunk.packCells()
                        }]);
                    } else {
                        world.createChunk(item);
                    }
                }
                break;
            }
            case 'destructChunk': {
                console.debug('Worker destructChunk:', args.length);
                for (let props of args) {
                    world.destructChunk(props);
                }
                break;
            }
            case 'destroyMap': {
                if (world.generator.maps) {
                    world.generator.maps.destroyAroundPlayers(args.players);
                }
                break;
            }
            case 'buildVertices': {
                for (let ind = 0; ind < args.addrs.length; ind++) {
                    const addr = args.addrs[ind];
                    const dataOffset = args.offsets[ind];
                    const chunk = world.chunks.get(addr);
                    if (chunk) {
                        chunk.dataOffset = dataOffset;

                        if (!chunk.buildVerticesInProgress) {
                            world.chunks.buildQueue?.push(chunk);
                        }
                    }
                }
                break;
            }
            case 'setBlock': {
                world.workerSetBlock(args);
                break;
            }
            case 'stat': {
                try {
                    console.table({
                        maps_cache_count: world.generator.maps_cache.size,
                        maps_cache_size: JSON.stringify(world.generator.maps_cache).length / 1024 / 1024,
                        chunks_count: world.chunks.size,
                    });
                } catch (e) {
                    console.error(e);
                }
                break;
            }
            case 'setDropItemMeshes': {
                this.drop_item_meshes = args;
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
            case 'setPotentialCenter': {
                if (args.pos) {
                    world.workerSetPotential(args.pos);
                }
                break;
            }
            case 'buildingSchemaAdd': {
                for (let schema of args.list) {
                    if (this.world) {
                        this.BuildingTemplate.addSchema(schema)
                    } else {
                        this.bulding_schemas.push(schema)
                    }
                }
                break
            }
        }
    }
}

(globalThis as any).QubatchChunkWorker = new ChunkWorkerRoot();
QubatchChunkWorker.init();
QubatchChunkWorker.preLoad().then();
