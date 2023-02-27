/// <reference path="./global.d.ts" />

import { CubeSym } from "./core/CubeSym.js";
import {impl as alea} from "../vendors/alea.js";
import {default as runes} from "../vendors/runes.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_OUTER_SIZE_X, CHUNK_OUTER_SIZE_Y, CHUNK_OUTER_SIZE_Z, CHUNK_PADDING,
    CHUNK_CX, CHUNK_CY, CHUNK_CZ, CHUNK_CW } from "./chunk_const.js";
import { DEFAULT_TX_CNT } from "./constant.js";
import type { AABB } from "./core/AABB.js";

const {mat4, quat} = glMatrix;

export const TX_CNT = DEFAULT_TX_CNT;

export enum ROTATE {
    S = CubeSym.ROT_Y2, // front, z decreases
    W = CubeSym.ROT_Y,  // left, x decreases
    N = CubeSym.ID,     // back, z increases
    E = CubeSym.ROT_Y3, // right, x increases
};

export enum CAMERA_MODE {
    COUNT               = 3,
    SHOOTER             = 0,
    THIRD_PERSON        = 1,
    THIRD_PERSON_FRONT  = 2,
}

export enum QUAD_FLAGS {
    NORMAL_UP                   = 1 << 0,
    MASK_BIOME                  = 1 << 1,
    NO_AO                       = 1 << 2,
    NO_FOG                      = 1 << 3,
    LOOK_AT_CAMERA              = 1 << 4,
    FLAG_ANIMATED               = 1 << 5,
    FLAG_TEXTURE_SCROLL         = 1 << 6,
    NO_CAN_TAKE_AO              = 1 << 7,
    QUAD_FLAG_OPACITY           = 1 << 8,
    QUAD_FLAG_SDF               = 1 << 9,
    NO_CAN_TAKE_LIGHT           = 1 << 10,
    FLAG_TRIANGLE               = 1 << 11,
    FLAG_MIR2_TEX               = 1 << 12,
    FLAG_MULTIPLY_COLOR         = 1 << 13,
    FLAG_LEAVES                 = 1 << 14,
    LOOK_AT_CAMERA_HOR          = 1 << 15,
    // Starting from this flag, we can add new flags to fields
    // that contain QUAD_FLAGS, e.g. Mesh_Effect_Particle.flags
    FLAG_ENCHANTED_ANIMATION    = 1 << 16,
    FLAG_RAIN_OPACITY           = 1 << 17,
    FLAG_MASK_COLOR_ADD         = 1 << 18,
    FLAG_WAVES_VERTEX           = 1 << 19,
    FLAG_TORCH_FLAME                   = 1 << 20,
    NEXT_UNUSED_FLAG            = 1 << 21,
}

// Direction enumeration
export enum DIRECTION {
    UP        = CubeSym.ROT_X,
    DOWN      = CubeSym.ROT_X3,
    LEFT      = CubeSym.ROT_Y,
    RIGHT     = CubeSym.ROT_Y3,
    FORWARD   = CubeSym.ID,
    BACK      = CubeSym.ROT_Y2,
    // Aliases
    WEST      = CubeSym.ROT_Y, // left
    EAST      = CubeSym.ROT_Y3, // right
    NORTH     = CubeSym.ID, // forward
    SOUTH     = CubeSym.ROT_Y2, // back
};

export enum DIRECTION_BIT {
    UP    = 0,
    DOWN  = 1,
    EAST  = 2, // X increases
    WEST  = 3, // X decreases
    NORTH = 4, // Z increases
    SOUTH = 5, // Z decreases
};

// Direction names
export enum DIRECTION_NAME {
    up        = DIRECTION.UP as int,
    down      = DIRECTION.DOWN as int,
    left      = DIRECTION.LEFT as int,
    right     = DIRECTION.RIGHT as int,
    forward   = DIRECTION.FORWARD as int,
    back      = DIRECTION.BACK as int,
};

/**
 * @param {string} url
 * @param {*} callback
 */
 function loadText(url: string, callback: any) {
    let xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == 200) {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

function toType(a : any) : string | null {
    // Get fine type (object, array, function, null, error, date ...)
    const resp = ({}).toString.call(a).match(/([a-z]+)(:?\])/i)
    return resp ? resp[1] : null;
}

function isDeepObject(obj) {
    return "Object" === toType(obj);
}

/**
 * Returns an euler angle representation of a quaternion
 * @param  {number[]} out Euler angles, pitch-yaw-roll (vec3)
 * @param  {number[]} quat Quaternion (vec4)
 * @return {number[]} out (vec3)
 */
 function getEuler(out, quat) {
    let x = quat[0],
        y = quat[1],
        z = quat[2],
        w = quat[3],
        x2 = x * x,
        y2 = y * y,
        z2 = z * z,
        w2 = w * w;

    let unit = x2 + y2 + z2 + w2;
    let test = x * w - y * z;

    if (test > (0.5 - glMatrix.EPSILON) * unit) {
        // singularity at the north pole
        out[0] = Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else if (test < -(0.5 - glMatrix.EPSILON) * unit) { //TODO: Use glmatrix.EPSILON
        // singularity at the south pole
        out[0] = -Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else {
        out[0] = Math.asin(2 * (x * z - w * y));
        out[1] = Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2));
        out[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2));
    }

    const TO_DEG = 180 / Math.PI;

    out[0] *= TO_DEG;
    out[1] *= TO_DEG;
    out[2] *= TO_DEG;

    return out;
}

/**
 * Lerp any value between
 * @param {*} a
 * @param {*} b
 * @param {number} t
 * @param {*} res
 * @returns
 */
export function lerpComplex (a, b, t, res) {
    const typeA = typeof a;
    const typeB = typeof b;

    if (typeA !== typeB) {
        return res; // no emit
    }

    if (a == null || b == null) {
        return null;
    }

    if (typeA == 'boolean' || typeA === 'string') {
        return t > 0.5 ? b : a; // if < 0.5 return a, or b
    }

    if (typeA === 'number') {
        return a * (1 - t) + b * t;
    }

    if (Array.isArray(a)) {
        res = res || [];

        for (let i = 0; i < Math.min(a.length, b.length); i ++) {
            res[i] = a[i] * (1 - t) + b[i] * t;
        }

        return res;
    }

    res = res || {};

    for (const key in a) {

        res[key] = lerpComplex(
            a[key],
            b[key],
            t,
            res[key]
        );
    }

    return res;
}

export class Mth {
    [key: string]: any;

    static PI_MUL2  = Math.PI * 2
    static PI_DIV2  = Math.PI / 2
    static PI_INV   = 1 / Math.PI

    /**
     * Lerp any value between
     * @param {*} a
     * @param {*} b
     * @param {number} t
     * @param {*} res
     * @returns
     */
    static lerpComplex = lerpComplex;

    static lerp(amount, value1, value2) {
        amount = amount < 0 ? 0 : amount;
        amount = amount > 1 ? 1 : amount;
        return value1 + (value2 - value1) * amount;
    }

    static lerpAny(x, x1, value1, x2, value2) {
        return x1 !== x2
            ? this.lerp((x - x1) / (x2 - x1), value1, value2)
            : (value1 + value2) * 0.5;
    }

    static sin(a) {
        return Math.sin(a);
    }

    static cos(a) {
        return Math.cos(a);
    }

    static clamp (value, min, max) {
        return value < min
            ? min : (
                value > max
                    ? max
                    : value
            );
    }

    static clampModule(value, maxModule) {
        return value >= maxModule
            ? maxModule
            : (value < -maxModule ? -maxModule : value)
    }

    static repeat(value, length) {
        return Mth.clamp(value - Math.floor(value / length) * length, 0.0, length);
    }

    /**
     * Compute a distance between over minimal arc
     * @param {number} current
     * @param {number} target
     * @returns {number}
     */
    static deltaAngle(current, target) {
        const delta = Mth.repeat((target - current), 360.0);

        return delta > 180
            ? delta - 360.0
            : delta;
    }

    /**
     * Lerp angle with over minimal distance
     * @param {number} a - start angle
     * @param {number} b - target angle
     * @param {number} t - lerp factor
     * @returns {number}
     */
    static lerpAngle(a, b, t) {
        let delta = Mth.repeat((b - a), 360);

        if (delta > 180)
            delta -= 360;

        return a + delta * Mth.clamp(t, 0, 1);
    }

    // lut is an array containing pairs (amount, vaue), ordered by amount ascending.
    static lerpLUT(amount, lut) {
        if (amount <= lut[0]) {
            return lut[1];
        }
        var i = 2;
        while (i < lut.length && amount > lut[i]) {
            i += 2;
        }
        if (i === lut.length) {
            return lut[i - 1];
        }
        amount = (amount - lut[i - 2]) / (lut[i] - lut[i - 2]);
        return Mth.lerp(amount, lut[i - 1], lut[i + 1]);
    }

    /**
     * It transforms a uniformly distributed number from in 0..1 into
     * a somewhat "normally-like" (but exactly normally) distributed
     * number ceneterd around 0.
     * @param {Number} unifirmRandom01 - a uniformly distributed random
     *  number from 0 to 1
     * @param {Number} width - the maximum absolute value of results
     * @param {Number} narrowness - the bigger the value, the narrower
     *  the distribution. From 0 to 10.
     * @param {Number} flatness - the bigger the value, the wider is the
     * distribution, but it affects the central spike more than the borders. From 0 to 1.
     *
     * {narrowness: 4, flatness: 0} and {narrowness: 8, flatness: 0.5} have similar
     * density at the border, but the 1st one has a sharper cenral skike.
     */
    static toNarrowDistribution(unifirmRandom01: number, width: number, narrowness: number, flatness: number = 0) {
        const v = (unifirmRandom01 - 0.5) * 2;
        const vToPower = Math.pow(Math.abs(v), narrowness) * v;
        return (vToPower + flatness * (v - vToPower)) * width;
    }

    // generates from min to max, inclusive
    static randomIntRange(min: number, max: number) : number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // generates from 0 (inclusive) to max (exclusive)
    static randomInt(maxExclusive: number) : number {
        return Math.floor(Math.random() * maxExclusive);
    }

    static round(value: number, decimals: number) : number {
        decimals = Math.pow(10, decimals)
        return Math.round(value * decimals) / decimals
    }

    static roundUpToPowerOfTwo(v) {
        v--
        v |= v >> 1
        v |= v >> 2
        v |= v >> 4
        v |= v >> 8
        v |= v >> 16
        return v + 1
    }

    /**
     * Creates a function based on a lookup table without interpolation. Very fast and imprecise.
     * @param {number} min - the minimum value of the argument
     * @param {number} max - the maximum value of the argument
     * @param {number} size - the lookup table size. It's recommended to use at least 100.
     * @param {boolean} rangeCheck - whether to add range checks (slower, it's usefule to enable them for debugging, then turn off)
     */
    static createBasicLUTFunction(min: number, max: number, size: number = 100, rangeCheck: boolean, fn: Function): Function {
        const arr = new Float32Array(size)
        const maxInd = size - 1
        max -= min
        const kx = maxInd / max
        const kxInv = max / maxInd
        for(let i = 0; i <= maxInd; i++) {
            arr[i] = fn(min + i * kxInv)
        }
        return rangeCheck
            ? function(x: number): number {
                const ind = Math.round((x - min) * kx) | 0
                if ((ind | maxInd - ind) < 0) {
                    throw new Error()
                }
                return arr[ind]
            }
            : function(x: number): number {
                return arr[Math.round((x - min) * kx) | 0]
            }
    }

    /**
     * Similar to {@link createBasicLUTFunction}, but uses linear interpolation - more accurate and slower.
     * Chose smaller {@link size} than in {@link createBasicLUTFunction}.
     */
    static createLerpLUTFunction(min: number, max: number, size: number = 16, rangeCheck: boolean, fn: Function): Function {
        size |= 0
        // Pad with 1 element at each side, in case the argument is slightly out of bounds due to rounding errors.
        const arr = new Float64Array(size + 2)
        const maxInd = size - 1
        max -= min
        const kx = maxInd / max
        const kxInv = max / maxInd
        for(let i = 0; i <= maxInd; i++) {
            arr[i + 1] = fn(min + i * kxInv)
        }
        arr[0] = arr[1]
        arr[arr.length - 1] = arr[arr.length - 2]
        return rangeCheck
            ? function(x: number): number {
                let fi = (x - min) * kx
                const floor = Math.floor(fi)
                fi -= floor // now its semantics is "fraction beyound floor"
                const floorInd = (floor | 0) + 1
                // This condition is imprecise: it doesn't detect slight out-of-bounds.
                // But it's fast, and probably good enough to chatch bugs in practice.
                if ((floorInd | size - floorInd) < 0) {
                    throw new Error()
                }
                return arr[floorInd] * (1 - fi) + arr[floorInd + 1] * fi
            }
            : function(x: number): number {
                let fi = (x - min) * kx
                const floor = Math.floor(fi)
                fi -= floor
                const floorInd = (floor | 0) + 1
                return arr[floorInd] * (1 - fi) + arr[floorInd + 1] * fi
            }
    }
}

