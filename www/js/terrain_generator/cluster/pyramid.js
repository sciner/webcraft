import {Vector} from "../../helpers.js";
import {ClusterBase, ClusterPoint} from "./base.js";

//
export class ClusterPyramid extends ClusterBase {

    constructor(clusterManager, addr) {
        super(clusterManager, addr);
        this.max_height  = 1;
        this.is_empty = false;
        if(!this.is_empty) {
            const block = this.block_manager.MOSSY_STONE_BRICKS;
            let points = new Map();
            const addBlock = (x, z, height) => {
                let point = points.get(height);
                if(!point) {
                    point = new ClusterPoint(height, block.id, 5, null);
                    points.set(height, point);
                }
                this.mask[z * this.size.x + x] = point;
            };
            const rad = 32;
            const center = this.size.clone().divScalar(2);
            const p = new Vector(0, 0, 0);
            center.y = 0;
            for(let x = 0; x < this.size.x; x++) {
                for(let z = 0; z < this.size.z; z++) {
                    p.set(x, 0, z);
                    let dist = p.distance(center);
                    if(dist < rad && dist > rad / 2) {
                        dist = Math.sin(dist / rad * 2) * rad;
                        if(dist < rad) {
                            addBlock(x, z, Math.round(rad - dist));
                        }
                    }
                }
            }
        }
        //
        const moving = this.moveToRandomCorner();
    }

    // Fill chunk blocks
    fillBlocks(maps, chunk, map) {
        if(this.is_empty) {
            return false;
        }
        super.fillBlocks(maps, chunk, map);
    }

}