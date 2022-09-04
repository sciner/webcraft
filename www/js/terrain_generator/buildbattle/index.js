import {IndexedColor, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {alea, Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell} from "../default.js";

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
        // Init palette blocks
        this.blocks1 = [];
        for(let b of BLOCK.getAll()) {
            if ((b.name.indexOf('_TERRACOTTA') >= 0 && b.name.indexOf('_GLAZED') < 0) || b.name.indexOf('_WOOL') >= 0) {
                this.blocks1.push(b);
            }
        }
    }

    async init() {}

    /**
     * setSeed
     * @param { string } seed
     */
    setSeed(seed) {
    }

    /**
     *
     * @param { Chunk } chunk
     * @returns
     */
    generate(chunk) {

        if(chunk.addr.y < 10000 && chunk.addr.x < 5 && chunk.addr.x > -5  && chunk.addr.z < 5 && chunk.addr.z > -5) {

            const seed                  = chunk.addr.sub(new Vector(0, chunk.addr.y, 0)).toString();
            let aleaRandom              = new alea(seed);


            // ЖД через каждые 9 кварталов
            if(chunk.addr.x % 10 == 0) {

                // только на первом уровне
                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            if(x == 0 || x >= 14) {
                                this.setBlock(chunk, x, 0, z, BLOCK.BEDROCK, false);
                            } else if (x == 1 || x == 13) {
                                this.setBlock(chunk, x, 0, z, BLOCK.STONE, false);
                            } else if(x) {
                                this.setBlock(chunk, x, 0, z, BLOCK.GRASS_BLOCK, false);
                            }
                        }
                    }


                }

            } else {

                // Этажи pods
                let levels = aleaRandom.double() * 10 + 4;
                if(levels > 8) {
                    levels = aleaRandom.double() * 10 + 4;
                }
                levels |= 0;
                if(aleaRandom.double() < .1) {
                    levels = -1;
                }
                let H = 1;

                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            for (let y = 0; y < 1; y++) {
                                if (x > 0 && x < 14 && z > 1 && z < 15) {
                                    // территория строений
                                    // трава
                                    if (x >= 2 && x <= 12 && z >= 3 && z <= 13) {
                                        this.setBlock(chunk, x, y, z, BLOCK.GRASS_BLOCK, false);
                                    } else {
                                        this.setBlock(chunk, x, y, z, BLOCK.STONE, false);
                                    }
                                } else {
                                    // дороги вокруг дома
                                    this.setBlock(chunk, x, y, z, BLOCK.BEDROCK, false);
                                }
                            }
                        }
                    }

                

                }


            }
        }

        const cell = {dirt_color: new IndexedColor(82, 450, 0), biome: new Default_Terrain_Map_Cell({
            code: 'City'
        })};

        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LINE: 63},
            Array(chunk.size.x * chunk.size.z).fill(cell)
        );

    }

}
