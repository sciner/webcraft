"use strict";

/**
* Renderer
*
* This class contains the code that takes care of visualising the
* elements in the specified world.
**/

const CAMERA_DIST           = 10;
const FOV_CHANGE_SPEED      = 150;
const FOV_NORMAL            = 75;
const FOV_WIDE              = FOV_NORMAL * 1.15;
const MAX_DIST_FOR_SHIFT    = 800;
const RENDER_DISTANCE       = 800;

var settings = {
    fogColor:               [118 / 255, 194 / 255, 255 / 255, 1],
    fogUnderWaterColor:     [55 / 255, 100 / 255, 190 / 255, 1],
    fogAddColor:            [0, 0, 0, 0],
    fogUnderWaterAddColor:  [55 / 255, 100 / 255, 190 / 255, 0.75],
    fogDensity:             0.005,
    fogDensityUnderWater:   0.1
};

var currentRenderState = {
    fogColor:           [118 / 255, 194 / 255, 255 / 255, 1],
    fogDensity:         0.02,
    underWater:         false
};

// Creates a new renderer with the specified canvas as target.
function Renderer(world, renderSurfaceId, settings, initCallback) {

    var that                = this;
    that.canvas             = document.getElementById(renderSurfaceId);
	that.canvas.renderer    = that;
	this.skyBox             = null;
    this.videoCardInfoCache = null;
    
    // Create projection and view matrices
    that.projMatrix         = mat4.create();
    that.viewMatrix         = mat4.create();
    that.modelMatrix        = mat4.create(); // Create dummy model matrix
    mat4.identity(that.modelMatrix);

    this.setWorld(world);
	// Initialise WebGL
	var gl;
	try {
        gl = that.gl = that.canvas.getContext('webgl2', {antialias: false, depth: true, premultipliedAlpha: false});
        // gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
	} catch (e) {
		throw 'Your browser doesn\'t support WebGL!';
	}

	gl.viewportWidth        = that.canvas.width;
	gl.viewportHeight       = that.canvas.height;
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // PickAt
    this.pickAt             = new PickAt(this, gl);

	// Create main program
    createGLProgram(gl, './shaders/main/vertex.glsl', './shaders/main/fragment.glsl', function(info) {

        var program = that.program = info.program;

        gl.useProgram(program);

        // Store variable locations
        that.uProjMat           = gl.getUniformLocation(program, 'uProjMatrix');
        that.uModelMatrix       = gl.getUniformLocation(program, 'u_worldView');
        that.uModelMat          = gl.getUniformLocation(program, 'uModelMatrix');
        that.u_texture          = gl.getUniformLocation(program, 'u_texture');
        that.a_position         = gl.getAttribLocation(program, 'a_position');
        that.a_color            = gl.getAttribLocation(program, 'a_color');
        that.a_texcoord         = gl.getAttribLocation(program, 'a_texcoord');
        that.a_normal           = gl.getAttribLocation(program, 'a_normal');
        // fog
        that.u_fogColor         = gl.getUniformLocation(program, 'u_fogColor');
        that.u_fogDensity       = gl.getUniformLocation(program, 'u_fogDensity');
        that.u_fogAddColor      = gl.getUniformLocation(program, 'u_fogAddColor');
        that.u_fogOn            = gl.getUniformLocation(program, 'u_fogOn');
        //
        that.u_resolution       = gl.getUniformLocation(program, 'u_resolution');
        that.u_time             = gl.getUniformLocation(program, 'u_time');
        that.u_brightness       = gl.getUniformLocation(program, 'u_brightness');

        // Enable input
        gl.enableVertexAttribArray(that.a_position);
        gl.enableVertexAttribArray(that.a_texcoord);
        gl.enableVertexAttribArray(that.a_color);
        gl.enableVertexAttribArray(that.a_normal);
        that.setBrightness(that.world.saved_state.brightness ? that.world.saved_state.brightness : 1);
        // Create projection and view matrices
        gl.uniformMatrix4fv(that.uModelMat, false, that.modelMatrix);
        // Create 1px white texture for pure vertex color operations (e.g. picking)
        var whiteTexture        = that.texWhite = gl.createTexture();
        var white               = new Uint8Array([255, 255, 255, 255]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, whiteTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, white);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.uniform1i(that.u_texture, 0);
        // Load terrain texture
        var terrainTexture          = that.texTerrain = gl.createTexture();
        terrainTexture.image        = new Image();
        terrainTexture.image.onload = function() {
            // Раскрашивание текстуры
            Helpers.colorizeTerrainTexture(terrainTexture.image, function(file) {
                var image2 = new Image();
                image2.src = URL.createObjectURL(file);
                image2.onload = function(e) {
                    terrainTexture.image = image2;
                    gl.bindTexture(gl.TEXTURE_2D, terrainTexture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, terrainTexture.image);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                };
                image2.src = URL.createObjectURL(file);
            });
        };
        terrainTexture.image.src = settings.hd ? 'media/terrain_hd.png' : 'media/terrain.png';
        that.setPerspective(FOV_NORMAL, 0.01, RENDER_DISTANCE);
    });

    // SkyBox
    createGLProgram(gl, './shaders/skybox/vertex.glsl', './shaders/skybox/fragment.glsl', function(info) {
        const program = info.program;
        gl.useProgram(program);
        const vertexBuffer = gl.createBuffer();
        const indexBuffer = gl.createBuffer();
        const vertexData = [
            -1,-1, 1,
            1,-1, 1,
            1, 1, 1,
            -1, 1, 1,
            -1,-1,-1,
            1,-1,-1,
            1, 1,-1,
            -1, 1,-1
        ];
        const indexData = [
            0,1,2,2,3,0, 4,5,6,6,7,4,
            1,5,6,6,2,1, 0,4,7,7,3,0,
            3,2,6,6,7,3, 0,1,5,5,4,0
        ];
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indexData), gl.STATIC_DRAW);
        that.skyBox = {
            gl: gl,
            program: program,
            texture: gl.createTexture(),
            loaded: false,
            attribute: {
                vertex: gl.getAttribLocation(program, 'a_vertex')
            },
            uniform: {
                texture: gl.getUniformLocation(program, 'u_texture'),
                lookAtMatrix: gl.getUniformLocation(program, 'u_lookAtMatrix'),
                projectionMatrix: gl.getUniformLocation(program, 'u_projectionMatrix'),
                u_brightness_value: gl.getUniformLocation(program, 'u_brightness_value')
            },
            buffer: {
                vertex: vertexBuffer,
                index: indexBuffer
            },
            draw: function(_lookAtMatrix, _projectionMatrix) {
                if(!this.loaded) {
                    return;
                }
                _lookAtMatrix = new Float32Array(_lookAtMatrix)
                mat4.rotate(_lookAtMatrix, Math.PI / 2, [ 1, 0, 0 ], _lookAtMatrix);
                _lookAtMatrix[12] = 0;
                _lookAtMatrix[13] = 0;
                _lookAtMatrix[14] = 0;
                this.gl.useProgram(this.program);
                // brightness
                this.gl.uniform1f(this.uniform.u_brightness_value, that.brightness);
                // skybox
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer.vertex);
                this.gl.vertexAttribPointer(this.attribute.vertex, 3, this.gl.FLOAT, false, 0, 0);
                this.gl.enableVertexAttribArray(this.attribute.vertex);
                this.gl.uniform1i(this.uniform.texture, 0);
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
                this.gl.uniformMatrix4fv(this.uniform.lookAtMatrix, false, _lookAtMatrix);
                this.gl.uniformMatrix4fv(this.uniform.projectionMatrix, false, _projectionMatrix);
                this.gl.viewport(0,0, this.gl.canvas.width, this.gl.canvas.height);
                this.gl.disable(this.gl.CULL_FACE);
                this.gl.disable(this.gl.DEPTH_TEST);
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer.index);
                this.gl.drawElements(this.gl.TRIANGLES, 36, this.gl.UNSIGNED_BYTE, 0);
                this.gl.enable(this.gl.CULL_FACE);
                this.gl.enable(this.gl.DEPTH_TEST);
            }
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, that.skyBox.texture);
        const loadImageInTexture = (target, url) => {
            return new Promise((resolve, reject) => {
                const level             = 0;
                const internalFormat    = gl.RGBA;
                const width             = 1;
                const height            = 1;
                const format            = gl.RGBA;
                const type              = gl.UNSIGNED_BYTE;
                gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, new Uint8Array([255,255,255,255]));
                const image = new Image();
                image.addEventListener("load", () => {
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.texImage2D(target, level, internalFormat, format, type, image);
                    resolve();
                });
                image.addEventListener("error", () => {
                    reject(new Error(`Ошибка загрузки изображения '${url}'.`));
                });
                image.src = url;
            });
        }
        var skiybox_dir = './media/skybox/park';
        Promise.all([
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_X, skiybox_dir + '/posx.jpg'),
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, skiybox_dir + '/negx.jpg'),
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, skiybox_dir + '/posy.jpg'),
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, skiybox_dir + '/negy.jpg'),
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, skiybox_dir + '/posz.jpg'),
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, skiybox_dir + '/negz.jpg'),
        ]).then(() => {
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            that.skyBox.loaded = true;
        }).catch((error) => {
            throw new Error(error);
        });
    });

	// HUD
    createGLProgram(gl, './shaders/hud/vertex.glsl', './shaders/hud/fragment.glsl', function(info) {
		const program = info.program;
        // Build main HUD
        Game.hud = new HUD(0, 0);
        that.HUD = {
            gl: gl,
            tick: 0,
            program: program,
            texture: gl.createTexture(),
            bufRect: null,
            uniform: {
                texture:        gl.getUniformLocation(program, 'u_texture'),
                u_noDraw:       gl.getUniformLocation(program, 'u_noDraw'),
                u_noCrosshair:  gl.getUniformLocation(program, 'u_noCrosshair'),
                u_resolution:   gl.getUniformLocation(program, 'u_resolution')
            },
            attribute: {
                // v_attr_inx:     gl.getAttribLocation(program, 'inPos')
            },
            draw: function() {
                const gl = this.gl;
                gl.useProgram(this.program);
                Game.hud.draw();
                gl.uniform2f(this.uniform.u_resolution, gl.viewportWidth * window.devicePixelRatio, gl.viewportHeight * window.devicePixelRatio);
                gl.uniform1f(this.uniform.u_noCrosshair, Game.hud.wm.getVisibleWindows().length > 0);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
                if(this.tick++ % 2 == 0) {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, Game.hud.canvas);
                }
                if(!this.vertexBuffer) {
                    this.vertexBuffer = gl.createBuffer();
                    this.indexBuffer = gl.createBuffer();
                    const vertexData = [
                        -1, -1,
                         1, -1,
                         1,  1,
                        -1,  1
                    ];
                    const indexData = [
                        0, 1, 2,
                        1, 2, 3
                    ];
                    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
                    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);
                    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indexData), gl.STATIC_DRAW);
                }
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
                var v_attr_inx = this.attribute.v_attr_inx;
                gl.vertexAttribPointer(v_attr_inx, 2, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(v_attr_inx);
                gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
                gl.disableVertexAttribArray(v_attr_inx);
            }
        }
        // Create HUD texture
        var texture = that.HUD.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        initCallback();
	});

}

