import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../chunk_const.js";
import {BLOCK} from '../blocks.js';
import {FastRandom, Vector, DIRECTION_BIT, DIRECTION} from '../helpers.js';
import noise from '../../vendors/perlin.js';
import {impl as alea} from '../../vendors/alea.js';

export {alea, noise};

// Map cell
export class Default_Terrain_Map_Cell {

    constructor(biome) {
        this.biome = biome;
    }

}

//
export class Default_Terrain_Map {

    constructor(addr, size, coord, options, cells) {
        this.chunk = {addr, size, coord};
        this.options = options;
        this.cells = cells;
    }

}

//
export class Default_Terrain_Generator {

    constructor(seed, world_id, options, noise2d, noise3d) {
        this.voxel_buildings = [];
        this.setSeed(seed);
        this.noise2d        = noise2d ?? noise.simplex2;
        this.noise3d        = noise3d ?? noise.simplex3;
        this.world_id       = world_id;
        this.options        = options;
        this.x              = 0;
        this.xyz_temp       = new Vector(0, 0, 0);
        this.xyz_temp_find  = new Vector(0, 0, 0);
        this.xyz_temp_coord = new Vector(0, 0, 0);
        this.temp_block     = {id: 0};
        this.temp_tblock    = null;
        this.maps = {
            delete: function() {},
            destroyAroundPlayers: function() {}
        };
    }

    async init() {
        return true;
    }

    async setSeed(seed) {
        this.seed = seed;
        this.seed_int = parseInt(this.seed);
        noise.seed(this.seed);
        this.fastRandoms = new FastRandom(this.seed, CHUNK_SIZE_X * CHUNK_SIZE_Z);
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

        let cell = {biome: {dirt_color: new Indexedcolor(980, 980, 0), code: 'Flat'}};
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
        for (let i = 0; i < this.voxel_buildings.length; i++) {
            const vb = this.voxel_buildings[i];
            if(xyz.x >= vb.coord.x && xyz.y >= vb.coord.y && xyz.z >= vb.coord.z &&
                xyz.x < vb.coord.x + vb.size.x &&
                xyz.y < vb.coord.y + vb.size.z &&
                xyz.z < vb.coord.z + vb.size.y) {
                    return vb;
                }
        }
        return null;
    }

    //
    setTreeBlock(tree, chunk, x, y, z, block_type, force_replace, rotate, extra_data) {
        // if(!tree.aabb) tree.aabb = new AABB().reset();
        // tree.aabb.addPoint(chunk.coord.x + x, chunk.coord.y + y, chunk.coord.z + z);
        this.setBlock(chunk, x, y, z, block_type, force_replace, rotate, extra_data);
    }