/**
 * Calculates a convex bulge over a pathch of a flat surface, based on the distance
 * from a surface point to the surfase center.
 */
export class SphericalBulge {
    distToCenterOnUnitSph: number
    distScaleSqrInv: number
    bulgeScale: number
    x0: number
    y0: number

    /**
     * @param {float} radius - the radius of the pathc that has zon-zero bulge
     * @param {float} maxBulge - that bulge height at the surface center
     * @param {float} maxBulgeOnUnitSphere - affects the shape of the curvature, from 0 to 1 not inclusive
     */
    initRadius(radius, maxBulge = 1, maxBulgeOnUnitSphere = 0.25) {
        if (maxBulgeOnUnitSphere <= 0 || maxBulgeOnUnitSphere >= 1) {
            throw new Error()
        }
        this.distToCenterOnUnitSph = 1 - maxBulgeOnUnitSphere
        const maxDistSqrOnUnitSph = 1 - this.distToCenterOnUnitSph * this.distToCenterOnUnitSph
        this.distScaleSqrInv = maxDistSqrOnUnitSph / (radius * radius + 1e-10)
        this.bulgeScale = maxBulge / maxBulgeOnUnitSphere
        return this
    }

    init1DIntRange(x_min, x_max_excl, maxBulge = 1, maxBulgeOnUnitSphere = 0.25) {
        this.x0 = (x_min + x_max_excl - 1) * 0.5
        const radius = 0.5 * (x_max_excl - x_min - 1 + 1e-10)
        return this.initRadius(radius, maxBulge, maxBulgeOnUnitSphere)
    }

    init2DIntRange(x_min, y_min, x_max_excl, y_max_excl, maxBulge = 1, maxBulgeOnUnitSphere = 0.25) {
        this.x0 = (x_min + x_max_excl - 1) * 0.5
        this.y0 = (y_min + y_max_excl - 1) * 0.5
        const dx = x_max_excl - x_min - 1
        const dy = y_max_excl - y_min - 1
        const radius = 0.5 * (Math.sqrt(dx * dx + dy * dy) + 1e-10)
        return this.initRadius(radius, maxBulge, maxBulgeOnUnitSphere)
    }

    /**
     * @param {float} distSqr - the distance squared from a surface point to the center of the surface
     */
    bulgeByDistanceSqr(distSqr) {
        const distSqrOnUnitSph = distSqr * this.distScaleSqrInv
        const cathetusOnUnitSph = Math.sqrt(Math.max(1 - distSqrOnUnitSph, 0))
        return this.bulgeScale * Math.max(0, cathetusOnUnitSph - this.distToCenterOnUnitSph)
    }

    bulgeByDistance(dist) {
        return this.bulgeByDistanceSqr(dist * dist)
    }

    bulgeByXY(x, y) {
        x -= this.x0
        y -= this.y0
        return this.bulgeByDistanceSqr(x * x + y * y)
    }

    bulgeByX(x) {
        x -= this.x0
        return this.bulgeByDistanceSqr(x * x)
    }
}

export class IvanArray {
    [key: string]: any;
    arr: any[];
    count: number;
    constructor() {
        this.arr = [];
        this.count = 0;
    }

    clear() {
        const { count, arr } = this;
        this.count = 0;
        for (let i = 0; i < count; i++) {
            arr[i] = null;
        }
    }

    push(elem) {
        this.arr[this.count++] = elem;
    }
}

//
export function makeChunkEffectID(chunk_addr : Vector, material_key : string) : string {
    let resp = `particles_effects/${chunk_addr.toHash()}/`;
    if(material_key) {
        resp += material_key;
    }
    return resp;
}

/**
 * Возвращает адрес чанка по глобальным абсолютным координатам
 * @param x
 * @param y
 * @param z
 * @param out_vec
 */
export function getChunkAddr(x: number, y: number, z : number, out_vec : Vector | null = null) : Vector {
    out_vec = out_vec || new Vector();
    out_vec.x = Math.floor(x as any / CHUNK_SIZE_X);
    out_vec.y = Math.floor(y as any / CHUNK_SIZE_Y);
    out_vec.z = Math.floor(z / CHUNK_SIZE_Z);
    // Fix negative zero
    if(out_vec.x == 0) {out_vec.x = 0;}
    if(out_vec.y == 0) {out_vec.y = 0;}
    if(out_vec.z == 0) {out_vec.z = 0;}
    return out_vec;
}

export function chunkAddrToCoord(addr : IVector, result : IVector) {
    result.x = addr.x * CHUNK_SIZE_X;
    result.y = addr.y * CHUNK_SIZE_Y;
    result.z = addr.z * CHUNK_SIZE_Z;
}

export function unixTime() : int {
    return ~~(Date.now() / 1000);
}

/**
 * @param {string} seed
 * @param {int} len
 * @returns
 */
export function createFastRandom(seed : string, len : int = 512) {
    const random_alea = new alea(seed);
    // fast random
    const randoms = new Array(len); // new Float32Array(len)
    for(let i = 0; i < len; i++) {
        randoms[i] = random_alea.double();
    }
    let random_index = 0;
    // return random_alea.double
    return () => randoms[random_index++ % len];
}

export function fromMat3(out : imat4, b : imat3) : imat4 {
    // transponse too!
    out[ 0] = b[ 0];
    out[ 1] = b[ 3];
    out[ 2] = b[ 6];

    out[ 4] = b[ 1];
    out[ 5] = b[ 4];
    out[ 6] = b[ 7];

    out[ 8] = b[ 2];
    out[ 9] = b[ 5];
    out[10] = b[ 8];

    out[ 3] = out[ 7] = out[11] =
    out[12] = out[13] = out[14] = 0;
    out[15] = 1.0;

    return out;
}

// calcRotateMatrix
export function calcRotateMatrix(material, rotate : IVector, cardinal_direction : int, matrix : imat4) {
    // Can rotate
    if(material.can_rotate) {
        //
        if(rotate) {

            if (CubeSym.matrices[cardinal_direction][4] <= 0) {
                matrix = fromMat3(new Float32Array(16), CubeSym.matrices[cardinal_direction]);
                /*
                // Use matrix instead!
                if (matrix) {
                    mat3.multiply(tempMatrix, matrix, CubeSym.matrices[cardinal_direction]);
                    matrix = tempMatrix;
                } else {
                    matrix = CubeSym.matrices[cardinal_direction];
                }
                */
            } else if(rotate.y != 0) {
                if(material.tags.includes('rotate_by_pos_n')) {
                    matrix = mat4.create();
                    if(rotate.y == 1) {
                        // on the floor
                        mat4.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI);
                    } else {
                        // on the ceil
                        mat4.rotateZ(matrix, matrix, Math.PI);
                        mat4.rotateY(matrix, matrix, (rotate.x / 4) * (2 * Math.PI) + Math.PI*2);
                    }
                }
            }
        }
    }
    return matrix;
}

