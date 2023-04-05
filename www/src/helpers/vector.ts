import {CubeSym} from "../core/CubeSym.js";
import {Mth} from "./mth.js";
import { DIRECTION } from "./helper_const.js";

export class Vector implements IVector {
    // static cnt = 0;
    // static traces = new Map();

    static XN = new Vector(-1.0, 0.0, 0.0);
    static XP = new Vector(1.0, 0.0, 0.0);
    static YN = new Vector(0.0, -1.0, 0.0);
    static YP = new Vector(0.0, 1.0, 0.0);
    static ZN = new Vector(0.0, 0.0, -1.0);
    static ZP = new Vector(0.0, 0.0, 1.0);
    static ZERO = new Vector(0.0, 0.0, 0.0);

    static SIX_DIRECTIONS = [this.XN, this.XP, this.ZN, this.ZP, this.YN, this.YP];
    static DIRECTIONS = [this.XN, this.XP, this.ZN, this.ZP]

    static SHAPE_PIVOT = new Vector(.5, .5, .5);

    // Ading these values sequentially to the same Vector is the same as setting it to each of SIX_DIRECTIONS
    static SIX_DIRECTIONS_CUMULATIVE = [this.XN];
    static initStatics() {
        for(var i = 1; i < 6; ++i) {
            this.SIX_DIRECTIONS_CUMULATIVE.push(
                this.SIX_DIRECTIONS[i].sub(this.SIX_DIRECTIONS[i - 1]));
        }
    }

    static ZERO_AND_SIX_DIRECTIONS = [this.ZERO].concat(this.SIX_DIRECTIONS);
    static ZERO_AND_SIX_DIRECTIONS_CUMULATIVE = [this.ZERO].concat(this.SIX_DIRECTIONS_CUMULATIVE);

    static yFromChunkIndex: (index: number) => number

    x: number;
    y: number;
    z: number;

    /**
     * @param {Vector | IVector | number[]} [x]
     * @param {number} [y]
     * @param {number} [z]
     */
    constructor(x?: Vector | IVector | number[] | number, y?: number, z?: number) {
        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.set(x, y, z);
    }

    /**
     * returns v or a new Vector based on it
     * @param v : IVector
     * @returns
     */
    static vectorify(v: Vector | IVector | number[]) {
        return v instanceof Vector ? v : new Vector(v);
    }

    //Array like proxy for usign it in gl-matrix
    get [0]() {
        return this.x;
    }

    set [0](v) {
        this.x = v;
    }

    get [1]() {
        return this.y;
    }

    set [1](v) {
        this.y = v;
    }

    get [2]() {
        return this.z;
    }

    set [2](v) {
        this.z = v;
    }

    // array like iterator
    *[Symbol.iterator]() {
        yield this.x;
        yield this.y;
        yield this.z;
    }