// Makes the renderer start tracking a new world and set up the chunk structure.
// world - The world object to operate on.
// chunkSize - X, Y and Z dimensions of each chunk, doesn't have to fit exactly inside the world.
Renderer.prototype.setWorld = function(world) {
    this.world = world;
    world.renderer = this;
}

// setBrightness...
Renderer.prototype.setBrightness = function(value) {
    this.brightness = value;
    var mult = Math.min(1, value * 2)
    currentRenderState.fogColor = [
        settings.fogColor[0] * (value * mult),
        settings.fogColor[1] * (value * mult),
        settings.fogColor[2] * (value * mult),
        settings.fogColor[3]
    ]
}

// toggleNight...
Renderer.prototype.toggleNight = function() {
    if(this.brightness == 1) {
        this.setBrightness(.15);
    } else {
        this.setBrightness(1);
    }
}

// Render one frame of the world to the canvas.
Renderer.prototype.draw = function(delta) {

    var that = this;
	var gl = this.gl;

    // console.log(Game.world.renderer.camPos[2]);
    //if(Game.world.localPlayer.pos.z + 1.7 < 63.8) {
    //    currentRenderState.fogDensity   = settings.fogDensityUnderWater;
    //    currentRenderState.fogColor     = settings.fogUnderWaterColor;
    //    currentRenderState.fogAddColor  = settings.fogUnderWaterAddColor;
    //} else {
    currentRenderState.fogDensity   = settings.fogDensity;
    // currentRenderState.fogColor     = settings.fogColor;
    currentRenderState.fogAddColor  = settings.fogAddColor;
    //}

	// Initialise view
    gl.useProgram(this.program);
	this.updateViewport();

    // Говорим WebGL, как преобразовать координаты
    // из пространства отсечения в пиксели
    // gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(...currentRenderState.fogColor);
    gl.uniform4fv(this.u_fogColor, currentRenderState.fogColor);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 1. Draw skybox
	if( that.skyBox) {
        that.skyBox.draw(this.viewMatrix, this.projMatrix);
    }

    // 2. Draw level chunks
    gl.useProgram(this.program);
    // setCamera
    gl.uniformMatrix4fv(this.uModelMatrix, false, this.viewMatrix);
    // setPerspective
    mat4.perspective(this.fov, gl.viewportWidth / gl.viewportHeight, this.min, this.max, this.projMatrix);
    gl.uniformMatrix4fv(this.uProjMat, false, this.projMatrix);
    // Picking
    this.pickAt.draw();
    // set the fog color and near, far settings
    // fog1
    gl.uniform1f(this.u_fogDensity, currentRenderState.fogDensity);
    gl.uniform4fv(this.u_fogAddColor, currentRenderState.fogAddColor);
    gl.uniform1f(this.u_fogOn, true);
    // resolution
    gl.uniform2f(this.u_resolution, gl.viewportWidth, gl.viewportHeight);
    gl.uniform1f(this.u_time, performance.now() / 1000);
    gl.uniform1f(this.u_brightness, this.brightness);
    gl.enable(gl.BLEND);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texTerrain);

    // Draw chunks
    this.world.chunkManager.draw(this);
    this.world.draw(this, delta, this.modelMatrix, this.uModelMat);

    // 3. Draw players
    this.drawPlayers();

    // 4. Draw HUD
    if(that.HUD) {
        that.HUD.draw();
    }

	gl.disable(gl.BLEND);

}