// md5
export let md5 = (function() {
    var MD5 = function (d, outputEncoding? : BufferEncoding) {
        const binaryStr = V(Y(X(d), 8 * d.length));
        if (outputEncoding) { // 'base64', 'base64url', etc. - supported only in node.js
            return Buffer.from(binaryStr, 'binary').toString(outputEncoding);
        }
        return M(binaryStr); // hex (lowercase) encoding by default
    }
    function M (d) {
        for (var _, m = '0123456789abcdef', f = '', r = 0; r < d.length; r++) {
            _ = d.charCodeAt(r)
            f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _)
        }
        return f
    }
    function X (d) {
        for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++) {
            _[m] = 0
        }
        for (m = 0; m < 8 * d.length; m += 8) {
            _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32
        }
        return _
    }
    function V (d) {
        for (var _ = '', m = 0; m < 32 * d.length; m += 8) _ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255)
        return _
    }
    function Y (d, _) {
        d[_ >> 5] |= 128 << _ % 32
        d[14 + (_ + 64 >>> 9 << 4)] = _
        for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) {
            var h = m
            var t = f
            var g = r
            var e = i
            f = md5ii(f = md5ii(f = md5ii(f = md5ii(f = md5hh(f = md5hh(f = md5hh(f = md5hh(f = md5gg(f = md5gg(f = md5gg(f = md5gg(f = md5ff(f = md5ff(f = md5ff(f = md5ff(f, r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5ff(r, i = md5ff(i, m = md5ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5gg(r, i = md5gg(i, m = md5gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5hh(r, i = md5hh(i, m = md5hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5ii(r, i = md5ii(i, m = md5ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551)
            m = safeadd(m, h)
            f = safeadd(f, t)
            r = safeadd(r, g)
            i = safeadd(i, e)
        }
        return [m, f, r, i]
    }
    function md5cmn (d, _, m, f, r, i) {
        return safeadd(bitrol(safeadd(safeadd(_, d), safeadd(f, i)), r), m)
    }
    function md5ff (d, _, m, f, r, i, n) {
        return md5cmn(_ & m | ~_ & f, d, _, r, i, n)
    }
    function md5gg (d, _, m, f, r, i, n) {
        return md5cmn(_ & f | m & ~f, d, _, r, i, n)
    }
    function md5hh (d, _, m, f, r, i, n) {
        return md5cmn(_ ^ m ^ f, d, _, r, i, n)
    }
    function md5ii (d, _, m, f, r, i, n) {
        return md5cmn(m ^ (_ | ~f), d, _, r, i, n)
    }
    function safeadd (d, _) {
        var m = (65535 & d) + (65535 & _)
        return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m
    }
    function bitrol (d, _) {
        return d << _ | d >>> 32 - _
    }
    function MD5Unicode(buffer, outputEncoding? : BufferEncoding) {
        if (!(buffer instanceof Uint8Array || typeof Buffer === 'function' && buffer instanceof Buffer)) {
            buffer = new TextEncoder().encode(typeof buffer==='string' ? buffer : JSON.stringify(buffer));
        }
        var binary = [];
        var bytes = new Uint8Array(buffer);
        for (var i = 0, il = bytes.byteLength; i < il; i++) {
            binary.push(String.fromCharCode(bytes[i]));
        }
        return MD5(binary.join(''), outputEncoding);
    }

    return MD5Unicode;
})();

// VectorCollectorFlat...
export class VectorCollectorFlat {
    [key: string]: any;
    flat: any[];
    free_indexes: any[];
    size: number;
    list: any;

    constructor(list?) {
        this.clear(list);
        this.flat = [];//new Array(32768);
        this.free_indexes = [];
    }

    *[Symbol.iterator]() {
        for(let i = 0; i < this.flat.length; i++) {
            const chunk = this.flat[i];
            if(chunk) yield chunk;
        }
    }

    entries(aabb) {
        const that = this;
        return (function* () {
            if(that.size == 0) {
                return;
            }
            const vec = new Vector(0, 0, 0);
            for (let [xk, x] of that.list) {
                if(aabb && (xk < aabb.x_min || xk > aabb.x_max)) continue;
                for (let [yk, y] of x) {
                    if(aabb && (yk < aabb.y_min || yk > aabb.y_max)) continue;
                    for (let [zk, value] of y) {
                        if(aabb && (zk < aabb.z_min || zk > aabb.z_max)) continue;
                        vec.set(xk|0, yk|0, zk|0);
                        yield [vec, value];
                    }
                }
            }
        })()
    }

    clear(list?) {
        this.list = list ? list : new Map();
        this.size = 0;
        this.free_indexes = [];
        this.flat = [];
    }

    set(vec, chunk) {
        return this.add(vec, chunk);
    }

    add(vec, chunk) {

        this.delete(vec);

        // work with flat
        const index = (this.free_indexes.length > 0) ? this.free_indexes.pop() : this.flat.length;
        this.flat[index] = chunk;
        if(index == undefined) debugger;
        chunk._flat_index = index;

        //
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            if (typeof chunk === 'function') {
                chunk = chunk(vec);
            }
            this.list.get(vec.x).get(vec.y).set(vec.z, chunk);
            this.size++;
        }
        return this.list.get(vec.x).get(vec.y).get(vec.z);
    }

    delete(vec) {
        const chunk_map = this.list?.get(vec.x)?.get(vec.y);
        const chunk = chunk_map?.get(vec.z);
        if(chunk) {
            // work with flat
            this.flat[chunk._flat_index] = null;
            if(chunk._flat_index === undefined) {
                debugger
            }
            this.free_indexes.push(chunk._flat_index);
            //
            chunk_map.delete(vec.z)
            this.size--;
            return true;
        }
        return false;
    }

    has(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
    }

    /**
     * @param {Vector} vec
     */
    get(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
    }

    values() {
        const that = this;
        return (function* () {
            for (let x of that.list.values()) {
                for (let y of x.values()) {
                    for (let value of y.values()) {
                        yield value;
                    }
                }
            }
        })()
    }

}

// VectorCollector...
export class VectorCollector<T = any> {
    size: int;
    list: Map<int, Map<int, Map<int, T>>>;

    /**
     */
    constructor(list?: any, blocks_size: int | null = null) {
        this.clear(list);
        if(list && (blocks_size !== null)) {
            this.size = blocks_size
        }
    }

    *[Symbol.iterator](): IterableIterator<T> {
        for (let x of this.list.values()) {
            for (let y of x.values()) {
                for (let value of y.values()) {
                    yield value;
                }
            }
        }
    }

    /**
     * All values are split into {@link groupsCount} in an undetermined, but consistent way.
     * Goupd are numbered from 0 to {@link groupsCount} - 1.
     * It method iterates over values from group {@link groupIndex}
     */
    *subsetOfValues(groupIndex: int, groupsCount: int): IterableIterator<T> {
        for (let [x, byX] of this.list) {
            if (((x % groupsCount) + groupsCount) % groupsCount === groupIndex) {
                for (let byY of byX.values()) {
                    yield *byY.values()
                }
            }
        }
    }

    entries(aabb?: AABB): IterableIterator<[Vector, T]> {
        const that = this;
        return (function* () {
            if(that.size == 0) {
                return;
            }
            const vec = new Vector(0, 0, 0);
            for (let [xk, x] of that.list) {
                if(aabb && (xk < aabb.x_min || xk > aabb.x_max)) continue;
                for (let [yk, y] of x) {
                    if(aabb && (yk < aabb.y_min || yk > aabb.y_max)) continue;
                    for (let [zk, value] of y) {
                        if(aabb && (zk < aabb.z_min || zk > aabb.z_max)) continue;
                        vec.set(xk|0, yk|0, zk|0);
                        yield [vec, value];
                    }
                }
            }
        })()
    }

    clear(list : any = null) {
        this.list = list ? list : new Map();
        this.size = 0;
    }

    set(vec: IVector, value: T) : boolean {
        let size = this.size;
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            this.size++;
        }
        if (typeof value === 'function') {
            value = value(vec);
        }
        this.list.get(vec.x).get(vec.y).set(vec.z, value);
        return this.size > size;
    }

    add(vec : IVector, value: T): T {
        if(!this.list.has(vec.x)) this.list.set(vec.x, new Map());
        if(!this.list.get(vec.x).has(vec.y)) this.list.get(vec.x).set(vec.y, new Map());
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) {
            if (typeof value === 'function') {
                value = value(vec);
            }
            this.list.get(vec.x).get(vec.y).set(vec.z, value);
            this.size++;
        }
        return this.list.get(vec.x).get(vec.y).get(vec.z);
    }

    // If the element exists, returns it. Otherwise sets it to the result of createFn().
    getOrSet(vec : IVector, createFn : (vec: IVector) => T): T {
        let byY = this.list.get(vec.x);
        if (byY == null) {
            byY = new Map();
            this.list.set(vec.x, byY);
        }
        let byZ = byY.get(vec.y);
        if (byZ == null) {
            byZ = new Map();
            byY.set(vec.y, byZ);
        }
        let v = byZ.get(vec.z);
        if (v == null && !byZ.has(vec.z)) {
            v = createFn(vec);
            byZ.set(vec.z, v);
            this.size++;
        }
        return v;
    }

    /**
     * Updates a value (existing or non-existng), possibly setting it or deleting it.
     * It's faster than getting and then setting a value.
     * @param {Vector} vec
     * @param {Function} mapFn is called for the existing value (or undefined, if there is no value).
     *   If its result is not null, it's set as the new value.
     *   If its result is null, the value is deleted.
     * @return the new value.
     */
    update(vec : IVector, mapFn : (old?: T) => T | null): T | null {
        let byY = this.list.get(vec.x);
        if (byY == null) {
            byY = new Map();
            this.list.set(vec.x, byY);
        }
        let byZ = byY.get(vec.y);
        if (byZ == null) {
            byZ = new Map();
            byY.set(vec.y, byZ);
        }
        const oldV = byZ.get(vec.z);
        const newV = mapFn(oldV);
        if (newV != null) {
            if (newV !== oldV) {
                if (oldV === undefined && !byZ.has(vec.z)) { // fast check, then slow
                    this.size++;
                }
                byZ.set(vec.z, newV);
            }
        } else {
            if (byZ.delete(vec.z)) {
                this.size--;
            }
        }
        return newV;
    }

    delete(vec : IVector) : boolean {
        let resp = false
        const x = this.list?.get(vec.x)
        if(x) {
            const y = x.get(vec.y)
            if(y) {
                const z = y.get(vec.z)
                if(z) {
                    y.delete(vec.z)
                    resp = true
                    this.size--
                    if(y.size == 0) {
                        x.delete(vec.y)
                        if(x.size == 0) {
                            this.list.delete(vec.x)
                        }
                    }
                }
            }
        }
        return resp
    }

    has(vec : IVector) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
    }

    get(vec: IVector): T | null {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
    }

    keys(): IterableIterator<Vector> {
        const that = this;
        return (function* () {
            if(that.size == 0) {
                return;
            }
            for (let [xk, x] of that.list) {
                for (let [yk, y] of x) {
                    for (let zk of y.keys()) {
                        yield new Vector(xk|0, yk|0, zk|0)
                    }
                }
            }
        })()
    }

    values(): IterableIterator<T> {
        const that = this;
        return (function* () {
            for (let x of that.list.values()) {
                for (let y of x.values()) {
                    for (let value of y.values()) {
                        yield value;
                    }
                }
            }
        })()
    }

    reduce(max_size) {
        if(this.size < max_size) {
            return false;
        }
    }

}

/** Similar to {@link VectorCollector}, but for 2D coordinates. */
export class VectorCollector2D {

    byRow: Map<int, any>

    constructor() {
        this.byRow  = new Map()
    }

    isEmpty()  { return this.byRow.size === 0 }

    /**
     * It's relatively slow. Use {@link isEmpty} if possible.
     * We don't maintain size filed, because it's rarely needed, but makes modifications slower.
     */
    getSize() {
        let size = 0
        for(const byCol of this.byRow.values()) {
            size += byCol.size
        }
        return size
    }

    set(row, col, value) {
        let byCol = this.byRow.get(row)
        if (!byCol) {
            byCol = new Map()
            this.byRow.set(row, byCol)
        }
        byCol.set(col, value)
    }

    get(row, col) {
        return this.byRow.get(row)?.get(col)
    }

    delete(row, col) {
        let byCol = this.byRow.get(row)
        if (byCol) {
            byCol.delete(col)
            if (byCol.size === 0) {
                this.byRow.delete(row)
            }
        }
    }

    /**
     * Updates a value (existing or non-existng), possibly setting it or deleting it.
     * It's faster than getting and then setting a value.
     * @param {int} row
     * @param {int} col
     * @param {Function} mapFn is called for the existing value (or undefined, if there is no value).
     *   If its result is not null, it's set as the new value.
     *   If its result is null, the value is deleted.
     * @return the new value.
     */
    update(row, col, mapFn) {
        let byCol = this.byRow.get(row)
        const oldV = byCol?.get(col)
        const newV = mapFn(oldV)
        if (newV != null) {
            if (newV !== oldV) {
                if (!byCol) {
                    byCol = new Map()
                    this.byRow.set(row, byCol)
                }
                byCol.set(col, newV)
            }
        } else {
            if (byCol) {
                byCol.delete(col)
                if (byCol.size === 0) {
                    this.byRow.delete(row)
                }
            }
        }
        return newV
    }

    *values() {
        for (const byCol of this.byRow.values()) {
            yield *byCol.values()
        }
    }

    *keys() {
        const entry = [0, 0]
        for (const [row, byCol] of this.byRow) {
            entry[0] = row
            for (const col of byCol.keys()) {
                entry[1] = col
                yield entry
            }
        }
    }

    *entries() {
        const entry = [0, 0, null]
        for (const [row, byCol] of this.byRow) {
            entry[0] = row
            for (const [col, value] of byCol) {
                entry[1] = col
                entry[2] = value
                yield entry
            }
        }
    }

    /**
     * Sets min (inclusive) and max (exclusive) values of coordintes to fields of {@link dst}
     * object. The field names are derived from {@link prefixRow}, {@link prefixRow} and suffixes '_min' and '_max'.
     */
    calcBounds(prefixRow = 'row', prefixCol = 'col', dst = {}) {
        let minCol = Infinity
        let maxCol = -Infinity
        let minRow = Infinity
        let maxRow = -Infinity
        for (const [row, byCol] of this.byRow) {
            if (minRow > row) minRow = row
            if (maxRow < row) maxRow = row
            for (const col of byCol.keys()) {
                if (minCol > col) minCol = col
                if (maxCol < col) maxCol = col
            }
        }
        dst[prefixRow + '_min'] = minRow
        dst[prefixRow + '_max'] = maxRow + 1
        dst[prefixCol + '_min'] = minCol
        dst[prefixCol + '_max'] = maxCol + 1
        return dst
    }

    toMatrix(pad = 0, emptyValue = null, arrayClass = Array) {
        if (this.isEmpty()) {
            return null
        }
        const aabb = this.calcBounds() as any
        const mat = ShiftedMatrix.createMinMaxPad(aabb.row_min, aabb.col_min,
            aabb.row_max, aabb.col_max, pad, arrayClass)
        if (emptyValue !== null) {
            mat.fill(emptyValue)
        }
        for(const [row, col, value] of this.entries()) {
            mat.set(row, col, value)
        }
        return mat
    }
}

// Color
export class Color {
    [key: string]: any;
    r: number;
    g: number;
    b: number;
    a: number;

    static componentToHex(c: number) : string {
        const hex : string = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    static hexToColor(hex_color: string) : Color {
        let c : string[];
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex_color)) {
            c = hex_color.substring(1).split('');
            if(c.length == 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            const i : number = parseInt('0x' + c.join(''));
            return new Color((i>>16)&255, (i>>8)&255, i&255, 255); // 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',1)';
        }
        throw new Error('Bad Hex');
    }

    constructor(r: number, g: number, b: number, a: number = 0) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    add(color: Color) : Color {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        this.a += color.a;
        return this;
    }

    divide(color: Color) : Color {
        this.r /= color.r;
        this.g /= color.g;
        this.b /= color.b;
        this.a /= color.a;
        return this;
    }

    set(r: number | Color, g: number, b: number, a: number) : Color {
        if(r instanceof Color) {
            g = r.g;
            b = r.b;
            a = r.a;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        return this;
    }

    copyFrom(color: Color) : Color {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.a = color.a;
        return this
    }

    /**
     * @return {Color}
     */
    toFloat(): Color  {
        return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    /**
     * @return {string}
     */
    toCSS()  {
        return 'rgb(' + [this.r, this.g, this.b, this.a].join(',') + ')';
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    /**
     * @param {boolean} remove_alpha
     * @returns {string}
     */
    toHex(remove_alpha = false) {
        let resp = "#" + Color.componentToHex(this.r) +
            Color.componentToHex(this.g) +
            Color.componentToHex(this.b)
        if(!remove_alpha) {
            resp += Color.componentToHex(this.a)
        }
        return resp
    }

    toArray() {
        return [this.r, this.g, this.b, this.a];
    }

    equals(color) {
        return this.r === color.r && this.g === color.g && this.b === color.b && this.a === color.a;
    }

}

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

    static SHAPE_PIVOT = new Vector(.5, .5, .5);

    // Ading these values sequentially to the same Vector is the same as setting it to each of SIX_DIRECTIONS
    static SIX_DIRECTIONS_CUMULATIVE = [this.XN];
    static {
        for(var i = 1; i < 6; ++i) {
            this.SIX_DIRECTIONS_CUMULATIVE.push(
                this.SIX_DIRECTIONS[i].sub(this.SIX_DIRECTIONS[i - 1]));
        }
    }

    static ZERO_AND_SIX_DIRECTIONS = [this.ZERO].concat(this.SIX_DIRECTIONS);
    static ZERO_AND_SIX_DIRECTIONS_CUMULATIVE = [this.ZERO].concat(this.SIX_DIRECTIONS_CUMULATIVE);

    static toChunkAddr(in_vec: IVector, out_vec?: Vector) : Vector {
        out_vec = out_vec || new Vector()
        return getChunkAddr(in_vec.x, in_vec.y, in_vec.z, out_vec)
    }

    static getChunkCenterByAddr(in_vec: IVector, out_vec?: Vector) : Vector {
        out_vec = out_vec || new Vector();
        out_vec.x = (in_vec.x * CHUNK_SIZE_X) + (CHUNK_SIZE_X >> 1);
        out_vec.y = (in_vec.y * CHUNK_SIZE_Y) + (CHUNK_SIZE_Y >> 1);
        out_vec.z = (in_vec.z * CHUNK_SIZE_Z) + (CHUNK_SIZE_Z >> 1);
        return out_vec;
    }

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
            decimals = Math.pow(10, decimals);
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

    addByCardinalDirectionSelf(vec, dir, mirror_x = false, mirror_z = false) {
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

    //
    moveToSelf(rotate, dist) {
        this.x += dist * Math.cos(rotate.x) * Math.sin(rotate.z - Math.PI);
        this.y += dist * Math.sin(-rotate.x);
        this.z += dist * Math.cos(rotate.x) * Math.cos(rotate.z - Math.PI);
        return this;
    }

    // Return flat index of chunk block
    getFlatIndexInChunk() {
        let x = this.x - Math.floor(this.x / CHUNK_SIZE_X) * CHUNK_SIZE_X;
        let y = this.y - Math.floor(this.y / CHUNK_SIZE_Y) * CHUNK_SIZE_Y;
        let z = this.z - Math.floor(this.z / CHUNK_SIZE_Z) * CHUNK_SIZE_Z;
        return (CHUNK_SIZE_X * CHUNK_SIZE_Z) * y + (z * CHUNK_SIZE_X) + x;
    }

    relativePosToFlatIndexInChunk() {
        return CHUNK_SIZE_X * (CHUNK_SIZE_Z * this.y + this.z) + this.x;
    }

    //
    fromFlatChunkIndex(index) {
        index = parseInt(index);
        this.x = index % CHUNK_SIZE_X;
        this.y = index / (CHUNK_SIZE_X * CHUNK_SIZE_Z) | 0;
        this.z = (index % (CHUNK_SIZE_X * CHUNK_SIZE_Z) - this.x) / CHUNK_SIZE_X;
        return this;
    }

    fromChunkIndex(index) {
        //Not implemented, and its fine, implementation is below
        //TODO: move ALL such method to grid!
        return this;
    }

    worldPosToChunkIndex() {
        const x = this.x - Math.floor(this.x / CHUNK_SIZE_X) * CHUNK_SIZE_X;
        const y = this.y - Math.floor(this.y / CHUNK_SIZE_Y) * CHUNK_SIZE_Y;
        const z = this.z - Math.floor(this.z / CHUNK_SIZE_Z) * CHUNK_SIZE_Z;
        return CHUNK_CX * x + CHUNK_CY * y + CHUNK_CZ * z + CHUNK_CW;
    }

    static relativePosToChunkIndex(x, y, z) {
        return CHUNK_CX * x + CHUNK_CY * y + CHUNK_CZ * z + CHUNK_CW;
    }

    relativePosToChunkIndex() {
        return CHUNK_CX * this.x + CHUNK_CY * this.y + CHUNK_CZ * this.z + CHUNK_CW;
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

if (CHUNK_CX === 1) {
    /*
    CHUNK_CY = CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z
    CHUNK_CZ = CHUNK_OUTER_SIZE_X
    */
    Vector.prototype.fromChunkIndex = function(index: number): Vector {
        this.x = index % CHUNK_OUTER_SIZE_X - CHUNK_PADDING;
        index  = index / CHUNK_OUTER_SIZE_X | 0;
        this.z = index % CHUNK_OUTER_SIZE_Z - CHUNK_PADDING;
        this.y = (index / CHUNK_OUTER_SIZE_Z | 0) - CHUNK_PADDING;
        return this;
    }

    Vector.yFromChunkIndex = function(index: number): number {
        return (index / (CHUNK_OUTER_SIZE_X * CHUNK_OUTER_SIZE_Z) | 0) - CHUNK_PADDING
    }
} else if (CHUNK_CY === 1) {
    /*
    CHUNK_CZ = CHUNK_OUTER_SIZE_Y
    CHUNK_CX = CHUNK_OUTER_SIZE_Y * CHUNK_OUTER_SIZE_Z
    */
    Vector.prototype.fromChunkIndex = function(index: number): Vector {
        index = index | 0
        const dividedByY = index / CHUNK_OUTER_SIZE_Y | 0
        this.y = index - (dividedByY * CHUNK_OUTER_SIZE_Y) - CHUNK_PADDING
        const dividedYZ = dividedByY / CHUNK_OUTER_SIZE_Z | 0
        this.z = dividedByY - (dividedYZ * CHUNK_OUTER_SIZE_Z) - CHUNK_PADDING
        this.x = dividedYZ - CHUNK_PADDING
        return this
    }

    Vector.yFromChunkIndex = function(index: number): number {
        return (index % CHUNK_OUTER_SIZE_Y) - CHUNK_PADDING
    }
}

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

export class IndexedColor implements IColor {
    [key: string]: any;

    static WHITE = new IndexedColor(48, 528, 0);
    static GRASS = new IndexedColor(132, 485, 0);
    static WATER = new IndexedColor(132, 194, 0);

    r: number;
    g: number;
    b: number;
    packed: number;

    // static WHITE = null;
    // static GRASS = null;
    // static WATER = null;

    static packLm(lm) {
        return IndexedColor.packArg(lm.r, lm.g, lm.b);
    }

    static packArg(palU, palV, palMode) {
        palU = Math.round(palU);
        palV = Math.round(palV);
        return (palMode << 20) | (palV << 10) | (palU << 0);
    }

    constructor(r : int = 0, g : int = 0, b : int = 0) {
        this.r = r | 0;
        this.g = g | 0;
        this.b = b | 0;
        this.packed = IndexedColor.packArg(this.r, this.g, this.b);
    }

    set(r, g, b) {
        if(r instanceof IndexedColor) {
            g = r.g;
            b = r.b;
            r = r.r;
        }
        this.r = r;
        this.g = g;
        this.b = b;
        return this;
    }

    /**
     * only for terrain_map divide
     * @param color
     */
    divide(color : IColor) {
        this.r /= color.r;
        this.g /= color.g;
        return this;
    }

    clone() : IndexedColor {
        return new IndexedColor(this.r, this.g, this.b);
    }

    /**
     * @param {IndexedColor} ic
     */
    copyFrom(ic : IColor) {
        this.r = ic.r;
        this.g = ic.g;
        this.b = ic.b;
        return this;
    }

    flooredSelf() : IndexedColor {
        this.r = Math.floor(this.r);
        this.g = Math.floor(this.g);
        this.b = Math.floor(this.b);
        return this;
    }

    pack() {
        return this.packed = IndexedColor.packArg(this.r, this.g, this.b);
    }

}

// calc rotate
export function mat4ToRotate(matrix) : Vector {
    const out = new Vector(0, 0, 0)
    const _quat = quat.create();
    mat4.getRotation(_quat, matrix);
    getEuler(out, _quat)
    out.swapXZSelf().divScalarSelf(180).multiplyScalarSelf(Math.PI)
    return out
}

export async function blobToImage(blob) {

    if (blob == null) {
        throw 'error_empty_blob'
    }

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob)
        let img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.onerror = (e) => {
            URL.revokeObjectURL(url)
            reject(e)
        }
        img.src = url
    })

    /*
    const file = new File([blob], 'image.png', {type: 'image/png'})
    const url = URL.createObjectURL(file)
    return new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            // resolve(img)
            resolve(img)
        }
        img.src = url
    });
    */

}

/**
 * @param {Image,Canvas} image
 * @param {int} x
 * @param {int} y
 * @param {int} width
 * @param {int} height
 * @param {int} dest_width
 */
export async function cropToImage(image, x, y, width, height, dest_width, dest_height) {

    if(!dest_width) {
        dest_width = width
        dest_height = height
    }

    if(!dest_height) {
        dest_height = dest_width
    }

    // TODO: need to cache atlas sprites

    const item_image = document.createElement('canvas')
    item_image.width = dest_width
    item_image.height = dest_height
    const item_ctx = item_image.getContext('2d')

    item_ctx.drawImage(image, x, y, width, height, 0, 0, dest_width, dest_height)

    return new Promise((resolve, _) => {
        item_image.toBlob((blob) => {
            resolve(blobToImage(blob))
        })
    })

}

export function sizeOf(value) {
    const typeSizes = {
        "undefined": () => 0,
        "boolean": () => 4,
        "number": () => 8,
        "string": item => 2 * item.length,
        "object": item => !item ? 0 : (
            ('byteLength' in item) ? item.byteLength :
            (Object.keys(item).reduce((total, key) => sizeOf(key) + sizeOf(item[key]) + total, 0))
        )
    };
    return typeSizes[typeof value](value)
}

export function deepAssign(options) {
    return function deepAssignWithOptions (target, ...sources) {
        sources.forEach( (source) => {

            if (!isDeepObject(source) || !isDeepObject(target))
                return;

            // Copy source's own properties into target's own properties
            function copyProperty(property) {
                const descriptor = Object.getOwnPropertyDescriptor(source, property);
                // default: omit non-enumerable properties
                if (descriptor !== undefined && descriptor.enumerable || options.nonEnum) {
                    // Copy in-depth first
                    if (isDeepObject(source[property]) && isDeepObject(target[property]))
                        descriptor.value = deepAssign(options)(target[property], source[property]);
                    //default: omit descriptors
                    if (options.descriptors)
                        Object.defineProperty(target, property, descriptor); // shallow copy descriptor
                    else
                        target[property] = descriptor.value; // shallow copy value only
                }
            }

            // Copy string-keyed properties
            Object.getOwnPropertyNames(source).forEach(copyProperty);

            //default: omit symbol-keyed properties
            if (options.symbols)
                Object.getOwnPropertySymbols(source).forEach(copyProperty);

            //default: omit prototype's own properties
            if (options.proto)
                // Copy souce prototype's own properties into target prototype's own properties
                deepAssign(Object.assign({},options,{proto:false})) (// Prevent deeper copy of the prototype chain
                    Object.getPrototypeOf(target),
                    Object.getPrototypeOf(source)
                );

        });
        return target;
    }
}

// digestMessage
export async function digestMessage(message) {
    const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);           // hash the message
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

//
export function isMobileBrowser() {
    return 'ontouchstart' in document.documentElement;
}

//
export function isScalar(v : any) : boolean {
    return !(typeof v === 'object' && v !== null);
}

export class Helpers {
    [key: string]: any;

    static cache = new Map();
    static fetch : Function;
    static fs;
    static fetchJSON: (url: any, useCache?: boolean, namespace?: string) => Promise<any>;
    static fetchBinary: (url: any) => Promise<ArrayBuffer>;

    static setCache(cache) {
        Helpers.cache = cache;
    }

    static getCache() : Map<any, any> {
        return Helpers.cache;
    }

    //
    angleTo(pos, target) {
        let angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    // clamp
    static clamp(x : number, min : number, max : number) : number {
        if(!min) {
            min = 0;
        }
        if(!max) {
            max = 1;
        }
        if(x < min) return min;
        if(x > max) return max;
        return x;
    }

    // str byteToHex(uint8 byte)
    // converts a single byte to a hex string
    static byteToHex(byte : byte) : string {
        return ('0' + byte.toString(16)).slice(-2);
    }

    // str generateId(int len);
    // len - must be an even number (default: 32)
    static generateID() {
        const len = 32;
        let arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, Helpers.byteToHex).join('');
    }

    static distance(p : IVector, q : IVector) : float {
        let dx   = p.x - q.x;
        let dy   = p.y - q.y;
        let dz   = p.z - q.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist;
    }

    // getRandomInt возвращает случайное целое число в диапазоне от min до max (min <= N <= max)
    static getRandomInt(min : number, max : number) : float {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static createSkinLayer2(text : string, image : HTMLImageElement, callback: Function) {
        const canvas          = document.createElement('canvas');
        canvas.width        = 64;
        canvas.height       = 64;
        const ctx             = canvas.getContext('2d');
        if(!ctx) {
            throw 'error_empty_drawing_context'
        }
        if(text) {
            ctx.fillStyle       = '#f5f5f5';
            ctx.fillRect(0, 0, 200, 200);
            ctx.font            = 'bold 20px Arial';
            ctx.fillStyle       = '#333333';
            ctx.textAlign       = 'start';
            ctx.textBaseline    = 'top';
            ctx.fillText(text, 10, 10);
        } else {
            // img, sx, sy, swidth, sheight, x, y, width, height
            // head
            ctx.drawImage(image, 32, 0, 32, 16, 0, 0, 32, 16);
            // body + right leg + right arm
            ctx.drawImage(image, 0, 32, 56, 16, 0, 16, 56, 16);
            // left leg
            ctx.drawImage(image, 0, 48, 16, 16, 16, 48, 16, 16);
            // left arm
            ctx.drawImage(image, 0, 48, 48, 16, 32, 48, 16, 16);
        }
        // Debug
        // var link = document.createElement('a');
        // link.download = 'filename.png';
        // link.href = canvas.toDataURL()
        // link.click();
        canvas.toBlob(function(blob) {
            let filefromblob = new File([blob], 'image.png', {type: 'image/png'});
            callback(filefromblob);
        }, 'image/png');
    }

    // Canvas download
    static downloadBlobPNG(blob : Blob, filename : string) {
        /// create an "off-screen" anchor tag
        let lnk : HTMLAnchorElement = document.createElement('a'), event;
        /// the key here is to set the download attribute of the a tag
        lnk.download = filename;
        /// convert canvas content to data-uri for link. When download
        /// attribute is set the content pointed to by link will be
        /// pushed as "download" in HTML5 capable browsers
        lnk.href = URL.createObjectURL(blob);
        /// create a "fake" click-event to trigger the download
        if (document.createEvent) {
            event = document.createEvent('MouseEvents');
            event.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false,
            false, 0, null);
            lnk.dispatchEvent(event);
        } else {
            (lnk as any).fireEvent?.('onclick');
        }
    }

    // downloadImage
    static downloadImage(image : HTMLImageElement, filename : string) {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        if(!ctx) {
            throw 'error_empty_ctx'
        }
        ctx.canvas.width  = image.width;
        ctx.canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        c.toBlob(function(blob) {
            // here the image is a blob
            Helpers.downloadBlobPNG(blob, filename);
        }, 'image/png');
    }

    static deg2rad(degrees : float) : float {
        return degrees * (Math.PI / 180);
    }

    static rad2deg(radians : float) : float {
        return radians * 180 / Math.PI;
    }

    static async loadJSON(url : string, callback : Function) {
        loadText(url, function(text) {
            callback(JSON.parse(text));
        });
    }

    // createGLProgram...
    static createGLProgram(gl, obj, callback?) {
        let program = gl.createProgram();
        // Compile vertex shader
        let vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, obj.vertex);
        gl.compileShader(vertexShader);
        gl.attachShader(program, vertexShader);
        gl.deleteShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw "Could not compile vertex shader!\n" + gl.getShaderInfoLog(vertexShader);
        }
        // Compile fragment shader
        let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, obj.fragment);
        gl.compileShader(fragmentShader);
        gl.attachShader(program, fragmentShader);
        gl.deleteShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw "Could not compile fragment shader!\n" + gl.getShaderInfoLog(fragmentShader);
        }
        // Finish program
        gl.linkProgram(program);
        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'Could not link the shader program!';
        }

        callback && callback({
            program
        });

        return program;
    }

    // Return from green to red color depend on percentage
    static getColorForPercentage(pct : float) : Color {
        var percentColors = [
            {pct: 0.0, color: {r: 0xff, g: 0x00, b: 0}},
            {pct: 0.5, color: {r: 0xff, g: 0xff, b: 0}},
            {pct: 1.0, color: {r: 0x00, g: 0xff, b: 0}}
        ];
        for (var i = 1; i < percentColors.length - 1; i++) {
            if (pct < percentColors[i].pct) {
                break;
            }
        }
        var lower = percentColors[i - 1];
        var upper = percentColors[i];
        var range = upper.pct - lower.pct;
        var rangePct = (pct - lower.pct) / range;
        var pctLower = 1 - rangePct;
        var pctUpper = rangePct;
        var color = {
            r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
            g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
            b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
        };
        return new Color(color.r, color.g, color.b, 1);
        // or output as hex if preferred
    }

    // Return speed
    static calcSpeed(pos1 : Vector, pos2 : IVector, delta : float) : float {
        return Math.round(pos1.distance(pos2) / delta * 360) / 100;
    }

}

// Make fetch functions
if(typeof fetch === 'undefined') {
    // Hello eval ;)
    const code = `Helpers.fetch = (url) => import(url);
    Helpers.fetchJSON = (url) => import(url, {assert: {type: 'json'}}).then(response => response.default);
    Helpers.fetchBinary = async (url) => {
        let binary = fs.readFileSync(url);
        return binary.buffer;
    };`;
    var obj = Helpers;
    var func = new Function("Helpers", "window", "'use strict';" + code);
    func.call(obj, obj, obj);
} else {
    Helpers.fetch = async (url) => fetch(url);
    Helpers.fetchJSON = async (url, useCache = false, namespace = '') => {
        const cacheKey = namespace + '|' + url;

        if (useCache && Helpers.cache.has(cacheKey)) {
            return Promise.resolve(JSON.parse(Helpers.cache.get(cacheKey)));
        }

        const respt = await fetch(url);

        // if cache is presented - store text response
        // then we can use this inside a worker
        if (useCache) {
            const text = await respt.text();

            Helpers.cache.set(cacheKey, text);

            return JSON.parse(text);
        }

        return respt.json()
    };

    Helpers.fetchBinary = async (url) => fetch(url).then(response => response.arrayBuffer());
}

export class StringHelpers {
    [key: string]: any;

    // Like String.split, but splits only on the 1st separator, i.e. maximum in 2 parts.
    static splitFirst(str, separatpr) {
        const ind = str.indexOf(separatpr);
        return ind >= 0
            ? [str.substring(0, ind), str.substring(ind + 1, str.length)]
            : [str];
    }

    // The same hash as used in Java: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    static hash(str : string) : number {
        var hash = 0, i : int, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr | 0;
        }
        return hash;
    }

    // indexTrim
    static trim(str : string, ch : string) : string {
        var start = 0,
            end = str.length;
        while(start < end && str[start] === ch)
            ++start;
        while(end > start && str[end - 1] === ch)
            --end;
        return (start > 0 || end < str.length) ? str.substring(start, end) : str;
    }

    // converts to Roman number, from https://stackoverflow.com/questions/9083037/convert-a-number-into-a-roman-numeral-in-javascript
    static romanize(num : number) {
        let lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i;
        for (i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman;
    }

    static replaceCharAt(str : string, index : int, replacement : string) : string {
        return str.charAt(index) !== replacement
            ? str.substring(0, index) + replacement + str.substring(index + replacement.length)
            : str;
    }

    static count(str : string, subStr : string) {
        let res = 0;
        let ind = str.indexOf(subStr);
        while (ind >= 0) {
            res++;
            ind = str.indexOf(subStr, ind + 1);
        }
        return res;
    }

    static capitalizeChatAt(str : string, index : int) : string {
        return this.replaceCharAt(str, index, str.charAt(index).toUpperCase());
    }

    static capitalizeFirstLetterOfEachWord(str) {
        const re = /\W\w/g;
        let res = str; // because we need an immutable string
        let match;
        while (match = re.exec(str)) {
            res = this.capitalizeChatAt(res, match.index + 1);
        }
        return this.capitalizeChatAt(res, 0);
    }
}

export class ArrayHelpers {

    static EMPTY = []

    // elements order is not preserved
    static fastDelete(arr: any[], index: number): void {
        arr[index] = arr[arr.length - 1];
        --arr.length;
    }

    // elements order is not preserved
    static fastDeleteValue(arr: any[], value: any): void {
        var i = 0;
        var len = arr.length;
        while (i < len) {
            if (arr[i] == value) {
                arr[i] = arr[--len];
            } else {
                i++;
            }
        }
        arr.length = len;
    }

    static filterSelf(arr : any[], predicate: Function): void {
        // fast skip elements that don't change
        var src = 0;
        while (src < arr.length && predicate(arr[src])) {
            src++;
        }
        if (src === arr.length) {
            return;
        }
        // move elements
        var dst = src;
        src++;
        while (src < arr.length) {
            if (predicate(arr[src])) {
                arr[dst++] = arr[src];
            }
            ++src;
        }
        arr.length = dst;
    }

    static sum(arr : any[], mapper = (it: any): number => it): number {
        var sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += mapper(arr[i]);
        }
        return sum;
    }

    static max(arr : any[], initial: number = -Infinity, mapper = (it: any): number => it): number {
        let max = initial
        for (let i = 0; i < arr.length; i++) {
            const v = mapper(arr[i])
            if (max < v) {
                max = v
            }
        }
        return max
    }

    /**
     * Creates an array of at least the required length, or increases the length of the existing array.
     * @returns {AnyArray} the given array, or a new one.
     */
    static ensureCapacity(arr: AnyArray | null, length: number, arrayClass?: any): any {
        if (arr) {
            arrayClass ??= arr.constructor
            if (arrayClass !== arr.constructor) {
                throw new Error()
            }
            if (arrayClass === Array) {
                arr[length - 1] = null  // cause the array to grow
            } else { // a typed array
                if (arr.length < length) {
                    arr = new arrayClass(Mth.roundUpToPowerOfTwo(length))
                }
            }
        } else {
            arr = new arrayClass(length)
        }
        return arr
    }

    /**
     * Ensures that the first sortedLength elements are the same as if the entire array
     * was sorted. The order of the remaining elemnets is undefin.
     * It has O(length) time.
     * @param { int } sortedLength - the number of first array elements that will be sorted.
     */
    static partialSort(arr: any[], sortedLength = arr.length, compare: Function,
        // do not pass the last 2 arguments - they are internal
        fromIncl = 0, toExcl = arr.length
    ): void {
        while (true) {
            var d = toExcl - fromIncl;
            if (d <= 2) {
                if (d == 2) {
                    var v = arr[fromIncl + 1];
                    if (compare(arr[fromIncl], v) > 0) {
                        arr[fromIncl + 1] = arr[fromIncl];
                        arr[fromIncl] = v;
                    }
                }
                return;
            }
            var left = fromIncl;
            var right = toExcl - 1;
            var m = arr[(fromIncl + toExcl) >> 1];
            do {
                var vl = arr[left];
                while (compare(vl, m) < 0) {
                    vl = arr[++left];
                }
                var vr = arr[right];
                while (compare(vr, m) > 0) {
                    vr = arr[--right];
                }
                if (left > right) {
                    break;
                }
                arr[left] = vr;
                arr[right] = vl;
                left++;
                right--;
            } while (left <= right);
            if (left < sortedLength) {
                this.partialSort(arr, sortedLength, compare, left, toExcl);
            }
            toExcl = left;
        }
    }

    static toObject(arr: any[], toKeyFn = (ind : number, _ : any) => ind, toValueFn = (_ : number, value : any) => value): object {
        const res = {};
        if (typeof toValueFn !== 'function') {
            const value = toValueFn;
            toValueFn = () => value;
        }
        for(let i = 0; i < arr.length; i++) {
            const v = arr[i];
            res[toKeyFn(i, v)] = toValueFn(i, v);
        }
        return res;
    }

    static create<T = any>(size: int, fill?: ((index: int) => T) | T): T[] {
        const arr = new Array(size);
        if (typeof fill === 'function') {
            for(let i = 0; i < arr.length; i++) {
                arr[i] = (fill as Function)(i);
            }
        } else if (fill !== null) {
            arr.fill(fill);
        }
        return arr;
    }

    static copyToFrom(dst: any[], src: any[]): void {
        // it might be not the fastest, needs profiling
        dst.length = 0
        dst.push(...src)
    }

    /** Returns the class of Uint primitive arrays that can hold value {@link maxValue} */
    static uintArrayClassForMaxValue(maxValue : number) {
        return maxValue <= 0xff
            ? Uint8Array
            : (maxValue <= 0xffff ? Uint16Array : Uint32Array)
    }

    /**
     * Return random item from array
     * @param {*[]} arr
     * @returns
     */
    static randomItem(arr : any[]) : any {
        if(!Array.isArray(arr) || arr.length == 0) {
            return undefined
        }
        return arr[(Math.random() * arr.length) | 0]
    }

    static shuffle(array : any[], random_func: Function) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(random_func() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

}

// Helper methods to work with an array or a scalar in the same way.
export class ArrayOrScalar {

    // Returns Array or null as is. Non-null scalars are wraped into an array.
    static toArray<T = any>(v: T | T[]): T[] {
        return (v == null || Array.isArray(v)) ? v as T[] : [v];
    }

    static *values<T = any>(v: T | T[]): IterableIterator<T> {
        if (Array.isArray(v)) {
            yield* v
        } else {
            yield v
        }
    }

    static get<T = any>(v: T | T[], index: int): T {
        return Array.isArray(v) ? v[index] : v;
    }

    static find<T = any>(v: T | T[], fn: (v: T) => boolean): T {
        return Array.isArray(v)
            ? v.find(fn)
            : (fn(v) ? v : null)
    }

    /** For aray, the same as {@link Array.map}. For scalar, returns {@link fn} applied to it. */
    static map<T = any, OutT = any>(v: T | T[], fn: (v: T) => OutT): OutT | OutT[] {
        return Array.isArray(v) ? v.map(fn) : fn(v);
    }

    // Sets the length of an Array, but doesn't change a scalar
    static setArrayLength<T = any>(v: T | T[], length: int): T | T[] {
        if (Array.isArray(v)) {
            v.length = length;
        }
        return v;
    }

    /** Similar to {@link map}, but changes the array itself instead of creating a copy. */
    static mapSelf<T = any, OutT = any>(v: T | T[], fn: (v: T) => OutT): OutT | OutT[] {
        if (Array.isArray(v)) {
            for(let i = 0; i < v.length; i++) {
                (v as any[])[i] = fn(v[i]);
            }
            return v as any[];
        } else {
            return fn(v);
        }
    }
}

/**
 * Helper methods for working with an Object, Array or Map in the same way - like a map.
 *
 * There are 2 modes when working with arrays:
 * 1. By default, undefined vallues are used to mark empty elements. All other values can be stored and read.
 * 2. If emptyValue parameter in methods is set to null, then:
 *  - neither undefined, nor null can be put into the collection on purpose.
 *  - both undefined and null are skipped during iteration.
 *  - nulls are used to mark empty array elements.
 * It assumes the user doesn't put undefined or emptyValue into a Map or an Object.
 *
 * It can be optimized at the expense of code size.
 */
export class ArrayOrMap {
    [key: string]: any;

    static get(collection, key) {
        return collection instanceof Map ? collection.get(key) : collection[key];
    }

    static set(collection, key, value) {
        if (value === undefined) {
            throw new Error("value === undefined");
        }
        if (collection instanceof Map) {
            collection.set(key, value);
        } else {
            collection[key] = value;
        }
    }

    static delete(collection, key, emptyValue = undefined) {
        if (collection instanceof Map) {
            collection.delete(key);
        } else if (Array.isArray(collection)) {
            if (collection.length > key) {
                collection[key] = emptyValue;
            }
        } else {
            delete collection[key];
        }
    }

    /** Yields values expet undefined and {@link emptyValue}. */
    static *values(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.values();
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield v;
                }
            }
        }
    }

    static *keys(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.keys();
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield key;
                }
            }
        }
    }

    /** The only difference with {@link keys} is that it retuens Object's keys as numbers. */
    static *numericKeys(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.keys();
        } else {
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    yield parseFloat(key);
                }
            }
        }
    }

    /**
     * Yields [key, value], except those with values undefined and {@link emptyValue}.
     * Note: the same muatble entry is reused.
     */
    static *entries(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.entries();
        } else {
            const entry = [null, null];
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    entry[0] = key;
                    entry[1] = v;
                    yield entry;
                }
            }
        }
    }

    /** The only difference with {@link entries} is that it retuens Object's keys as numbers. */
    static *numericEntries(collection, emptyValue = undefined) {
        if (collection instanceof Map) {
            yield *collection.entries();
        } else {
            const entry = [null, null];
            for(let key in collection) {
                const v = collection[key];
                if (v !== undefined && v !== emptyValue) {
                    entry[0] = parseFloat(key);
                    entry[1] = v;
                    yield entry;
                }
            }
        }
    }
}

