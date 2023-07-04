import {noise, alea, addPointedDripstone} from "../../default.js";
import { BLOCK_FLAG, DAYLIGHT_VALUE } from "../../../constant.js";
import { CubeSym } from "../../../core/CubeSym.js";
import { ClusterEndCity } from "../../cluster/end_city.js";
import { ClusterManager } from "../../cluster/manager.js";
import { TerrainMapCell } from "../../terrain_map.js";
import { TerrainMapManagerBase } from "../terrain/manager_base.js";
import { Biome3TerrainMap } from "../terrain/map.js";
import { Biome3LayerBase } from "./base.js";
import {  createNoise3D } from '@vendors/simplex-noise.js';
import { Vector } from "../../../helpers.js";
import type { BLOCK } from "../../../blocks.js";
import type { ChunkGrid } from "../../../core/ChunkGrid.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { WorkerWorld } from "../../../worker/world.js";
import type { Biome } from "../biomes.js";
import type Terrain_Generator from "../index.js";

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
const MOSS_HUMIDITY             = .75;
const AMETHYST_ROOM_RADIUS      = 6;
const AMETHYST_CLUSTER_CHANCE   = 0.1;


class BottomCavesMapManager extends TerrainMapManagerBase {

    declare layer : Biome3LayerBottomCaves
    _biome : Biome

    constructor(world: WorkerWorld, seed : string, world_id : string, noise2d, noise3d, block_manager : BLOCK, generator_options, layer : Biome3LayerBottomCaves) {
        super(world, seed, world_id, noise2d, noise3d, block_manager, generator_options, layer)
        this._biome = this.biomes.byName.get('Пещеры нижнего мира')
    }

    // generate map
    generateMap(real_chunk : any, chunk : ChunkWorkerChunk, noisefn) {

        // Result map
        const map = new Biome3TerrainMap(chunk, this.generator_options, this.noise2d)
        const biome = this._biome

        const cell = new TerrainMapCell(80, 0, 0, null, 0)
        cell.biome = biome
        cell.dirt_color = biome.dirt_color
        cell.water_color = biome.water_color

        // create empty cells
        map.cells = new Array(chunk.size.x * chunk.size.z).fill(cell)

        return map

    }

    generateAround(chunk : ChunkWorkerChunk, chunk_addr : Vector, smooth : boolean = false, generate_trees : boolean = false) : any[] {

        const maps = super.generateAround(chunk, chunk_addr, smooth, generate_trees)

        // Generate trees
        // const xyz = new Vector(0, 0, 0)
        // for(let i = 0; i < maps.length; i++) {
        //     const map = maps[i]
        //     if(!map.rnd) {
        //         map.rnd = new alea('end_trees_' + map.chunk.addr.toHash())
        //         for(let j = 0; j < 2; j++) {
        //             const x = Math.floor(map.rnd.double() * chunk.size.x)
        //             const y = 39
        //             const z = Math.floor(map.rnd.double() * chunk.size.z)
        //             xyz.copyFrom(map.chunk.coord).addScalarSelf(x, y, z)
        //             const block_id = this.layer.getBlock(xyz)
        //             if(block_id > 0) {
        //                 const tree = {
        //                     "height": 20,
        //                     "rad": 10,
        //                     "type": {
        //                         "percent": 1,
        //                         "trunk": 1043,
        //                         "leaves": 1042,
        //                         "style": "chorus",
        //                         "height": {
        //                             "min": 16,
        //                             "max": 22
        //                         },
        //                         "transparent_trunk": true
        //                     },
        //                     "pos": new Vector(x, y, z)
        //                 }
        //                 map.trees.push(tree)
        //             }
        //         }
        //     }
        // }

        return maps

    }

}

export default class Biome3LayerBottomCaves extends Biome3LayerBase {

    filter_biome_list: int[] = [502]
    dayLightDefaultValue: int = DAYLIGHT_VALUE.NONE
    grid: ChunkGrid
    biome: any
    n3d: Function

