import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../chunk_const.js";
import {BLOCK} from '../blocks.js';
import {FastRandom, Vector, DIRECTION_BIT, createFastRandom, VectorCollector, SimpleQueue, getChunkAddr, IndexedColor } from '../helpers.js';
import noise from '../../vendors/perlin.js';
import {impl as alea} from '../../vendors/alea.js';
import { WorldAction } from "../world_action.js";
import type { ChunkWorkerChunk } from "../worker/chunk.js";
import type { TerrainMapCell } from "./terrain_map.js";

declare type ISetTreeBlock = (tree : any, x : int, y : int, z : int, block_type : any, force_replace : boolean, rotate? : IVector, extra_data? : any) => any

export {alea, noise};

// Map cell
export class Default_Terrain_Map_Cell {
    [key: string]: any;

    constructor(biome) {
        this.biome = biome;
    }

}

const _cache = {} as {[key: string] : any}

//
export class Default_Terrain_Map {
    [key: string]: any;

    constructor(addr : Vector, size : Vector, coord : Vector, options : any, cells) {
        this.chunk = {addr, size, coord};
        this.options = options;
        this.cells = cells;
    }

    /**
     * Return map cell
     */
    getCell(x : int, z : int) : TerrainMapCell {
        return this.cells[z * CHUNK_SIZE_X + x]
    }

}

//
export class Default_Terrain_Generator {

    seed: string
    voxel_buildings: any[];
    noise2d: any;
    noise3d: any;
    world_id: string;
    options: any;
    x: number;
    xyz_temp: Vector;
    xyz_temp_find: Vector;
    xyz_temp_coord: Vector;
    _chunk_addr: Vector;
    _block_pos: Vector;
    temp_block: { id: number; };
    temp_tblock: any;
    tree_styles: Map<any, any>;
    seed_int: number;
    fastRandoms: FastRandom;

    constructor(seed : string, world_id? : string, options?, noise2d? : any, noise3d? : any) {
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
        this._chunk_addr    = new Vector(0, 0, 0);
        this._block_pos     = new Vector(0, 0, 0);
        this.temp_block     = {id: 0};
        this.temp_tblock    = null;
        // Tree styles
        this.tree_styles = new Map()
        this.tree_styles.set('cactus', this.plantCactus.bind(this)) // кактус
        this.tree_styles.set('bamboo', this.plantBamboo.bind(this)) // бамбук
        this.tree_styles.set('stump', this.plantStump.bind(this)) // пенёк
        this.tree_styles.set('tundra_stone', this.plantTundraStone.bind(this)) // камень тундры
        this.tree_styles.set('birch', this.plantOak.bind(this)) // берёза
        this.tree_styles.set('oak', this.plantOak.bind(this)) // дуб
        this.tree_styles.set('wood', this.plantOak.bind(this)) // просто дерево
        this.tree_styles.set('red_mushroom', this.plantRedMushroom.bind(this)) // красный гриб
        this.tree_styles.set('brown_mushroom', this.plantBrownMushroom.bind(this)) // коричневый (плоский) гриб
        this.tree_styles.set('acacia', this.plantAcacia.bind(this)) // акация
        this.tree_styles.set('spruce', this.plantSpruce.bind(this)) // ель
        this.tree_styles.set('jungle', this.plantJungle.bind(this)) // тропическое дерево
        this.tree_styles.set('big_oak', this.plantBigOak.bind(this)) // большой дуб
        this.tree_styles.set('chorus', this.plantChorus.bind(this)) // растение хоруса
    }

    async init() : Promise<boolean> {
        return true;
    }

    async setSeed(seed : string) {
        this.seed = seed;
        this.seed_int = parseInt(this.seed);
        noise.seed(this.seed);
        this.fastRandoms = new FastRandom(this.seed, CHUNK_SIZE_X * CHUNK_SIZE_Z);
    }

    //
    generate(chunk : ChunkWorkerChunk) : Default_Terrain_Map | null {

        const b = (chunk.addr.x + chunk.addr.z) % 2 == 0 ? BLOCK.BEDROCK : BLOCK.SAND;

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

        const cell = {biome: {dirt_color: new IndexedColor(980, 980, 0), code: 'Flat'}};
        const cells = Array(chunk.size.x).fill(null).map(el => Array(chunk.size.z).fill(cell));

        return new Default_Terrain_Map(
            chunk.addr,
            chunk.size,
            chunk.addr.mul(chunk.size),
            {WATER_LEVEL: 63},
            cells
        );

    }

