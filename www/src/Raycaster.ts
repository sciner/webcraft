import { Vector } from "./helpers.js";
import { ALLOW_NEGATIVE_Y } from "./chunk_const.js";
import type { AABB } from "./core/AABB.js";

const INF = 100000.0;
const eps = 1e-3;
const coord = ['x', 'y', 'z'];
const point_precision = 1; // 000;
const side = new Vector(0, 0, 0);
const side_fluid = new Vector(0, 0, 0);
const leftTop = new Vector(0, 0, 0);
const check = new Vector(0, 0, 0);
const startBlock = new Vector(0, 0, 0);

const _tempVec3c = new Vector(0, 0, 0)

export class RaycasterResult {
    [key: string]: any;

    /**
     */
    constructor(pos : Vector | null = null, leftTop : Vector | null = null, side : Vector | null = null, aabb? : AABB, block_id : int = 0) {
        this.mob      = null;
        this.player   = null;
        this.aabb     = aabb || null;
        this.n        = side || 0; // TODO: Fix it
        this.block_id = block_id || 0;
        this.x        = 0;
        this.y        = 0;
        this.z        = 0;
        this.point    = 0;
        if (pos) {
            this.x = leftTop.x;
            this.y = leftTop.y;
            this.z = leftTop.z;
            this.point = new Vector(pos.x, pos.y, pos.z).subSelf(leftTop);
            if(point_precision != 1) {
                this.point.x = Math.round(this.point.x * point_precision) / point_precision;
                this.point.y = Math.round(this.point.y * point_precision) / point_precision;
                this.point.z = Math.round(this.point.z * point_precision) / point_precision;
            }
        }
        this.fluidLeftTop = null;
        this.fluidVal = 0;
    }

    distance(vec) {
        // Fast method
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    setFluid(fluidLeftTop, fluidVal, side) {
        this.fluidLeftTop = fluidLeftTop;
        this.fluidLeftTop.n = side;
        this.fluidVal = fluidVal;
        return this;
    }
}

export class Raycaster {
    [key: string]: any;

    constructor(world) {
        this.world = world;
        this.BLOCK = world.block_manager;
        this._dir = new Vector(0, 0, 0);
        this._pos = new Vector(0, 0, 0);
        this._blk = new Vector(0, 0, 0);
    }

    /**
     * @param {Vector} pos
     * @param {number[]} invViewMatrix
     * @param {number} distance
     * @param {*} callback
     * @returns {null | RaycasterResult}
     */
    getFromView(pos, invViewMatrix, distance, callback, ignore_transparent, return_fluid) {
        this._dir.x = -invViewMatrix[8];
        this._dir.y = -invViewMatrix[10];
        this._dir.z = -invViewMatrix[9];
        if(this._dir.length() < 0.01) {
            callback && callback(null);
            return null;
        }
        this._dir.normSelf();
        return this.get(pos, this._dir, distance, callback, ignore_transparent, return_fluid);
    }

    // intersectSphere...
    intersectSphere(sphere, origin = this.origin, direction = this.direction) {
        const ray : Vector = _tempVec3c;
        ray.copyFrom(sphere.center).subSelf(origin)
        const tca = ray.dot(direction);
        const d2 = ray.dot(ray) - tca * tca;
        const radius2 = sphere.radius * sphere.radius;
        if (d2 > radius2) return 0;
        const thc = Math.sqrt(radius2 - d2);
        const t0 = tca - thc;
        const t1 = tca + thc;
        if (t0 < 0 && t1 < 0) return 0;
        if (t0 < 0) return t1;
        return t0;
    }

    // Ray AABB - Ray Axis aligned bounding box testing
    intersectBox(box, origin, direction) {
        let tmin, tmax, tYmin, tYmax, tZmin, tZmax;
        const invdirx = 1 / direction.x;
        const invdiry = 1 / direction.y;
        const invdirz = 1 / direction.z;
        const min = {x: box.x_min, y: box.y_min, z: box.z_min};
        const max = {x: box.x_max, y: box.y_max, z: box.z_max};
        tmin = ((invdirx >= 0 ? min.x : max.x) - origin.x) * invdirx;
        tmax = ((invdirx >= 0 ? max.x : min.x) - origin.x) * invdirx;
        tYmin = ((invdiry >= 0 ? min.y : max.y) - origin.y) * invdiry;
        tYmax = ((invdiry >= 0 ? max.y : min.y) - origin.y) * invdiry;
        if (tmin > tYmax || tYmin > tmax) return 0;
        if (tYmin > tmin) tmin = tYmin;
        if (tYmax < tmax) tmax = tYmax;
        tZmin = ((invdirz >= 0 ? min.z : max.z) - origin.z) * invdirz;
        tZmax = ((invdirz >= 0 ? max.z : min.z) - origin.z) * invdirz;
        if (tmin > tZmax || tZmin > tmax) return 0;
        if (tZmin > tmin) tmin = tZmin;
        if (tZmax < tmax) tmax = tZmax;
        if (tmax < 0) return 0;
        return tmin >= 0 ? tmin : tmax;
    }

    // Mob raycaster
    intersectMob(pos, dir, max_distance) {
        const resp = {
            mob_distance: null,
            mob: null
        };
        if(this.world?.mobs) {
            for(const mob of this.world.mobs.list.values()) {
                mob.raycasted = false;
                if(!mob.aabb || !mob.isAlive()) {
                    continue
                }
                // @todo костыль, на сервере нет tPos
                const tPos = mob?.tPos ? mob.tPos : mob.pos
                if(tPos.distance(pos) > max_distance) {
                    continue
                }
                if(this.intersectBox(mob.aabb, pos, dir)) {
                    const dist = tPos.distance(pos);
                    if(resp.mob) {
                        if(dist < resp.mob_distance) {
                            resp.mob = mob;
                            resp.mob_distance = dist;
                        }
                    } else {
                        resp.mob = mob;
                        resp.mob_distance = dist;
                    }
                }
            }
        }
        return resp;
    }

