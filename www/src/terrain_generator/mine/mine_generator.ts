import {CHUNK_SIZE_X, CHUNK_SIZE_Z} from "../../chunk_const.js";
import {Vector, VectorCollector, DIRECTION, DIRECTION_BIT} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';
import { AABB } from "../../core/AABB.js";

const SIZE_CLUSTER = 8;
const LANTERN_ROT_UP = new Vector(0, -1, 0);
const LANTERN_CHANCE = 0.02;
const CHEST_ROT = new Vector(DIRECTION.SOUTH, 1, 0);
export const MINE_SIZE = new Vector(CHUNK_SIZE_X * SIZE_CLUSTER, 40, CHUNK_SIZE_Z * SIZE_CLUSTER);
export const NODE_SIZE = new Vector(CHUNK_SIZE_X, 4, CHUNK_SIZE_Z);
export const NODE_COUNT = new Vector(MINE_SIZE.x / NODE_SIZE.x, MINE_SIZE.y / NODE_SIZE.y, MINE_SIZE.z / NODE_SIZE.z);

export interface MineOptions {
    size_cluster: number
    chance_hal: float
    chance_cross: float
    chance_side_room: float
}
/**
 * Draw mines
 * @class MineGenerator
 * @param {World} world world
 * @param {Vector} pos chunk positon
 * @param {object} options options
 */
export class MineGenerator {
    [key: string]: any;

    static all = new VectorCollector();

    constructor(generator, addr : Vector, options : MineOptions) {
        //console.log(generator)
        this.generator          = generator;
        this.addr               = addr.clone();
        this.coord              = (new Vector(addr.x, addr.y, addr.z)).multiplyVecSelf(MINE_SIZE);
        this.random             = new alea(this.addr.toHash());
        this.is_empty           = this.random.double() > .25;
        if(this.is_empty) {
            return;
        }
        //
        this.size_cluster       = options?.size_cluster ?? 8
        this.chance_hal         = options?.chance_hal ?? 0.75
        this.chance_cross       = options?.chance_cross ?? 0.6
        this.chance_side_room   = options?.chance_side_room ?? 0.5
        //
        this._get_vec           = new Vector(0, 0, 0);
        this.voxel_buildings    = [];
        //
        let pn = performance.now();
        this.nodes = new VectorCollector();
        const bottom_y = Math.floor(this.random.double() * (NODE_COUNT.y - 2));
        const x = Math.round(NODE_COUNT.x / 2);
        const z = Math.round(NODE_COUNT.z / 2);
        this.genNodeMine(x, bottom_y, z, DIRECTION.SOUTH);
        this.is_empty = this.nodes.size == 0;
        const ms = Math.round((performance.now() - pn) * 1000) / 1000;
        //console.log("[INFO]MineGenerator: generation " + this.nodes.size + " nodes for " + ms + ' ms on height ' + bottom_y + ' hash: ' + this.addr.toHash());

        this.xyz_temp_coord = new Vector(0, 0, 0);
    }