    //
    getVoxelBuilding(xyz : Vector) {
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

    // plantTree...
    plantTree(world, tree, chunk, x, y, z, check_chunk_size = true) {
        
        const type = tree.type;
        const style_func = this.tree_styles.get(type.style)

        if(!style_func) {
            throw `error_undefined_tree_style|${type.style}`;
        }

        const first_time_generation = !tree.blocks

        if(first_time_generation) {
            tree.chunks = new VectorCollector()
            tree.blocks = new VectorCollector()
        }

        const orig_xyz = new Vector(x, y, z)
        const xyz = orig_xyz.add(chunk.coord)
        x -= x
        y -= y
        z -= z

        if(!check_chunk_size) {
            // indirect write without seperate by chunks
            return style_func(world, tree, xyz, (tree, x, y, z, block_type, force_replace, rotate, extra_data) => {
                x += orig_xyz.x
                y += orig_xyz.y
                z += orig_xyz.z
                const ax = chunk.coord.x + x
                const ay = chunk.coord.y + y
                const az = chunk.coord.z + z
                tree.blocks.set(this._block_pos.set(ax, ay, az), block_type);
                this.setBlock(chunk, x, y, z, block_type, force_replace, rotate, extra_data)
            });
        } else if(first_time_generation) {
            // if first time calling plant for this tree
            style_func(world, tree, xyz, (tree, x, y, z, block_type, force_replace, rotate, extra_data) => {
                x += orig_xyz.x
                y += orig_xyz.y
                z += orig_xyz.z
                this.setTreeBlock(tree, chunk, x, y, z, block_type, force_replace, rotate, extra_data)
            });
        }

        const c = tree.chunks.get(chunk.addr)
        if(!c) {
            return
        }

        // set blocks
        const _temp_block = {id: 0}
        for(let i = 0; i < c.blocks.length; i++) {
            const b = c.blocks.get(i)
            // TODO: check blocks if occupied
            _temp_block.id = b.block_id
            this.setBlock(chunk, b.cx, b.cy, b.cz, _temp_block, b.force_replace, b.rotate, b.extra_data);
        }

    }

    //
    setTreeBlock(tree, chunk, x : int, y : int, z : int, block_type : any, force_replace : boolean = false, rotate : Vector, extra_data : any) {

        const ax = chunk.coord.x + x
        const ay = chunk.coord.y + y
        const az = chunk.coord.z + z

        this._chunk_addr = getChunkAddr(ax, ay, az, this._chunk_addr)
        let c = tree.chunks.get(this._chunk_addr)
        if(!c) {
            c = {blocks: new SimpleQueue()}
            tree.chunks.set(this._chunk_addr, c)
        }

        const cx = ax - Math.floor(ax / CHUNK_SIZE_X) * CHUNK_SIZE_X;
        const cy = ay - Math.floor(ay / CHUNK_SIZE_Y) * CHUNK_SIZE_Y;
        const cz = az - Math.floor(az / CHUNK_SIZE_Z) * CHUNK_SIZE_Z;
        const block_id = block_type.id

        const block = {cx, cy, cz, block_id, force_replace, rotate, extra_data}
        tree.blocks.set(this._block_pos.set(ax, ay, az), block);
        c.blocks.push(block)

    }

    // setBlock
    setBlock(chunk : ChunkWorkerChunk, x : int, y : int, z : int, block_type : any, force_replace : boolean = false, rotate? : IVector, extra_data? : any) {
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

    // Кактус
    plantCactus(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0
        const ystart = y + tree.height;
        // ствол
        this.temp_block.id = 11
        setTreeBlock(tree, x, y - 1, z, this.temp_block, true)
        this.temp_block.id = tree.type.trunk;
        for(let p = y; p < ystart; p++) {
            setTreeBlock(tree, x, p, z, this.temp_block, true);
        }
    }

    // Бамбук
    plantBamboo(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0
        const ystart = y + tree.height;
        // ствол
        this.temp_block.id = tree.type.trunk;
        for(let p = y; p < ystart; p++) {
            let extra_data = {stage: 3};
            if(p == ystart - 1) extra_data.stage = 2;
            if(p == ystart - 2) extra_data.stage = 1;
            if(p == ystart - 3) extra_data.stage = 1;
            setTreeBlock(tree, x, p, z, this.temp_block, true, null, extra_data);
        }
    }

    // Пенёк
    plantStump(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0
        const ystart = y + tree.height;
        // ствол
        this.temp_block.id = tree.type.trunk;
        for(let p = y; p < ystart; p++) {
            setTreeBlock(tree, x, p, z, this.temp_block, true);
        }
        if(tree.type.leaves) {
            this.temp_block.id = tree.type.leaves;
            setTreeBlock(tree, x, ystart, z, this.temp_block, true);
        }
    }

    // Tundra stone
    plantTundraStone(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = -1
        const z = 0
        const ystart = y + tree.height;
        // ствол
        this.temp_block.id = tree.type.trunk;
        for(let p = y; p < ystart; p++) {
            for(let dx = -1; dx <= 1; dx++) {
                for(let dz = -1; dz <= 1; dz++) {
                    if(p != y && dx != 0 && dz != 0) {
                        continue;
                    }
                    setTreeBlock(tree, x + dx, p, z + dz, this.temp_block, true);
                }
            }
        }
    }

    // Акация
    plantAcacia(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0
        let iterations = 0;
        let that = this;
        let plant = function(x, y, z, height, px, pz, rads) {
            let ystart = y + height;
            // ствол
            for(let p = y; p < ystart; p++) {
                x += px;
                z += pz;
                that.temp_block.id = tree.type.trunk;
                setTreeBlock(tree, x, p, z, that.temp_block, true);
                // let r = random.double();
                let r = that.fastRandoms.double(x + p + z + xyz.x + xyz.y + xyz.z + height);
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
                        vec1.set(x, 0, z);
                        vec2.set(i, 0, j);
                        if(vec1.distance(vec2) > rad) {
                            continue;
                        }
                        const b = tree.blocks.get(that.xyz_temp_find.set(xyz.x + i, xyz.y + py, xyz.z + j))
                        let b_id = b?.id
                        if(!b_id || b_id >= 0 && b_id != tree.type.trunk) {
                            that.temp_block.id = tree.type.leaves;
                            setTreeBlock(tree, i, py, j, that.temp_block, false);
                        }
                    }
                }
                py--;
            }
        };
        plant(x, y, z, tree.height, 0, 0, [2, 3]);
    }

