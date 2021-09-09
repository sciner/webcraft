import {blocks} from '../../biomes.js';
import {Color, Vector} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';
import {BLOCK} from '../../blocks.js';

export default class Terrain_Generator {

    constructor() {
        this.seed = 0;
        //
        const blocks = this.blocks1 = [];
        for(let key in BLOCK) {
            if (key.substring(0, 4) === 'TERR' || key.substring(0, 4) === 'WOOL') {
                blocks.push(BLOCK[key]);
            }
        }
        //
        for(let key of Object.keys(blocks)) {
            let b = blocks[key];
            b = {...b};
            delete(b.texture);
            blocks[key] = b;
        }
    }

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
            const { blocks1 }           = this;

            let BRICK   = blocks.BRICK;
            let GLASS   = blocks.GLASS;
            let LIGHT   = blocks.GLOWSTONE;
            const wnd   = [0, 0, 0, 0, 0, 0, 0, 0, 0];

            let r = aleaRandom.double();
            if(r < .2) {
                BRICK = blocks.CONCRETE;
            } else if (r < .4) {
                BRICK = blocks.STONE_BRICK;
            }

            // ЖД через каждые 9 кварталов
            if(chunk.addr.x % 10 == 0) {

                // только на первом уровне
                if(chunk.addr.y == 0) {

                    for(let x = 0; x < chunk.size.x; x++) {
                        for (let z = 0; z < chunk.size.z; z++) {
                            if(x == 0 || x >= 14) {
                                chunk.blocks[x][z][0] = blocks.BEDROCK;
                            } else if (x == 1 || x == 13) {
                                chunk.blocks[x][z][0] = blocks.CONCRETE;
                            } else if(x) {
                                chunk.blocks[x][z][0] = blocks.DIRT;
                            }
                        }
                    }

                    // ЖД
                    for(let z = 0; z < chunk.size.z; z++) {
                        // рельсы
                        chunk.blocks[7][z][12] = blocks.OAK_PLANK;
                        // по краям рельс
                        chunk.blocks[6][z][12] = blocks.STONE_BRICK;
                        chunk.blocks[7][z][12] = blocks.STONE_BRICK;
                        // шпалы
                        if(z % 2 == 0) {
                            for(let a of [4, 5, 6, 7, 8, 9]) {
                                chunk.blocks[a][z][12 + 1] = blocks.CONCRETE;
                            }
                        }
                        // рельсы
                        for(let y = 14; y < 15; y++) {
                            chunk.blocks[5][z][y] = blocks.WOOL_BLACK;
                            chunk.blocks[8][z][y] = blocks.WOOL_BLACK;
                        }
                        // столбы
                        if(z == 4) {
                            for(let y = 0; y < 12; y++) {
                                chunk.blocks[5][z][y] = blocks.STONE_BRICK;
                                chunk.blocks[8][z][y] = blocks.STONE_BRICK;
                            }
                        }
                    }

                    // разметка
                    for(let x = 1; x < chunk.size.z-2; x += 2) {
                        chunk.blocks[15][x + 1][0] = blocks.SNOW_BLOCK;
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
                                        chunk.blocks[x][z][y] = blocks.DIRT;
                                    } else {
                                        chunk.blocks[x][z][y] = blocks.CONCRETE;
                                    }
                                } else {
                                    // дороги вокруг дома
                                    chunk.blocks[x][z][y] = blocks.BEDROCK;
                                }
                            }
                        }
                    }

                    // Разметка
                    for(let v = 1; v < chunk.size.z - 2; v += 2) {
                        chunk.blocks[v][0][0] = blocks.SNOW_BLOCK;
                        chunk.blocks[15][v + 1][0] = blocks.SNOW_BLOCK;
                        // Тачка
                        let carColor = blocks1[(aleaRandom.double() * blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            chunk.blocks[6][0][1] = blocks.CONCRETE;
                            chunk.blocks[8][0][1] = blocks.CONCRETE;
                            for(let cv = 5; cv < 10; cv++) {
                                chunk.blocks[cv][0][2] = carColor;
                            }
                            chunk.blocks[6][0][3] = blocks.GLASS;
                            chunk.blocks[7][0][3] = blocks.GLASS;
                            chunk.blocks[8][0][3] = blocks.GLASS;
                        }
                        // Тачка 2
                        carColor = blocks1[(aleaRandom.double() * blocks1.length | 0)];
                        if(aleaRandom.double() < .1) {
                            chunk.blocks[15][6][1] = blocks.CONCRETE;
                            chunk.blocks[15][8][1] = blocks.CONCRETE;
                            for(let cv = 5; cv < 10; cv++) {
                                chunk.blocks[15][cv][2] = carColor;
                            }
                            chunk.blocks[15][6][3] = blocks.GLASS;
                            chunk.blocks[15][7][3] = blocks.GLASS;
                            chunk.blocks[15][8][3] = blocks.GLASS;
                        }
                    }

                    // Парк (дерево)
                    if (levels < 0 || aleaRandom.double() < .05) {
                        let y = 1;
                        for(let x = 3; x <= 11; x++) {
                            for(let z = 4; z <= 12; z++) {
                                chunk.blocks[x][z][y] = blocks.DIRT;
                            }
                        }
                        this.plantTree({
                                height: (aleaRandom.double() * 4 | 0) + 5,
                                type: {
                                    trunk: blocks.SPRUCE,
                                    leaves: blocks.SPRUCE_LEAVES,
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
                    let mainColor = blocks1[(aleaRandom.double() * blocks1.length | 0)];
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
                                    chunk.blocks[x][z][y - chunk.coord.y] = mainColor;
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
                                mainColor = blocks1[(aleaRandom.double() * blocks1.length | 0)];
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
                                    chunk.blocks[x + 2][3][y] = b >= 0 ? GLASS : BRICK;
                                    chunk.blocks[x + 2][13][y] = b >= 0 ? GLASS: BRICK;
                                    chunk.blocks[2][x + 3][y] = b >= 0 ? GLASS: BRICK;
                                    chunk.blocks[12][x + 3][y] = b >= 0 ? GLASS: BRICK;
                                    if (b > 0 && x > 0 && x < 10) {
                                        chunk.blocks[x + 2][4][y] ||= wnd[b * 4 + 0];
                                        chunk.blocks[x + 2][12][y] ||= wnd[b * 4 + 1];
                                        chunk.blocks[3][x + 3][y] ||= wnd[b * 4 + 2];
                                        chunk.blocks[11][x + 3][y] ||= wnd[b * 4 + 3];
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
                                    chunk.blocks[ceil_x + i][ceil_z + j][y - chunk.coord.y] = mainColor;
                                }
                            }
                        }
                    }
                }

            }
        }

        let cell = {biome: {dirt_color: new Color(980 / 1024, 980 / 1024, 0, 0), code: 'City'}};
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

    plantTree(options, chunk, x, y, z) {
        const height        = options.height;
        const type        = options.type;
        let ystart = y + height;
        // ствол
        for(let p = y; p < ystart; p++) {
            if(chunk.getBlock(x + chunk.coord.x, p + chunk.coord.y, z + chunk.coord.z).id >= 0) {
                if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
                    chunk.blocks[x][z][p] = type.trunk;
                }
            }
        }
        // дуб, берёза
        let py = y + height;
        for(let rad of [1, 1, 2, 2]) {
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                        let m = (i == x - rad && j == z - rad) ||
                            (i == x + rad && j == z + rad) ||
                            (i == x - rad && j == z + rad) ||
                            (i == x + rad && j == z - rad);
                        let m2 = (py == y + height) ||
                            (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                        if(m && m2) {
                            continue;
                        }
                        let b = chunk.blocks[i][j][py];
                        if(!b || b.id >= 0 && b.id != type.trunk.id) {
                            chunk.blocks[i][j][py] = type.leaves;
                        }
                    }
                }
            }
            py--;
        }
    }

}
