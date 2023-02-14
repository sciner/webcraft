import { VectorCollector } from "../../helpers.js";
import {ClusterBase} from "./base.js";

//
export class ClusterEmpty extends ClusterBase {
    [key: string]: any;

    constructor(clusterManager, addr, biome) {
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