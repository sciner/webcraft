import { Vector, VectorCollector } from "../../../helpers.js";
import { Biomes } from "./../biomes.js";
import { Biome3TerrainMap } from "./map.js";
import type { BLOCK } from "../../../blocks.js";
import type { ChunkWorkerChunk } from "../../../worker/chunk.js";
import type { Biome3LayerBase } from "../layers/base.js";
import type { WorkerWorld } from "../../../worker/world.js";

//
const _temp_chunk = {
    addr: new Vector(),
    coord: new Vector(),
    size: new Vector(),
    chunkManager: {
        grid: null
    }
}

declare type IFunctionNoise2D = any // (x: float, z: float) => {}

export class TerrainMapManagerBase implements ITerrainMapManager {

    block_manager:          BLOCK
    maps_cache:             VectorCollector<any>
    biomes:                 Biomes
    seed:                   string
    world_id:               string
    noise2d:                IFunctionNoise2D
    noise3d:                any
    generator_options:      any
    float_seed:             any
    layer:                  Biome3LayerBase
    world:                  WorkerWorld

    static _temp_vec3 = Vector.ZERO.clone()
    static _temp_vec3_delete = Vector.ZERO.clone()

    constructor(world: WorkerWorld, seed : string, world_id : string, noise2d : Function, noise3d : Function, block_manager : BLOCK, generator_options, layer : Biome3LayerBase) {
        this.world = world;
        this.seed = seed;
        this.world_id = world_id;
        this.noise2d = noise2d as IFunctionNoise2D
        this.noise3d = noise3d
        this.block_manager = block_manager;
        this.layer = layer;
        this.maps_cache = new VectorCollector();
        this.biomes = new Biomes(noise2d, layer.filter_biome_list)
        this.generator_options = generator_options
    }

    calcBiome(center_coord : IVector, preset : any) : any {
        return null
    }

    // Delete map for unused chunk
    delete(addr : Vector) {
        TerrainMapManagerBase._temp_vec3_delete.copyFrom(addr);
        TerrainMapManagerBase._temp_vec3_delete.y = 0;
        this.maps_cache.delete(TerrainMapManagerBase._temp_vec3_delete);
    }

    // Return map
    get(addr : Vector) {
        return this.maps_cache.get(addr);
    }

    generateMapOrReturnFromCache(real_chunk, chunk, noisefn) : Biome3TerrainMap {

        const cached = this.maps_cache.get(chunk.addr);
        if(cached) {
            return cached;
        }

        const map = this.generateMap(real_chunk, chunk, noisefn)
        this.maps_cache.set(chunk.addr, map);

        return map

    }

    // generate map
    generateMap(real_chunk : any, chunk : ChunkWorkerChunk, noisefn) {

        // Result map
        const map = new Biome3TerrainMap(chunk, this.generator_options, this.noise2d)
        // const biome = this.biomes.byID.get(500)

        // const cell = new TerrainMapCell(80, 0, 0, null, 0)
        // cell.biome = biome
        // cell.dirt_color = biome.dirt_color
        // cell.water_color = biome.water_color

        // // create empty cells
        // map.cells = new Array(CHUNK_SIZE_X * CHUNK_SIZE_Z).fill(cell)

        return map

    }

    generateAround(chunk : ChunkWorkerChunk, chunk_addr : Vector, smooth : boolean = false, generate_trees : boolean = false) : any[] {

        const rad        = generate_trees ? 2 : 1
        const noisefn    = this.noise2d
        const maps       = []
        const grid = _temp_chunk.chunkManager.grid = chunk.chunkManager.grid;
        _temp_chunk.size.copyFrom(grid.chunkSize);
        for(let x = -rad; x <= rad; x++) {
            for(let z = -rad; z <= rad; z++) {
                TerrainMapManagerBase._temp_vec3.set(x, -chunk_addr.y, z);
                _temp_chunk.addr.copyFrom(chunk_addr).addSelf(TerrainMapManagerBase._temp_vec3);
                _temp_chunk.coord.copyFrom(_temp_chunk.addr).multiplyVecSelf(_temp_chunk.size);
                const map = this.generateMapOrReturnFromCache(chunk, _temp_chunk, noisefn)
                if(Math.abs(x) < 2 && Math.abs(z) < 2) {
                    maps.push(map);
                }
            }
        }

        return maps

    }

    //
    destroyAroundPlayers(players : IDestroyMapsAroundPlayers[]) : int {
        let cnt_destroyed = 0;
        for(let map_addr of this.maps_cache.keys()) {
            let can_destroy = true;
            for(let player of players) {
                const {chunk_render_dist, chunk_addr} = player;
                if(map_addr.distance(chunk_addr) < chunk_render_dist + 3) {
                    can_destroy = false;
                }
            }
            if(can_destroy) {
                this.maps_cache.delete(map_addr);
                cnt_destroyed++;
            }
        }
        // console.log('destroyAroundPlayers', this.maps_cache.size, TerrainMapManager3.maps_in_memory)
        return cnt_destroyed
    }

}