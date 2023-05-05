import { alea } from "../../default.js";
import { Helpers, Vector } from "../../../helpers.js";
import { TREE_MARGIN, TREE_BETWEEN_DIST, TREE_MIN_Y_SPACE, MAX_TREES_PER_CHUNK, DENSITY_AIR_THRESHOLD, TREE_PLANT_ATTEMPTS } from "./manager_vars.js";
import { TerrainMap } from "../../terrain_map.js";
import { BIOME3_CAVE_LAYERS, CaveGeneratorBigCaves, CaveGeneratorRegular } from "../cave_generator.js";
import { DensityParams } from "./manager_vars.js";

import type { TerrainMapCell } from "./map_cell.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { ClusterBase } from "../../cluster/base.js";
import type { TerrainMapManager3 } from "./manager.js";
import type { Aquifera } from "../aquifera.js";
import type { Biome } from "../biomes.js";

export class Biome3TerrainMap extends TerrainMap {
    aquifera:           Aquifera
    cluster:            any
    CHUNK_SIZE_X:       number
    _tree_neighbours:   any

    constructor(chunk : ChunkWorkerChunk, options, noise2d) {
        super(chunk, options);
        this._tree_neighbours = new Array(chunk.size.x * chunk.size.z);
        if(options.generate_big_caves) {
            this.caves = new CaveGeneratorBigCaves(chunk.chunkManager.grid, chunk.coord, noise2d, BIOME3_CAVE_LAYERS);
        } else {
            this.caves = new CaveGeneratorRegular(chunk.chunkManager.grid, chunk.coord, noise2d, BIOME3_CAVE_LAYERS);
        }
        this.CHUNK_SIZE_X = chunk.size.x;
    }

    addTree(chunk : IChunk, cluster : ClusterBase, aleaRandom : alea, rnd : float, x : int, y : int, z : int, biome : Biome, underwater : boolean = false) : boolean{
        const CHUNK_SIZE_X = chunk.size.x;
        const CHUNK_SIZE_Z = chunk.size.z;
        const index = z * CHUNK_SIZE_X + x;

        const nb = this._tree_neighbours[index];
        if(!isNaN(nb)) {
            return false;
        }

        //
        for(let i = -TREE_BETWEEN_DIST; i <= TREE_BETWEEN_DIST; i++) {
            for(let j = -TREE_BETWEEN_DIST; j <= TREE_BETWEEN_DIST; j++) {
                const px = x + i;
                const pz = z + j;
                if(px >= 0 && pz >= 0 && px < CHUNK_SIZE_X && pz < CHUNK_SIZE_Z) {
                    const nb_index = pz * CHUNK_SIZE_X + px;
                    const nb_value = this._tree_neighbours[nb_index] ?? Infinity;
                    const dist = Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz));
                    this._tree_neighbours[nb_index] = Math.min(nb_value, dist);
                }
            }
        }

        const xyz = new Vector(
            x + chunk.coord.x,
            y + chunk.coord.y - 1,
            z + chunk.coord.z
        )

        const trees = underwater ? biome.underwater_trees : biome.trees

        let s = 0;
        let r = rnd / trees.frequency;

        for(let type of trees.list) {
            s += type.percent;
            if(r < s) {
                if(!cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.z, TREE_MARGIN)) {
                    break
                }
                const rand_height = aleaRandom.double()
                const height = Helpers.clamp(Math.round(rand_height * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
                const rad = Math.max(Math.trunc(height / 2), 2)
                const pos = new Vector(x, y, z)
                this.trees.push({height, rad, type, pos, biome})
                return true
            }
        }

        return false

    }

    generateTrees(real_chunk : ChunkWorkerChunk, seed, manager : TerrainMapManager3) {

        this.trees = [];
        this.vegetable_generated = true;

        const CHUNK_SIZE_X      = real_chunk.size.x;
        const CHUNK_SIZE_Y      = real_chunk.size.y;
        const CHUNK_SIZE_Z      = real_chunk.size.z;
        const chunk             = this.chunk;
        const cluster           = this.cluster;
        const aleaRandom        = new alea('trees_' + seed + '_' + chunk.coord.toString());
        const xyz               = new Vector(0, 0, 0);
        const map               = this;
        const treeSearchSize    = new Vector(1, CHUNK_SIZE_Y + 1, 1);
        const density_params    = new DensityParams(0, 0, 0, 0, 0, 0);
        const attempts          = Math.ceil(TREE_PLANT_ATTEMPTS / 256 * (CHUNK_SIZE_X * CHUNK_SIZE_Z))

        for(let i = 0; i < attempts; i++) {

            // generate coord exclude near chunk borders
            const x = Math.floor((CHUNK_SIZE_X - 2) * aleaRandom.double()) + 1;
            const z = Math.floor((CHUNK_SIZE_Z - 2) * aleaRandom.double()) + 1;

            xyz.set(x + chunk.coord.x, 0, z + chunk.coord.z);

            const river_point = manager.makeRiverPoint(xyz.x, xyz.z);
            const cell = this.cells[z * CHUNK_SIZE_X + x];
            const biome = cell.biome as Biome
            const rnd = aleaRandom.double();

            let prev_underwater = false

            if(rnd <= biome.trees.frequency || rnd <= biome.underwater_trees.frequency) {
                let free_height = 0;
                const tree_y_base = map.cluster.y_base - 20 // вычитание для подводных деревьев
                xyz.y = tree_y_base
                manager.noise3d.generate4(xyz, treeSearchSize);
                for(let y = CHUNK_SIZE_Y; y >= 0; y--) {
                    xyz.y = tree_y_base + y
                    const underwater = xyz.y < map.cluster.y_base
                    const preset = manager.getPreset(xyz);
                    const {density} = manager.calcDensity(xyz, {river_point, preset}, density_params, map)
                    if(prev_underwater !== underwater) {
                        free_height = 0
                    } 
                    prev_underwater = underwater
                    // если это камень
                    if(density > DENSITY_AIR_THRESHOLD) {
                        if(free_height >= TREE_MIN_Y_SPACE) {
                            xyz.y++
                            manager.calcDensity(xyz, {river_point, preset}, density_params, map)
                            if(underwater || xyz.y > density_params.local_water_line) {
                                if(this.addTree(chunk, cluster, aleaRandom, rnd, x, xyz.y, z, biome, underwater)) {
                                    if(this.trees.length == MAX_TREES_PER_CHUNK) {
                                        break;
                                    }
                                }
                            }
                        }
                        break;
                    }
                    free_height++;
                }
            }
        }

        // console.log(this.trees.length)

    }

    /**
     * Return map cell
     */
    getCell(x : int, z : int) : TerrainMapCell {
        return this.cells[z * this.CHUNK_SIZE_X + x]
    }

}