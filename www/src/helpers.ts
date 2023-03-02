/// <reference path="./global.d.ts" />

import { CubeSym } from "./core/CubeSym.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import { Vector } from "./helpers/vector.js";
export * from "./helpers/index.js"

const {mat4, quat} = glMatrix;

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

export function unixTime() : int {
    return ~~(Date.now() / 1000);
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

// calc rotate
export function mat4ToRotate(matrix) : Vector {
    const out = new Vector(0, 0, 0)
    const _quat = quat.create();
    mat4.getRotation(_quat, matrix);
    getEuler(out, _quat)
    out.swapXZSelf().divScalarSelf(180).multiplyScalarSelf(Math.PI)
    return out
}

export async function blobToImage(blob : Blob) : Promise<HTMLImageElement> {

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
export function isMobileBrowser() : boolean {
    return 'ontouchstart' in document.documentElement;
}

//
export function isScalar(v : any) : boolean {
    return !(typeof v === 'object' && v !== null);
}