// drawPlayers
Renderer.prototype.drawPlayers = function() {
    var gl = this.gl;
    gl.useProgram(this.program);
    for(const [id, player] of Object.entries(this.world.players)) {
        if(player.id != this.world.server.id) {
            player.draw(this, this.modelMatrix, this.uModelMat, this.camPos);
        }
    }
    // Restore Matrix
    mat4.identity(this.modelMatrix);
    gl.uniformMatrix4fv(this.uModelMat, false, this.modelMatrix);
}

/**
* Check if the viewport is still the same size and update
* the render configuration if required.
*/
Renderer.prototype.updateViewport = function() {
	var gl = this.gl;
	var canvas = this.canvas;
	if (canvas.clientWidth != gl.viewportWidth || canvas.clientHeight != gl.viewportHeight) {
		gl.viewportWidth  = canvas.clientWidth;
		gl.viewportHeight = canvas.clientHeight;
		canvas.width      = window.innerWidth * window.devicePixelRatio;
		canvas.height     = window.innerHeight * window.devicePixelRatio;
		// Update perspective projection based on new w/h ratio
		this.setPerspective(this.fov, this.min, this.max);
	}
}

// refresh...
Renderer.prototype.refresh = function() {
    this.world.chunkManager.refresh();
}

// Sets the properties of the perspective projection.
Renderer.prototype.setPerspective = function(fov, min, max) {
	this.fov = fov;
	this.min = min;
	this.max = max;
}

