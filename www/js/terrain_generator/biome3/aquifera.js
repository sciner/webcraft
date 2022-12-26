import { Vector } from "../../helpers.js";
import { alea, Default_Terrain_Generator } from "../default.js";
import { DENSITY_AIR_THRESHOLD } from "./terrain/manager.js";

export class AquiferaParams {

    constructor() {
        /**
         * @type {float}
         */
        this.density = 0
        /**
         * @type {boolean}
         */
        this.in_wall = false
    }

}

export class Aquifera {

    /**
     * @param {Vector} coord 
     */
    constructor(coord) {
        this.options = {
            y: {min: 90, max: 100},
            rad: {min: 28, max: 48},
            chance: 1,
            rad_mul: 1.5
        }
        // WARNING: x and z of size must be a multiple of 16
        this.size = new Vector(128, 512, 128)
        this.addr = coord.clone().div(this.size).flooredSelf()
        this.coord = this.addr.mul(this.size)
        this.rand = new alea(`aquifera_rand_${this.addr.toHash()}`)
        this.is_empty = this.rand.double() > this.options.chance
        if(!this.is_empty) {
            const y = Math.floor(this.rand.double() * (this.options.y.max - this.options.y.min + 1) + this.options.y.min)
            this.pos = new Vector(this.coord.x + this.size.x/2, y, this.coord.z + this.size.z/2),
            this.rad = Math.floor(this.rand.double() * (this.options.rad.max - this.options.rad.min + 1) + this.options.rad.min)
            this.block_id = this.rand.double() > .5 ? BLOCK.STILL_LAVA.id : BLOCK.STILL_WATER.id
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
    calcInside(xyz, n3d, density_params, out_params) {
        const dify = xyz.y - this.pos.y
        let resp = false
        const d5 = density_params.d3
        // const d5 = n3d(xyz.x / 16, xyz.y / 16, xyz.z / 16)
        if(dify > -this.rad && dify < this.rad && dify < Math.abs(d5) * 3) {
            const abs_rad = (this.rad + d5 * 5)
            const aquifera_dist = this.pos.distance(xyz) / abs_rad
            if(aquifera_dist <= 1.1) {
                resp = true
                out_params.in_wall = false
                if(aquifera_dist > .7) {
                    out_params.density = DENSITY_AIR_THRESHOLD + .1
                    out_params.in_wall = true
                }
            }
        }
        return resp
    }

}