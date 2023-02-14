import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../../../chunk_const.js";
import { alea } from "../../default.js";
import { Helpers, Vector } from "../../../helpers.js";
import { TREE_MARGIN, TREE_BETWEEN_DIST, TREE_MIN_Y_SPACE, MAX_TREES_PER_CHUNK, DENSITY_AIR_THRESHOLD } from "./manager.js";
import { TerrainMap } from "../../terrain_map.js";
import { BIOME3_CAVE_LAYERS, CaveGenerator } from "../cave_generator.js";
import { TerrainMapCell } from "./map_cell.js";
import { DensityParams } from "./manager_vars.js";

export class TerrainMap2 extends TerrainMap {

    /**
     * @type { import("../aquifera.js").Aquifera }
     */
    // aquifera

    /**
     * @param { import("../../../worker/chunk.js").ChunkWorkerChunk } chunk 
     */
    constructor(chunk, options, noise2d) {
        super(chunk, options);
        this._tree_neighbours = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z);
        this.caves = new CaveGenerator(chunk.coord, noise2d, BIOME3_CAVE_LAYERS);
    }

    /**
     * @param { import("../../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @param { import("../../cluster/base.js").ClusterBase } cluster
     * @param {*} aleaRandom 
     * @param {float} rnd 
     * @param {int} x 
     * @param {int} y 
     * @param {int} z 
     * @param {*} biome 
     * 
     * @returns {boolean}
     */
    addTree(chunk, cluster, aleaRandom, rnd, x, y, z, biome) {

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
        );

        let s = 0;
        let r = rnd / biome.trees.frequency;

        for(let type of biome.trees.list) {
            s += type.percent;
            if(r < s) {
                if(!cluster.is_empty && cluster.cellIsOccupied(xyz.x, xyz.y, xyz.z, TREE_MARGIN)) {
                    break;
                }
                const rand_height = aleaRandom.double();
                const height = Helpers.clamp(Math.round(rand_height * (type.height.max - type.height.min) + type.height.min), type.height.min, type.height.max);
                const rad = Math.max(parseInt(height / 2), 2);
                const pos = new Vector(x, y, z)
                this.trees.push({height, rad, type, pos})
                return true;
            }
        }

        return false;

    }

    /**
     * @param { import("../../../worker/chunk.js").ChunkWorkerChunk } chunk 
     * @param {*} seed 
     * @param {TerrainMapManager2} manager 
     */
    generateTrees(real_chunk, seed, manager) {

        const chunk = this.chunk;
        const cluster = this.cluster;

        this.trees = [];
        this.vegetable_generated = true;

        const aleaRandom = new alea('trees_' + seed + '_' + chunk.coord.toString());
        const xyz = new Vector(0, 0, 0);
        const map = this;
        const treeSearchSize = new Vector(1, CHUNK_SIZE_Y + 1, 1);
        const density_params = new DensityParams(0, 0, 0, 0, 0, 0);

        for(let i = 0; i < 8; i++) {

            // generate coord exclude near chunk borders
            const x = Math.floor((CHUNK_SIZE_X - 2) * aleaRandom.double()) + 1;
            const z = Math.floor((CHUNK_SIZE_Z - 2) * aleaRandom.double()) + 1;

            xyz.set(x + chunk.coord.x, 0, z + chunk.coord.z);

            const river_point = manager.makeRiverPoint(xyz.x, xyz.z);
            const cell = this.cells[z * CHUNK_SIZE_X + x];
            const biome = cell.biome;

            const rnd = aleaRandom.double();

            if(rnd <= biome.trees.frequency) {
                let free_height = 0;
                xyz.y = map.cluster.y_base;
                manager.noise3d.generate4(xyz, treeSearchSize);
                for(let y = CHUNK_SIZE_Y; y >= 0; y--) {
                    xyz.y = map.cluster.y_base + y;
                    const preset = manager.getPreset(xyz);
                    const {d1, d2, d3, d4, density} = manager.calcDensity(xyz, {river_point, preset}, density_params, map);
                    // если это камень
                    if(density > DENSITY_AIR_THRESHOLD) {
                        if(free_height >= TREE_MIN_Y_SPACE) {
                            xyz.y++
                            manager.calcDensity(xyz, {river_point, preset}, density_params, map)
                            if(xyz.y > density_params.local_water_line) {
                                if(this.addTree(chunk, cluster, aleaRandom, rnd, x, xyz.y, z, biome)) {
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

    }

    /**
     * Return map cell
     * @param {int} x 
     * @param {int} z
     * 
     * @returns {TerrainMapCell}
     */
    getCell(x, z) {
        return this.cells[z * CHUNK_SIZE_X + x]
    }

}