    // setBlock
    setBlock(chunk, x, y, z, block_type, force_replace, rotate, extra_data) {
        const { tblocks } = chunk;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !tblocks.getBlockId(x, y, z)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                if(!this.getVoxelBuilding(this.xyz_temp_coord)) {
                    tblocks.setBlockId(x, y, z, block_type.id);
                    if(rotate || extra_data) {
                        tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data)
                    }
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
    plantTree(options, chunk, x, y, z, check_chunk_size) {
        const type = options.type;
        // листва над стволом
        switch(type.style) {
            // кактус
            case 'cactus': {
                this.plantCactus(options, chunk, x, y, z)
                break;
            }
            // бамбук
            case 'bamboo': {
                this.plantBamboo(options, chunk, x, y, z)
                break;
            }
            // пенёк
            case 'stump': {
                this.plantStump(options, chunk, x, y, z)
                break;
            }
            // tundra_stone
            case 'tundra_stone': {
                this.plantTundraStone(options, chunk, x, y, z)
                break;
            }
            // дуб, берёза
            case 'birch':
            case 'oak':
            case 'wood': {
                this.plantBigOak(options, chunk, x, y, z, check_chunk_size)
                break;
            }
            // mushroom
            case 'mushroom': {
                this.plantMushroom(options, chunk, x, y, z)
                break;
            }
            // brown_mushroom
            case 'brown_mushroom': {
                this.plantBrownMushroom(options, chunk, x, y, z)
                break;
            }
            // акация
            case 'acacia': {
                this.plantAcacia(options, chunk, x, y, z, check_chunk_size)
                break;
            }
            // ель
            case 'spruce': {
                this.plantSpruce(options, chunk, x, y, z, check_chunk_size)
                break;
            }
            // тропическое дерево
            case 'jungle': {
                this.plantJungle(options, chunk, x, y, z, check_chunk_size)
                break;
            }
            // большое дерево
            case 'big': {
                this.plantBigOak(options, chunk, x, y, z, check_chunk_size)
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
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
    }

    // Бамбук
    plantBamboo(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            let extra_data = {stage: 3};
            if(p == ystart - 1) extra_data.stage = 2;
            if(p == ystart - 2) extra_data.stage = 1;
            if(p == ystart - 3) extra_data.stage = 1;
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true, null, extra_data);
        }
    }

    // Пенёк
    plantStump(options, chunk, x, y, z, block, force_replace) {
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
        if(options.type.leaves) {
            this.temp_block.id = options.type.leaves;
            this.setTreeBlock(options, chunk, x, ystart, z, this.temp_block, true);
        }
    }

    // Tundra stone
    plantTundraStone(options, chunk, x, y, z, block, force_replace) {
        y--;
        const ystart = y + options.height;
        // ствол
        this.temp_block.id = options.type.trunk;
        for(let p = y; p < ystart; p++) {
            for(let dx = -1; dx <= 1; dx++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(p != y && dx != 0 && dz != 0) {
                        continue;
                    }
                    this.setTreeBlock(options, chunk, x + dx, p, z + dz, this.temp_block, true);
                }
            }
        }
    }