    init(generator : Terrain_Generator) : Biome3LayerBottomCaves {
        super.init(generator)
        this.grid = generator.world.chunkManager.grid;
        this.clusterManager = new ClusterManager(generator.world, generator.seed, this, [{chance: .6, class: ClusterEndCity}])
        this.maps = new BottomCavesMapManager(generator.world, generator.seed, generator.world_id, generator.noise2d, generator.noise3d, generator.block_manager, generator.options, this)
        // const noiseFactory = new NoiseFactory();
        // this.noise3d = noiseFactory.createNoise3D({seed: this.seed, randomFunc: this.tempAlea.double });
        this.n3d = createNoise3D(new alea(generator.seed).double)
        return this
    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : alea, is_lowest?: boolean, is_highest ?: boolean) {

        // Generate maps around chunk
        chunk.timers.start('generate_maps')
        const maps = this.maps.generateAround(chunk, chunk.addr, false, false)
        const map = chunk.map = maps[4]
        chunk.timers.stop()

        // Cluster
        // chunk.timers.start('generate_cluster')
        // chunk.cluster = this.clusterManager.getForCoord(chunk.coord, null) ?? null
        // chunk.cluster.fillBlocks(null, chunk, map, false, false)
        // chunk.timers.stop()

        // Generate chunk data
        chunk.timers.start('generate_chunk_data')
        this.generateChunkData(chunk, maps, seed, rnd)

        if(is_highest) {

            const bm = this.generator.block_manager
            const lava_id = bm.STILL_LAVA.id
            const stone_id = bm.DRIPSTONE_BLOCK.id
            const sz = chunk.size.y

            for(let x = 0; x < chunk.size.x; x++) {
                for(let z = 0; z < chunk.size.z; z++) {
                    const hx = (chunk.coord.x + x)
                    const hz = (chunk.coord.z + z)
                    let n = this.noise2d(hx/32, hz/32) * .667
                    let n2 = Math.ceil((n / .667 + 1) * 3)
                    n += this.noise2d(hx/16, hz/16) * 0.333
                    n += 1
                    const h = Math.round(n * 10 + 3)
                    for(let y = chunk.size.y - h; y < chunk.size.y; y++) {
                        chunk.setBlockIndirect(x, y, z, 0)
                        chunk.setBlockIndirect(x, y, z, y > sz - n2 ? lava_id : stone_id)
                    }
                }
            }
        }

        chunk.timers.stop()

        // Plant trees
        // chunk.timers.start('generate_trees')
        // if(chunk.addr.y == 1) {
        //     this.plantTrees(maps, chunk)
        // }
        // chunk.timers.stop()

        return chunk.map

    }

