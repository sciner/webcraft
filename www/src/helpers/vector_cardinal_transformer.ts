import { Vector } from "./vector.js";
import type {AABB} from "../core/AABB.js";
import {DIRECTION} from "./helper_const.js";

/** Applies rotation by cradinal direction, mirroring and shift to a Vector. */
export class VectorCardinalTransformer {
    x0 : number
    y0 : number
    z0 : number
    kxx : number
    kxz : number
    kzx : number
    kzz : number

    static tmpVec = new Vector()
    static tmpVec2 = new Vector()

    /** The same arguments as in {@link init} */
    constructor(vec0?: Vector, dir = 0, mirror_x = false, mirror_z = false) {
        if (vec0) {
            this.init(vec0, dir, mirror_x, mirror_z)
        }
    }

    /**
     * @param {Vector} vec0 - the vector to which (0, 0, 0) will be transformed
     * @param {Int} dir - one of DIRECTION.WEST, DIRECTION.EAST, DIRECTION.NORTH, DIRECTION.SOUTH
     */
    init(vec0: Vector, dir: number, mirror_x = false, mirror_z = false): VectorCardinalTransformer {
        this.x0 = vec0.x
        this.y0 = vec0.y
        this.z0 = vec0.z
        this.kxx = 0
        this.kxz = 0
        this.kzx = 0
        this.kzz = 0
        const x_sign = mirror_x ? -1 : 1
        const z_sign = mirror_z ? -1 : 1
        if (dir == null) {
            throw new Error()
        }
        dir = dir & 0x3     // same as (dir + 4) % 4, but faster
        switch(dir) {
            case DIRECTION.SOUTH:
                this.kxx = -x_sign
                this.kzz = -z_sign
                break
            case DIRECTION.NORTH:
                this.kxx = x_sign
                this.kzz = z_sign
                break
            case DIRECTION.WEST:
                this.kzx = x_sign
                this.kxz = -z_sign
                break
            case DIRECTION.EAST:
                this.kzx = -x_sign
                this.kxz = z_sign
                break
            default:
                throw new Error()
        }
        return this
    }

    /**
     * Initializes this transformer as the inverse transformation of the given
     * {@link srcTransformer}, ot itself.
     */
    initInverse(srcTransformer: VectorCardinalTransformer = this): VectorCardinalTransformer {
        let {kxx, kxz, kzx, kzz, x0, y0, z0} = srcTransformer
        const detInv = 1 / (kxx * kzz - kxz * kzx)
        this.kxx =  detInv * kzz
        this.kxz = -detInv * kxz
        this.kzx = -detInv * kzx
        this.kzz =  detInv * kxx
        this.y0 = -y0
        this.x0 = -(x0 * this.kxx + z0 * this.kxz)
        this.z0 = -(x0 * this.kzx + z0 * this.kzz)
        return this
    }

    transform(src: IVector, dst = new Vector()): Vector {
        let {x, z} = src
        dst.y = this.y0 + src.y
        dst.x = this.x0 + x * this.kxx + z * this.kxz
        dst.z = this.z0 + x * this.kzx + z * this.kzz
        return dst
    }

    transformXZ(x: number, z: number, dst: Vector): Vector {
        dst.x = this.x0 + x * this.kxx + z * this.kxz
        dst.z = this.z0 + x * this.kzx + z * this.kzz
        return dst
    }

    transformY(y: number): number {
        return this.y0 + y
    }

    tranformAABB(src: AABB, dst: AABB): AABB {
        const tmpVec = VectorCardinalTransformer.tmpVec
        tmpVec.set(src.x_min, src.y_min, src.z_min)
        this.transform(tmpVec, tmpVec)

        const tmpVec2 = VectorCardinalTransformer.tmpVec2
        // (x_max, z_max) are not inclusive, but we need to transfrom the actual block coordinates (inclusive)
        tmpVec2.set(src.x_max - 1, src.y_max, src.z_max - 1)
        this.transform(tmpVec2, tmpVec2)

        dst.y_min = tmpVec.y
        dst.y_max = tmpVec2.y
        if (tmpVec.x < tmpVec2.x) {
            dst.x_min = tmpVec.x
            dst.x_max = tmpVec2.x + 1
        } else {
            dst.x_min = tmpVec2.x
            dst.x_max = tmpVec.x + 1
        }
        if (tmpVec.z < tmpVec2.z) {
            dst.z_min = tmpVec.z
            dst.z_max = tmpVec2.z + 1
        } else {
            dst.z_min = tmpVec2.z
            dst.z_max = tmpVec.z + 1
        }

        return dst
    }
}