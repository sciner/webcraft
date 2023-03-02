import { BLOCK } from '../../blocks.js';
import { Vector } from "../../helpers.js";
import { alea } from "../default.js";
import { DENSITY_AIR_THRESHOLD } from "./terrain/manager.js";
import { createNoise2D, createNoise3D } from '../../../vendors/simplex-noise.js';

export const AQUIFERA_UP_PADDING = 10

export class AquiferaParams {
    [key: string]: any;

    constructor() {
        this.reset()
    }

    reset() {
        /**
         * @type {float}
         */
        this.density = 0
        /**
         * @type {boolean}
         */
        this.inside = false
        /**
         * @type {boolean}
         */
        this.in_wall = false
    }

}

export class Aquifera {
    [key: string]: any;

    /**
     * @param {Vector} coord
     */
    constructor(coord) {
        this.options = {
            y: {min: 20, max: 50},
            rad: {min: 28, max: 48},
            chance: .5,
            rad_mul: 1.5
        }
        // WARNING: x and z of size must be a multiple of 16
        this.size = new Vector(96, 512, 96)
        this.addr = coord.clone().div(this.size).flooredSelf()
        this.coord = this.addr.mul(this.size)
        this.rand = new alea(`aquifera_rand_${this.addr.toHash()}`)
        this.is_empty = this.rand.double() > this.options.chance
        if(!this.is_empty) {
            this.n3d = createNoise3D(new alea(`aquifera_` + this.addr.toHash()));
            const y = Math.floor(this.rand.double() * (this.options.y.max - this.options.y.min + 1) + this.options.y.min)
            this.pos = new Vector(this.coord.x + this.size.x/2, y, this.coord.z + this.size.z/2),
            this.rad = Math.floor(this.rand.double() * (this.options.rad.max - this.options.rad.min + 1) + this.options.rad.min)
            this.block_id = this.rand.double() > .25 ? BLOCK.STILL_LAVA.id : BLOCK.STILL_WATER.id
        }
    }

    /**
     * @param {Vector} xyz
     */
    hasColumn(xyz) {
        if(this.is_empty) return false
        const difx = xyz.x - this.pos.x
        const difz = xyz.z - this.pos.z
        const rad_check_column = this.rad * this.options.rad_mul
        return difx > -rad_check_column &&
               difx < rad_check_column &&
               difz > -rad_check_column &&
               difz < rad_check_column
    }

    /**
     * @param {Vector} xyz
     * @param {*} n3d
     * @param {AquiferaParams} out_params
     *
     * @returns {boolean}
     */
    calcInside(xyz, out_params) {
        if(this.is_empty) {
            return out_params.inside = false
        }
        //
        out_params.reset()
        //if(!this.hasColumn(xyz)) {
        //    return false
        //}
        //
        const dify = xyz.y - this.pos.y
        // const noise_add_y = Math.abs(d5) * 3
        if(dify > -this.rad && dify < AQUIFERA_UP_PADDING /*&& dify < noise_add_y */) {
            const d5 = dify < 5 ? this.n3d(xyz.x / 16, xyz.y / 16, xyz.z / 16) : 0
            const abs_rad = (this.rad + d5 * 5)
            const aquifera_dist = this.pos.distance(xyz) / abs_rad
            if(aquifera_dist <= 1.0) {
                out_params.inside = true
                if(aquifera_dist > .85) {
                    out_params.density = DENSITY_AIR_THRESHOLD + .1
                    out_params.in_wall = true
                }
            }
        }
        return out_params.inside
    }

}