export class SpiralEntry {
    [key: string]: any;
    dist: number;
    pos: Vector;
    chunk: any;
    constructor() {
        this.pos = new Vector();
        this.dist = 0;
        this.chunk = null;
    }

    copyTranslate(se, translation) {
        this.pos.copyFrom(se.pos);
        this.pos.addSelf(translation);
        this.dist = se.dist;
        this.chunk = null;
        return this;
    }
}

// SpiralGenerator ...
export class SpiralGenerator {
    [key: string]: any;

    static cache = new Map();
    static cache3D = {};

    // generate ...
    static generate(margin: int) {
        let size : number = margin * 2;
        if(SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];
        function rPush(vec : IVector) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if(dist < margin) {
                resp.push(vec);
            }
        }
        let iInd = Math.trunc(size / 2);
        let jInd = Math.trunc(size / 2);
        let iStep = 1;
        let jStep = 1;
        rPush(new Vector(iInd, 0, jInd));
        for(let i = 0; i < size; i++) {
            for (let h = 0; h < i; h++) rPush(new Vector(iInd, 0, jInd += jStep));
            for (let v = 0; v < i; v++) rPush(new Vector(iInd += iStep, 0, jInd));
            jStep = -jStep;
            iStep = -iStep;
        }
        for(let h = 0; h < size - 1; h++) {
            rPush(new Vector(iInd, 0, jInd += jStep));
        }
        SpiralGenerator.cache.set(margin, resp);
        return resp;
    }

    /**
     * generate3D
     * @param {Vector} vec_margin
     * @returns
     */
    static generate3D(vec_margin : IVector) : SpiralEntry[] {
        const cache_key = vec_margin.toString();
        if(SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        const resp : SpiralEntry[] = [];
        const center = new Vector(0, 0, 0);
        const exists : string[] = [];
        const MAX_DIST  = vec_margin.x;
        for(let y = -vec_margin.y; y <= vec_margin.y; y++) {
            for(let x = -vec_margin.x; x <= vec_margin.x; x++) {
                for(let z = -vec_margin.z; z <= vec_margin.z; z++) {
                    let vec = new Vector(x, y, z);
                    let dist = Math.round(vec.distance(center) * 1000) / 1000;
                    if(dist <= MAX_DIST) {
                        let key = vec.toString();
                        if(exists.indexOf(key) < 0) {
                            const entry = new SpiralEntry();
                            entry.pos = vec;
                            entry.dist = dist;
                            resp.push(entry);
                            exists.push(key)
                        }
                    }
                }
            }
        }
        resp.sort(function(a : SpiralEntry, b : SpiralEntry) {
            return a.dist - b.dist;
        });
        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
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

// AverageClockTimer
export class AverageClockTimer {
    [key: string]: any;
    sum: number;
    history_index: number;
    history: number[];
    prev: number | null;
    min: number | null;
    max: number | null;
    avg: number | null;

    constructor() {
        this.prev       = null,
        this.min        = null,
        this.max        = null,
        this.avg        = null,
        this.sum        = 0,
        this.history_index = 0;
        this.history    = new Array(60).fill(0);
    }

    /**
     * @param value : float
     */
    add(value: number) {
        this.prev = value;
        if(this.min === null || this.min > value) {
            this.min = value;
        }
        if(this.max === null || this.max < value) {
            this.max = value;
        }
        //
        this.sum += value;
        this.history_index++;
        if(this.history_index == this.history.length) {
            this.history_index = 0;
        }
        this.sum -= this.history[this.history_index];
        this.history[this.history_index] = value;
        this.avg = (this.sum / this.history.length) || 0;
    }

}

// FastRandom...
export class FastRandom {
    [key: string]: any;
    int32s: any[];
    doubles: any[];
    index: number;
    cnt: any;

    /**
     * @param seed : string
     * @param cnt : int
     */
    constructor(seed : string, cnt : int) {
        const a = new alea(seed);
        this.int32s = new Array(cnt);
        this.doubles = new Array(cnt);
        this.index = 0;
        this.cnt = cnt;
        for(let i = 0; i < cnt; i++) {
            this.int32s[i] = a.int32();
            this.doubles[i] = a.double();
        }
    }

    double(offset : number) : float {
        offset = Math.abs(offset) % this.cnt;
        return this.doubles[offset];
    }

    int32(offset : number) : int {
        offset = Math.abs(offset) % this.cnt;
        return this.int32s[offset];
    }

}

export class RuneStrings {
    [key: string]: any;

    static toArray(str : string) {
        return runes(str);
    }

    // Разделяет слово на строки, в которых максимум указанное в [chunk] количество букв (с учётом emoji)
    static toChunks(str : string, chunk : int) : string[] {
        const rs = runes(str);
        if(rs.length > chunk) {
            let i : int, j : int, resp = [];
            for (i = 0, j = rs.length; i < j; i += chunk) {
                resp.push(rs.slice(i, i + chunk).join(''));
            }
            return resp;
        }
        return [str];
    }

    // Разделяет длинные слова пробелами (с учётом emoji)
    static splitLongWords(str : string, max_len : int) {
        let text = str.replaceAll("\r", "¡");
        let temp = text.split(' ');
        for(let i = 0; i < temp.length; i++) {
            let word = temp[i];
            if(word) {
                temp[i] = RuneStrings.toChunks(word, max_len).join(' ');
            }
        }
        return temp.join(' ').replaceAll("¡", "\r");
    }

}

// AlphabetTexture
export class AlphabetTexture {
    [key: string]: any;

    static width            = 1024;
    static height           = 1024;
    static char_size        = {width: 32, height: 32};
    static char_size_norm   = {width: this.char_size.width / this.width, height: this.char_size.height / this.height};
    static chars            = new Map();
    static chars_x: any;

    // init...
    static init() {
        if(this.chars_x) {
            return false;
        }
        this.chars_x = Math.floor(this.width / this.char_size.width);

        // {
        //    "id":9608,
        //    "index":1283,
        //    "char":"█",
        //    "width":25,
        //    "height":46,
        //    "xoffset":-2,
        //    "yoffset":-4,
        //    "xadvance":21,
        //    "chnl":15,
        //    "x":0,
        //    "y":0,
        //    "page":0
        // }
        const uvs = globalThis.alphabet.msdf;
        const sprite_size = uvs.common.scaleW;
        for(let uv of uvs.chars) {
            const char = uv.char;
            const shift_x = 0; // (uv.originX / uv.height);
            const shift_y = 0; // (uv.height - uv.originY) / uv.height;
            let pos = {
                uv,
                xn: uv.x / sprite_size,
                yn: uv.y / sprite_size,
                width: uv.width / sprite_size,
                height: uv.height / sprite_size,
                shift_x: shift_x,
                shift_y: shift_y,
                char
            };
            this.chars.set(char, pos);
        }

        /*
        const uvs = globalThis.alphabet.sdf;
        const sprite_size = uvs.width;
        for(let char in uvs.characters) {
            const uv = uvs.characters[char] || uvs.characters["�"];
            const shift_x = 0;
            const shift_y = (uv.height - uv.originY) / uv.height;
            let pos = {
                uv,
                xn: uv.x / sprite_size,
                yn: uv.y / sprite_size,
                width: uv.width / sprite_size,
                height: uv.height / sprite_size,
                shift_x: shift_x,
                shift_y: shift_y,
                char
            };
            this.chars.set(char, pos);
        }
        */

    }

    // getStringUVs...
    static getStringUVs(str : string) {
        AlphabetTexture.init();
        const chars = RuneStrings.toArray(str);
        const resp = [];
        const def_char = this.chars.get('�');
        for(let char of chars) {
            const item = this.chars.has(char) ? this.chars.get(char) : def_char;
            if(char == "\r") {
                item.char = char;
            }
            resp.push(item);
        }
        return resp;
    }

}

// maybe move other related methods here
export class ObjectHelpers {

    static isEmpty(obj: object): boolean {
        for (let _ in obj) {
            return false;
        }
        return true;
    }

    // For now, it supports only plain objects, Array, primitives and Vector.
    static deepClone(v: any, depth : number = Infinity): any {
        if (v == null) {
            return v;
        }
        // Splitting this function into 3 increases(!) performance
        // Probably because JIT can infer static types in deepCloneArray() and deepCloneObject()
        if (v.length != null && Array.isArray(v)) {
            return this.deepCloneArray(v, depth);
        }
        if (typeof v === 'object') {
            return this.deepCloneObject(v, depth);
        }
        return v;
    }

    static deepCloneArray(v: Array<any>, depth: number = Infinity): Array<any> {
        if (--depth < 0) {
            return v;
        }
        const res = new Array(v.length);
        for(let i = 0; i < v.length; i++) {
            res[i] = this.deepClone(v[i], depth);
        }
        return res;
    }

    static deepCloneObject(v: object, depth: number = Infinity): object {
        if (--depth < 0) {
            return v;
        }
        if ((<any>v).x != null && v instanceof Vector) {
            return new Vector(v);
        }
        const res = {};
        for(let key in v) {
            // Don't check hasOwnProperty(key) here, because it's not checked anywhere.
            // If something is added to Object.prototype, the entire project is screwed.
            res[key] = this.deepClone(v[key], depth);
        }
        return res;
    }

    /**
     * It deep compares own properties of the objects.
     * It's not perfect (e.g. it doesn't distnguisgh between absence of a property and an undefined value),
     * but it's good enough for real game use cases.
     *
     * Maybe add support for Map, Set, primitive arrays.
     */
    static deepEqual(a: any, b: any): boolean {
        if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
            return a === b;
        }
        return Array.isArray(a)
            ? Array.isArray(b) && this.deepEqualArray(a, b)
            : this.deepEqualObject(a, b);
    }

    static deepEqualArray(a: AnyArray, b: AnyArray): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for(let i = 0; i < a.length; i++) {
            if (!this.deepEqual(a[i], b[i])) {
                return false;
            }
        }
        return true;
    }

    static deepEqualObject(a: object, b: object): boolean {
        for (let key in a) {
            // We could also check b.hasOwnProperty(key) - i.e. it's not in the prototype,
            // but for real game objects it seems unnecesssary.
            if (!this.deepEqual(a[key], b[key])) {
                return false;
            }
        }
        for (let key in b) {
            if (!(key in a)) {
                return false;
            }
        }
        return true;
    }

    // Returns a result similar to JSON.stringify, but the keys are sorted alphabetically.
    static sortedStringify(obj: any) {
        if (obj == null) {
            return 'null'; // for both null and undefined
        }
        if (typeof obj !== 'object') {
            return JSON.stringify(obj);
        }
        if (Array.isArray(obj)) {
            const transformedArr = obj.map(it => this.sortedStringify(it));
            return '[' + transformedArr.join(',') + ']';
        }
        // it's an object
        const keys = Object.keys(obj).sort();
        for(let i = 0; i < keys.length; i++) {
            const key = keys[i];
            // stringify the key to escape quotes in it
            keys[i] = JSON.stringify(key) + ':' + this.sortedStringify(obj[key]);
        }
        return '{' + keys.join(',') + '}';
    }

    static toMultiline(obj: object, pad = 0) : string {
        const result: string[] = []
        const prefix = ' '.repeat(pad)
        for (const key in obj) {
            result.push(prefix + key + ': ' + obj[key])
        }
        return result.join('\n')
    }
}

