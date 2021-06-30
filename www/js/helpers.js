// ==========================================
// Helpers
//
// This file contains helper classes and functions.
// ==========================================

class Helpers {

    // str byteToHex(uint8 byte)
    // converts a single byte to a hex string 
    static byteToHex(byte) {
        return ('0' + byte.toString(16)).slice(-2);
    }

    // str generateId(int len);
    // len - must be an even number (default: 32)
    static generateID() {
        const len = 32;
        var arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, Helpers.byteToHex).join('');
    }

    static distance(p, q) {
        var dx   = p.x - q.x;         
        var dy   = p.y - q.y;         
        var dist = Math.sqrt(dx * dx + dy * dy); 
        return dist;
    }

    // getRandomInt...
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //Максимум не включается, минимум включается
    }

    static isDev() {
        var loc = location.host;
        return loc.indexOf('whiteframe.ru') < 0;
    }

    static createSkinLayer2(text, image, callback) {
        var canvas          = document.createElement('canvas');
        canvas.width        = 64;
        canvas.height       = 64;
        var ctx             = canvas.getContext('2d');
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
        canvas.toBlob(function(blob) {
            var filefromblob = new File([blob], 'image.png', {type: 'image/png'});
            callback(filefromblob);
        }, 'image/png');
    }

    // Раскрашивание текстуры
    static colorizeTerrainTexture(image, callback) {
        // Высчитываем ширину и высоту одного блока
        const block_sz      = image.width / 32;
        //
        var canvas_temp     = document.createElement('canvas');
        canvas_temp.width   = block_sz;
        canvas_temp.height  = block_sz;
        // 
        var canvas          = document.createElement('canvas');
        canvas.width        = image.width;
        canvas.height       = image.height;
        var ctx             = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        //
        ctx.globalCompositeOperation = 'multiply';
        // Блок травы (grass block)
        ctx.fillStyle = '#80a755ff';
        ctx.fillRect(0, 0, block_sz, block_sz);
        // Шапка травы
        /*
            // img, sx, sy, swidth, sheight, x, y, width, height
            ctx.fillRect(block_sz * 3, 0, block_sz, block_sz);
            canvas_temp.save();
            // копирование земли во временный
            canvas_temp.drawImage(ctx, block_sz * 2, 0, block_sz, block_sz, 0, 0, block_sz, block_sz);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillRect(block_sz * 3, 0, block_sz, block_sz);
            canvas_temp.restore();
        */
        var imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var pix = imgd.data;
        for(var x = block_sz * 8; x < block_sz * 8 + block_sz; x++) {
            for(var y = block_sz * 2; y < block_sz * 2 + block_sz; y++) {
                var i = (y * canvas.width + x) * 4;
                if(pix[i + 3] > 0) {
                    ctx.fillStyle = '#80a755ff'; // 'rgba(' + [r, g, b, (a / 255)].join(',') + ')';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        // ctx.fillRect(block_sz * 8, block_sz * 2, block_sz, block_sz);
        canvas.toBlob(function(blob) {
            var filefromblob = new File([blob], 'image.png', {type: 'image/png'});
            callback(filefromblob);
        }, 'image/png');
    }

    // IntersectRayBrick
    static IntersectRayBrick(ray, brick) {

        // check whether initial point is inside the parallelepiped
        if ((ray.start[0] >= brick.min_point[0]) &&
            (ray.start[0] <= brick.max_point[0]) &&
            (ray.start[1] >= brick.min_point[1]) &&
            (ray.start[1] <= brick.max_point[1]) &&
            (ray.start[2] >= brick.min_point[2]) &&
            (ray.start[2] <= brick.max_point[2])) {
            return true;
        }

        // ray parameter
        var t_near = Number.MIN_SAFE_INTEGER;
        var t_far = Number.MAX_SAFE_INTEGER;
        var t1, t2;

        // directions loop
        for (var i = 0; i < 3; i++) {
            if (Math.abs(ray.direction[i]) >= Number.EPSILON) {
                t1 = (brick.min_point[i] - ray.start[i]) / ray.direction[i];
                t2 = (brick.max_point[i] - ray.start[i]) / ray.direction[i];
                if (t1 > t2) t1 = [t2, t2 = t1][0];
                if (t1 > t_near) t_near = t1;
                if (t2 < t_far) t_far = t2;
                if (t_near > t_far) return false;
                if (t_far < 0.0) return false;
            } else {
                if (ray.start[i] < brick.min_point[i] || ray.start[i] > brick.max_point[i]) {
                    return false;
                }
            }
        }

        return (t_near <= t_far && t_far >=0);
    }

}

// ==========================================
// Vector class
// ==========================================\

function createGLProgram(gl, vertex, fragment, callback) {

    function loadTextFile(url) {
        return fetch(url).then(response => response.text());
    };

    async function loadShaders() {
        const files = await Promise.all([vertex, fragment].map(loadTextFile));
        
        /*
        var info = webglUtils.createProgramInfo(gl, files);
        callback(info);
        */

        var program = gl.createProgram();

        // Compile vertex shader
        var vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, files[0]);
        gl.compileShader(vertexShader);
        gl.attachShader(program, vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw "Could not compile vertex shader!\n" + gl.getShaderInfoLog(vertexShader);
        }

        // Compile fragment shader
        var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, files[1]);
        gl.compileShader(fragmentShader);
        gl.attachShader(program, fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw "Could not compile fragment shader!\n" + gl.getShaderInfoLog(fragmentShader);
        }

        // Finish program
        gl.linkProgram(program);

        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw 'Could not link the shader program!';
        }

        gl.useProgram(program);

        callback({
            program: program
        });

    }

    loadShaders();

}

