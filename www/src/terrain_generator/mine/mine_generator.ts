import {Vector, VectorCollector, DIRECTION} from '../../helpers.js';
import { impl as alea } from '../../../vendors/alea.js';
import { AABB } from "../../core/AABB.js";
import { CD_ROT } from "../../core/CubeSym.js";
import { DEFAULT_MOB_TEXTURE_NAME, MOB_TYPE, TREASURE_SOURCE } from '../../constant.js';
import type { ChunkWorkerChunk } from "../../worker/chunk.js";
import type { Biome3LayerBase } from "../biome3/layers/base.js";

const BARREL_CHANCE     = 0.02
const BARREL_EXTRA_DATA = {slots: {}}
const SIZE_CLUSTER      = 8
const EMPTY_CHANCE      = 0.25
const LANTERN_ROT_UP    = new Vector(0, -1, 0)
const LANTERN_CHANCE    = 0.02
const CHEST_ROT         = new Vector(DIRECTION.SOUTH, 1, 0)
const DEFAULT_BLOCK_AIR = {id : 0}

export interface MineOptions {
    chance_hal:         float
    chance_cross:       float
    chance_side_room:   float
}

export interface MineNode {
    dir:        int
    type:       string
    bottom_y:   int
    shift:      boolean
}

/**
 * Draw mines
 */
export class MineGenerator {
    addr:               Vector
    coord:              Vector
    random:             alea
    is_empty:           boolean
    mine_size:          Vector
    node_size:          Vector
    node_count:         Vector
    chunk_size:         Vector
    nodes:              VectorCollector
    generator:          Biome3LayerBase
    chance_hal:         float
    chance_cross:       float
    chance_side_room:   float
    voxel_buildings:    any[]

    _get_vec:           Vector
    xyz_temp_coord:     Vector

    static all = new VectorCollector()

    constructor(generator : Biome3LayerBase, addr : Vector, options : MineOptions) {
        this.generator          = generator
        this.addr               = addr.clone()

        const {chunkSize} = generator.clusterManager.chunkManager.grid

        this.mine_size          = new Vector(chunkSize.x * SIZE_CLUSTER, chunkSize.y, chunkSize.z * SIZE_CLUSTER)
        this.node_size          = new Vector(chunkSize.x, 4, chunkSize.z)
        this.node_count         = this.mine_size.div(this.node_size)
        this.chunk_size         = chunkSize.clone()
        this.coord              = addr.clone().multiplyVecSelf(this.mine_size)
        this.random             = new alea(this.addr.toHash())
        this.is_empty           = this.random.double() > EMPTY_CHANCE

        if(!this.is_empty) {
            this.chance_hal         = options?.chance_hal ?? 0.75
            this.chance_cross       = options?.chance_cross ?? 0.6
            this.chance_side_room   = options?.chance_side_room ?? 0
            //
            this._get_vec           = new Vector(0, 0, 0)
            this.voxel_buildings    = []
            //
            this.nodes = new VectorCollector()
            const bottom_y = Math.floor(this.random.double() * (this.node_count.y - 2));
            const x = Math.round(this.node_count.x / 2);
            const z = Math.round(this.node_count.z / 2);
            this.genNodeMine(x, bottom_y, z, DIRECTION.SOUTH)
            this.is_empty = this.nodes.size == 0;
            this.xyz_temp_coord = new Vector(0, 0, 0);
        }

    }

    // getForCoord
    static getForCoord(generator, chunk_coord : IVector, chunkSize : IVector) {
        const mine_size = new Vector(chunkSize.x * SIZE_CLUSTER, chunkSize.y, chunkSize.z * SIZE_CLUSTER)
        const addr = new Vector(chunk_coord.x, 0, chunk_coord.z).divScalarVecSelf(mine_size).flooredSelf();
        let mine = MineGenerator.all.get(addr);
        if(mine) {
            return mine;
        }
        const options = {
            'chance_hal' : 0.4
        } as MineOptions;
        mine = new MineGenerator(generator, addr, options);
        MineGenerator.all.set(addr, mine);
        return mine;
    }

