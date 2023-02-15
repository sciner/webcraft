class ChunkWorkerRoot {
    RAF_MS = 20;
    blockManager = null;
    Helpers = null;
    WorkerWorldManager = null;
    BuildingTemplate = null;
    worlds = null;
    drop_item_meshes = [];
    bulding_schemas = [];
    parentPort = null;
    world = null;
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
        }
        else {
            onmessage = this.onMessageFunc;
        }
    }
    postMessage(message) {
        if (this.parentPort) {
            this.parentPort.postMessage(message);
        }
        else {
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
        await import('./resources.js').then(async (module) => {
            await module.Resources.loadBBModels();
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
            globalThis.BLOCK = this.blockManager = module.BLOCK;
            // return BLOCK.init(settings);
        });
        console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
    }
    async initWorld(generator, world_seed, world_guid, settings, cache) {
        if (cache) {
            this.Helpers.setCache(cache);
        }
        // legacy
        if (!this.blockManager) {
            await this.preLoad();
        }
        await this.blockManager.init(settings);
        //
        this.worlds = new this.WorkerWorldManager(this.blockManager);
        await this.worlds.InitTerrainGenerators([generator.id]);
        // bulding_schemas
        if (this.bulding_schemas.length > 0) {
            while (this.bulding_schemas.length > 0) {
                const schema = this.bulding_schemas.shift();
                this.BuildingTemplate.addSchema(schema, this.blockManager);
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
            this.worlds.process({ maxMs: this.RAF_MS });
        }
        catch (e) {
            console.error(e);
        }
        const passed = Math.ceil(performance.now() - now);
        setTimeout(this.run, Math.max(0, this.RAF_MS - passed));
    };
    onMessageFunc = async (e) => {
        let data = e;
        if (typeof e == 'object' && 'data' in e) {
            data = e.data;
        }
        const cmd = data[0];
        const args = data[1];
        if (cmd == 'init') {
            // Init modules
            return await this.initWorld(args.generator, args.world_seed, args.world_guid, args.settings, args.resource_cache);
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
                    }
                    else {
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
                }
                catch (e) {
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
                        this.BuildingTemplate.addSchema(schema);
                    }
                    else {
                        this.bulding_schemas.push(schema);
                    }
                }
                break;
            }
        }
    };
}
globalThis.QubatchChunkWorker = new ChunkWorkerRoot();
QubatchChunkWorker.init();
QubatchChunkWorker.preLoad().then();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2h1bmtfd29ya2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NodW5rX3dvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxNQUFNLGVBQWU7SUFDakIsTUFBTSxHQUFHLEVBQUUsQ0FBQTtJQUNYLFlBQVksR0FBRyxJQUFJLENBQUE7SUFDbkIsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUNkLGtCQUFrQixHQUFHLElBQUksQ0FBQTtJQUN6QixnQkFBZ0IsR0FBRyxJQUFJLENBQUE7SUFDdkIsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUViLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtJQUNyQixlQUFlLEdBQUcsRUFBRSxDQUFBO0lBQ3BCLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFDakIsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUVaO0lBQ0EsQ0FBQztJQUVELElBQUk7UUFDQSxJQUFJLE9BQU8sT0FBTyxLQUFLLFdBQVcsRUFBRTtZQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN4QyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQztZQUNwRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ25DLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDbEQsaURBQWlEO2dCQUNqRCwwREFBMEQ7WUFDOUQsQ0FBQyxDQUFDLENBQUM7U0FDTjthQUFNO1lBQ0gsU0FBUyxHQUFHLElBQUks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