// Moves the camera to the specified orientation.
//
// pos - Position in world coordinates.
// ang - Pitch, yaw and roll.
Renderer.prototype.setCamera = function(pos, ang) {
    var z_add = Math.cos(this.world.localPlayer.walking_frame * (15 * (this.world.localPlayer.running ? 1.5 : 1))) * .025;
    if(this.world.localPlayer.walking) {
        // ang[1] += Math.cos(this.world.localPlayer.walking_frame * 15) * 0.0025;
    }
	this.camPos = pos;
	mat4.identity(this.viewMatrix);
	mat4.rotate(this.viewMatrix, -ang[0] - Math.PI / 2, [ 1, 0, 0 ], this.viewMatrix);
	mat4.rotate(this.viewMatrix, ang[1], [ 0, 0, 1 ], this.viewMatrix);
	mat4.rotate(this.viewMatrix, -ang[2], [ 0, 1, 0 ], this.viewMatrix);
    mat4.translate(this.viewMatrix, [-pos[0] + Game.shift.x, -pos[1] + Game.shift.y, -pos[2] + z_add], this.viewMatrix);
}

// drawBuffer...
Renderer.prototype.drawBuffer = function(buffer) {
	var gl = this.gl;
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(this.a_position, 3, gl.FLOAT, false, 12 * 4, 0);
	gl.vertexAttribPointer(this.a_color,    4, gl.FLOAT, false, 12 * 4, 5 * 4);
    gl.vertexAttribPointer(this.a_texcoord, 2, gl.FLOAT, false, 12 * 4, 3 * 4);
	gl.vertexAttribPointer(this.a_normal,   3, gl.FLOAT, false, 12 * 4, 9 * 4);
    // gl.drawArrays(gl.LINES, 0, buffer.vertices);
    gl.drawArrays(gl.TRIANGLES, 0, buffer.vertices);
}

// getVideoCardInfo...
Renderer.prototype.getVideoCardInfo = function() {
    if(this.videoCardInfoCache) {
        return this.videoCardInfoCache;
    }
    var gl = this.gl; // document.createElement('canvas').getContext('webgl');
    if (!gl) {
        return {
            error: 'no webgl',
        };
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    var resp = null;
    if(debugInfo) {
        resp = {
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
            renderer:  gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        };
    }
    resp = {
        error: 'no WEBGL_debug_renderer_info',
    };
    this.videoCardInfoCache = resp;
    return resp;
}