    // Ель
    plantSpruce(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        let max_rad = 5;
        let ystart = y + tree.height;

        let random = null
        const getRandom = () => {
            if(!random) {
                random = new alea('tree_' + xyz.toHash())
            }
            return random.double()
        }

        // ствол
        for(let i = 0; i < tree.height; i++) {
            this.temp_block.id = tree.type.trunk;
            let extra_data = null
            if(tree.type.has_cavity && (i == 1)) {
                if(getRandom() < 1/16) {
                    extra_data = {cavity: Math.floor(getRandom() * 4)}
                }
            }
            setTreeBlock(tree, x, y + i, z, this.temp_block, true, undefined, extra_data)
        }

        // листва
        let r = 1;
        let rad = Math.round(r);
        this.temp_block.id = tree.type.leaves;
        setTreeBlock(tree, x, ystart, z, this.temp_block, false);
        
        const is_snowy = (tree.biome_code == 'SNOW') || tree.biome?.is_snowy

        if(is_snowy) {
            this.temp_block.id = BLOCK.SNOW.id;
            setTreeBlock(tree, x, ystart + 1, z, this.temp_block, false, null, {height: 0.5});
        }

        let step = 0;
        let temp_rad = 0;
        for(let py = ystart - 1; py > ystart - (tree.height - 1); py--) {
            step++
            if(step % 2 == 0) {
                rad = Math.min(Math.round(r), max_rad);
                temp_rad = rad;
            } else if(step == 1) {
                rad = tree.height % 2;
                temp_rad = rad;
            } else {
                rad = temp_rad - 1;
            }
            for(let i = x - rad; i <= x + rad; i++) {
                for(let j = z - rad; j <= z + rad; j++) {
                    if(Math.sqrt(Math.pow(x - i, 2) + Math.pow(z - j, 2)) <= rad) {
                        const b = tree.blocks.get(this.xyz_temp_find.set(xyz.x + i, xyz.y + py, xyz.z + j))
                        const b_id = b?.id ?? 0
                        if(b_id == 0 || b_id != tree.type.trunk) {
                            this.temp_block.id = tree.type.leaves;
                            setTreeBlock(tree, i, py, j, this.temp_block, false);
                            if(is_snowy) {
                                this.temp_block.id = BLOCK.SNOW.id;
                                setTreeBlock(tree, i, py + 1, j, this.temp_block, false, null, {height: 0.5});
                            }
                        }
                    }
                }
            }
            r = Math.sqrt(step);
            if(r < 1.5) {
                this.temp_block.id = tree.type.leaves;
                setTreeBlock(tree, x, py, z, this.temp_block, true);
            }
        }

    }

    // Дуб, берёза
    plantOak(world, tree, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        const extra_data = this.makeLeavesExtraData(xyz)

        const random = new alea('tree_' + xyz.toHash())
        const cavity_chance = 1/32
        const bee_nest_chance = 1/32

        // ствол
        for(let i = 0; i < tree.height; i++) {
            this.temp_block.id = tree.type.trunk;
            let extra_data = null
            if(tree.type.has_cavity && (i == tree.height - 5)) {
                const r_cavity = random.double()
                if(r_cavity < cavity_chance) {
                    extra_data = {cavity: Math.floor((r_cavity / cavity_chance) * 4)}
                }
            }
            setTreeBlock(tree, x, y + i, z, this.temp_block, true, undefined, extra_data)
        }

        // Create bee nest
        if(tree.height > 6) {
            if(BLOCK.fromId(tree.type.trunk).name == 'BIRCH_LOG') {
                const r_bee_nest = random.double()
                if(r_bee_nest < bee_nest_chance) {
                    const side = Math.floor((r_bee_nest / bee_nest_chance) * 4)
                    const vec = Vector.ZERO.clone().addByCardinalDirectionSelf(Vector.ZP, side)
                    const bee_nest_block = BLOCK.fromName('BEE_NEST')
                    const bee_block = {id: bee_nest_block.id, extra_data: {pollen: 0, max_ticks: 100, bees: [{pollen: 0}]}}
                    setTreeBlock(tree, x + vec.x, y + 2, z + vec.z, bee_block, true, new Vector(side, 0, 0), bee_block.extra_data)
                }
            }
        }

        // // листва
        // let py = y + tree.height;
        // for(let rad of [1, 1, 2, 2]) {
        //     for(let i = x - rad; i <= x + rad; i++) {
        //         for(let j = z - rad; j <= z + rad; j++) {
        //             const m = (i == x - rad && j == z - rad) ||
        //                 (i == x + rad && j == z + rad) ||
        //                 (i == x - rad && j == z + rad) ||
        //                 (i == x + rad && j == z - rad);
        //             const m2 = (py == y + tree.height) ||
        //                 (i + xyz.x + j + xyz.z + py + xyz.y) % 3 > 0;
        //             if(m && m2) {
        //                 continue;
        //             }
        //             const b = tree.blocks.get(this.xyz_temp_find.set(xyz.x + i, xyz.y + py, xyz.z + j))
        //             const b_id = b?.id ?? 0
        //             if(b_id == 0 || b_id != tree.type.trunk) {
        //                 this.temp_block.id = tree.type.leaves;
        //                 // tree, chunk, x, y, z, block_type, force_replace, rotate, extra_data
        //                 setTreeBlock(tree, i, py, j, this.temp_block, false, null, extra_data);
        //             }
        //         }
        //     }
        //     py--;
        // }

        // листва
        this.temp_block.id = tree.type.leaves

        const y_leaves_start = y + tree.height
        const r_rad = Math.floor(random.double() * 16)
        const rad_ver = (r_rad % 4) + 2
        const rad_hor = Math.floor(r_rad / 4) + 2
        const center = new Vector(x, y_leaves_start, z)
        const pos = new Vector(0, 0, 0)

        for(let k = -rad_ver; k < rad_ver; k++) {
            const perc = (k + rad_ver) / (rad_ver * 2)
            const r = rad_ver - (perc * (rad_ver * 1.5)) + 1
            for(let i = x - rad_hor; i <= x + rad_hor; i++) {
                for(let j = z - rad_hor; j <= z + rad_hor; j++) {
                    pos.set(i, y_leaves_start + k, j)
                    if(pos.distance(center) < r) {
                        setTreeBlock(tree, i, y_leaves_start + k, j, this.temp_block, false, null, extra_data);
                    }
                }
            }
        }

    }

