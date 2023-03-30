/// <reference path="./global.d.ts" />
/// <reference path="./worker/messages.d.ts" />

export * from "./helpers/helper_const.js";
export * from './helpers/color.js';
export * from "./helpers/mth.js";
export * from './helpers/vector.js';
export * from './helpers/vector_collector.js';
export * from './helpers/performance_timer.js';
export * from './helpers/string_helpers.js';
export * from './helpers/object_helpers.js';
export * from './helpers/alphabet_texture.js';
export * from './helpers/spiral_generator.js';
export * from './helpers/indexed_color.js';
export * from './helpers/fast_random.js';
export * from './helpers/monotonic_utc_date.js';

export * from "./helpers/vector_collector_2d.js";
export * from "./helpers/vector_cardinal_transformer.js";
export * from "./helpers/simple_queue.js";
export * from "./helpers/shifted_matrix.js";
export * from "./helpers/array_helpers.js";
export * from "./helpers/array_or_map.js";
export * from "./helpers/array_or_scalar.js";
export * from "./helpers/spatial_determenistic_random.js";
export * from "./helpers/average_clock_timer.js";
export * from "./helpers/simple_shifted_3d_array.js";

import { CubeSym } from "./core/CubeSym.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import { Vector } from "./helpers/vector.js";
import {Color} from "./helpers/color.js";
import type { World } from "./world.js";

const {mat4, quat} = glMatrix;

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

    static inWorker() : boolean {
        return (typeof (self as any).WorkerGlobalScope !== 'undefined') ||
               (typeof worker != 'undefined')
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
if((typeof fetch === 'undefined') || (typeof process != 'undefined') ) {
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
    Helpers.fetch = async (url : string) => fetch(url);
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



    /**
     * Возвращает позицию, на которой можно стоять вокруг точки pos или null
     * @param pos - позиция
     * @param world - ссылка на world
     */
    export function getValidPosition(pos : Vector, world: World) : Vector | null {
        let block = world.getBlock(pos.offset(0, 2, 0))
        if (block.id == 0) {
            return pos.offset(.5, 1, .5)
        }
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (j == 0 && i == 0) {
                    continue
                }
                block = world.getBlock(pos.offset(i, -1, j))
                if (block.material.is_solid) {
                    block = world.getBlock(pos.offset(i, 0, j))
                    if (block.id == 0 || block?.material?.height < .5) {
                        block = world.getBlock(pos.offset(i, 1, j))
                        if (block.id == 0) {
                            return pos.offset(i + .5, .5, j + .5)
                        }
                    } 
                }
            }
        }
        return null
    }//
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