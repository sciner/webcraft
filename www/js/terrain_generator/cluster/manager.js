import {Vector, VectorCollector} from "../../helpers.js";
import {ClusterVilage} from "./vilage.js";
import {ClusterPyramid} from "./pyramid.js";
import { ClusterStructures } from "./structures.js";
import {ClusterEmpty} from "./empty.js";
import {impl as alea} from '../../../vendors/alea.js';
import { TerrainMapManager2 } from "../biome3/terrain/manager.js";

const CLUSTER_SIZE = new Vector(128, 256, 256)
export const CLUSTER_SIZE_V2 = new Vector(160, 256, 160)

// ClusterManager
export class ClusterManager {

    // All clusters
    constructor(chunkManager, seed, version) {
        this.seed = seed;
        this.version = version;
        this.chunkManager = chunkManager;
        this.all = new VectorCollector();
        this.size = new Vector(version == 2 ? CLUSTER_SIZE_V2 : CLUSTER_SIZE)
    }

    /**
     * Return existing cluster or create new and return
     * @param {Vector} coord 
     * @param {TerrainMapManager2} map_manager 
     * @returns 
     */
    getForCoord(coord, map_manager) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(this.size).flooredSelf()
        const center_coord = addr.mul(this.size).addScalarSelf(this.size.x / 2, this.size.y / 2, this.size.z / 2)
        const biome = map_manager?.calcBiome ? map_manager.calcBiome(center_coord) : null
        let cluster = this.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const rand = new alea(this.seed + '_' + addr.toHash());
        const r = rand.double();
        if(this.version == 2) {
            /*
            if(r < .2) {
                cluster = new ClusterVilage(this, addr.clone(), biome)
                // cluster = new ClusterEmpty(this, addr.clone(), biome)
            } else {
                // cluster = new ClusterEmpty(this, addr.clone(), biome)
                cluster = new ClusterStructures(this, addr.clone(), biome)
            }
            */
            // cluster = new ClusterStructures(this, addr.clone(), biome)
            cluster = new ClusterVilage(this, addr.clone(), biome)
        } else {
            if(r <= .1) {
                cluster = new ClusterPyramid(this, addr.clone(), biome);
            } else if(r < .6) {
                // empty
            } else {
                cluster = new ClusterVilage(this, addr.clone(), biome);
            }
        }
        if(!cluster) {
            cluster = new ClusterEmpty(this, addr.clone(), biome);
        }
        this.all.set(addr, cluster)
        return cluster
    }

}