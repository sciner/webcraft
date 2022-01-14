import { Vector } from "./helpers.js";
import { BLOCK } from "./blocks.js";
import { ALLOW_NEGATIVE_Y } from "./chunk.js";
const INF = 100000.0;
const eps = 1e-3;
const coord = ['x', 'y', 'z'];
const point_precision = 1000;
const side = new Vector(0, 0, 0);
const leftTop = new Vector(0, 0, 0);
const check = new Vector(0, 0, 0);
const startBlock = new Vector(0,0,0);

export class RaycasterResult {

    /**
     * @param {Vector} pos
     * @param {Vector} leftTop
     * @param {Vector} side
     */
    constructor(pos, leftTop, side) {
        this.x = leftTop.x;
        this.y = leftTop.y;
        this.z = leftTop.z;
        this.n = side;
        this.point = new Vector(pos.x, pos.y, pos.z).sub(leftTop);
        if(point_precision != 1) {
            this.point.x = Math.round(this.point.x * point_precision) / point_precision;
            this.point.y = Math.round(this.point.y * point_precision) / point_precision;
            this.point.z = Math.round(this.point.z * point_precision) / point_precision;
        }
    }

}

export class Raycaster {

    constructor(world) {
        this.world = world;
        this._dir = new Vector(0, 0, 0);
        this._pos = new Vector(0, 0, 0);
    }

    /**
     * @param {Vector} pos 
     * @param {number[]} invViewMatrix 
     * @param {number} distance 
     * @param {*} callback 
     * @returns {null | RaycasterResult}
     */
    getFromView(pos, invViewMatrix, distance, callback ) {
        this._dir.x = -invViewMatrix[8];
        this._dir.y = -invViewMatrix[10];
        this._dir.z = -invViewMatrix[9];
        if(this._dir.length() < 0.01) {
            callback && callback(null);
            return null;
        }
        this._dir.normSelf();
        return this.get(pos, this._dir, distance, callback);
    }

    /**
     * @param {Vector} pos 
     * @param {*} dir 
     * @param {number} pickat_distance 
     * @param {*} callback
     * @returns {null | RaycasterResult}
     */
    get(pos, dir, pickat_distance, callback) {
        pos = this._pos.copyFrom(pos);
        startBlock.set(
            Math.floor(pos.x) + 0.5,
            Math.floor(pos.y) + 0.5,
            Math.floor(pos.z) + 0.5
        );

        side.zero();
        leftTop.zero();
        check.zero();

        let res = null;
        let block = new Vector(startBlock);

        while (Math.abs(block.x - startBlock.x) < pickat_distance
            && Math.abs(block.y - startBlock.y) < pickat_distance
            && Math.abs(block.z - startBlock.z) < pickat_distance
        ) {
            let tMin = INF;
            for(let d of coord) {
                if(dir[d] > eps && tMin > (block[d] + 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] + 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = 1;
                }
                if(dir[d] < -eps && tMin > (block[d] - 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] - 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = -1;
                }
            }
            if (tMin >= INF) {
                break;
            }

            leftTop.x = Math.floor(block.x);
            leftTop.y = Math.floor(block.y);
            leftTop.z = Math.floor(block.z);
            let b = this.world.chunkManager.getBlock(leftTop.x, leftTop.y, leftTop.z);

            let hitShape = b.id > BLOCK.AIR.id && b.id !== BLOCK.STILL_WATER.id;

            if (hitShape) {
                const shapes = BLOCK.getShapes(leftTop, b, this.world, false, true);
                let flag = false;

                for (let i=0;i<shapes.length;i++) {
                    const shape = shapes[i];

                    for(let j=0;j<3;j++) {
                        const d = coord[j];
                        
                        if(dir[d] > eps && tMin + eps > (shape[j] + leftTop[d] - pos[d]) / dir[d]) {
                            const t = (shape[j] + leftTop[d] - pos[d]) / dir[d];
                            
                            check.x = pos.x - leftTop.x + t * dir.x;
                            check.y = pos.y - leftTop.y + t * dir.y;
                            check.z = pos.z - leftTop.z + t * dir.z;

                            if (shape[0] - eps < check.x && check.x < shape[3] + eps
                                && shape[1] - eps < check.y && check.y < shape[4] + eps
                                && shape[2] - eps < check.z && check.z < shape[5] + eps
                            ) {
                                tMin = t;
                                side.zero()[d] = 1;
                                flag = true;
                            }
                        }

                        if(
                            dir[d] < -eps && tMin + eps > (shape[j + 3] + leftTop[d] - pos[d]) / dir[d]
                        ) {
                            const t = (shape[j + 3] + leftTop[d] - pos[d]) / dir[d];
                            check.x = pos.x - leftTop.x + t * dir.x;
                            check.y = pos.y - leftTop.y + t * dir.y;
                            check.z = pos.z - leftTop.z + t * dir.z;

                            if (shape[0] - eps < check.x && check.x < shape[3] + eps
                                && shape[1] - eps < check.y && check.y < shape[4] + eps
                                && shape[2] - eps < check.z && check.z < shape[5] + eps) {
                                tMin = t;
                                side.zero()[d] = -1;
                                flag = true;
                            }
                        }
                    }
                }

                hitShape = flag;
            }

            pos.x += dir.x * tMin;
            pos.y += dir.y * tMin;
            pos.z += dir.z * tMin;

            if (hitShape) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = new RaycasterResult(pos, leftTop, side);
                if(res.point.y == 1) {
                    res.point.y = 0;
                }
                break;
            }

            block = block.add(side);
            if (!ALLOW_NEGATIVE_Y && block.y < 0) {
                break;
            }
        }
     
        callback && callback(res);
        
        return res;
    }

}