// A queue backed by an array that wraps around.
// shift() and length are compatible with that of Array.
// push() is not fully compatible with Array: it doesn't support multiple arguments.
export class SimpleQueue {
    [key: string]: any;
    arr: any[];
    left: number;
    length: number;

    constructor() {
        this.arr = [null]; // a single element to prevent division by 0
        this.left = 0;
        this.length = 0; // the number of actually used elements
    }

    push(v) {
        this._grow();
        this.arr[(this.left + this.length) % this.arr.length] = v;
        this.length++;
    }

    unshift(v) {
        this._grow();
        this.left = (this.left + this.arr.length - 1) % this.arr.length;
        this.arr[this.left] = v;
        this.length++;
    }

    shift() {
        if (this.length === 0) {
            return;
        }
        const v = this.arr[this.left];
        this.left = (this.left + 1) % this.arr.length;
        this.length--;
        return v;
    }

    get(index) {
        if (index >= 0 && index < this.length) {
            return this.arr[(this.left + index) % this.arr.length];
        }
    }

    _grow() {
        if (this.length === this.arr.length) {
            // grow: copy the beginning into the end; the beginning becomes empty.
            // At least one element is pushed.
            for(var i = 0; i <= this.left; i++) {
                this.arr.push(this.arr[i]);
            }
        }
    }
}

