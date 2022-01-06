import {Color, Vector} from '../../helpers.js';
import {BLOCK} from '../../blocks.js';
import {alea, Default_Terrain_Generator} from "../default.js";

export default class Terrain_Generator extends Default_Terrain_Generator {

    constructor(seed, world_id) {
        super();
        this.setSeed(0);
        // Init palette blocks
        this.blocks1 = [];
        for(let b of BLOCK.list.values()) {
            if (b.name.substring(0, 4) === 'TERR' || b.name.substring(0, 4) === 'WOOL') {
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

        if(chunk.addr.y < 10000) {

            const seed                  = chunk.addr.sub(new Vector(0, chunk.addr.y, 0)).toString();
            let aleaRandom              = new alea(seed);

            let BRICK   = BLOCK.BRICK;
            let GLASS   = BLOCK.GLASS;
            let LIGHT   = BLOCK.GLOWSTONE;
            const wnd   = [0, 0, 0, 0, 0, 0, 0, 0, 0];

            let r = aleaRandom.double();
            if(r < .2) {
                BRICK = BLOCK.CONCRETE;
            } else if (r < .4) {
                BRICK = BLOCK.STONE_BRICK;
            }

            // ЖД через каждые 9 кварталов
            if(chunk.addr.x % 10 == 0) {

                // только на первом уровне
                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            if(x == 0 || x >= 14) {
                                this.setBlock(chunk, x, 0, z, BLOCK.BEDROCK, false);
                            } else if (x == 1 || x == 13) {
                                this.setBlock(chunk, x, 0, z, BLOCK.CONCRETE, false);
                            } else if(x) {
                                this.setBlock(chunk, x, 0, z, BLOCK.DIRT, false);
                            }
                        }
                    }

                    // ЖД
                    for(let z = 0; z < chunk.size.z; z++) {
                        // рельсы
                        this.setBlock(chunk, 7, 12, z, BLOCK.OAK_PLANK, false);
                        // по краям рельс
                        this.setBlock(chunk, 6, 12, z, BLOCK.STONE_BRICK, false);
                        this.setBlock(chunk, 7, 12, z, BLOCK.STONE_BRICK, false);
                        // шпалы
                        if(z % 2 == 0) {
                            for(let a of [4, 5, 6, 7, 8, 9]) {
                                this.setBlock(chunk, a, 12 + 1, z, BLOCK.CONCRETE, false);
                            }
                        }
                        // рельсы
                        for(let y = 14; y < 15; y++) {
                            this.setBlock(chunk, 5, y, z, BLOCK.WOOL_BLACK, false);
                            this.setBlock(chunk, 8, y, z, BLOCK.WOOL_BLACK, false);
                        }
                        // столбы
                        if(z == 4) {
                            for(let y = 0; y < 12; y++) {
                                this.setBlock(chunk, 5, y, z, BLOCK.STONE_BRICK, false);
                                this.setBlock(chunk, 8, y, z, BLOCK.STONE_BRICK, false);
                            }
                        }
                    }

                    // разметка
                    for(let x = 1; x < chunk.size.z-2; x += 2) {
                        this.setBlock(chunk, 15, 0, x + 1, BLOCK.SNOW_BLOCK, false);
                    }

                }

            } else {

                // Этажи
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
                                        this.setBlock(chunk, x, y, z, BLOCK.DIRT, false);
                                    } else {
                                        this.setBlock(chunk, x, y, z, BLOCK.CONCRETE, false);
                                    }
                                } else {
                                    // дороги вокруг дома
                                    this.setBlock(chunk, x, y, z, BLOCK.BEDROCK, false);
                                }
                            }
                        }
                    }

                    // Разметка
                    for(let v = 1; v < chunk.size.z - 2; v += 2) {
                        this.setBlock(chunk, v, 0, 0, BLOCK.SNOW_BLOCK, false);
                        this.setBlock(chunk, 15, 0, v + 1, BLOCK.SNOW_BLOCK, false);
                        // Тачка
                        let carColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            this.setBlock(chunk, 6, 1, 0, BLOCK.CONCRETE, false);
                            this.setBlock(chunk, 8, 1, 0, BLOCK.CONCRETE, false);
                            for(let cv = 5; cv < 10; cv++) {
                                this.setBlock(chunk, cv, 2, 0, carColor, false);
                            }
                            this.setBlock(chunk, 6, 3, 0, BLOCK.GLASS, false);
                            this.setBlock(chunk, 7, 3, 0, BLOCK.GLASS, false);
                            this.setBlock(chunk, 8, 3, 0, BLOCK.GLASS, false);
                        }
                        // Тачка 2
                        carColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            this.setBlock(chunk, 15, 1, 6, BLOCK.CONCRETE, false);
                            this.setBlock(chunk, 15, 1, 8, BLOCK.CONCRETE, false);
                            for(let cv = 5; cv < 10; cv++) {
                                this.setBlock(chunk, 15, 2, cv, carColor, false);
                            }
                            this.setBlock(chunk, 15, 3, 6, BLOCK.GLASS, false);
                            this.setBlock(chunk, 15, 3, 7, BLOCK.GLASS, false);
                            this.setBlock(chunk, 15, 3, 8, BLOCK.GLASS, false);
                        }
                    }

                    // Парк (дерево)
                    if (levels < 0 || aleaRandom.double() < .05) {
                        let y = 1;
                        for(let x = 3; x <= 11; x++) {
                            for(let z = 4; z <= 12; z++) {
                                this.setBlock(chunk, x, y, z, BLOCK.DIRT, false);
                            }
                        }
                        this.plantTree({
                                height: (aleaRandom.double() * 4 | 0) + 5,
                                type: {
                                    style: 'wood',
                                    trunk: BLOCK.SPRUCE_TRUNK.id,
                                    leaves: BLOCK.SPRUCE_LEAVES.id,
                                    height: 7
                                }
                            },
                            chunk,
                            5 + (aleaRandom.double() * 4 | 0), H + 1, 5 + (aleaRandom.double() * 4 | 0)
                        );
                    }

                }

                // Здание
                if(levels > 0) {
                    aleaRandom = new alea(seed);
                    let mainColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                    let y = 1;
                    for(let level = 1; level <= levels; level++) {
                        let h = (aleaRandom.double() * 2 | 0) + 3; // высота комнаты
                        if(level == levels) {
                            h = 0;
                        }
                        // Межэтажные перекрытия
                        if(y - chunk.coord.y >= 0 && y - chunk.coord.y < chunk.size.y) {
                            for(let x = 2; x <= 12; x++) {
                                for (let z = 3; z <= 13; z++) {
                                    this.setBlock(chunk, x, y - chunk.coord.y, z, mainColor, false);
                                }
                            }
                        }
                        // Остекление и стены
                        if(level < levels) {
                            // если это потолок последнего этажа, то стены не нужны
                            for(let i = 0; i < 12; i++) {
                                wnd[i] = aleaRandom.double() * 12 < 1.0 ? LIGHT : null;
                            }
                            if (aleaRandom.double() < .1) {
                                mainColor = this.blocks1[(aleaRandom.double() * this.blocks1.length | 0)];
                            }
                            for(let y_abs = y + 1; y_abs <= y + h; y_abs++) {
                                if(y_abs < chunk.coord.y || y_abs >= chunk.coord.y + chunk.size.y) {
                                    continue;
                                }
                                let y = y_abs - chunk.coord.y;
                                for(let x = 0; x <= 10; x++) {
                                    let b = -1;
                                    if (x > 0 && x < 3) b = 0;
                                    if (x > 3 && x < 7) b = 1;
                                    if (x > 7 && x < 10) b = 2;
                                    this.setBlock(chunk, x + 2, y, 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, x + 2, y, 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, x + 2, y, 13, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, 2, y, x + 3, b >= 0 ? GLASS : BRICK, false);
                                    this.setBlock(chunk, 12, y, x + 3, b >= 0 ? GLASS : BRICK, false);
                                    if (b > 0 && x > 0 && x < 10) {
                                        // chunk.blocks[x + 2][4][y] ||= wnd[b * 4 + 0];
                                        // chunk.blocks[x + 2][12][y] ||= wnd[b * 4 + 1];
                                        // chunk.blocks[3][x + 3][y] ||= wnd[b * 4 + 2];
                                        // chunk.blocks[11][x + 3][y] ||= wnd[b * 4 + 3];
                                        // this.setBlock(chunk, x + 2, y, 4, wnd[b * 4 + 0], false);
                                        // this.setBlock(chunk, x + 2, y, 12, wnd[b * 4 + 1], false);
                                        // this.setBlock(chunk, 3,     y, x + 3, wnd[b * 4 + 2], false);
                                        // this.setBlock(chunk, 11,    y, x + 3, wnd[b * 4 + 3], false);
                                    }
                                }
                            }
                        }
                        y += h + 1;
                    }
                    // Строения на крыше
                    if(y - chunk.coord.y >= 0 && y - chunk.coord.y < chunk.size.y) {
                        for(let sz of [1, 2, 2]) {
                            let ceil_x = 3 + parseInt(aleaRandom.double() * 8);
                            let ceil_z = 4 + parseInt(aleaRandom.double() * 8);
                            for(let i = 0; i < sz; i++) {
                                for(let j = 0; j < sz; j++) {
                                    this.setBlock(chunk, ceil_x + i, y - chunk.coord.y, ceil_z + j, mainColor, false);
                                }
                            }
                        }
                    }
                }

            }
        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'City'}};
        let cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        let addr = chunk.addr;
        let size = chunk.size;

        return {
            chunk: {
                id:     [addr.x, addr.y, addr.z, size.x, size.y, size.z].join('_'),
                blocks: {},
                seed:   chunk.seed,
                addr:   addr,
                size:   size,
                coord:  addr.mul(size),
            },
            options: {
                WATER_LINE: 63, // Ватер-линия
            },
            info: {
                cells: cells
            }
        };

    }

}