    // Brown mushroom
    plantBrownMushroom(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        let ystart = y + tree.height;
        // ствол
        for(let p = y; p < ystart; p++) {
            this.temp_block.id = tree.type.trunk;
            setTreeBlock(tree, x, p, z, this.temp_block, true);
        }
        // листва
        let py = y + tree.height;
        for(let rad of [1, 3]) {
            for(let i = -rad; i <= rad; i++) {
                for(let j = -rad; j <= rad; j++) {
                    if(py < y + tree.height) {
                        if(Math.abs(i) < 2 && Math.abs(j) < 2) {
                            continue;
                        }
                    }
                    let m = (i == -rad && j == -rad) ||
                        (i == rad && j == rad) ||
                        (i == -rad && j == rad) ||
                        (i == rad && j == -rad);
                    if(m && py < y + tree.height) {
                        continue;
                    }
                    const b = tree.blocks.get(this.xyz_temp_find.set(xyz.x + i + x, xyz.y + py, xyz.z + j + z))
                    const b_id = b?.id ?? 0
                    if(b_id == 0 || b_id != tree.type.trunk) {
                        this.temp_block.id = tree.type.leaves;
                        // determining which side to cover with which texture
                        let t = 0;
                        if(py >= y + tree.height - 1) t |= (1 << DIRECTION_BIT.UP); // up
                        if(i == rad) t |= (1 << DIRECTION_BIT.EAST); // east x+
                        if(i == -rad) t |= (1 << DIRECTION_BIT.WEST); // west x-
                        if(j == rad) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                        if(j == -rad) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                        //
                        if(py < y + tree.height) {
                            if((j == -rad || j == rad) && i == rad - 1) t |= (1 << DIRECTION_BIT.EAST); // east x+
                            if((j == -rad || j == rad) && i == -rad + 1) t |= (1 << DIRECTION_BIT.WEST); // west x-
                            if((i == -rad || i == rad) && j == rad - 1) t |= (1 << DIRECTION_BIT.NORTH); // north z+
                            if((i == -rad || i == rad) && j == -rad + 1) t |= (1 << DIRECTION_BIT.SOUTH); // south z-
                        }
                        const extra_data = t ? {t: t} : null;
                        setTreeBlock(tree, i + x, py, j + z, this.temp_block, false, null, extra_data);
                    }
                }
            }
            py--;
        }
        if (tree.params?.effects) {
            this.addMushroomEffects(world, xyz, BLOCK.BROWN_MUSHROOM, tree.height);
        }
    }