    // Player raycaster
    intersectPlayer(pos : IVector, dir : IVector, max_distance : number) {
        const resp = {
            player_distance: null,
            player: null
        };
        if(this.world?.players) {
            for (const player of this.world.players.list.values()) {
                player.raycasted = false;
                if(!player.aabb || !player.isAlive()) {
                    continue;
                }
                // @todo костыль, на сервере нет tPos
                const tPos = player?.tPos ? player.tPos : player.state.pos
                if(tPos.distance(pos) > max_distance) {
                    continue;
                }
                if(this.intersectBox(player.aabb, pos, dir)) {
                    const dist = tPos.distance(pos);
                    if(resp.player) {
                        if(dist < resp.player_distance) {
                            resp.player = player;
                            resp.player_distance = dist;
                        }
                    } else {
                        resp.player = player;
                        resp.player_distance = dist;
                    }
                }
            }
        }
        return resp;
    }

    get(origin : Vector, dir : Vector, pickat_distance : number, callback : Function, ignore_transparent : boolean = false, return_fluid : boolean = false) : RaycasterResult | null {

        // const origin_block_pos = new Vector(origin).flooredSelf();

        const pos = this._pos.copyFrom(origin);
        startBlock.set(
            Math.floor(pos.x) + 0.5,
            Math.floor(pos.y) + 0.5,
            Math.floor(pos.z) + 0.5
        );

        side.zero();
        leftTop.zero();
        check.zero();
        side_fluid.zero();

        let fluidVal = 0;
        let fluidLeftTop = null;
        let res = null;
        let len = 0;
        if(!this._block_vec) {
            this._block_vec = new Vector(0, 0, 0);
        }
        let block = this._block_vec.copyFrom(startBlock);
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

            leftTop.copyFrom(block).flooredSelf();
            let b = this.world.chunkManager.getBlock(leftTop.x, leftTop.y, leftTop.z, this._blk);

            let hitShape = b.id > this.BLOCK.AIR.id; // && !origin_block_pos.equal(leftTop);
            if(ignore_transparent && b.material.invisible_for_cam ||
                b.material.material.id === 'water'
            ) {
                hitShape = false;
            }

            let hitFluid = fluidVal === 0 && b.fluidSource > 0;
            if (hitFluid) {
                fluidLeftTop = block.floored();
                fluidVal = b.fluidSource;
                side_fluid.zero().y = 1;
            }

            if (hitShape) {
                const shapes = this.BLOCK.getShapes(leftTop, b, this.world, false, true);
                let flag = false;

                for (let i = 0; i < shapes.length; i++) {
                    const shape = shapes[i];

                    for(let j = 0; j < 3; j++) {
                        const d = coord[j];

                        if (Math.abs(dir[d]) < eps) {
                            continue;
                        }

                        let sign = Math.sign(dir[d]);
                        let t = (shape[j] + leftTop[d] - pos[d]) / dir[d];
                        let t2 = (shape[j + 3] + leftTop[d] - pos[d]) / dir[d];
                        if (sign < 0) {
                            let tt = t; t = t2; t2 = tt;
                        }

                        if (t2 < -len || t > tMin + eps) continue;
                        check.x = pos.x - leftTop.x + t * dir.x;
                        check.y = pos.y - leftTop.y + t * dir.y;
                        check.z = pos.z - leftTop.z + t * dir.z;

                        if (shape[0] - eps < check.x && check.x < shape[3] + eps
                            && shape[1] - eps < check.y && check.y < shape[4] + eps
                            && shape[2] - eps < check.z && check.z < shape[5] + eps
                        ) {
                            tMin = t;
                            side.zero()[d] = sign;
                            flag = true;
                        }
                    }
                }

                hitShape = flag;
            }

            // tMin += .1

            pos.x += dir.x * tMin;
            pos.y += dir.y * tMin;
            pos.z += dir.z * tMin;
            len   += tMin;

            if (hitShape) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = new RaycasterResult(pos, leftTop, side, null, b?.id);
                if(res.point.y == 1) {
                    res.point.y = 0;
                }
                break;
            }

            block.addSelf(side);
            if (!ALLOW_NEGATIVE_Y && block.y < 0) {
                break;
            }
        }

        const {mob_distance, mob} = this.intersectMob(origin, dir, pickat_distance);
        if (mob) {
            if (res) {
                const res_vec = new Vector(res.x + .5, res.y + .5, res.z + .5);
                if(mob_distance < res_vec.distance(origin)) {
                    mob.raycasted = true;
                }
            } else {
                mob.raycasted = true;
            }
            if(mob.raycasted) {
                res = new RaycasterResult(pos, leftTop, side);
                res.mob = mob;
            }
        }

        const {player_distance, player} = this.intersectPlayer(origin, dir, pickat_distance);
        if (player) {
            if(res) {
                const res_vec = new Vector(res.x + .5, res.y + .5, res.z + .5);
                if (player_distance < res_vec.distance(origin)) {
                    player.raycasted = true;
                }
            } else {
                player.raycasted = true;
            }
            if(player.raycasted) {
                res = new RaycasterResult(pos, leftTop, side);
                res.player = player;
            }
        }

        if (fluidVal > 0) {
            if (!res) {
                res = new RaycasterResult();
            }
            res.setFluid(fluidLeftTop, fluidVal, side_fluid);
        }

        callback && callback(res);

        return res;
    }

}