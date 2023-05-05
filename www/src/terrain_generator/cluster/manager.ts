import {Vector, VectorCollector} from "../../helpers.js";
import {impl as alea} from '../../../vendors/alea.js';
import {ClusterEmpty} from "./empty.js";

import type { ClusterBase } from "./base.js";
import type { WorkerWorld } from "../../worker/world.js";
import type { Biome3LayerBase } from "../biome3/layers/base.js";
import type { IClusterList } from "../biome3/layers/underworld.js";

// TODO: This is must be moved to world generators on server
// but in constructor of ClusterManager generator options is empty
export const CLUSTER_SIZE = new Vector(128, 256, 128)
export const CLUSTER_SIZE_BIOME3 = new Vector(288, 200, 288) // 288, because it divided without remainder to 16, 24, 32 

// ClusterManager
export class ClusterManager {

    cluster_types:      {chance: float, cluster_class : any | null}[] = []
    all:                VectorCollector<any> = new VectorCollector()
    layer:              Biome3LayerBase
    world:              WorkerWorld
    size:               Vector
    seed:               string
    chunkManager:       any

    /**
     * All clusters
     */
    constructor(world : WorkerWorld, seed : string, layer? : Biome3LayerBase | null, cluster_list? : IClusterList) {
        this.seed = seed
        this.layer = layer
        this.world = world
        this.chunkManager = world.chunkManager
        this.size = new Vector().copyFrom(layer ? CLUSTER_SIZE_BIOME3 : CLUSTER_SIZE)
        for(let structure of cluster_list) {
            this.registerCluster(structure.chance, structure.class)
        }
    }

    registerCluster(chance : float, cluster_class : any | null) {
        this.cluster_types.push({chance, cluster_class})
    }

    /**
     * Return existing cluster or create new and return
     */
    getForCoord(coord : Vector, map_manager? : ITerrainMapManager) : ClusterBase {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVecSelf(this.size).flooredSelf()
        let cluster = this.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const center_coord = addr.mul(this.size).addScalarSelf(this.size.x / 2, this.size.y / 2, this.size.z / 2)
        const biome = map_manager?.calcBiome(center_coord, null) ?? null
        const rand = new alea(this.seed + '_' + addr.toHash());
        const r = rand.double()

        //
        let cluster_class = null
        for(let i = 0; i < this.cluster_types.length; i++) {
            let item = this.cluster_types[i]
            if(item.chance === null || item.chance > r) {
                cluster_class = item.cluster_class
                break
            }
        }

        if(cluster_class) {
            cluster = new cluster_class(this, addr.clone(), biome)
        }

        if(!cluster) {
            cluster = new ClusterEmpty(this, addr.clone(), biome);
        }
        this.all.set(addr, cluster)
        return cluster
    }

}