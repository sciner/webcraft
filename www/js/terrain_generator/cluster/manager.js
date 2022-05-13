import {Vector, VectorCollector} from "../../helpers.js";
import {ClusterVilage} from "./vilage.js";
import {ClusterPyramid} from "./pyramid.js";
import {ClusterEmpty} from "./empty.js";
import {CLUSTER_SIZE} from "./base.js";
import {impl as alea} from '../../../vendors/alea.js';

// ClusterManager
export class ClusterManager {

    // All clusters
    constructor(seed) {
        this.seed = seed;
        this.all = new VectorCollector();
    }

    // Return cluster
    getForCoord(coord) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        let cluster = this.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const rand = new alea(this.seed + '_' + addr.toHash());
        const r = rand.double();
        if(r <= .1) {
            cluster = new ClusterPyramid(this, addr.clone());
        } else if(r < .6) {
            cluster = new ClusterEmpty(this, addr.clone());
        } else {
            cluster = new ClusterVilage(this, addr.clone());
        }
        this.all.set(addr, cluster);
        return cluster;
    }

}