// A matrix that has indices in [minRow..(minRow + rows - 1), minCol..(minCol + cols - 1)]
export class ShiftedMatrix {
    [key: string]: any;
    minRow: any;
    minCol: any;
    rows: any;
    cols: any;
    rowsM1: number;
    colsM1: number;
    arr: any[];

    // For each shift, we compute the distance. Shifts that are multiple of each other are not used.
    // It's used to compute approximate cartesian distances (to achieve more natural, rounded corners).
    static _MAX_SHIFT = 3
    static _SHIFTS_BY_DELTA_ROW = ArrayHelpers.create(2 * ShiftedMatrix._MAX_SHIFT + 1, i => [])
    static { // init shifts
        const shifts = [0,1, 0,-1, 1,0, -1,0, -1,-1, -1,1, 1,-1, 1,1]
        function add(dRow, dCol) {
            const len = Math.sqrt(dRow * dRow + dCol * dCol)
            ShiftedMatrix._SHIFTS_BY_DELTA_ROW[dRow + ShiftedMatrix._MAX_SHIFT].push(dCol, len)
        }
        for(let i = 0; i < shifts.length; i++) {
            add(shifts[i], shifts[++i])
        }
        for(let i = 2; i <= ShiftedMatrix._MAX_SHIFT; i++) {
            for(let j = 1; j < i; j++) {
                for(let si = -1; si <= 1; si += 2 ) {
                    for(let sj = -1; sj <= 1; sj += 2 ) {
                        add(i * si, j * sj)
                        add(j * sj, i * si)
                    }
                }
            }
        }
    }

