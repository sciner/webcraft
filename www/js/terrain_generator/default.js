import {Color, Helpers} from '../helpers.js';
import noise from '../../vendors/perlin.js';
import {impl as alea} from '../../vendors/alea.js';
export {blocks, BIOMES} from '../biomes.js';

export {alea, noise};

export class Default_Terrain_Generator {

    constructor(seed, world_id) {
        this.voxel_buildings = [];
        this.setSeed(seed);
        this.world_id = world_id;
    }

    async setSeed(seed) {
        this.seed = seed;
        noise.seed(this.seed);
    }

    generate(chunk) {

        let b = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? blocks.BEDROCK : blocks.SAND;

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    // BEDROCK
                    for(let y = 0; y < 1; y++) {
                        chunk.blocks[x][z][y] = b;
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

    //
    getVoxelBuilding(xyz) {
        for(var vb of this.voxel_buildings) {
            if(xyz.x >= vb.coord.x && xyz.y >= vb.coord.y && xyz.z >= vb.coord.z &&
                xyz.x < vb.coord.x + vb.size.x &&
                xyz.y < vb.coord.y + vb.size.z && 
                xyz.z < vb.coord.z + vb.size.y) {
                    return vb;
                }
        }
        return null;
    }

    // setBlock
    setBlock(chunk, x, y, z, block, force_replace) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !chunk.blocks[x][z][y]) {
                let xyz = new Vector(x, y, z);
                if(!this.getVoxelBuilding(xyz.add(chunk.coord))) {
                    chunk.blocks[x][z][y] = block.id;
                }
            }
        }
    }

    // plantTree...
    plantTree(options, chunk, x, y, z) {
        const type          = options.type;
        // листва над стволом
        switch(type.style) {
            case 'cactus': {
                // кактус
                this.plantStump(options, chunk, x, y, z)
                break;
            }
            case 'stump': {
                // пенёк
                this.plantStump(options, chunk, x, y, z)
                break;
            }
            case 'wood': {
                // дуб, берёза
                this.plantOak(options, chunk, x, y, z)
                break;
            }
            case 'acacia': {
                // акация
                this.plantAcacia(options, chunk, x, y, z)
                break;
            }
            case 'spruce': {
                // ель
                this.plantSpruce(options, chunk, x, y, z)
                break;
            }
        }
    }

    // Кактус
    plantCactus(chunk, x, y, z, block, force_replace) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, options.type.trunk, true);
        }
    }

    // Пенёк
    plantStump(chunk, x, y, z, block, force_replace) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, options.type.trunk, true);
        }
        this.setBlock(chunk, x, ystart, z, options.type.leaves, true);
    }

    // Акация
    plantAcacia(options, chunk, orig_x, orig_y, orig_z) {
        let random = new alea(chunk.id + '_tree' + orig_x + 'x' + orig_z);
        let iterations = 0;
        let that = this;
        let plant = function(x, y, z, height, px, pz, rads) {
            let ystart = y + height;
            // ствол
            for(let p = y; p < ystart; p++) {
                x += px;
                z += pz;
                that.setBlock(chunk, x, p, z, options.type.trunk, true);
                let r = random.double();
                if(iterations == 0 && r < .1 && p <= y+height/2) {
                    r *= 10;
                    iterations++;
                    let px2 = r < .5 ? 1 : 0;
                    if(r < .25) px2 * -1;
                    let pz2 = r < .5 ? 0 : 1;
                    if(r < .75) pz2 * -1;
                    plant(x, p + 1, z, (r * 2 + 2) | 0, px2, pz2, [1, 2]);
                    if(r < .3) {
                        return;
                    }
                }
            }
            // листва
            let py = y + height;
            for(let rad of rads) {
                for(let i = x - rad; i <= x + rad; i++) {
                    for(let j = z - rad; j <= z + rad; j++) {
                        if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                            if(Helpers.distance(new Vector(x, 0, z), new Vector(i, 0, j)) > rad) {
                                continue;
                            }
                            let b = chunk.blocks[i][j][py];
                            let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk.id) {
                                that.setBlock(chunk, i, py, j, options.type.leaves, false);
                            }
                        }
                    }
                }
                py--;
            }
        };
        plant(orig_x, orig_y, orig_z, options.height, 0, 0, [2, 3]);
    }

    // Ель
    plantSpruce(options, chunk, x, y, z) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, options.type.trunk, true);
        }
        // листва
        let r = 1;
        let rad = Math.round(r);
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
            this.setBlock(chunk, x, ystart, z, options.type.leaves, false);
            if(options.biome_code == 'SNOW') {
                this.setBlock(chunk, x, ystart + 1, z, blocks.SNOW, false);
            }
        }
        let step = 0;
        for(let y = ystart - 1; y > ystart - (options.height - 1); y--) {
            if(step++ % 2 == 0) {
                rad = Math.min(Math.round(r), 3);
            } else {
                rad = 1;
            }
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                        if(rad == 1 || Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                            let b = chunk.getBlock(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
                            let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                            if(b_id === blocks.AIR.id) {
                                this.setBlock(chunk, i, y, j, options.type.leaves, false);
                                if(options.biome_code == 'SNOW') {
                                    this.setBlock(chunk, i, y + 1, j, blocks.SNOW, false);
                                }
                            }
                        }
                    }
                }
            }
            r += .9;
        }
    }

    // Дуб, берёза
    plantOak(options, chunk, x, y, z) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, options.type.trunk, true);
        }
        // листва
        let py = y + options.height;
        for(let rad of [1, 1, 2, 2]) {
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                        let m = (i == x - rad && j == z - rad) ||
                            (i == x + rad && j == z + rad) || 
                            (i == x - rad && j == z + rad) ||
                            (i == x + rad && j == z - rad);
                            let m2 = (py == y + options.height) ||
                            (i + chunk.coord.x + j + chunk.coord.z + py) % 3 > 0;
                        if(m && m2) {
                            continue;
                        }
                        let b = chunk.blocks[i][j][py];
                        let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk.id) {
                            this.setBlock(chunk, i, py, j, options.type.leaves, false);
                        }
                    }
                }
            }
            py--;
        }

    }

}