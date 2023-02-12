import { IndexedColor } from '../../helpers.js';
import { DungeonGenerator } from '../dungeon.js';
import { Default_Terrain_Generator } from '../default.js';
import { BLOCK } from '../../blocks.js';
import { alea } from "../default.js";

export default class MineGenerator2 extends Default_Terrain_Generator {

    constructor(world, seed, world_id, options) {
        super(seed, world_id, options);
        this.s = seed;
        this.aleaRandom = new alea(seed);
        this.setSeed(seed);
        this.dungeon = new DungeonGenerator(seed);
    }

    async init() {}

    generate(chunk) {
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

        return {
            id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
            blocks: {},
            seed:   chunk.seed,
            addr:   addr,
            size:   size,
            coord:  addr.mul(size),
            cells:  Array(chunk.size.x * chunk.size.z).fill(cell),
            options: {
                WATER_LINE: 63, // Ватер-линия
            }
        };

    }
}