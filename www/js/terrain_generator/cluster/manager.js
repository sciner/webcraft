import {Vector, VectorCollector} from "../../helpers.js";
import {ClusterVilage} from "./vilage.js";
import {ClusterPyramid} from "./pyramid.js";
import {CLUSTER_SIZE} from "./base.js";
import {impl as alea} from '../../../vendors/alea.js';

// ClusterManager
export class ClusterManager {

    // All clusters
    static all = new VectorCollector();

    // Return cluster
    static getForCoord(coord) {
        const addr = new Vector(coord.x, coord.y, coord.z).divScalarVec(CLUSTER_SIZE).flooredSelf();
        let cluster = ClusterManager.all.get(addr);
        if(cluster) {
            return cluster;
        }
        const rand = new alea(addr.toHash());
        const r = rand.double();
        if(r <= .01) {
            cluster = new ClusterPyramid(addr.clone());
        } else {
            cluster = new ClusterVilage(addr.clone());
        }
        ClusterManager.all.set(addr, cluster);
        return cluster;
    }

}