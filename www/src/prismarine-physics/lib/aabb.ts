import {AABB as BaseAABB} from "../../core/AABB.js"

const EPS = 1e-3

export class AABB extends BaseAABB {

    clone(): AABB {
        return new AABB(this.x_min, this.y_min, this.z_min, this.x_max, this.y_max, this.z_max)
    }

    extend(dx: number, dy: number, dz: number): this {
        if (dx < 0) this.x_min += dx
        else this.x_max += dx

        if (dy < 0) this.y_min += dy
        else this.y_max += dy

        if (dz < 0) this.z_min += dz
        else this.z_max += dz

        return this
    }

    contract(x: number, y: number, z: number): this {
        // гарантируем что размер не станет нулевым
        x = Math.min(x, this.width * 0.499999)
        y = Math.min(y, this.height * 0.499999)
        z = Math.min(z, this.depth * 0.499999)
        this.x_min += x
        this.y_min += y
        this.z_min += z
        this.x_max -= x
        this.y_max -= y
        this.z_max -= z
        return this
    }

    computeOffsetX(other: AABB, offsetX: number): number {
        if (other.y_max > this.y_min && other.y_min < this.y_max && other.z_max > this.z_min && other.z_min < this.z_max) {
            if (offsetX > 0.0 && other.x_max - this.x_min <= EPS) {
                offsetX = Math.min(this.x_min - other.x_max, offsetX)
            } else if (offsetX < 0.0 && other.x_min - this.x_max >= -EPS) {
                offsetX = Math.max(this.x_max - other.x_min, offsetX)
            }
        }
        return offsetX
    }

    computeOffsetY(other: AABB, offsetY: number): number {
        if (other.x_max > this.x_min && other.x_min < this.x_max && other.z_max > this.z_min && other.z_min < this.z_max) {
            if (offsetY > 0.0 && other.y_max - this.y_min <= EPS) {
                offsetY = Math.min(this.y_min - other.y_max, offsetY)
            } else if (offsetY < 0.0 && other.y_min - this.y_max >= -EPS) {
                offsetY = Math.max(this.y_max - other.y_min, offsetY)
            }
        }
        return offsetY
    }

    computeOffsetZ(other: AABB, offsetZ: number): number {
        if (other.x_max > this.x_min && other.x_min < this.x_max && other.y_max > this.y_min && other.y_min < this.y_max) {
            if (offsetZ > 0.0 && other.z_max - this.z_min <= EPS) {
                offsetZ = Math.min(this.z_min - other.z_max, offsetZ)
            } else if (offsetZ < 0.0 && other.z_min - this.z_max >= -EPS) {
                offsetZ = Math.max(this.z_max - other.z_min, offsetZ)
            }
        }
        return offsetZ
    }

}