function Color(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
}

Color.prototype.toFloat = function()  {
    return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
}

function color2Int(color) {
    return ((color.r & 0xFF) << 24) + ((color.g & 0xFF) << 16) + ((color.b & 0xFF) << 8) + (color.a);
}

function color2Float(color) {
    var i = color2Int(color);
    return i / 4294967295;
}

function float2Color(num) {
    num = parseInt(num * 4294967295);
    num >>>= 0;
    var a = num & 0xFF,
        b = (num & 0xFF00) >>> 8,
        g = (num & 0xFF0000) >>> 16,
        r = ((num & 0xFF000000) >>> 24 );
        
    return new Color(r, g, b, a);
}

function deg2rad(degrees) {
    return degrees * (Math.PI / 180);
}

function rad2deg(radians) {
    return radians * 180 / Math.PI;
}

// Angle in degree between two Vector
function getAngleDegree(origin, target) {
    var n = 270 - (Math.atan2(origin.y - target.y, origin.x - target.x)) * 180 / Math.PI;
    return n % 360;
}

class MyArray extends Array {
    sortBy(...args) {
        // return this.sort(dynamicSortMultiple(...args));
        return this.sort(function(obj1, obj2) {
            if(!Game.world || !Game.world.localPlayer) {
                return;
            }
            var playerPos = Game.world.localPlayer.pos;
            var dist1 = Math.sqrt(Math.pow(playerPos.x - obj1.coord.x, 2) + Math.pow(playerPos.y - obj1.coord.y, 2));
            var dist2 = Math.sqrt(Math.pow(playerPos.x - obj2.coord.x, 2) + Math.pow(playerPos.y - obj2.coord.y, 2));
            if(dist1 > dist2) {
                return 1;
            } else if(dist2 > dist1) {
                return -1;
            }
            return 0;
        });
    }
}

function loadText(url, callback) {   
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url, true); // Replace 'my_data' with the path to your file
    xobj.onreadystatechange = function () {
        if (xobj.readyState == 4 && xobj.status == '200') {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);  
}

function loadJSON(url, callback) {
    loadText(url, function(text) {
        callback(JSON.parse(text));
    });
}

function saveJSON(data, filename) {
    if(!data) {
        console.error('No data')
        return;
    }
    if(!filename) filename = 'console.json'

    if(typeof data === "object"){
        data = JSON.stringify(data); // , undefined, 4)
    }
    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

function Vector(x, y, z) {
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
}

Vector.prototype.add = function( vec ) {
	return new Vector( this.x + vec.x, this.y + vec.y, this.z + vec.z );
}

Vector.prototype.sub = function( vec ) {
	return new Vector( this.x - vec.x, this.y - vec.y, this.z - vec.z );
}

Vector.prototype.mul = function( n ) {
	return new Vector( this.x*n, this.y*n, this.z*n );
}

Vector.prototype.length = function() {
	return Math.sqrt( this.x*this.x + this.y*this.y + this.z*this.z );
}

Vector.prototype.distance = function( vec ) {
	return this.sub( vec ).length();
}

Vector.prototype.normal = function() {
	if(this.x == 0 && this.y == 0 && this.z == 0 ) return new Vector( 0, 0, 0 );
	var l = this.length();
	return new Vector( this.x/l, this.y/l, this.z/l );
}

Vector.prototype.dot = function( vec ) {
	return this.x * vec.x + this.y * vec.y + this.z * vec.z;
}

Vector.prototype.toArray = function() {
	return [ this.x, this.y, this.z ];
}

Vector.prototype.toString = function() {
	return '(' + this.x + ',' + this.y + ',' + this.z + ')';
}

// lineRectCollide( line, rect )
//
// Checks if an axis-aligned line and a bounding box overlap.
// line = { y, x1, x2 } or line = { x, y1, y2 }
// rect = { x, y, size }

function lineRectCollide( line, rect )
{
	if(line.y != null )
		return rect.y > line.y - rect.size/2 && rect.y < line.y + rect.size/2 && rect.x > line.x1 - rect.size/2 && rect.x < line.x2 + rect.size/2;
	else
		return rect.x > line.x - rect.size/2 && rect.x < line.x + rect.size/2 && rect.y > line.y1 - rect.size/2 && rect.y < line.y2 + rect.size/2;
}

// rectRectCollide( r1, r2 )
//
// Checks if two rectangles (x1, y1, x2, y2) overlap.

function rectRectCollide( r1, r2 )
{
	if(r2.x1 > r1.x1 && r2.x1 < r1.x2 && r2.y1 > r1.y1 && r2.y1 < r1.y2 ) return true;
	if(r2.x2 > r1.x1 && r2.x2 < r1.x2 && r2.y1 > r1.y1 && r2.y1 < r1.y2 ) return true;
	if(r2.x2 > r1.x1 && r2.x2 < r1.x2 && r2.y2 > r1.y1 && r2.y2 < r1.y2 ) return true;
	if(r2.x1 > r1.x1 && r2.x1 < r1.x2 && r2.y2 > r1.y1 && r2.y2 < r1.y2 ) return true;
	return false;
}

// Export to node.js
if(typeof( exports ) != "undefined" )
{
	exports.Vector = Vector;
}