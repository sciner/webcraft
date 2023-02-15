import { IndexedColor } from '../../helpers.js';
import { DungeonGenerator } from '../dungeon.js';
import { Default_Terrain_Generator, Default_Terrain_Map } from '../default.js';
import { BLOCK } from '../../blocks.js';
import { alea } from "../default.js";
import type { ChunkWorkerChunk } from '../../worker/chunk.js';
import type { WorkerWorld } from '../../worker/world.js';

export default class MineGenerator2 extends Default_Terrain_Generator {
    [key: string]: any;

    constructor(world : WorkerWorld, seed : string, world_id : string, options) {
        super(seed, world_id, options);
        this.s = seed;
        this.aleaRandom = new alea(seed);
        this.setSeed(seed);
        this.dungeon = new DungeonGenerator(seed);
    }

    async init() {
        return super.init()
    }

    generate(chunk : ChunkWorkerChunk) : Default_Terrain_Map {
        const aleaRandom = new alea(this.s + chunk.addr.toString());
        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    for(let y = 0; y <= 100; y++) {
                        this.setBlock(chunk, x, y, z, aleaRandom.double() > 0.8 ? BLOCK.DIRT : BLOCK.AIR);
                    }
                }
            }
        }

        this.dungeon.add(chunk);

        const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: {
            code: 'Flat'
        }};

        let addr = chunk.addr;
        let size = chunk.size;

        return new Default_Terrain_Map(addr, size, addr.mul(size), {WATER_LINE: 63}, Array(chunk.size.x * chunk.size.z).fill(cell))

    }
}