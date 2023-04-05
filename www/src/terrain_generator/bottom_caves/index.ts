import { IndexedColor, Vector } from '../../helpers.js';
import { Default_Terrain_Generator, Default_Terrain_Map, Default_Terrain_Map_Cell } from '../default.js';
import { BLOCK } from '../../blocks.js';
import { CubeSym } from '../../core/CubeSym.js';
import { noise, alea } from "../default.js";
import type { WorkerWorld } from '../../worker/world.js';
import type { ChunkWorkerChunk } from '../../worker/chunk.js';

const DEFAULT_DIRT_COLOR = IndexedColor.GRASS.clone();
const DEFAULT_WATER_COLOR = IndexedColor.WATER.clone();

const rotates = [
    new Vector(CubeSym.ROT_Z, 0, 0),
    new Vector(CubeSym.ROT_Z3, 0, 0),
    new Vector(CubeSym.NEG_Y, 0, 0),
    new Vector(CubeSym.ROT_Y3, 0, 0),
    new Vector(CubeSym.ROT_X, 0, 0),
    new Vector(CubeSym.ROT_X3, 0, 0)
];

const sides = [
    new Vector(1, 0, 0),
    new Vector(-1, 0, 0),
    new Vector(0, 1, 0),
    new Vector(0, -1, 0),
    new Vector(0, 0, 1),
    new Vector(0, 0, -1)
];

//
const ABS_STONE                 = 16;
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;

// Генерация пещер нижнего мира
export default class Terrain_Generator extends Default_Terrain_Generator {
    [key: string]: any;

    constructor(world : WorkerWorld, seed, world_id, options) {
        super(seed, world_id, options);
        this.setSeed(seed);
    }

    async init() {
        return super.init()
    }

    generate(chunk : ChunkWorkerChunk, aleaRandom?: alea, generate_map : boolean = true) : Default_Terrain_Map | null {

        if(!aleaRandom) {
            aleaRandom = new alea(`${this.seed}/${chunk.id}`);
        }

        const {CHUNK_SIZE}          = chunk.chunkManager.grid.math;
        const options               = chunk.chunkManager.world.generator.options;
        const noise3d               = noise.simplex3;
        let xyz                     = new Vector(0, 0, 0);
        let xyz_stone_density       = new Vector(0, 0, 0);
        let DENSITY_COEFF           = 1;
        let fill_count              = 0;

        //
        const getBlock = (x : int, y : int, z : int) => {
            return chunk.tblocks.getBlockId(x, y, z);
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {

            for(let z = 0; z < chunk.size.z; z++) {

                let y_start                 = Infinity;
                let stalactite_height       = 0;
                let stalactite_can_start    = false;
                let dripstone_allow         = true;

                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);

                    let density = (
                        noise3d(xyz.x / (100 * DENSITY_COEFF), xyz.y / (15 * DENSITY_COEFF), xyz.z / (100 * DENSITY_COEFF)) / 2 + .5 +
                        noise3d(xyz.x / (20 * DENSITY_COEFF), xyz.y / (20 * DENSITY_COEFF), xyz.z / (20 * DENSITY_COEFF)) / 2 + .5
                    ) / 2;

                    if(xyz.y > -ABS_STONE) {
                        const dist = xyz.y / -ABS_STONE + .2;
                        density += dist;
                    }

                    // air
                    if(density < 0.5) {
                        if(stalactite_can_start) {
                            const humidity = noise3d(xyz.x / 80, xyz.z / 80, xyz.y / 80) / 2 + .5;
                            if(y_start == Infinity) {
                                // start stalactite
                                y_start = y;
                                stalactite_height = 0;
                                // MOSS_BLOCK
                                if(humidity > MOSS_HUMIDITY) {
                                    chunk.setBlockIndirect(x, y + 1, z, BLOCK.MOSS_BLOCK.id);
                                    dripstone_allow = false;
                                }
                            } else {
                                stalactite_height++;
                                if(stalactite_height >= 5) {
                                    // Moss and vine
                                    if(humidity > MOSS_HUMIDITY) {
                                        if(stalactite_height == 5 + Math.round((humidity - MOSS_HUMIDITY) * (1 / MOSS_HUMIDITY) * 20)) {
                                            if(aleaRandom.double() < .3) {
                                                for(let yy = 0; yy < stalactite_height; yy++) {
                                                    let vine_id = null;
                                                    if(yy == stalactite_height - 1) {
                                                        vine_id = BLOCK.CAVE_VINE_PART3.id + (x + z + y + yy) % 2;
                                                    } else {
                                                        vine_id = BLOCK.CAVE_VINE_PART1.id + (aleaRandom.double() < .2 ? 1 : 0);
                                                    }
                                                    chunk.setBlockIndirect(x, y_start - yy, z, vine_id);
                                                }
                                            }
                                            // reset stalactite
                                            y_start = Infinity;
                                            stalactite_height = 0;
                                            stalactite_can_start = false;
                                        }
                                    } else if(dripstone_allow) {
                                        // Dripstone
                                        if(aleaRandom.double() < .3) {
                                            chunk.setBlockIndirect(x, y_start - 0, z, BLOCK.POINTED_DRIPSTONE.id, null, {dir: -1, stage: 2});
                                            chunk.setBlockIndirect(x, y_start - 1, z, BLOCK.POINTED_DRIPSTONE.id, null, {dir: -1, stage: 1});
                                            chunk.setBlockIndirect(x, y_start - 2, z, BLOCK.POINTED_DRIPSTONE.id, null, {dir: -1, stage: 0});
                                        }
                                        // reset stalactite
                                        y_start = Infinity;
                                        stalactite_height = 0;
                                        stalactite_can_start = false;
                                    }
                                }
                            }
                        }
                        continue;
                    }

                    let stone_block_id = BLOCK.STONE.id;
                    xyz_stone_density.set(xyz.x + 100000, xyz.y + 100000, xyz.z + 100000);
                    let stone_density = noise3d(xyz_stone_density.x / 20, xyz_stone_density.z / 20, xyz_stone_density.y / 20) / 2 + .5;

                    if(stone_density < .025) {
                        stone_block_id = BLOCK.GLOWSTONE.id;
                    } else {
                        if(stone_density > 0.5) {
                            if(stone_density < 0.66) {
                                stone_block_id = BLOCK.DIORITE.id;
                            } else if(stone_density < 0.83) {
                                stone_block_id = BLOCK.ANDESITE.id;
                            } else {
                                stone_block_id = BLOCK.GRANITE.id;
                            }
                        } else {
                            let density_ore = noise3d(xyz.y / 10, xyz.x / 10, xyz.z / 10) / 2 + .5;
                            // 0 ... 0.06
                            if(stone_density < 0.06) {
                                stone_block_id = BLOCK.DIAMOND_ORE.id;
                                if(y < 2 && options.generate_bottom_caves_lava) {
                                    debugger
                                    const over_block = getBlock(x, y + 1, z);
                                    if(over_block == 0) {
                                        stone_block_id = BLOCK.FLOWING_LAVA.id;
                                    }
                                }
                            // 0.06 ... 0.1
                            } else if (density_ore < .1) {
                                stone_block_id = BLOCK.COAL_ORE.id;
                            // 0.1 ... 0.3
                            } else if (density_ore > .3) {
                                stone_block_id = BLOCK.DRIPSTONE_BLOCK.id;
                            // 0.85 ...1
                            } else if (density_ore > .85) {
                                stone_block_id = BLOCK.COAL_ORE.id;
                            }
                        }
                    }

                    chunk.setBlockIndirect(x, y, z, stone_block_id);

                    // reset stalactite
                    stalactite_can_start    = stone_block_id == BLOCK.DRIPSTONE_BLOCK.id;
                    y_start                 = Infinity;
                    stalactite_height       = 0;

                    fill_count++;

                }
            }
        }

