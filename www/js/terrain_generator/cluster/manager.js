import {Vector, VectorCollector} from "../../helpers.js";
import {ClusterVilage} from "./vilage.js";
import {ClusterPyramid} from "./pyramid.js";
import {ClusterEmpty} from "./empty.js";
import {CLUSTER_SIZE} from "./base.js";
import {impl as alea} from '../../../vendors/alea.js';
import { TerrainMapManager2 } from "../biome3/terrain/manager.js";

// ClusterManager
export class ClusterManager {

    // All clusters
    constructor(chunkManager, seed, version) {
        this.seed = seed;
        this.version = version;
        this.chunkManager = chunkManager;
        this.all = new VectorCollector();
    }

    /**
     * Return existing cluster or create new and return
     * @param {Vector} coord 
     * @param {TerrainMapManager2} map_manager 
     * @returns 
     */
    getForCoord(coord, map_manager) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        const center_coord = addr.mul(CLUSTER_SIZE).addScalarSelf(CLUSTER_SIZE.x / 2, CLUSTER_SIZE.y / 2, CLUSTER_SIZE.z / 2)
        const biome = map_manager?.calcBiome ? map_manager.calcBiome(center_coord) : null
        let cluster = this.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const rand = new alea(this.seed + '_' + addr.toHash());
        const r = rand.double();
        if(this.version == 2) {
            if(r < .2) {
                cluster = new ClusterVilage(this, addr.clone(), biome);
            } else {
                cluster = new ClusterEmpty(this, addr.clone(), biome);
            }
        } else {
            if(r <= .1) {
                cluster = new ClusterPyramid(this, addr.clone(), biome);
            } else if(r < .6) {
                cluster = new ClusterEmpty(this, addr.clone(), biome);
            } else {
                cluster = new ClusterVilage(this, addr.clone(), biome);
            }
        }
        this.all.set(addr, cluster);
        return cluster;
    }

}