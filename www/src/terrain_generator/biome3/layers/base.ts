import type { Vector } from "../../../helpers";
import type { ChunkWorkerChunk } from "../../../worker/chunk";
import type { ClusterBase } from "../../cluster/base";
import type { ClusterManager } from "../../cluster/manager";
import type { Default_Terrain_Map } from "../../default";
import type { Biome } from "../biomes";
import type { TerrainMapManagerBase } from "../terrain/manager_base";
import type { TerrainMap2 } from "../terrain/map";

/**
 * Generate underworld infinity air
 */
export class Biome3LayerBase {
    noise2d:            any
    noise3d:            any
    block_manager:      any
    maps:               TerrainMapManagerBase // | Map<any, any>
    generator:          any
    clusterManager:     ClusterManager
    seed:               string
    world:              any

    constructor(generator : any) {

        this.generator = generator

        this.noise2d = generator.noise2d
        this.noise3d = generator.noise3d
        this.block_manager = generator.block_manager
        // this.maps = new Map()

    }

    generate(chunk : ChunkWorkerChunk, seed : string, rnd : any) : Default_Terrain_Map {
        return this.generator.generateDefaultMap(chunk)
    }

    /**
     * Plant chunk trees
     */
    plantTrees(maps : TerrainMap2[], chunk : ChunkWorkerChunk) {
        const bm = chunk.chunkManager.block_manager
        for(let i = 0; i < maps.length; i++) {
            const m = maps[i];
            for(let j = 0; j < m.trees.length; j++) {

                const tree = m.trees[j];

                const x = m.chunk.coord.x + tree.pos.x - chunk.coord.x;
                const y = m.chunk.coord.y + tree.pos.y - chunk.coord.y;
                const z = m.chunk.coord.z + tree.pos.z - chunk.coord.z;

                // Replace grass_block with dirt under trees
                const basis_block = tree.type.basis === undefined ? bm.DIRT.id : tree.type.basis
                if(basis_block !== null) {
                    if(chunk.addr.x == m.chunk.addr.x && chunk.addr.z == m.chunk.addr.z) {
                        const yu = y - 1
                        if(yu >= 0 && yu < chunk.size.y) {
                            const cell = m.getCell(tree.pos.x, tree.pos.z)
                            if(!cell.is_sand && !tree.type.transparent_trunk) {
                                chunk.setGroundIndirect(x, yu, z, basis_block)
                            }
                        }
                    }
                }

                // Draw tree blocks into chunk
                this.generator.plantTree(this.world, tree, chunk, x, y, z, true);

            }
        }
    }

    /**
     * Dump biome
     */
     dumpBiome(xyz : Vector, biome : Biome) {
        if(!globalThis.used_biomes) {
            globalThis.used_biomes = new Map();
        }
        if(!globalThis.used_biomes.has(biome.title)) {
            globalThis.used_biomes.set(biome.title, biome.title);
            console.table(Array.from(globalThis.used_biomes.values()))
            console.log(biome.title, xyz.toHash())
        }
    }

}