    // generate node
    genNodeMine(x : int, y : int, z : int, dir : int) {

        if (x > this.node_count.x || x < 0 || y > this.node_count.y || y < 0 || z > this.node_count.z || z < 0) {
            return;
        }

        let new_x = x, new_y = y, new_z = z;

        if (dir == DIRECTION.SOUTH) {
            ++new_z;
        } else if (dir == DIRECTION.EAST) {
            ++new_x;
        } else if (dir == DIRECTION.NORTH) {
            --new_z;
        } else if (dir == DIRECTION.WEST){
            --new_x;
        }

        if (this.nodes.size == 0) {
            this.addNode(x, y, z, dir, 'cross'); // enter
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.WEST, dir));
        }

        const node = this.findNodeMine(new_x, new_y, new_z);
        if (node != null) {
            return;
        }

        if (this.random.double() < this.chance_cross) {
            this.addNode(new_x, new_y, new_z, dir, 'cross');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }

        if (this.random.double() < this.chance_hal) {
            this.addNode(new_x, new_y, new_z, dir, 'hal');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            return;
        }

        if (this.random.double() < this.chance_side_room) {
            this.addNode(new_x, new_y, new_z, dir, 'room');
        }

    }

    // Generate chunk blocks
    fillBlocks(chunk : ChunkWorkerChunk) : boolean {

        if(this.is_empty) {
            return false
        }

        const aabb = new AABB()

        aabb.x_min = (chunk.coord.x - this.coord.x) / this.node_size.x;
        aabb.z_min = (chunk.coord.z - this.coord.z) / this.node_size.z;
        aabb.x_max = aabb.x_min;
        aabb.z_max = aabb.z_min;
        aabb.y_max = this.node_count.y;

        for(const [_, node] of this.nodes.entries(aabb)) {
            switch(node.type) {
                // case 'enter': {
                //     this.genNodeEnter(chunk, node)
                //     break
                // }
                case 'cross': {
                    this.genNodeCross(chunk, node)
                    break
                }
                case 'hal': {
                    this.genNodeHal(chunk, node)
                    break
                }
                case 'room': {
                    this.genNodeSideRoom(chunk, node)
                    break
                }
            }
        }

        return true

    }

    // Generate sideroom node
    genNodeSideRoom(chunk : ChunkWorkerChunk, node : MineNode) {
        const random = new alea(chunk.addr.toHash())
        const dir = node.dir;

        this.genBox(chunk, node, random, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, random, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, random, 1, 1, 1, 8, 3, 4, dir);

        const vec = new Vector(0, 0, 0);
        vec.set(8, 3, 4).rotY(dir, this.chunk_size.x)
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);

        vec.set(1, 1, 1).rotY(dir, this.chunk_size.x)
        const chest_rot = CHEST_ROT;
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.CHEST, true, chest_rot, {generate: true, params: {source: TREASURE_SOURCE.CAVE_MINES}});

        // Спавнер
        vec.set(4, 1, 2).rotY(dir, this.chunk_size.x)
        const mob_type = random.double() < 0.75 ? MOB_TYPE.ZOMBIE : MOB_TYPE.SKELETON
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.MOB_SPAWN, true, {x: 0, y: 0, z: 0}, {
            type:       mob_type,
            skin:       DEFAULT_MOB_TEXTURE_NAME,
            max_ticks:  800
        })
    }

    // Generate cross node
    genNodeCross(chunk : ChunkWorkerChunk, node : MineNode) {
        const csx = this.chunk_size.x - 1
        const csx1 = csx - 1
        const csx2 = csx - 2
        const csx3 = csx - 3
        const csx4 = csx - 4

        const random = new alea(chunk.addr.toHash())
        const dir = node.dir;
        this.genBox(chunk, node, random, 0, 1, 0, 4, 4, csx, dir, BLOCK.AIR, 0.02)
        this.genBox(chunk, node, random, 4, 1, csx4, csx, 4, csx, dir, BLOCK.AIR, 0.02)

        this.genBox(chunk, node, random, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, node, random, 1, 1, 0, 3, 3, csx, dir);
        this.genBox(chunk, node, random, 1, 1, csx3, csx, 3, csx1, dir);

        // floor as bridge over air
        this.genBox(chunk, node, random, 1, 0, 0, 3, 0, csx, dir, BLOCK.OAK_PLANKS, 1, true);
        this.genBox(chunk, node, random, 1, 0, csx3, csx, 0, csx1, dir, BLOCK.OAK_PLANKS, 1, true);
        this.genBox(chunk, node, random, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLANKS, 1, true);

        const interval = Math.round(random.double()) + 4;
        const sign = dir % 2 == 1 ? -1 : 1;
        const torch_dir = dir + 1 * sign

        for (let n = 0; n <= csx; n += interval) {

            if (n == 0 || n == csx) {
                continue
            }

            // опоры
            this.genBox(chunk, node, random, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANKS);

            this.genBox(chunk, node, random, n, 1, csx1, n, 2, csx1, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, n, 1, csx3, n, 2, csx3, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, n, 3, csx3, n, 3, csx1, dir, BLOCK.OAK_PLANKS);

            this.genBox(chunk, node, random, n + 1, 3, csx2, n + 1, 3, csx2, dir, BLOCK.TORCH, .3, false, new Vector(torch_dir % 4, 0, 0));
            this.genBox(chunk, node, random, n - 1, 3, csx2, n - 1, 3, csx2, dir, BLOCK.TORCH, .3, false, new Vector((torch_dir + 2) % 4, 0, 0));

            // паутина
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);

            this.genBoxAir(chunk, node, random, n - 3, 3, csx1, n + 3, 3, csx1, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, random, n - 3, 3, csx3, n + 3, 3, csx3, dir, BLOCK.COBWEB, 0.05);

            // факелы
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.1, LANTERN_ROT_UP);

            this.genBoxAir(chunk, node, random, n - 3, 3, csx1, n + 3, 3, csx1, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, n - 3, 3, csx3, n + 3, 3, csx3, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
        }

        // рельсы
        const shape = dir % 2
        this.genBoxAir(chunk, node, random, 2, 1, 0, 2, 1, 0 + csx, dir, BLOCK.RAIL, 0.7, undefined, {shape}, false)
        this.genBoxAir(chunk, node, random, 4, 1, csx2, csx, 1, csx2, dir, BLOCK.RAIL, 0.7, undefined, {shape: (dir + 1) % 2}, false)

        // грибы
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, csx, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, csx, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, csx, dir, BLOCK.BROWN_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, csx, dir, BLOCK.BROWN_MUSHROOM, 0.01)

        // динамит 
        this.genGroundDecor(chunk, node, random, 4, 1, csx3, 5, 1, csx1, dir, BLOCK.TNT, 0.05)

        // свечи немного 
        this.genGroundDecor(chunk, node, random, 0, 2, 0, 0, 2, csx, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, 0, 4, 2, csx, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, csx4, csx, 2, csx4, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, csx, csx, 2, csx, dir, BLOCK.BLACK_CANDLE, 0.01)

        // куски камней
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, csx, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, csx, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 0, 1, csx3, csx, 1, csx3, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 0, 1, csx1, csx, 1, csx1, dir, BLOCK.PEBBLES, 0.04)

        // бочки
        this.genWallDecor(chunk, node, random, 1, 1, 0, 1, 1, csx, dir, true, BLOCK.BARREL, BARREL_CHANCE, undefined, BARREL_EXTRA_DATA)
        this.genWallDecor(chunk, node, random, 3, 1, 0, 3, 1, csx, dir, true, BLOCK.BARREL, BARREL_CHANCE, undefined, BARREL_EXTRA_DATA)
        this.genGroundDecor(chunk, node, random, 0, 1, csx3, csx, 1, csx3, dir, BLOCK.BARREL, BARREL_CHANCE)
        this.genGroundDecor(chunk, node, random, 0, 1, csx1, csx, 1, csx1, dir, BLOCK.BARREL, BARREL_CHANCE)
    }

    // Generate hal node
    genNodeHal(chunk : ChunkWorkerChunk, node : MineNode) {
        const csx = this.chunk_size.x - 1

        const random = new alea(chunk.addr.toHash())
        const dir = node.dir
        const interval = Math.round(random.double()) + 4
        const interval_half = Math.round(interval / 2)

        for(let block of [BLOCK.POOR_COAL_ORE, BLOCK.POOR_IRON_ORE]) {
            this.genBox(chunk, node, random, 0, 1, 0, 4, 4, csx, dir, block, 0.02)
        }

        this.genBox(chunk, node, random, 1, 1, 0, 3, 3, csx, dir, BLOCK.AIR)

        for (let n = 1; n < csx; n++) {
            // vines on walls
            let ex1 = null
            let ex2 = null
            const vine_chance = .35
            if(dir == DIRECTION.EAST) {
                ex1 = {rotate: false, south: true}
                ex2 = {rotate: false, north: true}
            } else if(dir == DIRECTION.WEST) {
                ex1 = {rotate: false, north: true}
                ex2 = {rotate: false, south: true}
            } else if(dir == DIRECTION.NORTH) {
                ex1 = {rotate: false, west: true}
                ex2 = {rotate: false, east: true}
            } else if(dir == DIRECTION.SOUTH) {
                ex1 = {rotate: false, east: true}
                ex2 = {rotate: false, west: true}
            }
            this.genWallDecor(chunk, node, random, 1, 1, n, 1, 3, n, dir, true, BLOCK.VINE, vine_chance, undefined, ex1)
            this.genWallDecor(chunk, node, random, 3, 1, n, 3, 3, n, dir, false, BLOCK.VINE, vine_chance, undefined, ex2)
            // torches on walls
            if(n % interval == interval_half) {
                let torch_rotate1 = null
                let torch_rotate2 = null
                const torch_chance = .5
                if(dir == DIRECTION.NORTH) {
                    torch_rotate1 = new Vector(DIRECTION.WEST, 0, 0)
                    torch_rotate2 = new Vector(DIRECTION.EAST, 0, 0)
                } else if(dir == DIRECTION.SOUTH) {
                    torch_rotate1 = new Vector(DIRECTION.EAST, 0, 0)
                    torch_rotate2 = new Vector(DIRECTION.WEST, 0, 0)
                } else if(dir == DIRECTION.WEST) {
                    torch_rotate1 = new Vector(DIRECTION.NORTH, 0, 0)
                    torch_rotate2 = new Vector(DIRECTION.SOUTH, 0, 0)
                } else if(dir == DIRECTION.EAST) {
                    torch_rotate1 = new Vector(DIRECTION.SOUTH, 0, 0)
                    torch_rotate2 = new Vector(DIRECTION.NORTH, 0, 0)
                }
                this.genWallDecor(chunk, node, random, 1, 2, n, 1, 2, n, dir, true, BLOCK.TORCH, torch_chance, torch_rotate1)
                this.genWallDecor(chunk, node, random, 3, 2, n, 3, 2, n, dir, false, BLOCK.TORCH, torch_chance, torch_rotate2)
            }
        }

        // floor
        this.genBox(chunk, node, random, 1, 0, 0, 3, 0, csx, dir, BLOCK.OAK_PLANKS, 1, true);

        for (let n = 0; n <= csx; n += interval) {

            if (n == 0 || n == csx) {
                continue
            }

            this.genBox(chunk, node, random, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANKS);

            this.genBoxNoAir(chunk, node, random, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANKS, 0.25);

            this.genBoxAir(chunk, node, random, 1, 3, n - 1, 1, 3, n + 1, dir, BLOCK.COBBLESTONE, 0.25); // добавить из окружения
            this.genBoxAir(chunk, node, random, 3, 3, n - 1, 3, 3, n + 1, dir, BLOCK.DIRT, 0.25);

            // паутина
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);

            // лампа
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
        }

        // рельсы
        const shape = dir % 2
        this.genBoxAir(chunk, node, random, 2, 1, 0, 2, 1, 0 + csx, dir, BLOCK.RAIL, 0.7, undefined, {shape}, false)

        // грибы
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, csx, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, csx, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, csx, dir, BLOCK.BROWN_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, csx, dir, BLOCK.BROWN_MUSHROOM, 0.01)

        // булыжники
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, csx, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, csx, dir, BLOCK.PEBBLES, 0.04)

        // бочки
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, csx, dir, BLOCK.BARREL, BARREL_CHANCE)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, csx, dir, BLOCK.BARREL, BARREL_CHANCE)

    }

    // Add new node
    addNode(x : int, y : int, z : int, dir : int, type : string) {
        if (this.nodes.has(new Vector(x, y, z))) {
            return
        }
        const shift = this.random.double() >= .5
        let add_bottom_y = shift ? 1 : 0;
        const bottom_y = y * this.node_size.y + add_bottom_y;
        this.nodes.set(new Vector(x, y, z), {dir, type, bottom_y, shift} as MineNode)
    }

    findNodeMine(x : int, y : int, z : int) : MineNode | null {
        return this.nodes.get(this._get_vec.set(x, y, z)) || null
    }

    setBlock(chunk : ChunkWorkerChunk, node : MineNode, x : int, y : int, z : int, block_item : IBlockItem, force_replace : boolean, rotate? : IVector, extra_data? : any) {
        y += node.bottom_y;

        const { tblocks } = chunk;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !tblocks.getBlockId(x, y, z)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                const gen = this.generator as any
                const has_voxel_buildings = !!gen.getVoxelBuilding
                if(!has_voxel_buildings || !gen.getVoxelBuilding(this.xyz_temp_coord)) {
                    tblocks.setBlockId(x, y, z, block_item.id);
                    if(rotate || extra_data) {
                        tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data)
                    }
                }
            }
        }
    }

    getBlock(chunk : ChunkWorkerChunk, node : MineNode, x : int, y : int, z : int) {
        y += node.bottom_y;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }

    wrapRotation(dir : int, angle : int) {
        let new_dir = dir - angle;
        if (new_dir == -1) {
            new_dir = 3;
        } else if (new_dir == -2) {
            new_dir = 2;
        }
        return new_dir;
    }

    /**
     * TO DO EN генерация бокса внутри чанка, генерация с вероятностью установки
     * @param dir поворот внутри чанка
     * @param chance вероятность установки
     * @param only_if_air только если на позиции блок воздуха
     * @param block_rotate поворот блока
     */
    genBox(chunk : ChunkWorkerChunk, node : MineNode, random : alea, minX : int, minY : int, minZ : int, maxX : int, maxY : int, maxZ : int, dir: DIRECTION = DIRECTION.NORTH, block_item : IBlockItem = DEFAULT_BLOCK_AIR, chance = 1, only_if_air : boolean = false, block_rotate : Vector = null) {
        const vec = new Vector()
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    const is_chance = (chance == 1) ? true : random.double() < chance;
                    if (is_chance) {
                        vec.set(x, y, z).rotY(dir, this.chunk_size.x)
                        if(only_if_air) {
                            const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                            if(temp_block?.id != 0) {
                                continue;
                            }
                        }
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, block_item, true, block_rotate);
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена воздуха на блок с вероятностью
     * @param dir поворот внутри чанка
     * @param chance вероятность замены
     * @param block_rotate поворот блока
     */
    genBoxAir(chunk : ChunkWorkerChunk, node : MineNode, random : alea, minX : int, minY : int, minZ : int, maxX : int, maxY : int, maxZ : int, dir = DIRECTION.NORTH, block_item : IBlockItem = DEFAULT_BLOCK_AIR, chance = 1, block_rotate = null, extra_data? : any, check_air : boolean = true) {
        const vec = new Vector()
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    vec.set(x, y, z).rotY(dir, this.chunk_size.x)
                    const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    const temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
                    if(!check_air || (temp_block_over && temp_block_over.id != 0)) {
                        let is_chance = (chance == 1) ?  true : random.double() < chance;
                        if (is_chance && temp_block?.id == 0 && temp_block?.fluid == 0) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block_item, true, block_rotate, extra_data);
                        }
                    }
                }
            }
        }
    }

    genWallDecor(chunk : ChunkWorkerChunk, node : MineNode, random : alea, minX : int, minY : int, minZ : int, maxX : int, maxY : int, maxZ : int, dir = DIRECTION.NORTH, left_wall: boolean = true, block_item : IBlockItem = DEFAULT_BLOCK_AIR, chance : float = 1.0, block_rotate = null, extra_data? : any) {
        let wall_dir = 0
        const vec = new Vector()
        const check_vec = new Vector()
        if(dir == DIRECTION.EAST) {
            wall_dir = left_wall ? 1 : 3
        } else if(dir == DIRECTION.WEST) {
            wall_dir = left_wall ? 3 : 1
        } else if(dir == DIRECTION.NORTH) {
            wall_dir = left_wall ? 0 : 2
        } else if(dir == DIRECTION.SOUTH) {
            wall_dir = left_wall ? 2 : 0
        }
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    vec.set(x, y, z).rotY(dir, this.chunk_size.x)
                    check_vec.copyFrom(vec).addByCardinalDirectionSelf(Vector.XP, wall_dir)
                    const wall_block = this.getBlock(chunk, node, check_vec.x, check_vec.y, check_vec.z)
                    if(wall_block && wall_block.id != 0) {
                        if((chance == 1) || random.double() < chance) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block_item, true, block_rotate, extra_data)
                        }
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена не воздуха на блок с вероятностью
     * @param dir поворот внутри чанка
     * @param chance вероятность замены
     */
    genBoxNoAir(chunk : ChunkWorkerChunk, node : MineNode, random : alea, minX : int, minY : int, minZ : int, maxX : int, maxY : int, maxZ : int, dir = DIRECTION.NORTH, block_item : IBlockItem = DEFAULT_BLOCK_AIR, chance = 1) {
        const vec = new Vector()
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    vec.set(x, y, z).rotY(dir, this.chunk_size.x)
                    const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    const is_chance = (chance == 1) ?  true : random.double() < chance;
                    if (is_chance == true && temp_block?.id != 0) {
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, block_item, true);
                    }
                }
            }
        }
    }

    genGroundDecor(chunk : ChunkWorkerChunk, node : MineNode, random : alea, minX : int, minY : int, minZ : int, maxX : int, maxY : int, maxZ : int, dir = DIRECTION.NORTH, block_item : IBlockItem = DEFAULT_BLOCK_AIR, chance : float = 1) {
        const vec = new Vector()
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    vec.set(x, y, z).rotY(dir, this.chunk_size.x)
                    const temp_block_under = this.getBlock(chunk, node, vec.x, vec.y - 1, vec.z)
                    if (temp_block_under && temp_block_under.id != 0 && temp_block_under.material.is_solid) {
                        const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                        const is_chance = (chance == 1) ?  true : random.double() < chance;
                        if (is_chance == true && temp_block != null && temp_block.id == 0 && temp_block.fluid == 0) {
                            let rotate = null
                            let extra_data = null
                            if(block_item.id == BLOCK.BARREL.id) {
                                extra_data = BARREL_EXTRA_DATA
                                const r = random.double()
                                if(r < .2) {
                                    rotate = Vector.YP.clone()
                                } else if(r < .4) {
                                    rotate = new Vector(CD_ROT.NORTH, 0, 0)
                                } else if(r < .6) {
                                    rotate = new Vector(CD_ROT.SOUTH, 0, 0)
                                } else if(r < .8) {
                                    rotate = new Vector(CD_ROT.WEST, 0, 0)
                                } else {
                                    rotate = new Vector(CD_ROT.EAST, 0, 0)
                                }
                            }
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block_item, true, rotate, extra_data)
                        }
                    }
                }
            }
        } 
    }

}