        // Amethyst room
        if(fill_count > CHUNK_SIZE * .7) {
            let chance = aleaRandom.double();
            if(chance < .25) {
                const room_pos = new Vector(chunk.size).divScalarSelf(2);
                let temp_vec_amethyst = new Vector(0, 0, 0);
                let temp_ar_vec = new Vector();
                let rad = chance * 4;
                room_pos.y += Math.round((rad - 0.5) * 10);
                for(let x = 0; x < chunk.size.x; x++) {
                    for(let z = 0; z < chunk.size.z; z++) {
                        for(let y = chunk.size.y - 1; y >= 0; y--) {
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist <= AMETHYST_ROOM_RADIUS) {
                                if(dist > AMETHYST_ROOM_RADIUS - 1.5) {
                                    let b = getBlock(x, y, z);
                                    if(b == 0) {
                                        // air
                                        continue;
                                    } else if (dist >= AMETHYST_ROOM_RADIUS - 1.42) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK.AMETHYST_BLOCK.id);
                                    }
                                } else {
                                    chunk.setBlockIndirect(x, y, z, BLOCK.AIR.id);
                                }
                            }
                        }
                    }
                }
                // Set amethyst clusters
                let y_start = Math.max(room_pos.y - AMETHYST_ROOM_RADIUS, 1);
                let y_end = Math.min(room_pos.y + AMETHYST_ROOM_RADIUS, chunk.size.y - 2);
                for(let x = 1; x < chunk.size.x - 1; x++) {
                    for(let z = 1; z < chunk.size.z - 1; z++) {
                        for(let y = y_start; y < y_end; y++) {
                            let rnd = aleaRandom.double();
                            if(rnd > AMETHYST_CLUSTER_CHANCE) {
                                continue;
                            }
                            temp_vec_amethyst.set(x, y, z);
                            let dist = Math.round(room_pos.distance(temp_vec_amethyst));
                            if(dist < AMETHYST_ROOM_RADIUS - 1.5) {
                                const block = getBlock(x, y, z);
                                if(block == 0) {
                                    let set_vec     = null;
                                    let attempts    = 0;
                                    let rotate      = null;
                                    while(!set_vec && ++attempts < 5) {
                                        let i = Math.round(rnd * 10 * 5 + attempts) % 5;
                                        temp_ar_vec.set(x + sides[i].x, y + sides[i].y, z + sides[i].z);
                                        let b = getBlock(temp_ar_vec.x, temp_ar_vec.y, temp_ar_vec.z);
                                        if(b != 0 && b != BLOCK.AMETHYST_CLUSTER.id) {
                                            set_vec = sides[i];
                                            rotate = rotates[i];
                                        }
                                    }
                                    if(set_vec) {
                                        chunk.setBlockIndirect(x, y, z, BLOCK.AMETHYST_CLUSTER.id, rotate);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if(generate_map) {

            const cell = {
                dirt_color: DEFAULT_DIRT_COLOR,
                water_color: DEFAULT_WATER_COLOR,
                biome: new Default_Terrain_Map_Cell({
                code: 'bottom_caves'
            })};

            return new Default_Terrain_Map(
                chunk.addr,
                chunk.size,
                chunk.addr.mul(chunk.size),
                {WATER_LEVEL: 63},
                Array(chunk.size.x * chunk.size.z).fill(cell)
            );

        }

        return null

    }

}