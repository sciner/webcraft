import {CubeSym} from "./CubeSym.js";

export class AABB {

    constructor() {
        this.x_min = 0;
        this.y_min = 0;
        this.z_min = 0;
        this.x_max = 0;
        this.y_max = 0;
        this.z_max = 0;
    }

    get width() {
        return this.x_max - this.x_min;
    }

    get height() {
        return this.y_max - this.y_min;
    }

    get depth() {
        return this.z_max - this.z_min;
    }

    clone() {
        return new AABB().copyFrom(this);
    }

    copyFrom(aabb) {
        this.x_min = aabb.x_min;
        this.x_max = aabb.x_max;
        this.y_min = aabb.y_min;
        this.y_max = aabb.y_max;
        this.z_min = aabb.z_min;
        this.z_max = aabb.z_max;
        return this;
    }

    pad(padding) {
        this.x_min -= padding;
        this.x_max += padding;
        this.y_min -= padding;
        this.y_max += padding;
        this.z_min -= padding;
        this.z_max += padding;
        return this;
    }

    set(xMin, yMin, zMin, xMax, yMax, zMax) {
        // this.x_min = cx - w / 2;
        // this.x_max = cx + w / 2;
        // this.y_min = cy - h / 2;
        // this.y_max = cy + h / 2;
        // this.z_min = cz - d / 2;
        // this.z_max = cz + d / 2;
        this.x_min = xMin;
        this.y_min = yMin;
        this.z_min = zMin;
        this.x_max = xMax;
        this.y_max = yMax;
        this.z_max = zMax;
        return this;
    }

    setIntersect(aabb1, aabb2) {
        this.x_min = Math.max(aabb1.x_min, aabb2.x_min);
        this.x_max = Math.min(aabb1.x_max, aabb2.x_max);
        this.y_min = Math.max(aabb1.y_min, aabb2.y_min);
        this.y_max = Math.min(aabb1.y_max, aabb2.y_max);
        this.z_min = Math.max(aabb1.z_min, aabb2.z_min);
        this.z_max = Math.min(aabb1.z_max, aabb2.z_max);
        return this;
    }

    isEmpty() {
        return this.x_min >= this.x_max && this.y_min >= this.y_max && this.z_min >= this.z_max;
    }

    applyMatrix(matrix, pivot) {
        if (pivot) {
            this.x_min -= pivot.x;
            this.y_min -= pivot.y;
            this.z_min -= pivot.z;
            this.x_max -= pivot.x;
            this.y_max -= pivot.y;
            this.z_max -= pivot.z;
        }

        const x0 = this.x_min * matrix[0] + this.y_min * matrix[1] + this.z_min * matrix[2];
        const x1 = this.x_max * matrix[0] + this.y_max * matrix[1] + this.z_max * matrix[2];
        const y0 = this.x_min * matrix[3] + this.y_min * matrix[4] + this.z_min * matrix[5];
        const y1 = this.x_max * matrix[3] + this.y_max * matrix[4] + this.z_max * matrix[5];
        const z0 = this.x_min * matrix[6] + this.y_min * matrix[7] + this.z_min * matrix[8];
        const z1 = this.x_max * matrix[6] + this.y_max * matrix[7] + this.z_max * matrix[8];

        this.x_min = Math.min(x0, x1);
        this.x_max = Math.max(x0, x1);
        this.y_min = Math.min(y0, y1);
        this.y_max = Math.max(y0, y1);
        this.z_min = Math.min(z0, z1);
        this.z_max = Math.max(z0, z1);

        if (pivot) {
            this.x_min += pivot.x;
            this.y_min += pivot.y;
            this.z_min += pivot.z;
            this.x_max += pivot.x;
            this.y_max += pivot.y;
            this.z_max += pivot.z;
        }

        return this;
    }

    contains(x, y, z) {
        return x >= this.x_min && x < this.x_max
            && y >= this.y_min && y < this.y_max
            && z >= this.z_min && z < this.z_max;
    }

    intersect(box) {
        return (box.x_min < this.x_max && this.x_min < box.x_max
            && box.y_min < this.y_max && this.y_min < box.y_max
            && box.z_min < this.z_max && this.z_min < box.z_max);
    }

    /**
     * rotated around 0
     * @param sym
     */
    rotate(sym, pivot) {
        if (sym === 0) {
            return this;
        }

        return this.applyMatrix(CubeSym.matrices[sym], pivot);
    }

    toArray() {
        return [this.x_min, this.y_min, this.z_min, this.x_max, this.y_max, this.z_max];
    }

    translate(x, y, z) {
        this.x_min += x;
        this.x_max += x;
        this.y_min += y;
        this.y_max += y;
        this.z_min += z;
        this.z_max += z;
        return this;
    }

}

export class AABBPool {
    constructor() {
        this._list = [];
    }

    release(elem) {
        this._list.push(elem);
    }

    alloc() {
        return this._list.pop() || new AABB();
    }

    static instance = new AABBPool();
}
