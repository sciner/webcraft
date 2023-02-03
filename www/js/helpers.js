import { CubeSym } from "./core/CubeSym.js";
import {impl as alea} from "../vendors/alea.js";
import {default as runes} from "../vendors/runes.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z, CHUNK_OUTER_SIZE_X, CHUNK_OUTER_SIZE_Z, CHUNK_PADDING,
    CHUNK_CX, CHUNK_CY, CHUNK_CZ, CHUNK_CW } from "./chunk_const.js";
import { DEFAULT_TX_CNT } from "./constant.js";

const {mat4, quat} = glMatrix;

export const CAMERA_MODE = {
    COUNT: 3,
    SHOOTER: 0,
    THIRD_PERSON: 1,
    THIRD_PERSON_FRONT: 2
};

export const TX_CNT = DEFAULT_TX_CNT;

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
    static toNarrowDistribution(unifirmRandom01, width, narrowness, flatness = 0) {
        const v = (unifirmRandom01 - 0.5) * 2;
        const vToPower = Math.pow(Math.abs(v), narrowness) * v;
        return (vToPower + flatness * (v - vToPower)) * width;
    }

    // generates from min to max, inclusive
    static randomIntRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    // generates from 0 (inclusive) to max (exclusive)
    static randomInt(maxExclusive) {
        return Math.floor(Math.random() * maxExclusive);
    }
}

export class IvanArray {
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
export function makeChunkEffectID(chunk_addr, material_key) {
    let resp = `particles_effects/${chunk_addr.toHash()}/`;
    if(material_key) {
        resp += material_key;
    }
    return resp;
}

// Возвращает адрес чанка по глобальным абсолютным координатам
export function getChunkAddr(x, y, z, v = null) {
    if(x instanceof Vector || typeof x == 'object') {
        v = y;

        y = x.y;
        z = x.z;
        x = x.x;
    }
    //
    v = v || new Vector();
    v.x = Math.floor(x / CHUNK_SIZE_X);
    v.y = Math.floor(y / CHUNK_SIZE_Y);
    v.z = Math.floor(z / CHUNK_SIZE_Z);
    // Fix negative zero
    if(v.x == 0) {v.x = 0;}
    if(v.y == 0) {v.y = 0;}
    if(v.z == 0) {v.z = 0;}
    return v;
}

export function chunkAddrToCoord(addr, result) {
    result.x = addr.x * CHUNK_SIZE_X;
    result.y = addr.y * CHUNK_SIZE_Y;
    result.z = addr.z * CHUNK_SIZE_Z;
}

// VectorCollectorFlat...
export class VectorCollectorFlat {

