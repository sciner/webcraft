import { CubeSym } from "./core/CubeSym.js";

export const TX_CNT = 32;

/*Object.defineProperty(String.prototype, 'hashCode', {
    value: function() {
        var hash = 0, i, chr;
        for (i = 0; i < this.length; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
});*/

export class Mth {

    static lerp(amount, value1, value2) {
        amount = amount < 0 ? 0 : amount;
        amount = amount > 1 ? 1 : amount;
        return value1 + (value2 - value1) * amount;
    }

    static sin(a) {
        return Math.sin(a);
    }

    static cos(a) {
        return Math.cos(a);
    }

}

// VectorCollector...
export class VectorCollector {

    constructor(list) {
        this.clear();
        if(list) {
            this.list = list;
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

    clear() {
        this.list = new Map();
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

    delete(vec) {
        if(!this.has(vec)) {
            return false;
        }
        this.size--;
        this.list.get(vec.x).get(vec.y).delete(vec.z)
        return true;
    }

    has(vec) {
        if(!this.list.has(vec.x)) return false;
        if(!this.list.get(vec.x).has(vec.y)) return false;
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return false;
        return true;
    }

    get(vec) {
        if(!this.list.has(vec.x)) return null;
        if(!this.list.get(vec.x).has(vec.y)) return null;
        if(!this.list.get(vec.x).get(vec.y).has(vec.z)) return null;
        return this.list.get(vec.x).get(vec.y).get(vec.z);
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
        /*
        let keys = Object.keys(this.maps_cache);
        if(keys.length > MAX_ENTR) {
            let del_count = Math.floor(keys.length - MAX_ENTR * 0.333);
            console.info('Clear maps_cache, del_count: ' + del_count);
            for(let key of keys) {
                if(--del_count == 0) {
                    break;
                }
                delete(this.maps_cache[key]);
            }
        }
        */
    }

}

// Color
export class Color {

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

    toFloat()  {
        return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    toCSS()  {
        return 'rgb(' + [this.r, this.g, this.b, this.a].join(',') + ')';
    }

}

export class Vector {

    static XN = new Vector(-1.0, 0.0, 0.0);
    static XP = new Vector(1.0, 0.0, 0.0);
    static YN = new Vector(0.0, -1.0, 0.0);
    static YP = new Vector(0.0, 1.0, 0.0);
    static ZN = new Vector(0.0, 0.0, -1.0);
    static ZP = new Vector(0.0, 0.0, 1.0);
    static ZERO = new Vector(0.0, 0.0, 0.0);

    constructor(x, y, z) {
        if(x instanceof Vector) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            return;
        } else if(typeof x == 'object') {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
            return;
        }
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }

    copyFrom(vec) {
        this.x = vec.x;
        this.y = vec.y;
        this.z = vec.z;
        return this;
    }

    equal(vec) {
        return this.x === vec.x && this.y === vec.y && this.z === vec.z;
    }

    lerpFrom(vec1, vec2, delta) {
        this.x = vec1.x * (1.0 - delta) + vec2.x * delta;
        this.y = vec1.y * (1.0 - delta) + vec2.y * delta;
        this.z = vec1.z * (1.0 - delta) + vec2.z * delta;
    }

    add(vec) {
        return new Vector(this.x + vec.x, this.y + vec.y, this.z + vec.z);
    }

    sub(vec) {
        return new Vector(this.x - vec.x, this.y - vec.y, this.z - vec.z);
    }

    mul(vec) {
        return new Vector(this.x * vec.x, this.y * vec.y, this.z * vec.z);
    }

    div(vec) {
        return new Vector(this.x / vec.x, this.y / vec.y, this.z / vec.z);
    }

    zero() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        return this;
    }

    swapYZ() {
        return new Vector(this.x, this.z, this.y);
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    distance(vec) {
        return this.sub(vec).length();
    }

    //
    horizontalDistance(vec) {
        let vec1 = new Vector(this.x, 0, this.z);
        let vec2 = new Vector(vec.x, 0, vec.z);
        return vec1.sub(vec2).length();
    }

    normal() {
        if(this.x == 0 && this.y == 0 && this.z == 0) return new Vector(0, 0, 0);
        let l = this.length();
        return new Vector(this.x / l, this.y / l, this.z / l);
    }

    dot(vec) {
        return this.x * vec.x + this.y * vec.y + this.z * vec.z;
    }

    round() {
        return new Vector(
            Math.round(this.x),
            Math.round(this.y),
            Math.round(this.z)
        );
    }

    toInt() {
        return new Vector(
            this.x | 0,
            this.y | 0,
            this.z | 0
        );
    }

    clone() {
        return new Vector(
            this.x,
            this.y,
            this.z
        );
    }

    toArray() {
        return [this.x, this.y, this.z];
    }

    toString() {
        return '(' + this.x + ',' + this.y + ',' + this.z + ')';
    }

    toChunkKey() {
        return 'c_' + this.x + '_' + this.y + '_' + this.z;
    }

    toHash() {
        return this.x + ',' + this.y + ',' + this.z;
    }

    norm() {
        return this.length();
    }

    normalize() {
        return this.normal();
    }

    offset(x, y, z) {
        return this.add(new Vector(x, y, z));
    }

    floored() {
        return new Vector(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    translate(x, y, z) {
        this.x += x;
        this.y += y;
        this.z += z;
    }

    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    multiplyScalar(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }

    divScalar(scalar) {
        this.x /= scalar;
        this.y /= scalar;
        this.z /= scalar;
        return this;
    }

}

export class Vec3 extends Vector {}

export let MULTIPLY = {
    COLOR: {
        WHITE: new Color(816 / 1024, 1008 / 1024, 0, 0),
        GRASS: new Color(900 / 1024, 965 / 1024, 0, 0)
    }
};

export let QUAD_FLAGS = {}
    QUAD_FLAGS.NORMAL_UP = 1;
    QUAD_FLAGS.MASK_BIOME = 2;

export let ROTATE = {};
    ROTATE.S = CubeSym.ROT_Y2; // front
    ROTATE.W = CubeSym.ROT_Y; // left
    ROTATE.N = CubeSym.ID; // back
    ROTATE.E = CubeSym.ROT_Y3; // right


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

// Direction names
export let DIRECTION_NAME = {};
    DIRECTION_NAME.up        = DIRECTION.UP;
    DIRECTION_NAME.down      = DIRECTION.DOWN;
    DIRECTION_NAME.left      = DIRECTION.LEFT;
    DIRECTION_NAME.right     = DIRECTION.RIGHT;
    DIRECTION_NAME.forward   = DIRECTION.FORWARD;
    DIRECTION_NAME.back      = DIRECTION.BACK;

export class Helpers {

    static fetch;
    static fs;

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

    // getRandomInt...
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //Максимум не включается, минимум включается
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

    /* Canvas Donwload */
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
        callback({
            program
        });
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

}

// Make fetch functions
if(typeof fetch === 'undefined') {
    Helpers.fetch = async (url) => import(url);
    Helpers.fetchJSON = async (url) => import(url).then(response => response.default);
    Helpers.fetchBinary = async (url) => {
        let binary = fs.readFileSync(url);
        return binary.buffer;
    };
} else {
    Helpers.fetch = async (url) => fetch(url);
    Helpers.fetchJSON = async (url) => fetch(url).then(response => response.json());
    Helpers.fetchBinary = async (url) => fetch(url).then(response => response.arrayBuffer());
}

// SpiralGenerator ...
export class SpiralGenerator {

    static cache = {};
    static cache3D = {};

    // generate ...
    static generate(margin) {
        let size = margin * 2;
        if(SpiralGenerator.cache.hasOwnProperty(margin)) {
            return SpiralGenerator.cache[margin];
        }
        var resp = [];
        function rPush(vec) {
            // Если позиция на расстояние видимости (считаем честно, по кругу)
            let dist = Math.sqrt(Math.pow(vec.x - size / 2, 2) + Math.pow(vec.z - size / 2, 2));
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
        SpiralGenerator.cache[margin] = resp;
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
                            resp.push({pos: vec, dist: dist});
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
        this.history    = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    add(value) {
        this.prev = value;
        if(this.min === null || this.min > value) {
            this.min = value;
        }
        if(this.max === null || this.max < value) {
            this.max = value;
        }
        this.sum -= this.history.shift();
        this.sum += value;
        this.history.push(value);
        this.avg = (this.sum / this.history.length) || 0;
    }

}