    /**
     * @return {number}
     */
    // @ts-ignore
    length() : float {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * Much faster than set() if we know the soure type.
     * @param {Vector} vec
     */
    copyFrom(vec : IVector) : Vector {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    /**
     */
    equal(vec: IVector) : boolean {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    applyCubeSymSelf(cubeSym, origin : IVector = Vector.ZERO) {
        this.x -= origin.x;
        this.y -= origin.y;
        this.z -= origin.z;

        const mat = CubeSym.matrices[cubeSym];
        let newX = mat[0] * this.x + mat[1] * this.y + mat[2] * this.z;
        let newY = mat[3] * this.x + mat[4] * this.y + mat[5] * this.z;
        let newZ = mat[6] * this.x + mat[7] * this.y + mat[8] * this.z;

        this.x = newX + origin.x;
        this.y = newY + origin.y;
        this.z = newZ + origin.z;
    }

    /**
     */
    lerpFrom(vec1: IVector, vec2: IVector, delta: float) : this {
        this.x = vec1.x * (1.0 - delta) + vec2.x * delta;
        this.y = vec1.y * (1.0 - delta) + vec2.y * delta;
        this.z = vec1.z * (1.0 - delta) + vec2.z * delta;
        return this;
    }

    /**
     */
    lerpFromAngle(vec1 :IVector, vec2: IVector, delta: float, rad : boolean = false) : this {
        const coef = rad
            ? 180 / Math.PI
            : 1;

        this.x = Mth.lerpAngle(vec1.x * coef, vec2.x * coef, delta) / coef;
        this.y = Mth.lerpAngle(vec1.y * coef, vec2.y * coef, delta) / coef;
        this.z = Mth.lerpAngle(vec1.z * coef, vec2.z * coef, delta) / coef;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    add(vec: IVector) : Vector {
        return new Vector(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }

    addScalarSelf(x: number, y: number, z: number) : this {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     */
    addSelf(vec: IVector) : this {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    }

    /**
     */
    sub(vec: IVector) : Vector {
        return new Vector(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    subSelf(vec: IVector) : this {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    mul(vec: IVector) : Vector {
        return new Vector(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    mulScalar(k) {
        return new Vector(this.x * k, this.y * k, this.z * k)
    }

    mulScalarSelf(k: float): this {
        this.x *= k
        this.y *= k
        this.z *= k
        return this
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    div(vec: IVector) : Vector {
        return new Vector(this.x / vec.x, this.y / vec.y, this.z / vec.z);
    }

    zero() : this {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    /**
     */
    swapYZ() : Vector {
        return new Vector(this.x, this.z, this.y);
    }

    /**
     */
    swapYZSelf() : Vector {
        return this.set(this.x, this.z, this.y)
    }

    /**
     */
    swapXZSelf(): this {
        return this.set(this.z, this.y, this.x);
    }

    // length() {
    //     return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    // }

    horizontalLength() {
        return Math.sqrt(this.x * this.x + this.z * this.z);
    }

    distance(vec: IVector): number {
        // return this.sub(vec).length();
        // Fast method
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    distanceSqr(vec: IVector) : number {
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return x * x + y * y + z * z;
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    horizontalDistance(vec : IVector) : float {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return Math.sqrt(x * x + z * z);
    }

    horizontalDistanceSqr(vec : IVector) : float {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return x * x + z * z;
    }

    // distancePointLine...
    distanceToLine(line_start: Vector, line_end: Vector, intersection : Vector | null = null) : number {
        intersection = intersection || new Vector(0, 0, 0);
        let dist = line_start.distance(line_end);
        let u = (((this.x - line_start.x) * (line_end.x - line_start.x)) +
                ((this.y - line_start.y) * (line_end.y - line_start.y)) +
                ((this.z - line_start.z) * (line_end.z - line_start.z))) /
            (dist * dist);
        if(u < 0) u = 0;
        if(u > 1) u = 1;
        intersection.x = line_start.x + u * (line_end.x - line_start.x);
        intersection.y = line_start.y + u * (line_end.y - line_start.y);
        intersection.z = line_start.z + u * (line_end.z - line_start.z);
        return this.distance(intersection);
    }

    /**
     * @return {Vector}
     */
    normal() : Vector {
        if(this.x == 0 && this.y == 0 && this.z == 0) return new Vector(0, 0, 0);
        let l = this.length();
        return new Vector(this.x / l, this.y / l, this.z / l);
    }

    normSelf() : this {
        const l = this.length();
        this.x /= l;
        this.y /= l;
        this.z /= l;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    dot(vec: IVector) : number {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    /**
     */
    round(decimals?: number) : Vector {
        return this.clone().roundSelf(decimals);
    }

    /**
     * @returns {Vector}
     */
    roundSelf(decimals?: number) : this {
        if(decimals) {
            decimals = Mth.POWER_OF_10[decimals];
            this.x = Math.round(this.x * decimals) / decimals;
            this.y = Math.round(this.y * decimals) / decimals;
            this.z = Math.round(this.z * decimals) / decimals;
            return this;
        }
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.z = Math.round(this.z);
        return this;
    }

    minSelf(vec: IVector) : this {
        this.x = Math.min(this.x, vec.x);
        this.y = Math.min(this.y, vec.y);
        this.z = Math.min(this.z, vec.z);
        return this
    }

    maxSelf(vec: IVector) : this {
        this.x = Math.max(this.x, vec.x);
        this.y = Math.max(this.y, vec.y);
        this.z = Math.max(this.z, vec.z);
        return this
    }

    /**
     * @return {Vector}
     */
    toInt() : Vector {
        return new Vector(
            this.x | 0,
            this.y | 0,
            this.z | 0
        );
    }

    /**
     * @return {Vector}
     */
    clone() : Vector {
        return new Vector(
            this.x,
            this.y,
            this.z
        );
    }

    /**
     * @return {number[]}
     */
    toArray() : number[] {
        return [this.x, this.y, this.z];
    }

    /**
     * @return {string}
     */
    toString() {
        return '(' + this.x + ',' + this.y + ',' + this.z + ')';
    }

    /**
     */
    toChunkKey() : string {
        return 'c_' + this.x + '_' + this.y + '_' + this.z;
    }

    /**
     */
    toHash() : string {
        return this.x + ',' + this.y + ',' + this.z;
    }

    static toIntHash(x : number, y : number, z : number) : number {
        x *= 39749;
        y *= 76871;
        z *= 46049;
        return x ^ (y << 21) ^ (y >> 11) ^ (z << 11) ^ (z >> 21);
    }

    toIntHash() : number {
        return Vector.toIntHash(this.x, this.y, this.z);
    }

    /**
     * @return {number}
     */
    norm() {
        return this.length();
    }

    /**
     * @return {Vector}
     */
    normalize() : Vector {
        return this.normal();
    }

    normalizeSelf(newLength: float = 1.0): this {
        let norm = this.length()
        if (norm) {
            norm = newLength / norm
            this.x *= norm
            this.y *= norm
            this.z *= norm
        }
        return this
    }

    offset(x: number, y: number, z: number) : Vector {
        return new Vector(this.x + x, this.y + y, this.z + z);
    }

    /**
     * @return {Vector}
     */
    floored() : Vector {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    /**
     * @return {Vector}
     */
    flooredSelf() : this {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        return this;
    }

    translate(x: number, y: number, z: number) : this {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     * Identical semantics to the constructor, but more optimized for Vector argument.
     * Useful for safely replacing the constructor calls.
     */
    initFrom(x : Vector | number, y? : number, z? : number) {
        if (x instanceof Vector) { // this optimization helps a lot
            return this.copyFrom(x);
        }

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.set(x, y, z);
        return this;
    }

    set(x: Vector | IVector | number[] | number, y: number, z: number) : this {
        if (x && typeof x == 'object') {
            return this.copy(x);
        }

        // maybe undef
        this.x = <number>x || 0;
        this.y = <number>y || 0;
        this.z = <number>z || 0;
        return this;
    }

    setScalar(x: number, y: number, z: number) : this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    multiplyScalarSelf(scalar: number) : this {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    multiplyVecSelf(vec: IVector) : this {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        return this;
    }

    divScalarSelf(scalar: number) : this {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

    divScalarVecSelf(vec : IVector) : this {
        this.x /= vec.x;
        this.y /= vec.y;
        this.z /= vec.z;
        return this;
    }

    toAngles() : this {
        // N = 0
        // W = 1
        // S = 2
        // E = 3
        this.z = this.x * (-Math.PI/2);
        this.x = 0;
        this.y = 0;
        return this;
    }

    volume(vec : IVector) : number {
        const volx = Math.abs(this.x - vec.x) + 1;
        const voly = Math.abs(this.y - vec.y) + 1;
        const volz = Math.abs(this.z - vec.z) + 1;
        return volx * voly * volz;
    }

    /**
     */
    copy(from: Vector | number[] | IVector) {
        if (from == null) {
            return this;
        }

        // object is simple and has x, y, z props
        if ('x' in from) {
            this.x = from.x;
            this.y = from.y;
            this.z = from.z;
        }

        // array like object with length 3 or more
        // for gl-matix
        if ((from as any).length >= 3) {
            this.x = from[0];
            this.y = from[1];
            this.z = from[2];

            return this;
        }

        return this;
    }

    /**
     * TO DO EN поворот внутри чанка вокруг y
     * @param {DIRECTION_BIT} dir
     * @return {Vector}
     */
    rotY(dir : number) : this {
        let tmp_x = this.x, tmp_z = this.z;
        if (dir == DIRECTION.EAST) {
            this.x = tmp_z;
            this.z = 15 - tmp_x;
        }
        if (dir == DIRECTION.NORTH) {
            this.x = 15 - tmp_x;
            this.z = 15 - tmp_z;
        }
        if (dir == DIRECTION.WEST) {
            this.x = 15 - tmp_z;
            this.z = tmp_x;
        }
        return this;
    }

    // Rotates self from 0 to 3 times around Y, by 90 degrees each time
    rotateByCardinalDirectionSelf(dir) {
        const x = this.x;
        const z = this.z;
        switch(dir) {
            // case 0: do nothing
            case 1: { // DIRECTION.WEST
                this.x = -z;
                this.z = x;
                break;
            }
            case 2: { // DIRECTION.SOUTH
                this.x = -x;
                this.z = -z;
                break;
            }
            case 3: { // DIRECTION.EAST
                this.x = z;
                this.z = -x;
                break;
            }
        }
    }

    addByCardinalDirectionSelf(vec : IVector, dir : int, mirror_x = false, mirror_z = false) {
        const x_sign = mirror_x ? -1 : 1;
        const z_sign = mirror_z ? -1 : 1;
        this.y += vec.y;
        if(dir !== null) {
            dir = (dir + 4) % 4;
            if(dir == DIRECTION.SOUTH) {
                this.x -= vec.x * x_sign;
                this.z -= vec.z * z_sign;
            } else if(dir == DIRECTION.NORTH) {
                this.x += vec.x * x_sign;
                this.z += vec.z * z_sign;
            } else if(dir == DIRECTION.WEST) {
                this.z += vec.x * x_sign;
                this.x -= vec.z * z_sign;
            } else  if(dir == DIRECTION.EAST) {
                this.z -= vec.x * x_sign;
                this.x += vec.z * z_sign;
            }
        }
        return this;
    }

    /** Rotates the vector around Y axis */
    rotateYawSelf(yaw: float): this {
        const {x, z} = this
        const sin = Math.sin(yaw)
        const cos = Math.cos(yaw)
        this.x = x * cos + z * sin
        this.z = z * cos - x * sin
        return this
    }

    //
    moveToSelf(rotate, dist) {
        this.x += dist * Math.cos(rotate.x) * Math.sin(rotate.z - Math.PI);
        this.y += dist * Math.sin(-rotate.x);
        this.z += dist * Math.cos(rotate.x) * Math.cos(rotate.z - Math.PI);
        return this;
    }

    //
    fromHash(hash) {
        let temp = hash.split(',');
        this.x = temp[0] | 0
        this.y = temp[1] | 0;
        this.z = temp[2] | 0;
        return this;
    }

    /**
     * Return quaternion
     * @param {float} angle
     * @param {boolean} hz
     * @returns
     */
    rotationDegrees(angle, hz = true) {
        if(hz) {
            angle *= (Math.PI / 180);
        }
        const f = Math.sin(angle / 2.0);
        return [
            this.x * f,
            this.y * f,
            this.z * f,
            Math.cos(angle / 2.0),
        ];
    }

}

Vector.initStatics()

export const SIX_VECS = {
    south: new Vector(7, 0, 0),
    west: new Vector(22, 0, 0),
    north: new Vector(18, 0, 0),
    east: new Vector(13, 0, 0),
    up: new Vector(0, 1, 0),
    down: new Vector(0, -1, 0)
};

export let NORMALS = {
    FORWARD: new Vector(0, 0, 1),
    BACK: new Vector(0, 0, -1),
    LEFT: new Vector(-1, 0, 0),
    RIGHT: new Vector(1, 0, 0),
    UP: new Vector(0, 1, 0),
    DOWN: new Vector(0, -1, 0),
};

export class Vec3 extends Vector {
    [key: string]: any;

    /**
     * @param vec
     */
    add(vec: IVector) : Vec3 {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this
    }

    offset(x: number, y: number, z: number) : Vec3 {
        return new Vec3(this.x + x, this.y + y, this.z + z);
    }

}

export class Vector4 {
    [key: string]: any;
    x: number;
    y: number;
    height: number;
    width: number;

    constructor(x : number, y : number, width : number, height : number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}
