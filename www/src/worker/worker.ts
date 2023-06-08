/// <reference path="../worker/messages.d.ts" />
import type { IWorkerChunkCreateArgs } from './chunk.js'

export class ChunkWorkerRoot {
    RAF_MS = 20
    blockManager = null
    Helpers = null
    WORKER_MESSAGE = null
    WorkerWorldManager = null
    BuildingTemplate = null
    worlds = null

    drop_item_meshes = []
    bulding_schemas = []
    parentPort = null
    world = null

    constructor() {
    }

    init(missed_messages : any[]) {

        if (typeof process !== 'undefined') {
            import('fs').then(fs => global.fs = fs)
            import('path').then(module => global.path = module)
            import('worker_threads').then(module => {
                this.parentPort = module.parentPort
                this.parentPort.on('message', this.onMessageFunc)
            })
        } else {
            onmessage = this.onMessageFunc
            // process missed messages
            while(missed_messages.length > 0) {
                this.onMessageFunc(missed_messages.shift())
            }
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

        try {
            await import('../helpers.js').then(module => {
                this.Helpers = module.Helpers;
            });
            await import('../constant.js').then(module => {
                this.WORKER_MESSAGE = module.WORKER_MESSAGE;
            });

            await import('../terrain_generator/cluster/building_template.js').then(module => {
                this.BuildingTemplate = module.BuildingTemplate;
            });

            await import('../resources.js').then(async module => {
                await module.Resources.loadBBModels()
            });

            // load font
            if (typeof process == 'undefined') {
                await import('../../data/font.js').then(module => {
                    globalThis.alphabet = module;
                });
            }
            // load module
            await import('../worker/world.js').then(module => {
                this.WorkerWorldManager = module.WorkerWorldManager;
            });
            // load module
            await import('../blocks.js').then(module => {
                this.blockManager = module.BLOCK;
                (globalThis as any).BLOCK = this.blockManager;
                // return BLOCK.init(settings);
            });
        } catch (e) {
            console.error('Error in chunkWorker init', e);
        }

        console.debug('[ChunkWorker] Preloaded, load time:', performance.now() - start);
    }

    async initWorld(generator: TGeneratorInfo, world_seed: string, world_guid: string,
                    settings: TBlocksSettings, cache: Map<any, any>, is_server: boolean,
                    tech_info: TWorldTechInfo
    ) {
        if (cache) {
            this.Helpers.setCache(cache);
        }

        // legacy
        if (!this.blockManager) {
            await this.preLoad();
        }

        // load terrain generator while initializing blockManager
        const terrainGeneratorsPromise = this.WorkerWorldManager.loadTerrainGenerators([generator.id])

        try {
            await this.blockManager.init(settings);
            //
            const terrainGenerators = await terrainGeneratorsPromise;
            this.worlds = new this.WorkerWorldManager(this.blockManager, terrainGenerators, is_server);

            // bulding_schemas
            if (this.bulding_schemas.length > 0) {
                while (this.bulding_schemas.length > 0) {
                    const schema = this.bulding_schemas.shift()
                    this.BuildingTemplate.addSchema(schema, this.blockManager)
                }
            }

            this.world = await this.worlds.add(generator, world_seed, world_guid, settings, tech_info)
            // Worker inited
            this.postMessage(['world_inited', null]);

            setTimeout(this.run, 0);
        } catch (e) {
            console.error('Error in chunkWorker initWorld', e);
        }
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
        /** Its type is {@link } */
        const args = data[1];
        if (cmd == 'init') { // this.WORKER_MESSAGE.INIT_CHUNK_WORKER
            // Init modules
            const msg: TChunkWorkerMessageInit = args
            return await this.initWorld(
                msg.generator,
                msg.world_seed,
                msg.world_guid,
                msg.settings,
                msg.resource_cache,
                msg.is_server,
                msg.world_tech_info
            );
        }
        const world = this.world;
        switch (cmd) {
            case 'createChunk': {
                for (let i = 0; i < args.length; i++) {
                    const item = args[i] as IWorkerChunkCreateArgs
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
                        const non_zero = chunk.refreshNonZero();
                        const msg: TChunkWorkerMessageBlocksGenerated = {
                            addr: chunk.addr,
                            uniqId: item.uniqId,
                            tblocks: non_zero > 0 ? chunk.tblocks.saveState() : null,
                            packedCells: chunk.packCells(),
                            tickers: non_zero ? chunk.scanTickingBlocks() : null
                        }
                        this.postMessage(['blocks_generated', msg]);
                    } else {
                        world.createChunk(item);
                    }
                }
                break;
            }
            case 'destructChunk': {
                // console.debug('Worker destructChunk:', args.length);
                world.destructMultiple(args);
                break;
            }
            case 'destroyMap': {
                world.generator.destroyMapsAroundPlayers(args.players as IDestroyMapsAroundPlayers[])
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
                            (world.chunks as any).buildQueue?.push(chunk);
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