import {Color} from '../../helpers.js';
import { Default_Terrain_Generator } from '../default.js';
import {BLOCK} from '../../blocks.js';

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super();
        this.setSeed(0);
    }

    generate(chunk) {

        let b = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.BEDROCK : BLOCK.SAND;

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    // BEDROCK
                    for(let y = 0; y < 1; y++) {
                        this.setBlock(chunk, x, y, z, b, false);
                    }
                }
            }
        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'Flat'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        return {
            chunk: chunk,
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };

    }

}