    constructor(list) {
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

    clear(list) {
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

}

// VectorCollector...
export class VectorCollector {

    /**
     * @param {Map} list
     * @param {int} blocks_size
     */
    constructor(list, blocks_size) {
        this.clear(list);
        if(list && !isNaN(blocks_size)) {
            this.size = blocks_size
        }
    }

    *[Symbol.iterator]() {
        for (let x of this.list.values()) {
            for (let y of x.values()) {
                for (let value of y.values()) {
                    yield value;
                }
            }
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

    clear(list) {
        this.list = list ? list : new Map();
        this.size = 0;
    }

    set(vec, value) {
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

    add(vec, value) {
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
    getOrSet(vec, createFn) {
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
    update(vec, mapFn) {
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

    delete(vec) {
        if(this.list?.get(vec.x)?.get(vec.y)?.delete(vec.z)) {
            this.size--;
            return true;
        }
        return false;
    }

    has(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.has(vec.z) || false;
    }

    get(vec) {
        return this.list.get(vec.x)?.get(vec.y)?.get(vec.z) || null;
    }

    keys() {
        let resp = [];
        for (let [xk, x] of this.list) {
            for (let [yk, y] of x) {
                for (let [zk, z] of y) {
                    resp.push(new Vector(xk|0, yk|0, zk|0));
                }
            }
        }
        return resp;
    }

    values() {
        let resp = [];
        for(let item of this) {
            resp.push(item);
        }
        return resp;
    }

    reduce(max_size) {
        if(this.size < max_size) {
            return false;
        }
    }

}

// Color
export class Color {

    static componentToHex(c) {
        var hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    }

    static hexToColor(hex_color) {
        var c;
        if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex_color)) {
            c = hex_color.substring(1).split('');
            if(c.length == 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return new Color((c>>16)&255, (c>>8)&255, c&255, 255); // 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+',1)';
        }
        throw new Error('Bad Hex');
    }

    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    add(color) {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        this.a += color.a;
        return this;
    }

    divide(color) {
        this.r /= color.r;
        this.g /= color.g;
        this.b /= color.b;
        this.a /= color.a;
        return this;
    }

    set(r, g, b, a) {
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

    copyFrom(color) {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.a = color.a;
    }

    /**
     * @return {Color}
     */
    toFloat()  {
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

    copyFrom(color) {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        this.a = color.a;
    }

    equals(color) {
        return this.r === color.r && this.g === color.g && this.b === color.b && this.a === color.a;
    }

}

export class Vector {

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

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} [x]
     * @param {number} [y]
     * @param {number} [z]
     */
    constructor(x, y, z) {
        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.set(x, y, z);
    }

    // returns v or a new Vector based on it
    static vectorify(v) {
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

    // array like object lenght
    get length() {
        return 3;
    }

    /**
     * Much faster than set() if we know the soure type.
     * @param {Vector} vec
     */
    copyFrom(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {boolean}
     */
    equal(vec) {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    applyCubeSymSelf(cubeSym, origin = Vector.ZERO) {
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
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @return {void}
     */
    lerpFrom(vec1, vec2, delta) {
        this.x = vec1.x * (1.0 - delta) + vec2.x * delta;
        this.y = vec1.y * (1.0 - delta) + vec2.y * delta;
        this.z = vec1.z * (1.0 - delta) + vec2.z * delta;
        return this;
    }

    /**
     * @param {Vector} vec1
     * @param {Vector} vec2
     * @param {number} delta
     * @param {boolean} rad
     * @return {void}
     */
    lerpFromAngle(vec1, vec2, delta, rad = false) {
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
    add(vec) {
        return new Vector(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }

    addScalarSelf(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    addSelf(vec) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    sub(vec) {
        return new Vector(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    subSelf(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    subSelf(vec) {
        this.x -= vec.x;
        this.y -= vec.y;
        this.z -= vec.z;
        return this;
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    mul(vec) {
        return new Vector(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    /**
     * @param {Vector} vec
     * @return {Vector}
     */
    div(vec) {
        return new Vector(this.x / vec.x, this.y / vec.y, this.z / vec.z);
    }

    zero() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    /**
     * @return {Vector}
     */
    swapYZ() {
        return new Vector(this.x, this.z, this.y);
    }

    /**
     * @return {Vector}
     */
    swapXZSelf() {
        return this.set(this.z, this.y, this.x);
    }

    /**
     * @return {number}
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    distance(vec) {
        // return this.sub(vec).length();
        // Fast method
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return Math.sqrt(x * x + y * y + z * z);
    }

    distanceSqr(vec) {
        let x = this.x - vec.x;
        let y = this.y - vec.y;
        let z = this.z - vec.z;
        return x * x + y * y + z * z;
    }

    /**
     * @param {Vector} vec
     * @return {number}
     */
    horizontalDistance(vec) {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return Math.sqrt(x * x + z * z);
    }

    horizontalDistanceSqr(vec) {
        const x = this.x - vec.x;
        const z = this.z - vec.z;
        return x * x + z * z;
    }

    // distancePointLine...
    distanceToLine(line_start, line_end, intersection = null) {
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
    normal() {
        if(this.x == 0 && this.y == 0 && this.z == 0) return new Vector(0, 0, 0);
        let l = this.length();
        return new Vector(this.x / l, this.y / l, this.z / l);
    }

    normSelf() {
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
    dot(vec) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    /**
     * @return {Vector}
     */
    round(decimals) {
        return this.clone().roundSelf(decimals);
    }

    /**
     * @returns {Vector}
     */
    roundSelf(decimals) {
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

    minSelf(vec) {
        this.x = Math.min(this.x, vec.x);
        this.y = Math.min(this.y, vec.y);
        this.z = Math.min(this.z, vec.z);
    }

    maxSelf(vec) {
        this.x = Math.max(this.x, vec.x);
        this.y = Math.max(this.y, vec.y);
        this.z = Math.max(this.z, vec.z);
    }

    /**
     * @return {Vector}
     */
    toInt() {
        return new Vector(
            this.x | 0,
            this.y | 0,
            this.z | 0
        );
    }

    /**
     * @return {Vector}
     */
    clone() {
        return new Vector(
            this.x,
            this.y,
            this.z
        );
    }

    /**
     * @return {number[]}
     */
    toArray() {
        return [this.x, this.y, this.z];
    }

    /**
     * @return {string}
     */
    toString() {
        return '(' + this.x + ',' + this.y + ',' + this.z + ')';
    }

    /**
     * @return {string}
     */
    toChunkKey() {
        return 'c_' + this.x + '_' + this.y + '_' + this.z;
    }

    /**
     * @return {string}
     */
    toHash() {
        return this.x + ',' + this.y + ',' + this.z;
    }

    static toIntHash(x, y, z) {
        x *= 39749;
        y *= 76871;
        z *= 46049;
        return x ^ (y << 21) ^ (y >> 11) ^ (z << 11) ^ (z >> 21);
    }

    toIntHash() {
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
    normalize() {
        return this.normal();
    }

    offset(x, y, z) {
        return new Vector(this.x + x, this.y + y, this.z + z);
    }

    /**
     * @return {Vector}
     */
    floored() {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    /**
     * @return {Vector}
     */
    flooredSelf() {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        return this;
    }

    translate(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
        return this;
    }

    /**
     * Identical semantics to the constructor, but more optimized for Vector argument.
     * Useful for safely replacing the constructor calls.
     */
    initFrom(x, y, z) {
        if (x instanceof Vector) { // this optimization helps a lot
            return this.copyFrom(x);
        }

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.set(x, y, z);
        return this;
    }

    /**
     *
     * @param {Vector | {x: number, y: number, z: number} | number[]} x
     * @param {number} [y]
     * @param {number} [z]
     */
    set(x, y = x, z = x) {
        if (x && typeof x == 'object') {
            return this.copy(x);
        }

        // maybe undef
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
        return this;
    }

    setScalar(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    multiplyScalarSelf(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    multiplyVecSelf(vec) {
        this.x *= vec.x;
        this.y *= vec.y;
        this.z *= vec.z;
        return this;
    }

    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

    divScalarVec(vec) {
        this.x /= vec.x;
        this.y /= vec.y;
        this.z /= vec.z;
        return this;
    }

    toAngles() {
        // N = 0
        // W = 1
        // S = 2
        // E = 3
        this.z = this.x * (-Math.PI/2);
        this.x = 0;
        this.y = 0;
        return this;
    }

    volume(vec) {
        const volx = Math.abs(this.x - vec.x) + 1;
        const voly = Math.abs(this.y - vec.y) + 1;
        const volz = Math.abs(this.z - vec.z) + 1;
        return volx * voly * volz;
    }

    /**
     *
     * @param {Vector | number[] | {x: number, y: number, z: number}} from
     */
    copy(from) {
        if (from == null) {
            return this;
        }

        // array like object with length 3 or more
        // for gl-matix
        if (from.length >= 3) {
            this.x = from[0];
            this.y = from[1];
            this.z = from[2];

            return this;
        }

        // object is simple and has x, y, z props
        if ('x' in from) {
            this.x = from.x;
            this.y = from.y;
            this.z = from.z;
        }

        return this;
    }

    /**
     * TO DO EN поворот внутри чанка вокруг y
     * @param {DIRECTION_BIT} dir
     * @return {Vector}
     */
    rotY(dir) {
        let tmp_x = this.x, tmp_y = this.y, tmp_z = this.z;
        if (dir == DIRECTION.EAST){
            this.x = tmp_z;
            this.z = 15 - tmp_x;
        }
        if (dir == DIRECTION.NORTH){
            this.x = 15 - tmp_x;
            this.z = 15 - tmp_z;
        }
        if (dir == DIRECTION.WEST){
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

    worldPosToChunkIndex() {
        const x = this.x - Math.floor(this.x / CHUNK_SIZE_X) * CHUNK_SIZE_X;
        const y = this.y - Math.floor(this.y / CHUNK_SIZE_Y) * CHUNK_SIZE_Y;
        const z = this.z - Math.floor(this.z / CHUNK_SIZE_Z) * CHUNK_SIZE_Z;
        return CHUNK_CX * x + CHUNK_CY * y + CHUNK_CZ * z + CHUNK_CW;
    }

    relativePosToChunkIndex() {
        return CHUNK_CX * this.x + CHUNK_CY * this.y + CHUNK_CZ * this.z + CHUNK_CW;
    }

    fromChunkIndex(index) {
        this.x = index % CHUNK_OUTER_SIZE_X - CHUNK_PADDING;
        index  = index / CHUNK_OUTER_SIZE_X | 0;
        this.z = index % CHUNK_OUTER_SIZE_Z - CHUNK_PADDING;
        this.y = (index / CHUNK_OUTER_SIZE_Z | 0) - CHUNK_PADDING;
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

export class Vec3 extends Vector {
    add(vec) {
        this.x += vec.x;
        this.y += vec.y;
        this.z += vec.z;
    }
    offset(x, y, z) {
        return new Vec3(this.x + x, this.y + y, this.z + z);
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

export class IndexedColor {
    static packLm(lm) {
        return IndexedColor.packArg(lm.r, lm.g, lm.b);
    }

    static WHITE = null;
    static GRASS = null;
    static WATER = null;

    static packArg(palU, palV, palMode) {
        palU = Math.round(palU);
        palV = Math.round(palV);
        return (palMode << 20) | (palV << 10) | (palU << 0);
    }

    constructor(r, g, b) {
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
    divide(color) {
        this.r /= color.r;
        this.g /= color.g;
        return this;
    }

    clone() {
        return new IndexedColor(this.r, this.g, this.b);
    }

    /**
     * @param {IndexedColor} ic
     */
    copyFrom(ic) {
        this.r = ic.r;
        this.g = ic.g;
        this.b = ic.b;
        return this;
    }

    flooredSelf() {
        this.r = Math.floor(this.r);
        this.g = Math.floor(this.g);
        this.b = Math.floor(this.b);
        return this;
    }

    pack() {
        return this.packed = IndexedColor.packArg(this.r, this.g, this.b);
    }

    clone() {
        return new IndexedColor(this.r, this.g, this.b);
    }

}

IndexedColor.WHITE = new IndexedColor(48, 528, 0);
IndexedColor.GRASS = new IndexedColor(132, 485, 0);
IndexedColor.WATER = new IndexedColor(132, 194, 0);

export let QUAD_FLAGS = {}
    QUAD_FLAGS.NORMAL_UP = 1 << 0;
    QUAD_FLAGS.MASK_BIOME = 1 << 1;
    QUAD_FLAGS.NO_AO = 1 << 2;
    QUAD_FLAGS.NO_FOG = 1 << 3;
    QUAD_FLAGS.LOOK_AT_CAMERA = 1 << 4;
    QUAD_FLAGS.FLAG_ANIMATED = 1 << 5;
    QUAD_FLAGS.FLAG_TEXTURE_SCROLL = 1 << 6;
    QUAD_FLAGS.NO_CAN_TAKE_AO = 1 << 7;
    QUAD_FLAGS.QUAD_FLAG_OPACITY = 1 << 8;
    QUAD_FLAGS.QUAD_FLAG_SDF = 1 << 9;
    QUAD_FLAGS.NO_CAN_TAKE_LIGHT = 1 << 10;
    QUAD_FLAGS.FLAG_TRIANGLE = 1 << 11;
    QUAD_FLAGS.FLAG_MIR2_TEX = 1 << 12;
    QUAD_FLAGS.FLAG_MULTIPLY_COLOR = 1 << 13;
    QUAD_FLAGS.FLAG_LEAVES = 1 << 14;
    QUAD_FLAGS.LOOK_AT_CAMERA_HOR = 1 << 15;
    // Starting from this flag, we can add new flags to fields that contain QUAD_FLAGS, e.g. Mesh_Effect_Particle.flags
    QUAD_FLAGS.FLAG_ENCHANTED_ANIMATION = 1 << 16;
    QUAD_FLAGS.NEXT_UNUSED_FLAG = 1 << 17;

export let ROTATE = {};
    ROTATE.S = CubeSym.ROT_Y2; // front, z decreases
    ROTATE.W = CubeSym.ROT_Y; // left, x decreases
    ROTATE.N = CubeSym.ID; // back, z increases
    ROTATE.E = CubeSym.ROT_Y3; // right, x increases

export let NORMALS = {};
    NORMALS.FORWARD          = new Vector(0, 0, 1);
    NORMALS.BACK             = new Vector(0, 0, -1);
    NORMALS.LEFT             = new Vector(-1, 0, 0);
    NORMALS.RIGHT            = new Vector(1, 0, 0);
    NORMALS.UP               = new Vector(0, 1, 0);
    NORMALS.DOWN             = new Vector(0, -1, 0);

// Direction enumeration
export let DIRECTION = {};
    DIRECTION.UP        = CubeSym.ROT_X;
    DIRECTION.DOWN      = CubeSym.ROT_X3;
    DIRECTION.LEFT      = CubeSym.ROT_Y;
    DIRECTION.RIGHT     = CubeSym.ROT_Y3;
    DIRECTION.FORWARD   = CubeSym.ID;
    DIRECTION.BACK      = CubeSym.ROT_Y2;
    // Aliases
    DIRECTION.WEST      = DIRECTION.LEFT;
    DIRECTION.EAST      = DIRECTION.RIGHT
    DIRECTION.NORTH     = DIRECTION.FORWARD;
    DIRECTION.SOUTH     = DIRECTION.BACK;

export let DIRECTION_BIT = {};
    DIRECTION_BIT.UP    = 0;
    DIRECTION_BIT.DOWN  = 1;
    DIRECTION_BIT.EAST  = 2; // X increases
    DIRECTION_BIT.WEST  = 3; // X decreases
    DIRECTION_BIT.NORTH = 4; // Z increases
    DIRECTION_BIT.SOUTH = 5; // Z decreases

// Direction names
export let DIRECTION_NAME = {};
    DIRECTION_NAME.up        = DIRECTION.UP;
    DIRECTION_NAME.down      = DIRECTION.DOWN;
    DIRECTION_NAME.left      = DIRECTION.LEFT;
    DIRECTION_NAME.right     = DIRECTION.RIGHT;
    DIRECTION_NAME.forward   = DIRECTION.FORWARD;
    DIRECTION_NAME.back      = DIRECTION.BACK;

export class Helpers {

    static cache = new Map();
    static fetch;
    static fs;

    static setCache(cache) {
        Helpers.cache = cache;
    }

    static getCache() {
        return Helpers.cache;
    }

    //
    angleTo(pos, target) {
        let angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle + 2 * Math.PI;
    }

    // clamp
    static clamp(x, min, max) {
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
    static byteToHex(byte) {
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

    static distance(p, q) {
        let dx   = p.x - q.x;
        let dy   = p.y - q.y;
        let dz   = p.z - q.z;
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist;
    }

    // getRandomInt возвращает случайное целое число в диапазоне от min до max (min <= N <= max)
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static createSkinLayer2(text, image, callback) {
        let canvas          = document.createElement('canvas');
        canvas.width        = 64;
        canvas.height       = 64;
        let ctx             = canvas.getContext('2d');
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
    static downloadBlobPNG(blob, filename) {
        /// create an "off-screen" anchor tag
        let lnk = document.createElement('a'), e;
        /// the key here is to set the download attribute of the a tag
        lnk.download = filename;
        /// convert canvas content to data-uri for link. When download
        /// attribute is set the content pointed to by link will be
        /// pushed as "download" in HTML5 capable browsers
        lnk.href = URL.createObjectURL(blob);
        /// create a "fake" click-event to trigger the download
        if (document.createEvent) {
            e = document.createEvent('MouseEvents');
            e.initMouseEvent('click', true, true, window,
            0, 0, 0, 0, 0, false, false, false,
            false, 0, null);
            lnk.dispatchEvent(e);
        } else if (lnk.fireEvent) {
            lnk.fireEvent('onclick');
        }
    }

    // downloadImage
    static downloadImage(image, filename) {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        ctx.canvas.width  = image.width;
        ctx.canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        c.toBlob(function(blob) {
            // here the image is a blob
            Helpers.downloadBlobPNG(blob, filename);
        }, 'image/png');
    }

    static deg2rad(degrees) {
        return degrees * (Math.PI / 180);
    }

    static rad2deg(radians) {
        return radians * 180 / Math.PI;
    }

    static async loadJSON(url, callback) {
        await loadText(url, function(text) {
            callback(JSON.parse(text));
        });
    }

    // createGLProgram...
    static createGLProgram(gl, obj, callback) {
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
    static getColorForPercentage(pct) {
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
    static calcSpeed(pos1, pos2, delta) {
        return Math.round(pos1.distance(pos2) / delta * 360) / 100;
    }

}

export class StringHelpers {

    // Like String.split, but splits only on the 1st separator, i.e. maximum in 2 parts.
    static splitFirst(str, separatpr) {
        const ind = str.indexOf(separatpr);
        return ind >= 0
            ? [str.substring(0, ind), str.substring(ind + 1, str.length)]
            : [str];
    }

    // The same hash as used in Java: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    static hash(str) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr | 0;
        }
        return hash;
    }

    // indexTrim
    static trim(str, ch) {
        var start = 0,
            end = str.length;
        while(start < end && str[start] === ch)
            ++start;
        while(end > start && str[end - 1] === ch)
            --end;
        return (start > 0 || end < str.length) ? str.substring(start, end) : str;
    }

    // converts to Roman number, from https://stackoverflow.com/questions/9083037/convert-a-number-into-a-roman-numeral-in-javascript
    static romanize(num) {
        let lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1}, roman = '', i;
        for (i in lookup) {
            while (num >= lookup[i]) {
                roman += i;
                num -= lookup[i];
            }
        }
        return roman;
    }

    static replaceCharAt(str, index, replacement) {
        return str.charAt(index) !== replacement
            ? str.substring(0, index) + replacement + str.substring(index + replacement.length)
            : str;
    }

    static count(str, subStr) {
        let res = 0;
        let ind = str.indexOf(subStr);
        while (ind >= 0) {
            res++;
            ind = str.indexOf(subStr, ind + 1);
        }
        return res;
    }

    static capitalizeChatAt(str, index) {
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

    // elements order is not preserved
    static fastDelete(arr, index) {
        arr[index] = arr[arr.length - 1];
        --arr.length;
    }

    // elements order is not preserved
    static fastDeleteValue(arr, value) {
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

    static filterSelf(arr, predicate) {
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

    static sum(arr, mapper = (it) => it) {
        var sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += mapper(arr[i]);
        }
        return sum;
    }

    static growAndSet(arr, index, value, filler = undefined) {
        while (arr.length <= index) {
            arr.push(filler);
        }
        arr[index] = value;
    }

    /**
     * Ensures that the first sortedLength elements are the same as if the entire array
     * was sorted. The order of the remaining elemnets is undefin.
     * It has O(length) time.
     * @param {Int} sortedLength - the number of first array elements that will be sorted.
     */
    static partialSort(arr, sortedLength = arr.length, compare,
        // do not pass the last 2 arguments - they are internal
        fromIncl = 0, toExcl = arr.length
    ) {
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

    static toObject(arr, toKeyFn = (ind, value) => ind, toValueFn = (ind, value) => value) {
        const res = {};
        if (typeof toValueFn !== 'function') {
            toValueFn = () => toValueFn;
        }
        for(let i = 0; i < arr.length; i++) {
            const v = arr[i];
            res[toKeyFn(i, v)] = toValueFn(i, v);
        }
        return res;
    }

    static create(size, fill = null) {
        const arr = new Array(size);
        if (typeof fill === 'function') {
            for(let i = 0; i < arr.length; i++) {
                arr[i] = fill(i);
            }
        } else if (fill !== null) {
            arr.fill(fill);
        }
        return arr;
    }

    static create(length, createElementFn) {
        const res = new Array(length);
        for(let i = 0; i < length; i++) {
            res[i] = createElementFn(i);
        }
        return res;
    }
}

// Helper methods to work with an array or a scalar in the same way.
export class ArrayOrScalar {
    // Returns Array or null as is. Non-null scalars are wraped into an array.
    static toArray(v) {
        return (v == null || Array.isArray(v)) ? v : [v];
    }

    static length(v) {
        return Array.isArray(v) ? v.length : v;
    }

    static get(v, index) {
        return Array.isArray(v) ? v[index] : v;
    }

    static find(fn) {
        return Array.isArray(v)
            ? v.find(fn)
            : (fn(v) ? v : null);
    }

    static map(v, fn) {
        return Array.isArray(v) ? v.map(fn) : fn(v);
    }

    // Sets the length of an Array, but doesn't change a scalar
    static setArrayLength(v, length) {
        if (Array.isArray(v)) {
            v.length = length;
        }
        return v;
    }

    static mapSelf(v, fn) {
        if (Array.isArray(v)) {
            for(let i = 0; i < v.length; i++) {
                v[i] = fn(v[i]);
            }
            return v;
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

// Make fetch functions
if(typeof fetch === 'undefined') {
    // Hello eval ;)
    const code = `Helpers.fetch = async (url) => import(url);
    Helpers.fetchJSON = async (url) => import(url, {assert: {type: 'json'}}).then(response => response.default);
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

export class SpiralEntry {
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

    static cache = new Map();
    static cache3D = {};

    // generate ...
    static generate(margin) {
        let size = margin * 2;
        if(SpiralGenerator.cache.has(margin)) {
            return SpiralGenerator.cache.get[margin];
        }
        var resp = [];
        function rPush(vec) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let x = vec.x - size / 2;
            let z = vec.z - size / 2;
            let dist = Math.sqrt(x * x + z * z);
            if(dist < margin) {
                resp.push(vec);
            }
        }
        let iInd = parseInt(size / 2);
        let jInd = parseInt(size / 2);
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
    static generate3D(vec_margin) {
        let cache_key = vec_margin.toString();
        if(SpiralGenerator.cache3D.hasOwnProperty(cache_key)) {
            return SpiralGenerator.cache3D[cache_key];
        }
        let resp        = [];
        let center      = new Vector(0, 0, 0);
        let exists      = [];
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
                            exists[key] = true;
                        }
                    }
                }
            }
        }
        resp.sort(function(a, b) {
            return a.dist - b.dist;
        });
        SpiralGenerator.cache3D[cache_key] = resp;
        return resp;
    }

}

function loadText(url, callback) {
    let xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == '200') {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);
}

export class Vector4 {

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}

// AverageClockTimer
export class AverageClockTimer {

    constructor() {
        this.prev       = null,
        this.min        = null,
        this.max        = null,
        this.avg        = null,
        this.sum        = 0,
        this.history_index = 0;
        this.history    = new Array(60).fill(0);
    }

    add(value) {
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

export function unixTime() {
    return ~~(Date.now() / 1000);
}

/**
 *
 * @param {string} seed
 * @param {int} len
 * @returns
 */
export function createFastRandom(seed, len = 512) {
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

// FastRandom...
export class FastRandom {

    constructor(seed, cnt) {
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

    double(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.doubles[offset];
    }

    int32(offset) {
        offset = Math.abs(offset) % this.cnt;
        return this.int32s[offset];
    }

}

export class RuneStrings {

    static toArray(str) {
        return runes(str);
    }

    // Разделяет слово на строки, в которых максимум указанное в [chunk] количество букв (с учётом emoji)
    static toChunks(str, chunk) {
        const rs = runes(str);
        if(rs.length > chunk) {
            let i, j, resp = [];
            for (i = 0, j = rs.length; i < j; i += chunk) {
                resp.push(rs.slice(i, i + chunk).join(''));
            }
            return resp;
        }
        return [str];
    }

    // Разделяет длинные слова пробелами (с учётом emoji)
    static splitLongWords(str, max_len) {
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

    static width            = 1024;
    static height           = 1024;
    static char_size        = {width: 32, height: 32};
    static char_size_norm   = {width: this.char_size.width / this.width, height: this.char_size.height / this.height};
    static chars            = new Map();

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
    static getStringUVs(str, init_new) {
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

export function fromMat3(a, b) {
    //transponse too!
    a[ 0] = b[ 0];
    a[ 1] = b[ 3];
    a[ 2] = b[ 6];

    a[ 4] = b[ 1];
    a[ 5] = b[ 4];
    a[ 6] = b[ 7];

    a[ 8] = b[ 2];
    a[ 9] = b[ 5];
    a[10] = b[ 8];

    a[ 3] = a[ 7] = a[11] =
    a[12] = a[13] = a[14] = 0;
    a[15] = 1.0;

    return a;
}

// calcRotateMatrix
export function calcRotateMatrix(material, rotate, cardinal_direction, matrix) {
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

// maybe move other related methods here
export class ObjectHelpers {

    static isEmpty(obj) {
        for (let key in obj) {
            return false;
        }
        return true;
    }

    // For now, it supports only plain objects, Array, primitives and Vector.
    static deepClone(v, depth = Infinity) {
        if (v == null) {
            return v;
        }
        // Splitting this function into 3 increases(!) performance
        // Probably because JIT can infer static types in deepCloneArray() and deepCloneObject()
        if (Array.isArray(v)) {
            return this.deepCloneArray(v, depth);
        }
        if (typeof v === 'object') {
            return this.deepCloneObject(v, depth);
        }
        return v;
    }

    static deepCloneArray(v, depth = Infinity) {
        if (--depth < 0) {
            return v;
        }
        const res = new Array(v.length);
        for(let i = 0; i < v.length; i++) {
            res[i] = this.deepClone(v[i], depth);
        }
        return res;
    }

    static deepCloneObject(v, depth = Infinity) {
        if (--depth < 0) {
            return v;
        }
        if (v instanceof Vector) {
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
    static deepEqual(a, b) {
        if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') {
            return a === b;
        }
        return Array.isArray(a)
            ? Array.isArray(b) && this.deepEqualArray(a, b)
            : this.deepEqualObject(a, b);
    }

    static deepEqualArray(a, b) {
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

    static deepEqualObject(a, b) {
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
    static sortedStringify(obj) {
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
}

function toType(a) {
    // Get fine type (object, array, function, null, error, date ...)
    return ({}).toString.call(a).match(/([a-z]+)(:?\])/i)[1];
}

function isDeepObject(obj) {
    return "Object" === toType(obj);
}

export function deepAssign(options) {
    return function deepAssignWithOptions (target, ...sources) {
        sources.forEach( (source) => {

            if (!isDeepObject(source) || !isDeepObject(target))
                return;

            // Copy source's own properties into target's own properties
            function copyProperty(property) {
                const descriptor = Object.getOwnPropertyDescriptor(source, property);
                //default: omit non-enumerable properties
                if (descriptor.enumerable || options.nonEnum) {
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

const DEFAULT_PROPERTIES_EQUAL_FN = (a, b) => ObjectHelpers.deepEqual(a, b);

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
export function isScalar(v) {
    return !(typeof v === 'object' && v !== null);
}

// md5
export let md5 = (function() {
    var MD5 = function (d, outputEncoding) {
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
    function MD5Unicode(buffer, outputEncoding){
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

// A queue backed by an array that wraps around.
// shift() and length are compatible with that of Array.
// push() is not fully compatible with Array: it doesn't support multiple arguments.
export class SimpleQueue {

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
export class SimpleShiftedMatrix {

    constructor(minRow, minCol, rows, cols, arrayClass = Array) {
        this.minRow = minRow;
        this.minCol = minCol;
        this.rows = rows;
        this.cols = cols;
        this.rowsM1 = rows - 1;
        this.colsM1 = cols - 1;
        this.maxRow = minRow + rows - 1;
        this.maxCol = minCol + cols - 1;
        this.arr = new arrayClass(rows * cols);
    }

    fill(v) {
        for(let i = 0; i < this.arr.size; i++) {
            this.arr[i] = v;
        }
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

    getOrDefault(row, col, def) {
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
        return ((row - this.minRow) | (col - this.minCol) | (this.maxRow - row) | (this.maxCol - col)) >= 0;
    }

    hasRow(row) {
        return ((row - this.minRow) | (this.maxRow - row)) >= 0;
    }

    hasCol(col) {
        return ((col - this.minCol) | (this.maxCol - col)) >= 0;
    }

    *entries() {
        for(let i = 0; i < this.rows; i++) {
            for(let j = 0; j < this.cols; j++) {
                yield [i + this.minRow, j + this.minCol, this.arr[i * this.cols + j]];
            }
        }
    }

    toArrayOfArrays() {
        let res = [];
        for(let i = 0; i < this.rows; i++) {
            let s = [];
            for(let j = 0; j < this.cols; j++) {
                s.push(this.arr[i * this.cols + j]);
            }
            res.push(s);
        }
        return res;
    }
}

/**
 * Returns a random number based on world seed, block position, and some object.
 */
export class SpatialDeterministicRandom {

    /**
     * @param {Vector-like} pos
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns {Int} - a signed 32-bit value based on the current world positon,
     *      world seed and spice.
     */
    static int32(world, pos, spice = null) {
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
     * @returns {Int} - an unsigned 31-bit value based on the current world positon,
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
     * @param {Int} max - the maximum value (exclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns {Int} - a value from min to max, based on the current world positon,
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
     * @param {Int} min - the minium value (inclusive)
     * @param {Int} max - the maximum value (inclusive)
     * @param {Int or String} spice - a value to change the result (optional)
     * @returns {Int} - a value from min to max, based on the current world positon,
     *      world seed and spice.
     */
    static intRange(world, pos, min, max, spice = null) {
        return SpatialDeterministicRandom.uint(world, pos, spice) % (max - min + 1) + min;
    }
}

/**
 * Returns an euler angle representation of a quaternion
 * @param  {vec3} out Euler angles, pitch-yaw-roll
 * @param  {quat} mat Quaternion
 * @return {vec3} out
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

export function mat4ToRotate(matrix) {
    // calc rotate
    const out = new Vector(0, 0, 0)
    const _quat = quat.create();
    mat4.getRotation(_quat, matrix);
    getEuler(out, _quat)
    out.swapXZSelf().divScalar(180).multiplyScalarSelf(Math.PI)
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

    return new Promise((resolve, reject) => {
        item_image.toBlob((blob) => {
            resolve(blobToImage(blob))
        })
    })

}

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
export function sizeOf(value) {
    return typeSizes[typeof value](value)
}



export class PerformanceTimer {

    constructor() {
        this.names = []
    }

    start(name) {
        this.names.push({name, p: performance.now()})
    }

    stop() {
        let keys = []
        for(let item of this.names) {
            keys.push(item.name)
        }
        const key = keys.join(' -> ')
        const item = this.names.pop()
        const diff = performance.now() - item.p
        const exist_value = this[key] ?? 0
        this[key] = exist_value + diff
    }

}