    // getForCoord
    static getForCoord(generator, coord : IVector) {
        const addr = new Vector(coord.x, 0, coord.z).divScalarVecSelf(MINE_SIZE).flooredSelf();
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
    genNodeMine(x, y, z, dir : int) {

        if (x > NODE_COUNT.x || x < 0 || y > NODE_COUNT.y || y < 0 || z > NODE_COUNT.z || z < 0) {
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

        let node = this.findNodeMine(new_x, new_y, new_z);
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
    fillBlocks(chunk) {

        if(this.is_empty) {
            return false;
        }

        const aabb = new AABB();

        aabb.x_min = (chunk.coord.x - this.coord.x) / NODE_SIZE.x;
        aabb.z_min = (chunk.coord.z - this.coord.z) / NODE_SIZE.z;
        aabb.x_max = aabb.x_min;
        aabb.z_max = aabb.z_min;
        aabb.y_max = NODE_COUNT.y;

        for(const [_, node] of this.nodes.entries(aabb)) {
            if (node.type == "enter") {
                this.genNodeEnter(chunk, node);
            } else if (node.type == "cross") {
                this.genNodeCross(chunk, node);
            } else if (node.type == "hal") {
                this.genNodeHal(chunk, node);
            } else if (node.type == "room") {
                this.genNodeSideRoom(chunk, node);
            }
        }

        return true;

    }

    // Generate sideroom node
    genNodeSideRoom(chunk, node) {
        const random = new alea(chunk.addr.toHash())
        const dir = node.dir;

        this.genBox(chunk, node, random, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, random, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICKS);
        this.genBox(chunk, node, random, 1, 1, 1, 8, 3, 4, dir);

        let vec = new Vector(0, 0, 0);
        vec.set(8, 3, 4).rotY(dir);
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);

        vec.set(1, 1, 1).rotY(dir);
        const chest_rot = CHEST_ROT;
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.CHEST, true, chest_rot, {generate: true, params: {source: 'cave_mines'}});
    }

    // Generate cross node
    genNodeCross(chunk, node) {
        const random = new alea(chunk.addr.toHash())
        const dir = node.dir;
        this.genBox(chunk, node, random, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.2)
        this.genBox(chunk, node, random, 4, 1, 11, 15, 4, 15, dir, BLOCK.AIR, 0.2)

        this.genBox(chunk, node, random, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, node, random, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, node, random, 1, 1, 12, 15, 3, 14, dir);

        // floor as bridge over air
        this.genBox(chunk, node, random, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLANKS, 1, true);
        this.genBox(chunk, node, random, 1, 0, 12, 15, 0, 14, dir, BLOCK.OAK_PLANKS, 1, true);
        this.genBox(chunk, node, random, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLANKS, 1, true);

        let interval = Math.round(random.double()) + 4;
        const sign = dir % 2 == 1 ? -1 : 1;
        let torch_dir = dir + 1 * sign;
        for (let n = 0; n <= 15; n += interval) {

            if (n == 0) {
                continue
            }

            // опоры
            this.genBox(chunk, node, random, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_PLANKS);

            this.genBox(chunk, node, random, n, 1, 14, n, 2, 14, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, n, 1, 12, n, 2, 12, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, random, n, 3, 12, n, 3, 14, dir, BLOCK.OAK_PLANKS);

            this.genBox(chunk, node, random, n + 1, 3, 13, n + 1, 3, 13, dir, BLOCK.TORCH, .3, false, {x: torch_dir % 4, y: 0, z: 0});
            this.genBox(chunk, node, random, n - 1, 3, 13, n - 1, 3, 13, dir, BLOCK.TORCH, .3, false, {x: (torch_dir + 2) % 4, y: 0, z: 0});

            // паутина
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);

            this.genBoxAir(chunk, node, random, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, random, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.COBWEB, 0.05);

            // факелы
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.1, LANTERN_ROT_UP);

            this.genBoxAir(chunk, node, random, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.LANTERN, LANTERN_CHANCE * 2, LANTERN_ROT_UP);
        }

        // рельсы
        const shape = dir % 2
        this.genBoxAir(chunk, node, random, 2, 1, 0, 2, 1, 0 + 15, dir, BLOCK.RAIL, 0.7, undefined, {shape}, false)
        this.genBoxAir(chunk, node, random, 4, 1, 13, 15, 1, 13, dir, BLOCK.RAIL, 0.7, undefined, {shape: (dir + 1) % 2}, false)