    constructor(minRow, minCol, rows, cols, arrayClass = Array) {
        this.init(minRow, minCol, rows, cols, new arrayClass(rows * cols))
    }

    init(minRow, minCol, rows, cols, arr = null) {
        this.minRow = minRow
        this.minCol = minCol
        this.rows = rows
        this.cols = cols
        this.rowsM1 = rows - 1
        this.colsM1 = cols - 1
        this.arr = arr ?? ArrayHelpers.ensureCapacity(this.arr, rows * cols)
        return this
    }

    initHorizontalInAABB(aabb) {
        return this.init(aabb.x_min, aabb.z_min, aabb.width, aabb.depth)
    }

    static createHorizontalInAABB(aabb, arrayClass = Array) {
        return new ShiftedMatrix(aabb.x_min, aabb.z_min, aabb.width, aabb.depth, arrayClass)
    }

    static createMinMaxPad(minRow, minCol, maxRow, maxCol, pad = 0, arrayClass = Array) {
        return new ShiftedMatrix(minRow - pad, minCol - pad,
            maxRow - minRow + 2 * pad, maxCol - minCol + 2 * pad, arrayClass)
    }

    // Exclusive, like in AABB
    get maxRow() { return this.minRow + this.rows }
    get maxCol() { return this.minCol + this.cols }
    get size()   { return this.rows * this.cols }

    /** Creates a mtarix with the same size and coordinates as this. */
    createAligned(arrayClass = Array) {
        return new ShiftedMatrix(this.minRow, this.minCol, this.rows, this.cols, arrayClass)
    }

    fill(v) {
        this.arr.fill(v, 0, this.size);
        return this;
    }

    get(row, col) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            throw new Error();
        }
        return this.arr[row * this.cols + col];
    }

    getOrDefault(row, col, def = null) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            return def;
        }
        return this.arr[row * this.cols + col];
    }

    set(row, col, v) {
        row -= this.minRow;
        col -= this.minCol;
        if ((row | col | (this.rowsM1 - row) | (this.colsM1 - col)) < 0) {
            throw new Error();
        }
        this.arr[row * this.cols + col] = v;
        return v;
    }

    has(row, col) {
        row -= this.minRow
        col -= this.minCol
        return (row | col | (this.rowsM1 - row) | (this.colsM1 - col)) >= 0
    }

    hasRow(row) {
        row -= this.minRow
        return (row | (this.rowsM1 - row)) >= 0
    }

    hasCol(col) {
        col -= this.minCol
        return (col | (this.colsM1 - col)) >= 0
    }

    /**
     * Iterates over all elements, or over an area intersectign with the given aabb.
     * @param {?Int} minRow - inclusive
     * @param {?Int} minCol - inclusive
     * @param {?Int} maxRow - exclusive
     * @param {?Int} maxCol - exclusive
     * @yields {Array} [row, col, value]
     */
    *entries(minRow = null, minCol = null, maxRow = null, maxCol = null) {
        if (minCol == null) {
            minRow = this.minRow
            maxRow = this.maxRow
            minCol = this.minCol
            maxCol = this.maxCol
        } else {
            minRow = Math.max(minRow, this.minRow)
            maxRow = Math.min(maxRow, this.maxRow)
            minCol = Math.max(minCol, this.minCol)
            maxCol = Math.min(maxCol, this.maxCol)
        }
        const entry = [0, 0, 0]
        for(let i = minRow; i < maxRow; i++) {
            let ind = (i - this.minRow) * this.cols + (minCol - this.minCol)
            entry[0] = i
            for(let j = minCol; j < maxCol; j++) {
                entry[1] = j
                entry[2] = this.arr[ind]
                yield entry
                ind++
            }
        }
    }

    /**
     * @yields {Array} [row, col, index], where row is from 0 to this.rows - 1, and col is from  0 to this.cols - 1
     */
    *relativeRowColIndices() {
        const entry = [0, 0, 0]
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            let ind = i * cols
            entry[0] = i
            for(let j = 0; j < cols; j++) {
                entry[1] = j
                entry[2] = ind
                yield entry
                ind++
            }
        }
    }

    *rowColIndices() {
        const entry = [0, 0, 0]
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            let ind = i * cols
            entry[0] = i + this.minRow
            for(let j = 0; j < cols; j++) {
                entry[1] = j + this.minCol
                entry[2] = ind
                yield entry
                ind++
            }
        }
    }

    toArrayOfArrays() {
        let res = [];
        for(let i = 0; i < this.rows; i++) {
            const s = [];
            for(let j = 0; j < this.cols; j++) {
                s.push(this.arr[i * this.cols + j]);
            }
            res.push(s);
        }
        return res;
    }

    transformEach(fn) {
        const arr = this.arr
        for(let i = 0; i < arr.length; i++) {
            arr[i] = fn(arr[i])
        }
    }

    /**
     * Casts "rays" parallel to the sides that pass through rejected by {@link isNotEmpty},
     * and fills all the elements that are not "illuminated" by the rays with {@link value}.
     */
    fillInsides(value = 1, isNotEmpty = (it) => it) {
        const arr = this.arr
        const cols = this.cols
        for(let i = 0; i < this.rows; i++) {
            const ind0 = i * cols
            // find the 1st non-empty element in the row
            for(let jb = 0; jb < cols; jb++) {
                const indB = ind0 + jb
                if (isNotEmpty(arr[indB])) {
                    let ind = ind0 + (cols - 1)
                    // find the last non-empty element
                    while(!isNotEmpty(arr[ind])) {
                        ind--
                    }
                    while(ind >= indB) {
                        arr[ind] = value
                        ind--
                    }
                    break
                }
            }
        }
        for(let j = 0; j < this.cols; j++) {
            // find the 1st non-empty element in the column
            for(let ib = 0; ib < this.rows; ib++) {
                const indB = j + cols * ib
                if (isNotEmpty(arr[indB])) {
                    let ind = j + cols * (this.rows - 1)
                    // find the last non-empty element
                    while(!isNotEmpty(arr[ind])) {
                        ind -= cols
                    }
                    while(ind >= indB) {
                        arr[ind] = value
                        ind -= cols
                    }
                    break
                }
            }
        }
    }

    /** Creates a new matrix, or fills {@link dst} with values of this matrix, transformed by {@link fn} */
    map(fn = (it) => it, dst = null, arrayClass = Array) {
        if (dst && (dst.rows !== this.rows || dst.cols !== this.cols)) {
            throw new Error()
        }
        dst = dst ?? new ShiftedMatrix(this.minRow, this.minCol, this.rows, this.cols, arrayClass)
        for(let ind = 0; ind < this.arr.length; ind++) {
            dst.arr[ind] = fn(this.arr[ind])
        }
        return dst
    }

    /**
     * Initially some area must be filled with 0, and the rest with Infinity.
     * For each cell filled with Infinity, it computes approximate distance to the
     * closest cell filled with 0. If {@link toOutside} == true, the cells outside the
     * matrix are considered to be 0.
     */
    calcDistances(toOutside = false, tmpArray = null, tmpQueue = null) {

        function add(row, col, ind) {
            queue.push(row)
            queue.push(col)
            tmpArray[ind] = 1
        }

        function spread(row0, col0, ind, v0) {
            // don't spread to the side that already has smaller values
            const minRow = row0 > 0 && arr[ind - cols] >= v0
                ? Math.max(row0 - ShiftedMatrix._MAX_SHIFT, 0)
                : row0
            const maxRow = row0 < rowsM1 && arr[ind + cols] >= v0
                ? Math.min(row0 + ShiftedMatrix._MAX_SHIFT, rowsM1)
                : row0
            for(let row = minRow; row <= maxRow; row++) {
                const ind0 = row * cols
                let byRow = ShiftedMatrix._SHIFTS_BY_DELTA_ROW[row - row0 + ShiftedMatrix._MAX_SHIFT]
                for(let i = 0; i < byRow.length; i += 2) {
                    const col = col0 + byRow[i]
                    if (col >= 0 && col < cols) {
                        const ind = ind0 + col
                        const v = v0 + byRow[i + 1]
                        if (arr[ind] > v) {
                            arr[ind] = v
                        }
                    }
                }
            }
        }

        if (tmpArray) {
            tmpArray.fill(0, 0, this.size)
        } else {
            tmpArray = new Uint8Array(this.size)
        }
        const queue = tmpQueue ?? new SimpleQueue()

        const cols = this.cols
        const rowsM1 = this.rows - 1
        const colsM1 = cols - 1
        const arr = this.arr
        // add border cells to the queue, spread from inner cells
        for(const [row, col, ind] of this.relativeRowColIndices()) {
            const v = arr[ind]
            if (v) { // it's a cell with an unkown distance, a queue candidate
                const onBorder =
                    (row === 0      ? toOutside : arr[ind - cols] === 0) ||
                    (row === rowsM1 ? toOutside : arr[ind + cols] === 0) ||
                    (col === 0      ? toOutside : arr[ind - 1]    === 0) ||
                    (col === colsM1 ? toOutside : arr[ind + 1]    === 0)
                if (onBorder) {
                    add(row, col, ind)
                }
            } else {    // it's a cell with known 0 distance; spread from some of them
                const hasNonZeroNeigbours =
                    row          && arr[ind - cols] ||
                    row < rowsM1 && arr[ind + cols] ||
                    col          && arr[ind - 1] ||
                    col < colsM1 && arr[ind + 1]
                if (hasNonZeroNeigbours) {
                    spread(row, col, ind, v)
                }
            }
        }
        // do wide search
        while(queue.length) {
            const row = queue.shift()
            const col = queue.shift()
            const ind = row * cols + col
            spread(row, col, ind, arr[ind])
            if (row > 0 && !tmpArray[ind - cols]) {
                add(row - 1, col, ind - cols)
            }
            if (row < rowsM1 && !tmpArray[ind + cols]) {
                add(row + 1, col, ind + cols)
            }
            if (col > 0 && !tmpArray[ind - 1]) {
                add(row, col - 1, ind - 1)
            }
            if (col < colsM1 && !tmpArray[ind + 1]) {
                add(row, col + 1, ind + 1)
            }
        }
        return this
    }
}

