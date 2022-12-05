import { VectorCollector } from "../../helpers.js";
import {ClusterBase} from "./base.js";

//
export class ClusterEmpty extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.max_height  = 1;
        this.is_empty = true;
        this.buildings = new VectorCollector();
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        return false;
    }

}