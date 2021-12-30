import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk.js";
import {BLOCK} from '../blocks.js';
import {Color, Helpers, Vector} from '../helpers.js';
import noise from '../../vendors/perlin.js';
import {impl as alea} from '../../vendors/alea.js';

export {alea, noise};

export class Default_Terrain_Generator {

    constructor(seed, world_id) {
        this.voxel_buildings = [];
        this.setSeed(seed);
        this.world_id = world_id;
        this.x = 0;
        this.xyz_temp       = new Vector(0, 0, 0);
        this.xyz_temp_find  = new Vector(0, 0, 0);
        this.xyz_temp_coord = new Vector(0, 0, 0);
        this.temp_block     = {id: 0};
        this.temp_tblock    = null;
    }

    async setSeed(seed) {
        this.seed = seed;
        noise.seed(this.seed);
    }

    generate(chunk) {

        let b = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.BEDROCK : BLOCK.SAND;

        if(chunk.addr.y == 0) {
            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    // BEDROCK
                    for(let y = 0; y < 1; y++) {
                        let block = chunk.tblocks.get(new Vector(x, y, z));
                        block.id = b.id;
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

    deleteMap(addr) {
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
    setBlock(chunk, x, y, z, block_type, force_replace) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            this.xyz_temp.set(x, y, z);
            if(force_replace || !chunk.tblocks.has(this.xyz_temp)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                if(!this.getVoxelBuilding(this.xyz_temp_coord)) {
                    let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * this.xyz_temp.y + (this.xyz_temp.z * CHUNK_SIZE_X) + this.xyz_temp.x;
                    chunk.tblocks.id[index] = block_type.id;
                    // chunk.tblocks.delete(this.xyz_temp);
                    // this.temp_tblock = chunk.tblocks.get(this.xyz_temp, this.temp_tblock);
                    // this.temp_tblock.id = block_type.id;
                }
            }
        }
    }

    getBlock(chunk, x, y, z) {
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }

    // plantTree...
    plantTree(options, chunk, x, y, z) {
        const type = options.type;
        // листва над стволом
        switch(type.style) {
            // кактус
            case 'cactus': {
                this.plantStump(options, chunk, x, y, z)
                break;
            }
            // пенёк
            case 'stump': {
                this.plantStump(options, chunk, x, y, z)
                break;
            }
            // дуб, берёза
            case 'wood': {
                this.plantOak(options, chunk, x, y, z)
                break;
            }
            // акация
            case 'acacia': {
                this.plantAcacia(options, chunk, x, y, z)
                break;
            }
            // ель
            case 'spruce': {
                this.plantSpruce(options, chunk, x, y, z)
                break;
            }
        }
    }

    // Кактус
    plantCactus(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
    }

    // Пенёк
    plantStump(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        if(options.type.leaves) {
            this.temp_block.id = options.type.leaves;
            this.setBlock(chunk, x, ystart, z, this.temp_block, true);
        }
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
                that.temp_block.id = options.type.trunk;
                that.setBlock(chunk, x, p, z, that.temp_block, true);
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
            const vec1 = new Vector();
            const vec2 = new Vector();
            for(let rad of rads) {
                for(let i = x - rad; i <= x + rad; i++) {
                    for(let j = z - rad; j <= z + rad; j++) {
                        if(i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z) {
                            vec1.set(x, 0, z);
                            vec2.set(i, 0, j);
                            if(vec1.distance(vec2) > rad) {
                                continue;
                            }
                            that.xyz_temp_find.set(i, py, j);
                            let b = chunk.tblocks.get(that.xyz_temp_find);
                            let b_id = !b ? 0 : (typeof b == 'number' ? b : b.id);
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                                that.temp_block.id = options.type.leaves;
                                that.setBlock(chunk, i, py, j, that.temp_block, false);
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
            this.temp_block.id = options.type.trunk;
            this.setBlock(chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let r = 1;
        let rad = Math.round(r);
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z) {
            this.temp_block.id = options.type.leaves;
            this.setBlock(chunk, x, ystart, z, this.temp_block, false);
            if(options.biome_code == 'SNOW') {
                this.temp_block.id = BLOCK.SNOW.id;
                this.setBlock(chunk, x, ystart + 1, z, this.temp_block, false);
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
                            this.xyz_temp_find.set(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
                            let b = chunk.tblocks.get(this.xyz_temp_find);
                            let b_id = b.id;
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                                this.temp_block.id = options.type.leaves;
                                this.setBlock(chunk, i, y, j, this.temp_block, false);
                                if(options.biome_code == 'SNOW') {
                                    this.temp_block.id = BLOCK.SNOW.id;
                                    this.setBlock(chunk, i, y + 1, j, this.temp_block, false);
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
            this.temp_block.id = options.type.trunk;
            this.setBlock(chunk, x, p, z, this.temp_block, true);
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
                        this.xyz_temp_find.set(i, py, j);
                        let b = chunk.tblocks.get(this.xyz_temp_find);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            this.setBlock(chunk, i, py, j, this.temp_block, false);
                        }
                    }
                }
            }
            py--;
        }

    }

}