/** A 3D array (backed by an Array or a typed array) whose bottom-left corner may differ from (0,0,0). */
export class SimpleShifted3DArray {
    [key: string]: any;
    minX: any;
    minY: any;
    minZ: any;
    sizeX: any;
    sizeY: any;
    sizeZ: any;
    sizeXM1: number;
    sizeYM1: number;
    sizeZM1: number;
    maxX: any;
    maxY: any;
    maxZ: any;
    arr: any[];
    lengthM1: number;
    strideX: number;
    strideY: any;
    strideZ: number;

    constructor(minX, minY, minZ, sizeX, sizeY, sizeZ, arrayClass = Array) {
        this.minX = minX
        this.minY = minY
        this.minZ = minZ
        this.sizeX = sizeX
        this.sizeY = sizeY
        this.sizeZ = sizeZ
        this.sizeXM1 = sizeX - 1
        this.sizeYM1 = sizeY - 1
        this.sizeZM1 = sizeZ - 1
        this.maxX = minX + this.sizeXM1
        this.maxY = minY + this.sizeYM1
        this.maxZ = minZ + this.sizeZM1
        this.arr = new arrayClass(sizeX * sizeY * sizeZ)
        this.lengthM1 = this.arr.length - 1
        this.strideX = sizeZ * sizeY
        this.strideY = sizeZ
        this.strideZ = 1
    }

    fill(v) {
        this.arr.fill(v)
        return this
    }

    has(x, y, z) {
        return x >= this.minX && y >= this.minY && z >= this.minZ &&
            x <= this.maxX && y <= this.maxY && z <= this.maxZ
    }

    toIndOrNull(x, y, z) {
        x -= this.minX
        y -= this.minY
        z -= this.minZ
        return x >= 0 && y >= 0 && z >= 0 && x <= this.sizeXM1 && y <= this.sizeYM1 && z <= this.sizeZM1
            ? x * this.strideX + y * this.strideY + z
            : null
    }

    vecToIndOrNull(vec) {
        return this.toIndOrNull(vec.x, vec.y, vec.z)
    }

    toInd(x, y, z) {
        x -= this.minX
        y -= this.minY
        z -= this.minZ
        if ((x | y | z | (this.sizeXM1 - x) | (this.sizeYM1 - y) | (this.sizeZM1 - z)) < 0) {
            throw new Error()
        }
        return x * this.strideX + y * this.strideY + z
    }

    vecToInd(vec) {
        return this.toInd(vec.x, vec.y, vec.z)
    }

    getByInd(ind) {
        if ((ind | (this.lengthM1 - ind)) < 0) {
            throw new Error()
        }
        return this.arr[ind]
    }

    get(x, y, z) {
        return this.arr[this.toInd(x, y, z)]
    }

    getByVec(vec) {
        return this.arr[this.toInd(vec.x, vec.y, vec.z)]
    }

    setByInd(ind, v) {
        if ((ind | (this.lengthM1 - ind)) < 0) {
            throw new Error()
        }
        this.arr[ind] = v
    }

    set(x, y, z, v) {
        this.arr[this.toInd(x, y, z)] = v
    }

    setByVec(vec, v) {
        this.arr[this.toInd(vec.x, vec.y, vec.z)] = v
    }

    shift(dx, dy, dz, fill) {
        if ((dx | dy | dz) === 0) {
            return false
        }
        this.minX += dx
        this.maxX += dx
        this.minY += dy
        this.maxY += dy
        this.minZ += dz
        this.maxZ += dz
        if (Math.abs(dx) >= this.sizeX || Math.abs(dy) >= this.sizeY || Math.abs(dz) >= this.sizeZ) {
            this.arr.fill(fill)
            return true
        }
        let x0, x2, ax, y0, y2, ay, z0, z2, az
        if (dx > 0) {
            x0 = 0
            x2 = this.sizeX
            ax = 1
        } else {
            x0 = this.sizeXM1
            x2 = -1
            ax = -1
        }
        const x1 = x2 - dx
        if (dy > 0) {
            y0 = 0
            y2 = this.sizeY
            ay = 1
        } else {
            y0 = this.sizeYM1
            y2 = -1
            ay = -1
        }
        const y1 = y2 - dy
        if (dz > 0) {
            z0 = 0
            z2 = this.sizeZ
            az = 1
        } else {
            z0 = this.sizeZM1
            z2 = -1
            az = -1
        }
        const z1 = z2 - dz

        const d = dx * this.strideX + dy * this.strideY + dz
        for(let x = x0; x != x1; x += ax) {
            const ix = x * this.strideX
            for(let y = y0; y != y1; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z1; z += az) {
                    // copy the elemets
                    const iz = iy + z
                    this.arr[iz] = this.arr[iz + d]
                }
                // fill uncopied elements
                for(let z = z1; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
            // fill uncopied elements
            for(let y = y1; y != y2; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
        }
        // fill uncopied elements
        for(let x = x1; x != x2; x += ax) {
            const ix = x * this.strideX
            for(let y = y0; y != y2; y += ay) {
                const iy = ix + y * this.strideY
                for(let z = z0; z != z2; z += az) {
                    this.arr[iy + z] = fill
                }
            }
        }

        return true
    }

    /**
     * Yields [x, y, z, ind, value]
     * For now, values outside the array are not supported, and behavior for them is undefined.
     */
    *xyzIndValues(minX = this.minX, maxX = this.maxX, minY = this.minY, maxY = this.maxY, minZ = this.minZ, maxZ = this.maxZ) {
        const entry = [null, null, null, null, null]
        for(let x = minX; x <= maxX; x++) {
            const ix = (x - this.minX) * this.strideX
            entry[0] = x
            for(let y = minY; y <= maxY; y++) {
                const iyp = ix + (y - this.minY) * this.strideY - this.minZ
                entry[1] = y
                for(let z = minZ; z <= maxZ; z++) {
                    const iz = iyp + z
                    entry[2] = z
                    entry[3] = iz
                    entry[4] = this.arr[iz]
                    yield entry
                }
            }
        }
    }

    *values() {
        yield *this.arr
    }
}

/**
 * Returns a random number based on world seed, block position, and some object.
 */
export class SpatialDeterministicRandom {
    [key: string]: any;

    /**
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a signed 32-bit value based on the current world positon,
     *      world seed and spice.
     */
    static int32(world, pos : IVector, spice : number | null = null) {
        let res = Vector.toIntHash(pos.x, pos.y, pos.z) ^ world.info.seed;
        if (spice != null) {
            if (typeof spice === 'number') {
                // to account for bth integer and floating point
                spice = spice | (spice * 1000000000);
            } else if (typeof spice === 'string') {
                spice = StringHelpers.hash(spice);
            } else {
                throw Error(); // unsupported spice
            }
            res ^= (spice << 16) ^ (spice >> 16) ^ 243394093;
        }
        return res;
    }

    /**
     * Generates 31-bit unsigned int.
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - an unsigned 31-bit value based on the current world positon,
     *      world seed and spice.
     */
    static uint(world, pos, spice = null) {
        return SpatialDeterministicRandom.int32(world, pos, spice) & 0x7FFFFFFF;
    }

    /**
     * Generates a real number from 0 (inclisve) to 1 (exclusive).
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns {Float} - a value from 0 (inclusive) to 1 (exclusive), based on
     *      the current world positon, world seed and spice.
     */
    static float(world, pos, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) / 0x80000000;
    }

    /**
     * Generates int number from 0 (inclusive) to max (exclusive).
     * Note: the distribution is not uniform for very large numbers.
     *
     * @param {Vector-like} pos
     * @param { int } max - the maximum value (exclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a value from min to max, based on the current world positon,
     *      world seed and spice.
     */
    static int(world, pos, max, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) % max;
    }

    /**
     * Generates int in the given range.
     * Note: the distribution is not uniform for very large numbers.
     *
     * @param {Vector-like} pos
     * @param { int } min - the minium value (inclusive)
     * @param { int } max - the maximum value (inclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns { int } - a value from min to max, based on the current world positon,
     *      world seed and spice.
     */
    static intRange(world, pos, min, max, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) % (max - min + 1) + min;
    }
}

export class PerformanceTimer {

    #names : {name: string, p: number}[] = []
    #keys : string[] = []   // a reusable temporary array

    result: Map<string, number> = new Map()
    /** The total time measured by this timer */
    sum: number = 0
    /**
     * The total number of uses. The exact semantics is up to the caller.
     * It's delcared here for convenience, but not managed by this class, because
     * it doesn't know which start() and stop() to cosider the same or different uses.
     */
    count: number = 0
    #countByTopKey = {}

    constructor() {
    }

    start(name: string) : void {
        this.#names.push({name, p: performance.now()})
    }

    stop() : PerformanceTimer {
        this.#keys.length = 0
        for(let item of this.#names) {
            this.#keys.push(item.name)
        }
        const key = this.#keys.join(' -> ')
        const item = this.#names.pop()
        if(item === undefined) {
            throw 'error_not_started'
        }
        const diff = performance.now() - item.p
        const exist_value = this.result.get(key) ?? 0
        this.result.set(key, exist_value + diff)
        if (this.#keys.length === 1) {
            this.sum += diff
        }
        return this
    }

    /** Adds the sum as a field (which will be exported with other fields). */
    addSum(key : string = 'sum') : PerformanceTimer {
        this.result.set(key, this.sum)
        return this
    }

    /** Add to this timer values from the other timer */
    addFrom(other : PerformanceTimer) : PerformanceTimer {
        this.sum += other.sum
        this.count += other.count
        for(const [key, value] of other.result) {
            this.result.set(key, (this.result.get(key) ?? 0) + value)
        }
        return this
    }

    round() : PerformanceTimer {
        for(const [key, value] of this.result.entries()) {
            this.result.set(key, Math.round(value))
        }
        return this
    }

    filter(minTime : number = 1) : PerformanceTimer {
        for(const [key, value] of this.result.entries()) {
            if(value < minTime) {
                this.result.delete(key)
            }
        }
        return this
    }

    export() : object {
        return Object.fromEntries(this.result.entries())
    }

    exportMultiline(pad = 0) : string {
        return ObjectHelpers.toMultiline(this.export(), pad)
    }

}

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