    generateChunkData(chunk : ChunkWorkerChunk, maps : any[], seed : string, rnd : any) {

        const grid                  = chunk.chunkManager.grid
        const map                   = chunk.map
        const { uint16View }        = chunk.tblocks.dataChunk
        const bm                    = this.generator.block_manager
        const blockFlags            = bm.flags
        const aleaRandom            = new alea(`${this.seed}/${chunk.id}`)
        const {CHUNK_SIZE}          = chunk.chunkManager.grid.math
        const options               = chunk.chunkManager.world.generator.options
        // const noise3d               = this.n3d
        const noise3d               = noise.simplex3 // noise.perlin3
        // const noise3d               = this.noise3d.noise3d

        const xyz                   = new Vector(0, 0, 0)
        const xyz_stone_density     = new Vector(0, 0, 0)
        let DENSITY_COEFF           = 1
        let fill_count              = 0

        // this.generator.noise3d.generate4(crd, sz);

        //
        const getBlockId = (x : int, y : int, z : int) : int => {
            return chunk.tblocks.getBlockId(x, y, z)
        };

        //
        for(let x = 0; x < chunk.size.x; x++) {

            for(let z = 0; z < chunk.size.z; z++) {

                let y_start                 = Infinity
                let stalactite_height       = 0
                let stalactite_can_start    = false
                let dripstone_allow         = true

                for(let y = chunk.size.y - 1; y >= 0; y--) {

                    xyz.set(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z)

                    let density = (
                        noise3d(xyz.x / (100 * DENSITY_COEFF), xyz.y / (15 * DENSITY_COEFF), xyz.z / (100 * DENSITY_COEFF)) / 2 + .5 +
                        noise3d(xyz.x / (20 * DENSITY_COEFF), xyz.y / (20 * DENSITY_COEFF), xyz.z / (20 * DENSITY_COEFF)) / 2 + .5
                    ) / 2

                    // if(xyz.y > -ABS_STONE) {
                    //     const dist = xyz.y / -ABS_STONE + .2;
                    //     density += dist;
                    // }

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
                                    chunk.setBlockIndirect(x, y + 1, z, bm.MOSS_BLOCK.id);
                                    dripstone_allow = false;
                                }
                            } else {
                                stalactite_height++;
                                if(stalactite_height >= 5) {
                                    // Moss and vine
                                    if(humidity > MOSS_HUMIDITY) {
                                        if(stalactite_height == 5 + Math.round((humidity - MOSS_HUMIDITY) * (1 / MOSS_HUMIDITY) * 20)) {
                                            let vine_r = aleaRandom.double()
                                            if(vine_r < .3) {
                                                // const block = vine_r > .15 ? BLOCK.CAVE_VINE : BLOCK.GLOWING_HANGING_LIANA
                                                const block = bm.GLOWING_HANGING_LIANA
                                                const parts_count = block.hanging_textures.length
                                                for(let yy = 0; yy < stalactite_height; yy++) {
                                                    let r = Math.round(aleaRandom.double() * 100)
                                                    let vine_part = 0
                                                    if(yy == stalactite_height - 1) {
                                                        vine_part = parts_count - 1
                                                    } else if(yy > 0) {
                                                        const middle_parts_count = parts_count - 2
                                                        if(middle_parts_count < 1) {
                                                            vine_part = 0
                                                        } else {
                                                            vine_part = 1 + (r % middle_parts_count)
                                                        }
                                                    }
                                                    const ripe = r < 33
                                                    const extra_data = {
                                                        part: vine_part,
                                                        ripe: ripe,
                                                    }
                                                    chunk.setBlockIndirect(x, y_start - yy, z, block.id, undefined, extra_data)
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
                                            addPointedDripstone(chunk, bm, x, y_start, z, aleaRandom.double() * 6 | 0)
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

                    let stone_block_id = bm.STONE.id
                    xyz_stone_density.set(xyz.x + 100000, xyz.y + 100000, xyz.z + 100000)
                    const stone_density = noise3d(xyz_stone_density.x / 20, xyz_stone_density.z / 20, xyz_stone_density.y / 20) / 2 + .5

                    // stone_block_id = bm.GLOWSTONE.id;

                    if(stone_density < .025) {
                        stone_block_id = bm.GLOWSTONE.id;
                    } else {
                        if(stone_density > 0.5) {
                            if(stone_density < 0.66) {
                                stone_block_id = bm.DIORITE.id;
                            } else if(stone_density < 0.83) {
                                stone_block_id = bm.ANDESITE.id;
                            } else {
                                stone_block_id = bm.GRANITE.id;
                            }
                        } else {
                            let density_ore = noise3d(xyz.y / 10, xyz.x / 10, xyz.z / 10) / 2 + .5;
                            // 0 ... 0.06
                            if(stone_density < 0.06) {
                                stone_block_id = bm.DIAMOND_ORE.id;
                                if(y < 2 && options.generate_bottom_caves_lava) {
                                    debugger
                                    const over_block = getBlockId(x, y + 1, z);
                                    if(over_block == 0) {
                                        stone_block_id = bm.FLOWING_LAVA.id;
                                    }
                                }
                            // 0.06 ... 0.1
                            } else if (density_ore < .1) {
                                stone_block_id = bm.COAL_ORE.id;
                            // 0.1 ... 0.3
                            } else if (density_ore > .3) {
                                stone_block_id = bm.DRIPSTONE_BLOCK.id;
                            // 0.85 ...1
                            } else if (density_ore > .85) {
                                stone_block_id = bm.COAL_ORE.id;
                            }
                        }
                    }

                    chunk.setBlockIndirect(x, y, z, stone_block_id)

                    // reset stalactite
                    stalactite_can_start    = stone_block_id == bm.DRIPSTONE_BLOCK.id
                    y_start                 = Infinity
                    stalactite_height       = 0

                    fill_count++

                }
            }
        }

        // Amethyst room
        if(fill_count > CHUNK_SIZE * .7) {
            const chance = aleaRandom.double();
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
                                    let b = getBlockId(x, y, z);
                                    if(b == 0 || !(blockFlags[b] & BLOCK_FLAG.SOLID)) {
                                        // air
                                        continue;
                                    } else if (dist >= AMETHYST_ROOM_RADIUS - 1.42) {
                                        chunk.setBlockIndirect(x, y, z, bm.AMETHYST_BLOCK.id);
                                    }
                                } else {
                                    chunk.setBlockIndirect(x, y, z, bm.AIR.id);
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
                                const block = getBlockId(x, y, z);
                                if(block == 0) {
                                    let set_vec     = null;
                                    let attempts    = 0;
                                    let rotate      = null;
                                    while(!set_vec && ++attempts < 5) {
                                        let i = Math.round(rnd * 10 * 5 + attempts) % 5;
                                        temp_ar_vec.set(x + sides[i].x, y + sides[i].y, z + sides[i].z);
                                        let b = getBlockId(temp_ar_vec.x, temp_ar_vec.y, temp_ar_vec.z);
                                        if(b != 0 && b != bm.AMETHYST_CLUSTER.id) {
                                            set_vec = sides[i];
                                            rotate = rotates[i];
                                        }
                                    }
                                    if(set_vec) {
                                        chunk.setBlockIndirect(x, y, z, bm.AMETHYST_CLUSTER.id, rotate);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // if(generate_map) {

        //     const cell = {
        //         dirt_color: DEFAULT_DIRT_COLOR,
        //         water_color: DEFAULT_WATER_COLOR,
        //         biome: this.biome
        //     }

        //     return new Default_Terrain_Map(
        //         chunk.addr,
        //         chunk.size,
        //         chunk.addr.mul(chunk.size),
        //         {WATER_LEVEL: 63},
        //         Array(chunk.size.x * chunk.size.z).fill(cell)
        //     );

        // }

        // return null

        return map

    }

    

}