    // Red mushroom
    plantRedMushroom(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        // const orig_y = y
        // y -= y
        // const setTreeBlock2 = (tree : any, chunk : any, x : int, y : int, z : int, block_type : any, force_replace : boolean, rotate? : IVector, extra_data? : any) => {
        //     setTreeBlock(tree, x, y + orig_y, z, block_type, force_replace, rotate, extra_data)
        // }

        const random = new alea('tree' + xyz.toHash());
        const rskew = random.double()
        const skew_sign = rskew < .5 ? -1 : 1 // в какую сторону наклонять(- или +)
        const skew_by_x = rskew > .25 || rskew < .75 // (по какой оси, x или z)
        const skew_shift = 5 * skew_sign; // максимальное смещение ствола, количество кубов
        const height_incr_coefficient = 2; // насколько увеличить размер гриба
        const step = Math.PI / (tree.height * height_incr_coefficient);
        const height_coef = 1.2 // + .7 * ((rskew % .25) / .25); // коэффициент насколько вытянуть шляпу вверх
        const ystart = y + tree.height * height_incr_coefficient;
        const ystart_with_coef = Math.floor(ystart * height_coef);

        this.temp_block.id = tree.type.trunk;

        let s = 0; // значение для вычисления cos, которое участвует в отклонении ствола
        let x_new_pos = x;
        let z_new_pos = z;
        // отклонение первого блока от начальной координаты, для всех остальных блоков будет поправка на это значение
        // нужно чтобы гриб начинался именно со стартовой координаты
        let x_start_shift = 0;
        let z_start_shift = 0;

        const rad = tree.height;

        let skirt_center_x = x_new_pos;
        let skirt_center_z = z_new_pos;
        let skirt_radius = Math.ceil(rad / 2);
        const skirt_bottom = Math.ceil(ystart_with_coef / 4);


        for (let p = y; p < ystart_with_coef - 1; p++) {
            const c = ((Math.cos(s)) / 2) * skew_sign;
            s += step;
            if (skew_by_x) {
                x_new_pos = x - Math.floor(c * skew_shift) * skew_sign;
                if (p == y) {
                    x_start_shift = x - x_new_pos;
                }
                x_new_pos += x_start_shift;
            } else {
                z_new_pos = z - Math.floor(c * skew_shift) * skew_sign;
                if (p == y) {
                    z_start_shift = z - z_new_pos;
                }
                z_new_pos += z_start_shift;
            }
            if (p == skirt_bottom) {
                if (skew_by_x) {
                    skirt_center_x = x_new_pos + 2 * skew_sign;
                    skirt_center_z = z_new_pos + skew_sign;
                } else {
                    skirt_center_x = x_new_pos + skew_sign;
                    skirt_center_z = z_new_pos + 2 * skew_sign;
                }
            }
            setTreeBlock(tree, x_new_pos, p, z_new_pos, this.temp_block, true);
            setTreeBlock(tree, x_new_pos + skew_sign, p, z_new_pos, this.temp_block, true);
            setTreeBlock(tree, x_new_pos, p, z_new_pos + skew_sign, this.temp_block, true);
            setTreeBlock(tree, x_new_pos + skew_sign, p, z_new_pos + skew_sign, this.temp_block, true);
        }

        const x_pos = x_new_pos; // новая координата x где будет центр шляпы
        const z_pos = z_new_pos; // новая координата z где будет центр шляпы

        const bottom_pos = ystart - rad;
        const bottom_pos_with_coef = Math.ceil((bottom_pos + 1) / height_coef);
        const qube_center: Vector = new Vector(x_pos, bottom_pos, z_pos);
        const qube_pos: Vector = new Vector(x_pos - rad, bottom_pos, z_pos - rad);
        const radius_sqr = rad * rad;

        function addDirectionBit(x2 : float, y2 : float, z2 : float, direction_bit : int, y: int, prev_skipped: boolean) : int {
            let mask = 0
            // Если сдвинув координаты на 1 мы получим расстояние больше чем радиус
            // значит это последний куб в ряду и одну из сторон надо покрасить
            if ((x2 + y2 + z2) >= radius_sqr) {
                mask |= (1 << direction_bit);
                // если это самый нижний куб, то нужно подкрасить его снизу (у гриба будет кромка снизу окрашена на 1 куб)
                if (y <= bottom_pos_with_coef || prev_skipped) {
                    mask |= (1 << DIRECTION_BIT.DOWN)
                }
            }
            return mask
        }

        const determineSideToCover = (x, y, z, prev_skipped) => {

            let t = 0;
            let x2 = 1;
            let y2 = (bottom_pos - (y + 1.5)) * (bottom_pos - (y + 1.5));
            let z2 = 1;

            for (let i = -.5; i <= .5; i++) {
                x2 = (x_pos - (x + i)) * (x_pos - (x + i));
                for (let j = -.5; j <= .5; j++) {
                    z2 = (z_pos - (z + j)) * (z_pos - (z + j));
                    if ((x2 + y2 + z2) > radius_sqr) {
                        t |= (1 << DIRECTION_BIT.UP);
                    }
                }
            }

            // EAST
            x2 = (x_pos - (x + 1.5)) * (x_pos - (x + 1.5));
            y2 = (bottom_pos - (y + .5)) * (bottom_pos - (y + .5));
            z2 = (z_pos - (z + .5)) * (z_pos - (z + .5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.EAST,y,prev_skipped)
            z2 = (z_pos - (z - .5)) * (z_pos - (z - .5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.EAST,y,prev_skipped)

            // WEST
            x2 = (x_pos - (x - 1.5)) * (x_pos - (x - 1.5))
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.WEST,y,prev_skipped)
            z2 = (z_pos - (z + .5)) * (z_pos - (z + .5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.WEST,y,prev_skipped)

            // NORTH
            x2 = (x_pos - (x + .5)) * (x_pos - (x + .5));
            z2 = (z_pos - (z + 1.5)) * (z_pos - (z + 1.5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.NORTH,y,prev_skipped)
            x2 = (x_pos - (x - .5)) * (x_pos - (x - .5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.NORTH,y,prev_skipped)

            // SOUTH
            z2 = (z_pos - (z - 1.5)) * (z_pos - (z - 1.5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.SOUTH,y,prev_skipped)
            x2 = (x_pos - (x + .5)) * (x_pos - (x + .5));
            t |= addDirectionBit(x2, y2, z2, DIRECTION_BIT.SOUTH,y,prev_skipped)

            return t ? {t: t} : null;

        }

        let prev_skipped = false;
        for (let i = -rad; i <= rad; i++) {
            for (let j = -rad; j <= rad; j++) {
                for (let qube_pos_y = bottom_pos + 1; qube_pos_y <= ystart_with_coef; qube_pos_y++) {

                    if(qube_pos_y <= bottom_pos + 1) {
                        if(random.double() < .15) {
                            prev_skipped = true;
                            continue;
                        }
                    }

                    const x_shift = i < 0 ? -.5 : .5;
                    const z_shift = j < 0 ? -.5 : .5;
                    const qube_pos_x = i + x_pos;
                    const qube_pos_z = j + z_pos;
                    qube_pos.setScalar(qube_pos_x + x_shift, Math.ceil(qube_pos_y / height_coef) + .5, qube_pos_z + z_shift)
                    const dist = qube_center.distanceSqr(qube_pos)
                    if (dist > radius_sqr || dist < radius_sqr * 0.7) {
                        continue;
                    }
                    // const b = tree.blocks.get(this.xyz_temp_find.set(xyz.x + qube_pos_x, xyz.y + qube_pos_y, xyz.z + qube_pos_z))
                    // const b_id = b?.id ?? 0
                    // if (b_id == 0 || b_id != tree.type.trunk) {
                        this.temp_block.id = tree.type.leaves;
                        let extra_data = determineSideToCover(qube_pos_x, Math.ceil(qube_pos_y / height_coef), qube_pos_z, prev_skipped);
                        prev_skipped = false;
                        setTreeBlock(tree, qube_pos_x, qube_pos_y, qube_pos_z, this.temp_block, false, null, extra_data);
                    // }
                }
            }
        }
        if (tree.height > 7) {
            const skirt_center = new Vector(skirt_center_x, skirt_bottom + 1, skirt_center_z);
            const skirt_radius_sqr = skirt_radius * skirt_radius;
            for (let i = -skirt_radius; i <= skirt_radius; i++) {
                for (let j = -skirt_radius; j <= skirt_radius; j++) {
                    for (let coef = 0; coef < Math.PI; coef += .1) {
                        const x_shift = i < 0 ? -.5 : .5;
                        const z_shift = j < 0 ? -.5 : .5;
                        const qube_pos_x = i + skirt_center_x;
                        const qube_pos_z = j + skirt_center_z;
                        const c = Math.cos(coef);
                        const qube_pos_y = skirt_bottom + Math.ceil((c + 2) / 3 * skirt_radius);
                        qube_pos.setScalar(qube_pos_x + x_shift, qube_pos_y + .5, qube_pos_z + z_shift);
                        const dist = skirt_center.distanceSqr(qube_pos)
                        if (dist > skirt_radius_sqr || dist < skirt_radius_sqr * .7) {
                            continue;
                        }
                        this.temp_block.id = tree.type.leaves;
                        let extra_data = null;
                        setTreeBlock(tree, qube_pos_x, qube_pos_y, qube_pos_z, this.temp_block, false, null, extra_data);
                    }
                }
            }
        }
        if (tree.params?.effects) {
            this.addMushroomEffects(world, xyz, BLOCK.RED_MUSHROOM, tree.height * height_incr_coefficient);
        }

    }

    // Тропическое дерево
    plantJungle(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        const TREE_HEIGHT = tree.height - 2 // рандомная высота дерева, переданная из генератора
        const ystart = y + TREE_HEIGHT
        const maxW = Math.floor(TREE_HEIGHT / 2)
        const minW = Math.floor(TREE_HEIGHT / 3)
        const mainseed = xyz.x + xyz.y + xyz.z;
        const vine_block = _cache.vine_block || (_cache.vine_block = { id: BLOCK.VINE.id })
        const vine_blocks = _cache.vine_blocks || (_cache.vine_blocks = [
            {...vine_block, extra_data: {north: true, east: true, rotate: false}},
            {...vine_block, extra_data: {east: true, south: true, rotate: false}},
            {...vine_block, extra_data: {south: true, west: true, rotate: false}},
            {...vine_block, extra_data: {west: true, north: true, rotate: false}},
        ])
        // получаю большое число
        const cnt = Math.floor(this.fastRandoms.double(mainseed + tree.height) * Math.pow(2, 58))
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
        const random = new alea('tree' + xyz.toHash());
        this.temp_block.id = tree.type.trunk;
        for(let py = y; py < ystart; py++) {
            setTreeBlock(tree, x, py, z, this.temp_block, true);
            let block_id = vine_block.id;
            let extra_data = null;
            const makeCocoa = () => {
                if(random.double() < .04 && py < y + 4) {
                    block_id = BLOCK.COCOA_BEANS.id;
                    extra_data = {stage: 2};
                }
            }
            const apy = xyz.y + py
            if((apy + arr[apy % 7]) % 2 == 0) {
                makeCocoa();
                setTreeBlock(tree, x + 1, py, z, { id: block_id }, false, new Vector(3, 0, 0), extra_data)
            }
            if((apy + arr[(apy + 1) % 7]) % 2 == 0) {
                makeCocoa();
                setTreeBlock(tree, x - 1, py, z, { id: block_id }, false, new Vector(1, 0, 0), extra_data)
            }
            if((apy + arr[(apy + 2) % 7]) % 2 == 0) {
                makeCocoa();
                setTreeBlock(tree, x, py, z + 1, { id: block_id }, false, new Vector(0, 0, 3), extra_data)
            }
            if((apy + arr[(apy + 3) % 7]) % 2 == 0) {
                makeCocoa();
                setTreeBlock(tree, x, py, z - 1, { id: block_id }, false, new Vector(2, 0, 0), extra_data)
            }
        }
        // рисование кроны дерева
        const generateLeaves = (x, y, z, rad, rnd) => {
            for(let h = 0; h <= 1; h++) {
                let w = Math.max(rad - h * 2, 5 - h)
                let dx = Math.floor(x - w / 2)
                let dz = Math.floor(z - w / 2)
                // let d = null
                for(let i = dx; i <= dx + w; i++) {
                    for(let j = dz; j <= dz + w; j++) {
                        const l = Math.abs(Math.sqrt(Math.pow(i - x, 2) + Math.pow(j - z, 2)))
                        if(l <= w / 2) {
                            const b = tree.blocks.get(this.xyz_temp_find.set(xyz.x + i, xyz.y + y + h, xyz.z + j))
                            const b_id = b?.id ?? 0
                            if(b_id == 0 || b_id != tree.type.trunk) {
                                this.temp_block.id = tree.type.leaves;
                                setTreeBlock(tree, i, y + h, j, this.temp_block, false);
                                if (
                                    rad % 2 == 0 &&
                                    h == 0 &&
                                    (i == dx || i == dx + w || j == dz || j == dz + w)
                                ) {
                                    const vb_index = i == dx ? 3 : i == dx + w ? 1 : j == dz + w ? 2 : 0
                                    const vb = vine_blocks[vb_index]
                                    // const rot = new Vector(
                                    //     vb_index,
                                    //     0,
                                    //     j == dz ? 3 : 0
                                    // )
                                    for(let t = 1; t <= Math.floor(1 + rad * (arr[1 + (t % 6)] / 255)); t++) {
                                        setTreeBlock(
                                            tree,
                                            i, y + h - t, j,
                                            vb,
                                            false,
                                            null, // rot,
                                            vb.extra_data
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
            this.temp_block.id = tree.type.trunk;
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
                setTreeBlock(tree, x1, y + pos + dy, z1, this.temp_block, true);
            }
            this.temp_block.id = tree.type.leaves
            generateLeaves(x1, y + pos + dy + 1, z1, rad, arr)
        }
        // рисуем крону основного дерева
        this.temp_block.id = tree.type.leaves
        generateLeaves(x, ystart, z, Math.floor(minW + (maxW * arr[0]) / 255), arr)
    }

    // Тестовое дерево
    plantTestTree(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {
        const x = 0
        const y = 0
        const z = 0

        const conus_rad = 16;
        const random_alea2 = new alea('tree_big' + xyz.toHash());
        const blocks = [BLOCK.GREEN_CONCRETE, BLOCK.GREEN_CONCRETE_POWDER, BLOCK.GREEN_TERRACOTTA, BLOCK.MOSS_BLOCK, BLOCK.GREEN_WOOL];

        for(let k = 0; k < conus_rad * 2; k++) {
            const y2 = y + conus_rad * 2 - k - 1
            for(let i = -conus_rad; i < conus_rad; i++) {
                for(let j = -conus_rad; j < conus_rad; j++) {
                    const dist = Math.sqrt(
                        (x - (x+i)) * (x - (x+i)) +
                        (y + conus_rad - (y2*2)) * (y + conus_rad- (y2*2)) +
                        (z - (z+j)) * (z - (z+j))
                    )
                    if(dist <= conus_rad * .9) {
                        const block = blocks[(random_alea2.double() * blocks.length) | 0];
                        setTreeBlock(tree, x + i, y2, z + j, block, true);
                    }
                }
            }
        }

    }

    // Большой дуб
    plantBigOak(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {

        const x = 0
        const y = 0
        const z = 0

        // высоту нужно принудительно контроллировать, чтобы она не стала выше высоты 1 чанка
        const height = Math.min(CHUNK_SIZE_Y - 12, tree.height); // рандомная высота дерева, переданная из генератор
        const getRandom = createFastRandom('tree_big' + xyz.toHash(), 128)

        // рисуем корни
        const generateRoots = (x, y, z) => {
            this.temp_block.id = tree.type.trunk;
            const h = 0
            for(let n of [[0,1],[0,-1],[1,0],[-1,0]]) {
                for(let k = -h; k < 3; k++) {
                    setTreeBlock(tree, x + n[0], y - k, z + n[1], this.temp_block, true);
                }
            }
        };

        // рисование кроны дерева
        const generateLeaves = (x : int, y : int, z : int, rad : number) => {
            
            let extra_data = this.makeLeavesExtraData(xyz.add(new Vector(0, y, 0)))
            if(extra_data) {
                if(extra_data.v == 0) {
                    extra_data.v = 1
                }
            }

            const LEAVES_THRESHOLD = .5;
            const LEAVES_THICNESS_MUL = (1 + 1.25 * getRandom()) // коэффициент сплющивания кроны

            rad = 4 - Math.round(1 - y / height); // чем ниже листва, тем радиус меньше
            this.temp_block.id = tree.type.leaves;

            for(let k = -rad; k <= rad; k++) {
                for(let i = -rad; i <= rad; i++) {
                    for(let j = - rad; j <= rad; j++) {

                        const rnd = getRandom();
                        if(rnd > LEAVES_THRESHOLD) continue; // полностью отбрасываем часть листвы

                        const dx = i
                        const dy = k * LEAVES_THICNESS_MUL
                        const dz = j
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

                        // расстояния до центра "шара" кроны
                        if(dist <= rad) {
                            // tree, chunk, x, y, z, block_type, force_replace, rotate, extra_data
                            if(extra_data) {
                                if(xyz.y % 2 == 0) {
                                    extra_data = {v: Math.floor(Math.random() * 3)}
                                    if(extra_data.v == 0) {
                                        extra_data.v = 3
                                    }
                                }
                            }
                            setTreeBlock(tree, x + i, y + k, z + j, this.temp_block, false, null, extra_data);
                        }

                    }
                }
            }

        }

        // рисуем линии веток
        const LineBresenham3D = (sx, sy, sz, ex, ey, ez) => {
            let x = sx;
            let y = sy;
            let z = sz;
            const sign_x = ex > sx ? 1 : -1;
            const sign_y = ey > sy ? 1 : -1;
            const sign_z = ez > sz ? 1 : -1;
            this.temp_block.id = tree.type.trunk;
            for (let n = 0; n < 10; n++) {
                let dx = Math.abs(ex - x);
                let dy = Math.abs(ey - y);
                let dz = Math.abs(ez - z);
                if (dx == 0 && dy == 0 && dz == 0) {
                    break;
                }
                if (dx >= dy && dx >= dz) {
                    x += sign_x;
                    setTreeBlock(tree, x, y, z, this.temp_block, true);
                } else if (dz >= dx && dz >= dy) {
                    z += sign_z;
                    setTreeBlock(tree, x, y, z, this.temp_block, true);
                } else if (dy >= dx && dy >= dz) {
                    y++;
                }
            }
        }

        // Ветки с вероятностью
        const genOldRing = (h, bonus = 0) => {
            const MIN_RADIUS = 4;
            let rad = (getRandom() * 7 | 0) + bonus;
            if (rad > 1) {
                let sign = (getRandom() > 0.5) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + sign * rad, y + h + 4, z + MIN_RADIUS);
                generateLeaves(x + sign * rad, y + h + 3, z + MIN_RADIUS, rad);
            }
            h += 1;
            rad = (getRandom() * 7 | 0) + bonus;
            if (rad > 1) {
                let sign = (getRandom() > 0.5) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + sign * rad, y + h + 4, z - MIN_RADIUS);
                generateLeaves(x + sign * rad, y + h + 3, z - MIN_RADIUS, rad);
            }
            h += 1;
            rad = (getRandom() * 7 | 0) + bonus;
            if (rad > 1) {
                let sign = (getRandom() > 0.5) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x + MIN_RADIUS, y + h + 4, z + sign * rad);
                generateLeaves(x + MIN_RADIUS, y + h + 3, z + sign * rad, rad);
            }
            h += 1;
            rad = (getRandom() * 7 | 0) + bonus;
            if (rad > 1) {
                let sign = (getRandom() > 0.5) ? -1 : 1;
                LineBresenham3D(x, y + h , z, x - MIN_RADIUS, y + h + 4, z + sign * rad);
                generateLeaves(x - MIN_RADIUS, y + h + 3, z + sign * rad, rad);
            }
        }

        // основной ствол
        for(let i = 0; i < height; i++) {
            this.temp_block.id = tree.type.trunk;
            setTreeBlock(tree, x, y + i, z, this.temp_block, true);
        }

        // листва основной кроны
        generateLeaves(x, y + height, z, 10);

        // ветки на разных уровнях
        if (height > 10) {
            genOldRing(4);
        }
        if (height > 16) {
            genOldRing(12);
        }
        if (height > 24) {
            genOldRing(20);
        }
        if (height > 32) {
            genOldRing(28);
        }

        // корни дерева
        generateRoots(x, y, z);

    }

    // Дерево хоруса
    plantChorus(world : any, tree : any, xyz : Vector, setTreeBlock : ISetTreeBlock) {

        const x = 0
        const y = 0
        const z = 0

        const blocks        = new Map()
        const faces         = [Vector.XN, Vector.XP, Vector.ZN, Vector.ZP, Vector.YP]
        const trunk_block   = {id: tree.type.trunk}
        const leaves_block  = {id: tree.type.leaves}

        const isNeighbors = (pos : Vector, ignore? : Vector) : boolean => {
            for (const face of faces) {
                const position = pos.add(face)
                if (ignore && position.equal(ignore)) {
                    continue
                }
                if (blocks.has(position.toHash())) {
                    return true
                }
            }
            return false
        }

        let ages = 0
        const random = new alea('chorus' + xyz.toHash())

        const setChorus = (pos : Vector) => {
            if (ages++ > 20) {
                return
            }
            for (let i = 0; i < tree.height; i++) {
                const tmp_pos = pos.offset(0, i, 0)
                blocks.set(tmp_pos.toHash(), true)
                if (isNeighbors(tmp_pos) && i != 0) {
                    return
                }
                setTreeBlock(tree, tmp_pos.x, tmp_pos.y, tmp_pos.z, trunk_block, false)
                if (random.double() < 0.35) {
                    const age = random.nextInt(4)
                    for (let l = 0; l < age; l++) {
                        const sh_x = random.nextInt(3) - 1
                        const sh_z = (sh_x == 0) ? random.nextInt(3) - 1 : 0
                        const sh_pos = tmp_pos.offset(sh_x, 0, sh_z)
                        if (!isNeighbors(sh_pos, tmp_pos)) {
                            setChorus(sh_pos)
                        }
                    }
                    return
                }
            }
            setTreeBlock(tree, pos.x, pos.y + tree.height, pos.z, leaves_block, false, null, {notick: true})
        }

        setChorus(new Vector(x, y + 1, z))

    }
    
    makeLeavesExtraData(xyz : Vector) {
        const pss = (xyz.x + xyz.z)
        return pss % 10 == 0 ? {v: xyz.y % 3} : null
    }

    addMushroomEffects(world, xyz : Vector, world_material, height) {
        height = Math.min(height, 4);
        const particles = [];
        for(let dy = 0; dy < height; dy++) {
            for(let dx = -0.5; dx <= 0.5; dx++) {
                for(let dz = -0.5; dz <= 0.5; dz++) {
                    particles.push({
                        type: 'villager_happy',
                        pos: xyz.clone().addScalarSelf(dx, dy, dz)
                    });
                }
            }
        }
        const actions = new WorldAction();
        actions.addParticles(particles);
        actions.addPlaySound({
            tag: world_material.sound,
            action: 'place',
            pos: xyz
        });
        world.actions_queue.add(null, actions);
    }

    destroyMapsAroundPlayers(players : IDestroyMapsAroundPlayers[]) : int {
        return 0
    }

}