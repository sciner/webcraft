import {blocks} from '../biomes.js';
import { Color } from '../helpers.js';

export default class Terrain_Generator {

    constructor() {
        this.seed = 0;
    }


    setSeed(seed) {
    }

    generate(chunk) {
        for(let x = 0; x < chunk.size.x; x++) {
            for(let z = 0; z < chunk.size.z; z++) {
                // AIR
                chunk.blocks[x][z] = Array(chunk.size.y).fill(null);
                // BEDROCK
                for(let y = 0; y < 1; y++) {
                    chunk.blocks[x][z][y] = blocks.BEDROCK;
                }

            }
        }

        let biome = {};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(biome));

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