    // Акация
    plantAcacia(options, chunk, orig_x, orig_y, orig_z, check_chunk_size = true) {
        // let xyz = chunk.coord.add(new Vector(orig_x, orig_y, orig_z));
        // let random = new alea('tree' + xyz.toHash());
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
                // let r = random.double();
                let r = that.fastRandoms.double(x + p + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + height);
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
                        if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
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
    plantSpruce(options, chunk, x, y, z, check_chunk_size = true) {
        let max_rad = 5;
        let ystart = y + options.height;
        let b = null;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let r = 1;
        let rad = Math.round(r);
        if(!check_chunk_size || (x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z)) {
            this.temp_block.id = options.type.leaves;
            this.setTreeBlock(options, chunk, x, ystart, z, this.temp_block, false);
            if(options.biome_code == 'SNOW') {
                this.temp_block.id = BLOCK.SNOW.id;
                this.setTreeBlock(options, chunk, x, ystart + 1, z, this.temp_block, false);
            }
        }
        let step = 0;
        let temp_rad = 0;
        for(let y = ystart - 1; y > ystart - (options.height - 1); y--) {
            step++
            if(step % 2 == 0) {
                rad = Math.min(Math.round(r), max_rad);
                temp_rad = rad;
            } else if(step == 1) {
                rad = options.height % 2;
                temp_rad = rad;
            } else {
                rad = temp_rad - 1;
            }
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
                        if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                            this.xyz_temp_find.set(i + chunk.coord.x, y + chunk.coord.y, j + chunk.coord.z);
                            b = chunk.tblocks.get(this.xyz_temp_find, b);
                            let b_id = b.id;
                            // options.aabb.addPoint(chunk.coord.x + i, chunk.coord.y + y, chunk.coord.z + j);
                            if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                                this.temp_block.id = options.type.leaves;
                                this.setTreeBlock(options, chunk, i, y, j, this.temp_block, false);
                                if(options.biome_code == 'SNOW') {
                                    this.temp_block.id = BLOCK.SNOW.id;
                                    this.setTreeBlock(options, chunk, i, y + 1, j, this.temp_block, false);
                                }
                            }
                        }
                    }
                }
            }
            r = Math.sqrt(step);
            if(r < 1.5) {
                this.temp_block.id = options.type.leaves;
                this.setTreeBlock(options, chunk, x, y, z, this.temp_block, true);
            }
        }
    }

    // Дуб, берёза
    plantOak(options, chunk, x, y, z, check_chunk_size = true) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + options.height;
        let b = null;
        for(let rad of [1, 1, 2, 2]) {
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(!check_chunk_size || (i >= 0 && i < chunk.size.x && j >= 0 && j < chunk.size.z)) {
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
                        b = chunk.tblocks.get(this.xyz_temp_find, b);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            this.setTreeBlock(options, chunk, i, py, j, this.temp_block, false);
                        }
                    }
                }
            }
            py--;
        }
    }

    // Brown mushroom
    plantBrownMushroom(options, chunk, x, y, z) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + options.height;
        let b = null;
        for(let rad of [1, 3]) {
            for(let i = -rad; i <= rad; i++) {
                for(let j = -rad; j <= rad; j++) {
                    if(py < y + options.height) {
                        if(Math.abs(i) < 2 && Math.abs(j) < 2) {
                            continue;
                        }
                    }
                    if(i + x >= 0 && i + x < chunk.size.x && j + z >= 0 && j + z < chunk.size.z) {
                        let m = (i == -rad && j == -rad) ||
                            (i == rad && j == rad) ||
                            (i == -rad && j == rad) ||
                            (i == rad && j == -rad);
                        if(m && py < y + options.height) {
                            continue;
                        }
                        this.xyz_temp_find.set(i + x, py, j + z);
                        b = chunk.tblocks.get(this.xyz_temp_find, b);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            // determining which side to cover with which texture
                            let t = 0;
                            if(py >= y + options.height - 1) t |= (1 << DIRECTION_BIT.UP); // up
                            if(i == rad) t |= (1 << DIRECTION_BIT.EAST); // east x+
                            if(i == -rad) t |= (1 << DIRECTION_BIT.WEST); // west x-
                            if(j == rad) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                            if(j == -rad) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                            //
                            if(py < y + options.height) {
                                if((j == -rad || j == rad) && i == rad - 1) t |= (1 << DIRECTION_BIT.EAST); // east x+
                                if((j == -rad || j == rad) && i == -rad + 1) t |= (1 << DIRECTION_BIT.WEST); // west x-
                                if((i == -rad || i == rad) && j == rad - 1) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                                if((i == -rad || i == rad) && j == -rad + 1) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                            }
                            const extra_data = t ? {t: t} : null;
                            this.setTreeBlock(options, chunk, i + x, py, j + z, this.temp_block, false, null, extra_data);
                        }
                    }
                }
            }
            py--;
        }
    }

    // Mushroom
    plantMushroom(options, chunk, x, y, z) {
        let ystart = y + options.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = options.type.trunk;
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + options.height;
        let b = null;
        for(let rad of [1, 2, 2, 2]) {
            for(let i = -rad; i <= rad; i++) {
                for(let j = -rad; j <= rad; j++) {
                    if(py < y + options.height) {
                        if(Math.abs(i) < 2 && Math.abs(j) < 2) {
                            continue;
                        }
                    }
                    if(i + x >= 0 && i + x < chunk.size.x && j + z >= 0 && j + z < chunk.size.z) {
                        let m = (i == -rad && j == -rad) ||
                            (i == rad && j == rad) ||
                            (i == -rad && j == rad) ||
                            (i == rad && j == -rad);
                        if(m && py < y + options.height) {
                            continue;
                        }
                        this.xyz_temp_find.set(i + x, py, j + z);
                        b = chunk.tblocks.get(this.xyz_temp_find, b);
                        let b_id = b.id;
                        if(!b_id || b_id >= 0 && b_id != options.type.trunk) {
                            this.temp_block.id = options.type.leaves;
                            // determining which side to cover with which texture
                            let t = 0;
                            if(py >= y + options.height - 1) t |= (1 << DIRECTION_BIT.UP); // up
                            if(i == rad) t |= (1 << DIRECTION_BIT.EAST); // east x+
                            if(i == -rad) t |= (1 << DIRECTION_BIT.WEST); // west x-
                            if(j == rad) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                            if(j == -rad) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                            //
                            if(py < y + options.height) {
                                if((j == -rad || j == rad) && i == rad - 1) t |= (1 << DIRECTION_BIT.EAST); // east x+
                                if((j == -rad || j == rad) && i == -rad + 1) t |= (1 << DIRECTION_BIT.WEST); // west x-
                                if((i == -rad || i == rad) && j == rad - 1) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                                if((i == -rad || i == rad) && j == -rad + 1) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                            }
                            let extra_data = t ? {t: t} : null;
                            this.setTreeBlock(options, chunk, i + x, py, j + z, this.temp_block, false, null, extra_data);
                        }
                    }
                }
            }
            py--;
        }
    }

    // Тропическое дерево
    plantJungle(options, chunk, x, y, z, check_chunk_size = true) {
        const TREE_HEIGHT = options.height - 2 // рандомная высота дерева, переданная из генератора
        let ystart = y + TREE_HEIGHT
        let maxW = Math.floor(TREE_HEIGHT / 2)
        let minW = Math.floor(TREE_HEIGHT / 3)
        this.temp_block.id = options.type.trunk;
        const mainseed = x + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + y;
        const vine_block = { id: BLOCK.VINE.id };
        // получаю большое число
        const cnt = Math.floor(this.fastRandoms.double(mainseed + options.height) * Math.pow(2, 58))
        const dy = Math.floor(cnt / 2 ** 32)
        // преобразование числа в массив байт
        const arr = [
            cnt << 24,
            cnt << 16,
            cnt << 8,
            cnt,
            dy << 24,
            dy << 16,
            dy << 8,
            dy,
        ].map((z) => z >>> 24)
        // ствол + лианы вокруг
        const xyz = chunk.coord.add(new Vector(x, y, z));
        const random = new alea('tree' + xyz.toHash());
        for(let p = y; p < ystart; p++) {
            this.setTreeBlock(options, chunk, x, p, z, this.temp_block, true);
            let block_id = vine_block.id;
            let extra_data = null;
            const makeCocoa = () => {
                if(random.double() < .04 && p < y + 4) {
                    block_id = BLOCK.COCOA_BEANS.id;
                    extra_data = {stage: 2};
                }
            }
            if((p + arr[p % 7]) % 2 == 0) {
                makeCocoa();
                this.setTreeBlock(options, chunk, x + 1, p, z, { id: block_id }, false, new Vector(3, 0, 0), extra_data)
            }
            if((p + arr[(p + 1) % 7]) % 2 == 0) {
                makeCocoa();
                this.setTreeBlock(options, chunk, x - 1, p, z, { id: block_id }, false, new Vector(1, 0, 0), extra_data)
            }
            if((p + arr[(p + 2) % 7]) % 2 == 0) {
                makeCocoa();
                this.setTreeBlock(options, chunk, x, p, z + 1, { id: block_id }, false, new Vector(0, 0, 3), extra_data)
            }
            if((p + arr[(p + 3) % 7]) % 2 == 0) {
                makeCocoa();
                this.setTreeBlock(options, chunk, x, p, z - 1, { id: block_id }, false, new Vector(2, 0, 0), extra_data)
            }
        }
        // рисование кроны дерева
        const generateLeaves = (x, y, z, rad, rnd) => {
            for(let h = 0; h <= 1; h++) {
                let w = Math.max(rad - h * 2, 5 - h)
                let dx = Math.floor(x - w / 2)
                let dz = Math.floor(z - w / 2)
                let d = null
                for(let a = dx; a <= dx + w; a++) {
                    for(let b = dz; b <= dz + w; b++) {
                        if(check_chunk_size && (a < 0 || a >= chunk.size.x || b < 0 || b >= chunk.size.z)) {
                            continue;
                        }
                        const l = Math.abs(Math.sqrt(Math.pow(a - x, 2) + Math.pow(b - z, 2)))
                        if(l <= w / 2) {
                            this.xyz_temp_find.set(a, y + h, b)
                            d = chunk.tblocks.get(this.xyz_temp_find, d)
                            const d_id = d.id
                            if(!d_id || (d_id >= 0 && d_id != options.type.trunk)) {
                                this.temp_block.id = options.type.leaves;
                                this.setTreeBlock(options, chunk, a, y + h, b, this.temp_block, false);
                                if (
                                    rad % 2 == 0 &&
                                    h == 0 &&
                                    (a == dx || a == dx + w || b == dz || b == dz + w)
                                ) {
                                    for(let t = 1; t <= Math.floor(1 + rad * (arr[1 + (t % 6)] / 255)); t++) {
                                        this.setTreeBlock(
                                            options,
                                            chunk,
                                            a, y + h - t, b,
                                            vine_block,
                                            false,
                                            new Vector(
                                                a == dx ? 3 : a == dx + w ? 1 : b == dz + w ? 2 : 0,
                                                0,
                                                b == dz ? 3 : 0
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // построение веток дерева
        for(let i = 0; i < arr[7]; i++) {
            this.temp_block.id = options.type.trunk;
            const pos = Math.floor(
                TREE_HEIGHT / 2.5 + (TREE_HEIGHT / 2) * (arr[6 - i] / 255)
            );
            let rad = Math.floor(minW + (maxW * arr[1 + i]) / 255 / 4)
            let side = (i + (arr[7] % 2)) % 4
            let x1 = x
            let z1 = z
            let dy = 0
            for(let k = 0; k < rad; k++) {
                x1 = side < 2 ? (side == 0 ? x1 - 1 : x1 + 1) : x1
                z1 = side >= 2 ? (side == 2 ? z1 - 1 : z1 + 1) : z1
                if(arr[k % 7] % 2 == 0) {
                    dy++
                }
                this.setTreeBlock(options, chunk, x1, y + pos + dy, z1, this.temp_block, true);
            }
            this.temp_block.id = options.type.leaves
            generateLeaves(x1, y + pos + dy + 1, z1, rad, arr)
        }
        // рисуем крону основного дерева
        this.temp_block.id = options.type.leaves
        generateLeaves(x, ystart, z, Math.floor(minW + (maxW * arr[0]) / 255), arr)
    }
    
    // Тропическое дерево
    plantBigOak(options, chunk, x, y, z, check_chunk_size = true) {
        // рисование кроны дерева
        const generateLeaves = (x, y, z, rad, rnd) => {
            for(let h = 0; h <= 1; h++) {
                let w = Math.max(rad - h * 2, 5 - h)
                let dx = Math.floor(x - w / 2)
                let dz = Math.floor(z - w / 2)
                let d = null
                for(let a = dx; a <= dx + w; a++) {
                    for(let b = dz; b <= dz + w; b++) {
                        if(check_chunk_size && (a < 0 || a >= chunk.size.x || b < 0 || b >= chunk.size.z)) {
                            continue;
                        }
                        const l = Math.abs(Math.sqrt(Math.pow(a - x, 2) + Math.pow(b - z, 2)))
                        if(l <= w / 2) {
                            this.xyz_temp_find.set(a, y + h, b)
                            d = chunk.tblocks.get(this.xyz_temp_find, d)
                            const d_id = d.id
                            if(!d_id || (d_id >= 0 && d_id != options.type.trunk)) {
                                this.temp_block.id = options.type.leaves;
                                this.setTreeBlock(options, chunk, a, y + h, b, this.temp_block, false);
                                if (
                                    rad % 2 == 0 &&
                                    h == 0 &&
                                    (a == dx || a == dx + w || b == dz || b == dz + w)
                                ) {
                                    for(let t = 1; t <= Math.floor(1 + rad * (rnd[1 + (t % 6)] / 255)); t++) {
                                        this.setTreeBlock(
                                            options,
                                            chunk,
                                            a, y + h - t, b,
                                            BLOCK.VINE,
                                            false,
                                            new Vector(
                                                a == dx ? 3 : a == dx + w ? 1 : b == dz + w ? 2 : 0,
                                                0,
                                                b == dz ? 3 : 0
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        const setBranch = (n, rot) => {
            let sign_x = 1;
            let sign_z = 1;
            if (rot == DIRECTION.SOUTH) {
                sign_z = -1;
            }
            switch(n) {
                case 0: {
                     this.setTreeBlock(options, chunk, x + 1 * sign_x, y + 1, z, BLOCK.OAK_LOG, true);
                     this.setTreeBlock(options, chunk, x + 2 * sign_x, y + 1, z, BLOCK.OAK_LOG, true);
                     this.setTreeBlock(options, chunk, x + 2 * sign_x, y + 1, z + 1 * sign_z, BLOCK.OAK_LOG, true);
                     this.setTreeBlock(options, chunk, x + 3 * sign_x, y + 2, z + 1 * sign_z, BLOCK.OAK_LOG, true);
                     this.setTreeBlock(options, chunk, x + 4 * sign_x, y + 3, z + 1 * sign_z, BLOCK.OAK_LOG, true);
                    break;
                }
            }
        }
        
        const LineBresenham3D = (sx, sy, sz, ex, ey, ez) => {
            let x = sx;
            let y = sy;
            let z = sz;
            const sign_x = ex > sx ? 1 : -1;
            const sign_y = ey > sy ? 1 : -1;
            const sign_z = ez > sz ? 1 : -1;
            for (let n = 0; n < 100; n++){
                let dx = Math.abs(ex - x);
                let dy = Math.abs(ey - y);
                let dz = Math.abs(ez - z);
                if (dx == 0 && dy == 0 && dz == 0) {
                    break;
                }
                if (dx >= dy && dx >= dz) {
                    x += sign_x;
                    this.setTreeBlock(options, chunk, x, y, z, BLOCK.OAK_LOG, true);
                } else if (dz >= dx && dz >= dy) {
                    //this.setTreeBlock(options, chunk, x, y, z, BLOCK.TEST, true);
                    z += sign_z;
                    this.setTreeBlock(options, chunk, x, y, z, BLOCK.OAK_LOG, true);
                }
                else if (dy >= dx && dy >= dz) {
                    y++;
                    
                }
                
            }
        }
        
        const getSector = (x, y) => {
            if (x > 0) {
                if (z > 0) {
                    return 0;
                } 
                return 3;
            } else {
                if (z > 0) {
                    return 1;
                } 
                return 2;
            }
            return null;
        }
        
        const genOldRing = (random, h, bonus = 0) => {
            /*
               111 111 1 1
            
            const sector = [false, false, false, false];
            let rnd = random;
            for (let n = 0; n < 8; n++) {
                let sign_x = (rnd.double() < 0.5) ? -1 : 1;
                let sign_z = (rnd.double() < 0.5) ? -1 : 1;
                
                let rnd_x = (((rnd.double() * 4) | 0 ) + 3) * sign_x;
                let rnd_z = (((rnd.double() * 4) | 0 ) + 3) * sign_z;
                
                let ns = getSector(sign_x, sign_z);
                
                if (ns && !sector[ns] && (rnd_x > 0 || rnd_z > 0)) {
                    LineBresenham3D(x, y + h, z, x + rnd_x, y + h + 4, z + rnd_z);
                    sector[ns] = true;
                    console.log(rnd_x + ' ' + rnd_z + ' ' + rnd.double());
                }
            }
            
            */
             
            bonus = 0;
            let rad = (random & 7) + bonus;
            if (rad > 1) {
                let sign = (((rad >> 1) & 1) == 0) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + sign * rad, y + h + 4, z + 4);
                //generateLeaves(x + sign * rad, y + h + 4, z + 4, rad * 2, rnd);
            }
            h += 1;
            rad = ((random >> 1) & 7) + bonus;
            if (rad > 1) {
                let sign = (((rad >> 1) & 1) == 0) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + sign * rad, y + h + 4, z - 4);
                //generateLeaves(x + sign * rad, y + h + 4, z - 4, rad * 2, rnd);
            }
            h += 1;
            rad = ((random >> 2) & 7) + bonus;
            if (rad > 1) {
                let sign = (((rad >> 1) & 1) == 0) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + 4, y + h + 4, z + sign * rad);
                //generateLeaves(x + 4, y + h + 4, z + sign * rad, rad * 2, rnd);
            }
            h += 1;
            rad = ((random >> 3) & 7) + bonus;
            if (rad > 1) {
                let sign = (((rad >> 1) & 1) == 0) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x - 4, y + h + 4, z + sign * rad);
                //generateLeaves(x - 4, y + h + 4, z + sign * rad, rad * 2, rnd);
            }
        }
        
        //LineBresenham3D(x, 1, z, 16, 5, 5);
        const height = options.height * 4; // рандомная высота дерева, переданная из генератора
        
        const mainseed = x + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + y;
        const cnt = Math.floor(this.fastRandoms.double(mainseed + options.height) * Math.pow(2, 58));
        const dy = Math.floor(cnt / 2 ** 32)
        // преобразование числа в массив байт
        const rnd = [
            cnt << 24,
            cnt << 16,
            cnt << 8,
            cnt,
            dy << 24,
            dy << 16,
            dy << 8,
            dy,
        ].map((z) => z >>> 24);
        
        for(let i = 0; i < height; i++) {
            this.setTreeBlock(options, chunk, x, y + i, z, BLOCK.OAK_LOG, true);
        }
        
        generateLeaves(x, y + height, z, 16, rnd);
        
       // setBranch(0);
        //setBranch(0, DIRECTION.SOUTH);
        const random = cnt / 10;
        genOldRing(random, 4, Math.floor(height / 10));
        if (height > 16) {
            genOldRing(random >> 4, 12, Math.floor(height / 10));
        }
        if (height > 24) {
            genOldRing(random >> 4, 20, Math.floor(height / 10));
        }
        //const xyz = chunk.coord.add(new Vector(x, y, z));
        //const al = new alea('tree_big' + xyz.toHash());
        
       // const random = cnt / 10;
        //    genOldRing(al, 4, Math.floor(height / 10));

       // if (height > 20) {
       //     genOldRing(al, 12, Math.floor((height - 20) / 10));
       // }
       // if (height > 30) {
       //     genOldRing(al, 18, Math.floor((height - 20) / 10));
            
       // }
        
        //genOldRing(random >> 4, 8);
        
        //genOldRing(random >> 8, 12);
        
        //genOldRing(random >> 12, 16);
        
        /*
        let rad = random & 4;
        if (rad > 1) {
            let sign = (rad >> 1) & 1 == 0 ? -1 : 1;
            LineBresenham3D(x, y + 6 , z, x + sign * rad, y + 10, z + 4);
            generateLeaves(x + sign * rad, y + 10, z + 4, rad * 2, rnd);
        }
        
        rad = (random >> 1) & 4;
        if (rad > 1) {
            let sign = ((rad >> 1) & 1) == 0 ? -1 : 1;
            LineBresenham3D(x, y + 7 , z, x + 4, y + 11, z + sign * rad);
            generateLeaves(x + 4, y + 11, z + sign * rad, rad * 2, rnd);
        }
        
        rad = (random >> 2) & 4;
        if (rad > 1) {
            let sign = ((rad >> 1) & 1) == 0 ? -1 : 1;
            LineBresenham3D(x, y + 8 , z, x + sign * rad, y + 12, z - 4);
            generateLeaves(x + sign * rad, y + 12, z - 4, rad * 2, rnd);
        }
        
        rad = (random >> 3) & 4;
        if (rad > 1) {
            let sign = ((rad >> 1) & 1) == 0 ? -1 : 1;
            LineBresenham3D(x, y + 8 , z, x - sign * rad, y + 12, z - 4);
            generateLeaves(x - sign * rad, y + 12, z - 4, rad * 2, rnd);
        }
        
        //const xyz = chunk.coord.add(new Vector(x, y, z));
        //const random = new alea('big_tree' + xyz.toHash());
        /*let random = cnt / 10;
        
        let rad = random & 7;
        if (rad > 4) {
            LineBresenham3D(x, y + 6 , z, x  + rad, y + 12, z);
            generateLeaves(x  + rad, y + 12, z, rad, rnd);
        }
        rad = (random >> 1) & 7;
        if (rad > 4) {
            LineBresenham3D(x, y + 6 , z, x, y + 12, z  + rad);
            generateLeaves(x, y + 12, z  + rad, rad, rnd);
        }
        rad = (random >> 2) & 7;
        if (rad > 4) {
            LineBresenham3D(x, y + 6 , z, x - rad, y + 12, z);
            generateLeaves(x - rad, y + 12, z, rad, rnd);
        }
        
        if (height > 28) {
            let rad = rrr & 15;
            if (rad > 8) {
                LineBresenham3D(x, y + height - 16, z, x  + rad, height + y - 4, z);
            }
            rad = (rrr >> 1) & 15;
            if (rad > 8) {
                LineBresenham3D(x, y + height - 16, z, x, height + y-4, z  + rad);
            }
            
            rad = (rrr >> 2) & 15;
            if (rad > 8) {
                LineBresenham3D(x, y + height - 16, z, x - rad, height + y-4, z);
            }
            
            rad = (rrr >> 3) & 15;
            if (rad > 8) {
                LineBresenham3D(x, y + height - 16, z, x, height + y-4, z - rad);
            }
            
            for(let i = 0; i < height - 15; i++) {
                this.setTreeBlock(options, chunk, x, y + i, z, BLOCK.TEST, true);
            }
        }/
        
        /*
        generateLeaves(x, y + height, z, 18, rnd);
        let d = null, d2 = null;
        let rnd_x = random.double() * 4 | 0 + 4;
        let rnd_z = random.double() * 4 | 0 + 4;
        rnd_x = random.double() > 0.5 ? rnd_x : -rnd_x;
        rnd_z = random.double() > 0.5 ? rnd_z : -rnd_z;
        this.xyz_temp_find.set(rnd_x + x, y + height, rnd_z + z);
        d = chunk.tblocks.get(this.xyz_temp_find, d);
        
        console.log('x'+ rnd_x + ' z ' + rnd_z + ' ' + d.id);
        
        if (d && d.id == 0) {
            LineBresenham3D(x, y + height - 4, z, rnd_x + x, height+y-2, z + rnd_z);  
        }
        */
        //LineBresenham3D(x, y + 8, z, rnd_x + x, y + 10, rnd_z + z);
        //generateLeaves(rnd_x + x, y + 10, rnd_z + z, 6, rnd);
        //console.log(xs + ' ' + ys)
        /*const mainseed = x + z + chunk.coord.x + chunk.coord.y + chunk.coord.z + y;
        const cnt = Math.floor(this.fastRandoms.double(mainseed + options.height) * Math.pow(2, 58));
        const dy = Math.floor(cnt / 2 ** 32)
        // преобразование числа в массив байт
        const rnd = [
            cnt << 24,
            cnt << 16,
            cnt << 8,
            cnt,
            dy << 24,
            dy << 16,
            dy << 8,
            dy,
        ].map((z) => z >>> 24)
        //console.log(rnd);
        // Отклонение главного ствола
        const nx = Math.floor(rnd[0] * height / 2040 );
        LineBresenham3D(x, y, z, nx + x, height+y, z);
        generateLeaves(nx + x, y+height, z, 15, rnd)*/
    }
}