        //грибы
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, 15, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, 15, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, 15, dir, BLOCK.BROWN_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, 15, dir, BLOCK.BROWN_MUSHROOM, 0.01)

        // динамит 
        this.genGroundDecor(chunk, node, random, 4, 1, 12, 5, 1, 14, dir, BLOCK.TNT, 0.05)

        // свечи немного 
        this.genGroundDecor(chunk, node, random, 0, 2, 0, 0, 2, 15, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, 0, 4, 2, 15, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, 11, 15, 2, 11, dir, BLOCK.BLACK_CANDLE, 0.01)
        this.genGroundDecor(chunk, node, random, 4, 2, 15, 15, 2, 15, dir, BLOCK.BLACK_CANDLE, 0.01)

        // куски камней
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, 15, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, 15, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 0, 1, 12, 15, 1, 12, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 0, 1, 14, 15, 1, 14, dir, BLOCK.PEBBLES, 0.04)
    }

    // Generate hal node
    genNodeHal(chunk, node) {
        const random = new alea(chunk.addr.toHash())
        const dir = node.dir;

        this.genBox(chunk, node, random, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.2);
        this.genBox(chunk, node, random, 1, 1, 0, 3, 3, 15, dir);

        // floor
        this.genBox(chunk, node, random, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLANKS, 1, true);

        let interval = Math.round(random.double()) + 4;
        for (let n = 0; n <= 15; n += interval) {

            if (n == 0) {
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

            // факел
            this.genBoxAir(chunk, node, random, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, random, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, LANTERN_CHANCE, LANTERN_ROT_UP);
        }

        // рельсы
        const shape = dir % 2
        this.genBoxAir(chunk, node, random, 2, 1, 0, 2, 1, 0 + 15, dir, BLOCK.RAIL, 0.7, undefined, {shape}, false)

        //грибы
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, 15, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, 15, dir, BLOCK.RED_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 0, 1, 0, 1, 1, 15, dir, BLOCK.BROWN_MUSHROOM, 0.01)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 4, 1, 15, dir, BLOCK.BROWN_MUSHROOM, 0.01)

        // куски камней
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, 15, dir, BLOCK.PEBBLES, 0.04)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, 15, dir, BLOCK.PEBBLES, 0.04)

        // бочки
        this.genGroundDecor(chunk, node, random, 1, 1, 0, 1, 1, 2, dir, BLOCK.BARREL, 0.1)
        this.genGroundDecor(chunk, node, random, 3, 1, 0, 3, 1, 2, dir, BLOCK.BARREL, 0.1)

    }

    // Add new node
    addNode(x, y, z, dir, type) {
        if (this.nodes.has(new Vector(x, y, z))) {
            return
        }
        let add_bottom_y = this.random.double() >= .5 ? 1 : 0;
        const bottom_y = y * NODE_SIZE.y + add_bottom_y;
        this.nodes.set(new Vector(x, y, z), {dir, type, bottom_y});
    }

    findNodeMine(x, y, z) {
        return this.nodes.get(this._get_vec.set(x, y, z)) || null;
    }

    setBlock(chunk, node, x, y, z, block_type, force_replace, rotate? : IVector, extra_data? : any) {
        y += node.bottom_y;

        const { tblocks } = chunk;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            if(force_replace || !tblocks.getBlockId(x, y, z)) {
                this.xyz_temp_coord.set(x, y, z).addSelf(chunk.coord);
                const has_voxel_buildings = !!this.generator.getVoxelBuilding
                if(!has_voxel_buildings || !this.generator.getVoxelBuilding(this.xyz_temp_coord)) {
                    tblocks.setBlockId(x, y, z, block_type.id);
                    if(rotate || extra_data) {
                        tblocks.setBlockRotateExtra(x, y, z, rotate, extra_data)
                    }
                }
            }
        }
    }

    getBlock(chunk, node, x, y, z) {
        y += node.bottom_y;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }

    wrapRotation(dir, angle) {
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
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность установки
     * @param {bool} only_if_air только если на позиции блок воздуха
     * @param {Vector} block_rotate поворот блока
     */
    genBox(chunk, node, random, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION.NORTH, blocks = {id : 0}, chance = 1, only_if_air = false, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    const is_chance = (chance == 1) ? true : random.double() < chance;
                    if (is_chance) {
                        const vec = (new Vector(x, y, z)).rotY(dir);
                        if(only_if_air) {
                            const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                            if(temp_block?.id != 0) {
                                continue;
                            }
                        }
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, blocks, true, block_rotate);
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена воздуха на блок с вероятностью
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     * @param {Vector} block_rotate поворот блока
     */
    genBoxAir(chunk, node, random, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1, block_rotate = null, extra_data? : any, check_air : boolean = true) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    const vec = (new Vector(x, y, z)).rotY(dir);
                    const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    const temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
                    if(!check_air || (temp_block_over && temp_block_over.id != 0)) {
                        let is_chance = (chance == 1) ?  true : random.double() < chance;
                        if (is_chance && temp_block?.id == 0 && temp_block?.fluid == 0) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true, block_rotate, extra_data);
                        }
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена не воздуха на блок с вероятностью
     * @param { import("../../worker/chunk.js").ChunkWorkerChunk } chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     */
    genBoxNoAir(chunk, node, random, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    const vec = (new Vector(x, y, z)).rotY(dir);
                    const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    const is_chance = (chance == 1) ?  true : random.double() < chance;
                    if (is_chance == true && temp_block?.id != 0) {
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true);
                    }
                }
            }
        }
    }

    genGroundDecor(chunk, node, random, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    const vec = (new Vector(x, y, z)).rotY(dir);
                    const temp_block_under = this.getBlock(chunk, node, vec.x, vec.y - 1, vec.z)
                    if (temp_block_under && temp_block_under.id != 0 && temp_block_under.material.is_solid) {
                        const temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                        const is_chance = (chance == 1) ?  true : random.double() < chance;
                        if (is_chance == true && temp_block != null && temp_block.id == 0 && temp_block.fluid == 0) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true);
                        }
                    }
                }
            }
        } 
    }

}