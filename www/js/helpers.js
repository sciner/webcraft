// ==========================================
// Helpers
//
// This file contains helper classes and functions.
// ==========================================

class Helpers {

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
        var arr = new Uint8Array(len / 2);
        window.crypto.getRandomValues(arr);
        return Array.from(arr, Helpers.byteToHex).join('');
    }

    static distance(p, q) {
        var dx   = p.x - q.x;
        var dy   = p.y - q.y;
        var dz   = p.z - q.z;         
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz); 
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
        return loc.indexOf('madcraft.io') < 0;
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

    /* Canvas Donwload */
    static downloadBlobPNG(blob, filename) {
        /// create an "off-screen" anchor tag
        var lnk = document.createElement('a'), e;
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

    static deg2rad(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    static rad2deg(radians) {
        return radians * 180 / Math.PI;
    }
    
    static loadJSON(url, callback) {
        loadText(url, function(text) {
            callback(JSON.parse(text));
        });
    }
    
    static saveJSON(data, filename) {
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

    // createGLProgram...
    static createGLProgram(gl, vertex, fragment, callback) {
        function loadTextFile(url) {
            return fetch(url).then(response => response.text());
        };
        async function loadShaders() {
            const files = await Promise.all([vertex, fragment].map(loadTextFile));
            var program = gl.createProgram();
            // Compile vertex shader
            var vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, files[0]);
            gl.compileShader(vertexShader);
            gl.attachShader(program, vertexShader);
            gl.deleteShader(vertexShader);
            if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw "Could not compile vertex shader!\n" + gl.getShaderInfoLog(vertexShader);
            }
            // Compile fragment shader
            var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, files[1]);
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
            gl.useProgram(program);
            callback({
                program: program
            });
        }
        loadShaders();
    }

    // lineRectCollide( line, rect )
    //
    // Checks if an axis-aligned line and a bounding box overlap.
    // line = { y, x1, x2 } or line = { x, y1, y2 }
    // rect = { x, y, size }
    static lineRectCollide(line, rect) {
        if(line.z != null) {
            return  rect.z > line.z - rect.size / 2 &&
                    rect.z < line.z + rect.size / 2 &&
                    rect.x > line.x1 - rect.size / 2 &&
                    rect.x < line.x2 + rect.size / 2;
        }
        return  rect.x > line.x - rect.size / 2 &&
                rect.x < line.x + rect.size / 2 &&
                rect.z > line.z1 - rect.size / 2 &&
                rect.z < line.z2 + rect.size / 2;
    }

    // rectRectCollide( r1, r2 )
    //
    // Checks if two rectangles (x1, y1, x2, y2) overlap.
    static rectRectCollide(r1, r2) {
        if(r2.x1 > r1.x1 && r2.x1 < r1.x2 && r2.z1 > r1.z1 && r2.z1 < r1.z2 ) return true;
        if(r2.x2 > r1.x1 && r2.x2 < r1.x2 && r2.z1 > r1.z1 && r2.z1 < r1.z2 ) return true;
        if(r2.x2 > r1.x1 && r2.x2 < r1.x2 && r2.z2 > r1.z1 && r2.z2 < r1.z2 ) return true;
        if(r2.x1 > r1.x1 && r2.x1 < r1.x2 && r2.z2 > r1.z1 && r2.z2 < r1.z2 ) return true;
        return false;
    }

}

function Color(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
}

Color.prototype.add = function(color) {
    this.r += color.r;
    this.g += color.g;
    this.b += color.b;
    this.a += color.a;
    return this;
}

Color.prototype.divide = function(color) {
    this.r /= color.r;
    this.g /= color.g;
    this.b /= color.b;
    this.a /= color.a;
    return this;
}

Color.prototype.toFloat = function()  {
    return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
}

class MyArray extends Array {
    sortBy(...args) {
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
    xobj.onreadystatechange = function() {
        if (xobj.readyState == 4 && xobj.status == '200') {
            // Required use of an anonymous callback as .open will NOT return a value but simply returns undefined in asynchronous mode
            callback(xobj.responseText);
        }
    };
    xobj.send(null);  
}

function Vector(x, y, z) {
    if(x instanceof Vector) {
        this.x = x.x;
        this.y = x.y;
        this.z = x.z;
        return;
    }
	this.x = x || 0;
	this.y = y || 0;
	this.z = z || 0;
}

Vector.prototype.add = function(vec) {
	return new Vector( this.x + vec.x, this.y + vec.y, this.z + vec.z );
}

Vector.prototype.sub = function(vec) {
	return new Vector( this.x - vec.x, this.y - vec.y, this.z - vec.z );
}

Vector.prototype.mul = function(n) {
	return new Vector( this.x*n, this.y*n, this.z*n );
}

Vector.prototype.length = function() {
	return Math.sqrt( this.x*this.x + this.y*this.y + this.z*this.z );
}

Vector.prototype.distance = function(vec) {
	return this.sub( vec ).length();
}

Vector.prototype.normal = function() {
	if(this.x == 0 && this.y == 0 && this.z == 0 ) return new Vector( 0, 0, 0 );
	var l = this.length();
	return new Vector( this.x/l, this.y/l, this.z/l );
}

Vector.prototype.dot = function(vec) {
	return this.x * vec.x + this.y * vec.y + this.z * vec.z;
}

Vector.prototype.toArray = function() {
	return [ this.x, this.y, this.z ];
}

Vector.prototype.toString = function() {
	return '(' + this.x + ',' + this.y + ',' + this.z + ')';
}

// Export to node.js
if(typeof(exports) != 'undefined') {
	exports.Vector = Vector;
}