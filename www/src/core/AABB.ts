import {CubeSym} from "./CubeSym.js";
import {IndexedColor, Vector} from '../helpers.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"

const {mat3, mat4, vec3}      = glMatrix;
const defaultPivot      = [0.5, 0.5, 0.5];
const defalutCenter     = new Vector(0, 0, 0);
const defaultMatrix     = mat4.create();
const tempMatrix        = mat3.create();
const _size             = [0, 0, 0];
const _dist             = [0, 0, 0];

export const PLANES = {
    up: {
        // axisX , axisY. axisY is flips sign!
        axes  : [[1, 0, 0], /**/ [0, 1, 0]],
        flip  : [1, 1],
        // origin offset relative center
        offset : [0.5, 0.5, 1.0],
    },
    down: {
        axes  : [[1, 0, 0], /**/ [0, -1, 0]],
        flip  : [-1, -1],
        offset: [0.5, 0.5, 0.0],
    },
    south: {
        axes  : [[1, 0, 0], /**/ [0, 0, 1]],
        flip  : [1, -1],
        offset: [0.5, 0.0, 0.5],
    },
    north: {
        axes  : [[1, 0, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [0.5, 1.0, 0.5],
    },
    east: {
        axes  : [[0, 1, 0], /**/ [0, 0, 1]],
        flip  : [1, -1],
        offset: [1.0, 0.5, 0.5],
    },
    west: {
        axes  : [[0, 1, 0], /**/ [0, 0, -1]],
        flip  : [-1, 1],
        offset: [-0.0, 0.5, 0.5],
    }
}

export class AABB {
    x_min: number;
    y_min: number;
    z_min: number;
    x_max: number;
    y_max: number;
    z_max: number;
    private _position?: Vector;
    private _size?: Vector;
    private _center?: Vector;

    constructor(xMin? : number, yMin? : number, zMin? : number, xMax? : number, yMax? : number, zMax? : number) {
        this.x_min = xMin || 0
        this.y_min = yMin || 0
        this.z_min = zMin || 0
        this.x_max = xMax || 0
        this.y_max = yMax || 0
        this.z_max = zMax || 0
    }

    reset() : this {
        this.x_min = Infinity;
        this.y_min = Infinity;
        this.z_min = Infinity;
        this.x_max = -Infinity;
        this.y_max = -Infinity;
        this.z_max = -Infinity;
        return this;
    }

    get position() : Vector {
        this._position = this._position || new Vector(0, 0, 0 )
        this._position.set(this.x_min, this.y_min, this.z_min)
        return this._position
    }

    get size() : Vector {
        this._size = this._size || new Vector(0,0,0);

        this._size.x = this.width;
        this._size.y = this.height;
        this._size.z = this.depth;

        return this._size;
    }

    get width() : number {
        return this.x_max - this.x_min;
    }

    get height() : number {
        return this.y_max - this.y_min;
    }

    get depth() : number {
        return this.z_max - this.z_min;
    }

    get center() : Vector {
        this._center = this._center ||  new Vector(0,0,0);
        this._center.set(
            this.x_min + this.width / 2,
            this.y_min + this.height / 2,
            this.z_min + this.depth / 2,
        );

        return this._center;
    }

    get volume() : float {
        return this.width * this.height * this.depth
    }

    clone() : AABB {
        return new AABB(this.x_min, this.y_min, this.z_min, this.x_max, this.y_max, this.z_max)
    }

    copyFrom(aabb : AABB) : this {
        this.x_min = aabb.x_min;
        this.x_max = aabb.x_max;
        this.y_min = aabb.y_min;
        this.y_max = aabb.y_max;
        this.z_min = aabb.z_min;
        this.z_max = aabb.z_max;
        return this;
    }

    /** See also {@link expand} */
    pad(padding : number) : this {
        this.x_min -= padding;
        this.x_max += padding;
        this.y_min -= padding;
        this.y_max += padding;
        this.z_min -= padding;
        this.z_max += padding;
        return this;
    }

    set(xMin : number, yMin : number, zMin : number, xMax : number, yMax : number, zMax : number): this {
        this.x_min = xMin;
        this.y_min = yMin;
        this.z_min = zMin;
        this.x_max = xMax;
        this.y_max = yMax;
        this.z_max = zMax;
        return this;
    }

    setArray(arr: number[]): this {
        this.x_min = arr[0]
        this.y_min = arr[1]
        this.z_min = arr[2]
        this.x_max = arr[3]
        this.y_max = arr[4]
        this.z_max = arr[5]
        return this
    }

    setBottomHeightRadius(vec : IVector, height : number, radius : number) : this {
        return this.set(
            vec.x - radius,
            vec.y,
            vec.z - radius,
            vec.x + radius,
            vec.y + height,
            vec.z + radius);
    }

    setCornerSize(corner : IVector, size : IVector) : this {
        this.x_min = corner.x;
        this.y_min = corner.y;
        this.z_min = corner.z;
        this.x_max = corner.x + size.x;
        this.y_max = corner.y + size.y;
        this.z_max = corner.z + size.z;
        return this;
    }

    setIntersect(aabb1 : AABB, aabb2 : AABB = this) : this {
        this.x_min = Math.max(aabb1.x_min, aabb2.x_min);
        this.x_max = Math.min(aabb1.x_max, aabb2.x_max);
        this.y_min = Math.max(aabb1.y_min, aabb2.y_min);
        this.y_max = Math.min(aabb1.y_max, aabb2.y_max);
        this.z_min = Math.max(aabb1.z_min, aabb2.z_min);
        this.z_max = Math.min(aabb1.z_max, aabb2.z_max);
        return this;
    }

    isEmpty() : boolean {
        return this.x_min >= this.x_max && this.y_min >= this.y_max && this.z_min >= this.z_max;
    }

    applyMatrix(matrix : imat3, pivot : IVector) : this {
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

    applyMat4(matrix : imat4, pivot : IVector) : this {    
        let ox = (this.x_min + this.x_max) * 0.5;
        let oy = (this.y_min + this.y_max) * 0.5;
        let oz = (this.z_min + this.z_max) * 0.5;

        const odx = ox - this.x_min;
        const ody = oy - this.y_min;
        const odz = oz - this.z_min;

        if (pivot) {
            ox -= pivot.x;
            oy -= pivot.y;
            oz -= pivot.z;
        }

        let cx = ox * matrix[0] + oy * matrix[4] + ox * matrix[8] + matrix[12];
        let cy = ox * matrix[1] + oy * matrix[5] + oy * matrix[9] + matrix[13];
        let cz = ox * matrix[2] + oz * matrix[6] + oz * matrix[10] + matrix[14];

        const dx = Math.abs(odx * matrix[0]) + Math.abs(ody * matrix[4]) + Math.abs(odz * matrix[8]);
        const dy = Math.abs(odx * matrix[1]) + Math.abs(ody * matrix[5]) + Math.abs(odz * matrix[9]);
        const dz = Math.abs(odx * matrix[2]) + Math.abs(ody * matrix[6]) + Math.abs(odz * matrix[10]);

        if (pivot) {
            cx += pivot.x;
            cy += pivot.y;
            cz += pivot.z;
        }

        this.x_min = cx - dx;
        this.x_max = cx + dx;
        this.y_min = cy - dy;
        this.y_max = cy + dy;
        this.z_min = cz - dz;
        this.z_max = cz + dz;

        return this;
    }

    contains(x : number, y : number, z : number) : boolean {
        return x >= this.x_min && x < this.x_max
            && y >= this.y_min && y < this.y_max
            && z >= this.z_min && z < this.z_max;
    }

    containsVec(vec : IVector) : boolean {
        return this.contains(vec.x, vec.y, vec.z);
    }

    intersectsColumn(x : number, z : number, y : number, y2 : number) : boolean {
        return x >= this.x_min && x < this.x_max
            && z >= this.z_min && z < this.z_max
            && y2 > this.y_min && y < this.y_max;
    }

    containsColumn(x : number, z : number, y : number, y2 : number) : boolean {
        return x >= this.x_min && x < this.x_max
            && z >= this.z_min && z < this.z_max
            && y >= this.y_min && y2 <= this.y_max;
    }

    intersect(box : IAABB) : boolean {
        return (box.x_min < this.x_max && this.x_min < box.x_max
            && box.y_min < this.y_max && this.y_min < box.y_max
            && box.z_min < this.z_max && this.z_min < box.z_max);
    }

    intersecXZ(box : IAABB) : boolean {
        return (box.x_min < this.x_max && this.x_min < box.x_max
            && box.z_min < this.z_max && this.z_min < box.z_max);
    }

    /**
     * rotated around 0
     */
    rotate(sym : int, pivot : IVector) : this {
        if (sym === 0) {
            return this;
        }

        return this.applyMatrix(CubeSym.matrices[sym], pivot);
    }

    toArray(target : number[] = []) : number[] {
        target[0] = this.x_min;
        target[1] = this.y_min;
        target[2] = this.z_min;

        target[3] = this.x_max;
        target[4] = this.y_max;
        target[5] = this.z_max;

        return target;
    }

    fromArray(source : number[] = []) : this {
        this.x_min = source[0];
        this.y_min = source[1];
        this.z_min = source[2];

        this.x_max = source[3];
        this.y_max = source[4];
        this.z_max = source[5];

        return this;
    }

    translate(x : number, y : number, z : number) : this {
        this.x_min += x;
        this.x_max += x;
        this.y_min += y;
        this.y_max += y;
        this.z_min += z;
        this.z_max += z;
        return this;
    }

    translateByVec(vec : IVector) : this {
        return this.translate(vec.x, vec.y, vec.z);
    }

    addPoint(x : number, y : number, z : number) : this {
        if(x < this.x_min) this.x_min = x;
        if(x > this.x_max) this.x_max = x;
        if(y < this.y_min) this.y_min = y;
        if(y > this.y_max) this.y_max = y;
        if(z < this.z_min) this.z_min = z;
        if(z > this.z_max) this.z_max = z;
        return this;
    }

    /**
     * Expand same for all sides
     * See also {@link pad}
     */
    expand(x : number, y : number, z : number) : this {
        this.x_min -= x;
        this.x_max += x;
        this.y_min -= y;
        this.y_max += y;
        this.z_min -= z;
        this.z_max += z;
        return this;
    }

    floor() : this {
        this.x_min = Math.floor(this.x_min)
        this.y_min = Math.floor(this.y_min)
        this.z_min = Math.floor(this.z_min)
        this.x_max = Math.floor(this.x_max)
        this.y_max = Math.floor(this.y_max)
        this.z_max = Math.floor(this.z_max)
        return this
    }

    addSelfTranslatedByVec(vec : IVector) : this {
        if (vec.x > 0) this.x_max += vec.x; else this.x_min += vec.x;
        if (vec.y > 0) this.y_max += vec.y; else this.y_min += vec.y;
        if (vec.z > 0) this.z_max += vec.z; else this.z_min += vec.z;
        return this;
    }

    div(value : number) : this {
        this.x_min /= value;
        this.x_max /= value;
        this.y_min /= value;
        this.y_max /= value;
        this.z_min /= value;
        this.z_max /= value;
        return this;
    }

    distance(vec: IVector): float {
        const dx = (vec.x < this.x_min) ? (this.x_min - vec.x) : (vec.x > this.x_max ? vec.x - this.x_max : 0)
        const dy = (vec.y < this.y_min) ? (this.y_min - vec.y) : (vec.y > this.y_max ? vec.y - this.y_max : 0)
        const dz = (vec.z < this.z_min) ? (this.z_min - vec.z) : (vec.z > this.z_max ? vec.z - this.z_max : 0)
        return Math.sqrt(dx * dx + dy * dy + dz * dz)
    }

}

export interface IAABB {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
    z_min: number;
    z_max: number;
}

export class AABBPool {
    [key: string]: any;
    _list: AABB[];
    constructor() {
        this._list = [];
    }

    release(elem : AABB) {
        this._list.push(elem);
    }

    alloc() : AABB {
        return this._list.pop() || new AABB();
    }

    static instance = new AABBPool();
}

export class AABBSides {
    up?: AABBSideParams = null
    down?: AABBSideParams = null
    south?: AABBSideParams = null
    north?: AABBSideParams = null
    east?: AABBSideParams = null
    west?: AABBSideParams = null

    constructor(up?: AABBSideParams, down?: AABBSideParams, south?: AABBSideParams, north?: AABBSideParams, east?: AABBSideParams, west?: AABBSideParams) {
        this.up = up
        this.down = down
        this.south = south
        this.north = north
        this.east = east
        this.west = west
    }
}

export class AABBSideParams {
    [key: string]: any;
    uv?: float[];
    flag: int = 0;
    anim: number = 0;
    lm: IndexedColor | null = null;
    axes?: number[][];
    autoUV: boolean = false;
    rawColor?: number[] | null;
    offset?: number[];

    constructor(uv : float[] = [0, 0, 0, 0], flag : int = 0, anim : number = 0, lm : IndexedColor | null = null, axes? : number[][], autoUV : boolean = false, rawColor = null, offset = null) {
        this.set(uv, flag, anim, lm, axes, autoUV, rawColor, offset)
    }

    set(uv : float[] = [0, 0, 0, 0], flag : int = 0, anim : number = 0, lm : IndexedColor | null = null, axes? : number[][], autoUV : boolean = false, rawColor = null, offset = null) {
        this.uv       = uv;
        this.flag     = flag;
        this.anim     = anim;
        this.lm       = lm;
        this.axes     = axes;
        this.autoUV   = autoUV;
        this.rawColor = rawColor;
        this.offset   = offset;
        return this;
    }

}

export function pushTransformed(
    vertices, mat : imat4, pivot : number[] | IVector,
    cx, cz, cy,
    x0, z0, y0,
    ux, uz, uy,
    vx, vz, vy,
    c0, c1, c2, c3,
    pp, flags : int
) {

    pivot = pivot || defaultPivot;
    if(Array.isArray(pivot)) {
        cx += pivot[0];
        cy += pivot[1];
        cz += pivot[2];
        x0 -= pivot[0];
        y0 -= pivot[1];
        z0 -= pivot[2];
    } else {
        cx += pivot.x;
        cy += pivot.y;
        cz += pivot.z;
        x0 -= pivot.x;
        y0 -= pivot.y;
        z0 -= pivot.z;
    }

    mat = mat || defaultMatrix;

    let tx = 0;
    let ty = 0;
    let tz = 0;

    // unroll mat4 matrix to mat3 + tx, ty, tz
    if (mat.length === 16) {
        mat3.fromMat4(tempMatrix, mat);
        mat3.transpose(tempMatrix, tempMatrix);

        tx = mat[12];
        ty = mat[14]; // flip
        tz = mat[13]; // flip

        mat = tempMatrix;
    }

    vertices.push(
        cx + x0 * mat[0] + y0 * mat[1] + z0 * mat[2] + tx,
        cz + x0 * mat[6] + y0 * mat[7] + z0 * mat[8] + ty,
        cy + x0 * mat[3] + y0 * mat[4] + z0 * mat[5] + tz,

        ux * mat[0] + uy * mat[1] + uz * mat[2],
        ux * mat[6] + uy * mat[7] + uz * mat[8],
        ux * mat[3] + uy * mat[4] + uz * mat[5],

        vx * mat[0] + vy * mat[1] + vz * mat[2],
        vx * mat[6] + vy * mat[7] + vz * mat[8],
        vx * mat[3] + vy * mat[4] + vz * mat[5],

        c0, c1, c2, c3, pp, flags
    );
}

/**
 * Side params for cube
 * @typedef {{up?: AABBSideParams, down?: AABBSideParams, south?: AABBSideParams, north: AABBSideParams, east?: AABBSideParams, west?: AABBSideParams}} TSideSet
 */

/**
 *
 * @param vertices
 * @param aabb
 * @param pivot
 * @param matrix
 * @param sides
 * @param center - center wicha AABB is placed, same as [x, y, z] in push transformed
 */
export function pushAABB(vertices : Float32Array | any[], aabb : AABB, pivot: Vector | IVector | number[] | null = null, matrix: null | imat4 = null, sides: TSideSet, center: IVector) {

    matrix = matrix || defaultMatrix
    center = center || defalutCenter
    pivot  = pivot  || defaultPivot

    const lm_default      = IndexedColor.WHITE
    const globalFlags     = 0
    const x               = center.x
    const y               = center.y
    const z               = center.z

    _size[0] = aabb.width;
    _size[1] = aabb.depth; // fucking flipped ZY
    _size[2] = aabb.height;

    // distance from center to minimal position
    _dist[0] = aabb.x_min - x
    _dist[1] = aabb.z_min - z // fucking flipped ZY
    _dist[2] = aabb.y_min - y

    for(const key in sides) {

        const side = sides[key]

        if(!side) {
            continue
        }

        const { /*axes,*/ /*offset*/ flip } = PLANES[key]
        const { uv, flag = 0, anim = 0, autoUV = true, rawColor } = side
        const lm = side.lm || lm_default
        const axes = side.axes || PLANES[key].axes
        const offset = side.offset || PLANES[key].offset

        let uvSize0: number
        let uvSize1: number

        let r = lm.r
        let g = lm.g
        let b = anim || lm.b

        if (rawColor) {
            r = rawColor[0];
            g = rawColor[1];
            b = rawColor[2];
        }

        if(autoUV) {
            uvSize0 = vec3.dot(axes[0], _size) * (uv[2]); // * flip[0];
            uvSize1 = -vec3.dot(axes[1], _size) * (uv[3]); // * flip[1];
        } else {
            uvSize0 = uv[2] * flip[0];
            uvSize1 = uv[3] * flip[1];
        }

        let sz0 = _size[0]
        let sz1 = _size[1]
        let sz2 = _size[2]

        pushTransformed(
            vertices, side.matrix || matrix, pivot,
            // center
            x, z, y,
            // offset
            sz0 * offset[0] + _dist[0],
            sz1 * offset[1] + _dist[1],
            sz2 * offset[2] + _dist[2],
            // axisx
            sz0 * axes[0][0],
            sz1 * axes[0][1],
            sz2 * axes[0][2],
            // axisY
            sz0 * axes[1][0],
            sz1 * axes[1][1],
            sz2 * axes[1][2],
            // UV center
            uv[0], uv[1],
            // UV size
            uvSize0, uvSize1,
            IndexedColor.packArg(r, g, b),
            // flags
            globalFlags | flag
        )
        
    }

}