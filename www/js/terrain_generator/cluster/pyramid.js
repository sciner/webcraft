import {Vector} from "../../helpers.js";
import {ClusterBase, ClusterPoint, CLUSTER_SIZE} from "./base.js";
import { BLOCK } from "../../blocks.js";

//
export class ClusterPyramid extends ClusterBase {

    constructor(addr) {
        super(addr);
        this.max_height  = 1;
        this.is_empty = false;
        if(!this.is_empty) {
            const block = BLOCK.MOSSY_STONE_BRICKS;
            let points = new Map();
            const addBlock = (x, z, height) => {
                let point = points.get(height);
                if(!point) {
                    point = new ClusterPoint(height, block.id, 5, null);
                    points.set(height, point);
                }
                this.mask[z * CLUSTER_SIZE.x + x] = point;
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
        super.fillBlocks(chunk, map);
    }

}