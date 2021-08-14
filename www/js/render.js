"use strict";

import PickAt from "./pickat.js";
import HUD from "./hud.js";
import {Helpers} from "./helpers.js";
import {CHUNK_SIZE_X} from "./blocks.js";
import rendererProvider from "./renders/rendererProvider.js";

/**
* Renderer
*
* This class contains the code that takes care of visualising the
* elements in the specified world.
**/
const BACKEND               = 'webgl';
const ZOOM_FACTOR           = 0.25;
const FOV_CHANGE_SPEED      = 150;
const FOV_NORMAL            = 75;
const FOV_WIDE              = FOV_NORMAL * 1.15;
const FOV_ZOOM              = FOV_NORMAL * ZOOM_FACTOR;
const RENDER_DISTANCE       = 800;

let settings = {
    fogColor:               [118 / 255, 194 / 255, 255 / 255, 1],
    // fogColor:               [185 / 255, 210 / 255, 254 / 255, 1],
    fogUnderWaterColor:     [55 / 255, 100 / 255, 190 / 255, 1],
    fogAddColor:            [0, 0, 0, 0],
    fogUnderWaterAddColor:  [55 / 255, 100 / 255, 190 / 255, 0.75],
    fogDensity:             2.52 / 320, // 170, //  0.015 = 168, 0.03 = 84
    fogDensityUnderWater:   0.1
};

let currentRenderState = {
    // fogColor:           [185 / 255, 210 / 255, 254 / 255, 1],
    fogColor:           [118 / 255, 194 / 255, 255 / 255, 1],
    fogDensity:         0.02,
    underWater:         false
};

// Creates a new renderer with the specified canvas as target.
export default class Renderer {
    constructor(renderSurfaceId) {
        this.canvas             = document.getElementById(renderSurfaceId);
        this.canvas.renderer    = this;
        this.renderBackend = rendererProvider.getRenderer(
            this.canvas,
            BACKEND, {
                antialias: false,
                depth: true,
                premultipliedAlpha: false
            });
    }
    async init(world, settings, resources) {
        return new Promise(res => {
            this._init(world, settings, resources, res);
        })
    }

    get gl() {
        return this.renderBackend.gl;
    }

    async genTerrain(image) {
        this.terrainTexSize = image.width;
        this.terrainBlockSize = image.width / 512 * 16;

        if (!this.useAnisotropy) {
            if (image instanceof  self.ImageBitmap) {
                return  image;
            }
            return await self.createImageBitmap(image);
        }

        const canvas2d = document.createElement('canvas');
        const context = canvas2d.getContext('2d');
        const w = image.width;
        canvas2d.width = w * 2;
        canvas2d.height = w * 2;

        let offset = 0;

        context.drawImage(image, 0, 0);

        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, offset, 0, w * 2 / dd, w, nextOffset, 0, w / dd, w);
            offset = nextOffset;
        }
        offset = 0;
        for (let dd = 2; dd <= 16; dd *= 2) {
            const nextOffset = offset + w * 2 / dd;
            context.drawImage(canvas2d, 0, offset, w * 2, w * 2 / dd, 0, nextOffset, w * 2, w / dd);
            offset = nextOffset;
        }
        // canvas2d.width = 0;
        // canvas2d.height = 0;
        //return await self.createImageBitmap(canvas2d);
        return canvas2d;
    }

    async genColorTexture(clr) {
        const canvas2d = document.createElement('canvas');
        canvas2d.width = canvas2d.height = 16;

        const context = canvas2d.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, 16, 16);

        return canvas2d;
    }

    // todo
    //  GO TO PROMISE
    async _init(world, settings, resources, callback) {
        this.resources          = resources;
        this.skyBox             = null;
        this.videoCardInfoCache = null;
        this.options         = {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, ZOOM_FACTOR, FOV_CHANGE_SPEED, RENDER_DISTANCE};

        // Create projection and view matrices
        mat4.identity(this.modelMatrix);

        this.setWorld(world);

        const {renderBackend} = this;

        await renderBackend.init();

        this.shader = renderBackend.createShader({ code: resources.codeMain});

        this.materials = {
            regular: renderBackend.createMaterial({ cullFace: true, opaque: true}),
            doubleface: renderBackend.createMaterial({ cullFace: false, opaque: true}),
            transparent: renderBackend.createMaterial({ cullFace: true, opaque: false}),
        }

        this.projMatrix = this.shader.projMatrix;
        this.viewMatrix = this.shader.viewMatrix;
        this.modelMatrix = this.shader.modelMatrix;

        // Initialise WebGL
        // const gl = this.renderBackend.gl;

        this.viewportWidth        = this.canvas.width;
        this.viewportHeight       = this.canvas.height;
        renderBackend.resize(this.viewportWidth, this.viewportHeight);

        if (renderBackend.gl) {
            // PickAt
            this.pickAt             = new PickAt(this, renderBackend.gl);
        }

        this.useAnisotropy = settings.mipmap;
        this.terrainTexSize = 1;
        this.terrainBlockSize = 1;

        this.texture = renderBackend.createTexture(await this.genTerrain(resources.terrain.image));

        this.whiteTexture = renderBackend.createTexture(await this.genColorTexture('white'));

        this.setPerspective(FOV_NORMAL, 0.01, RENDER_DISTANCE);

        if (renderBackend.gl) {
            // SkyBox
            this.initSky();
        }

        // HUD
        // Build main HUD
        Game.hud = new HUD(0, 0);
        this.HUD = {
            tick: 0,
            bufRect: null,
            draw: function() {
                Game.hud.draw();
            }
        }

        callback();
    }

    initSky() {
        const { resources } = this;
        const { gl } = this.renderBackend;
        const that = this;

        Helpers.createGLProgram(gl, resources.codeSky, (info) => {
            const program = info.program;
            gl.useProgram(program);
            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            const vertexBuffer = gl.createBuffer();
            const indexBuffer = gl.createBuffer();
            const vertexData = [
                -1, -1, 1,
                1, -1, 1,
                1, 1, 1,
                -1, 1, 1,
                -1, -1, -1,
                1, -1, -1,
                1, 1, -1,
                -1, 1, -1
            ];
            const indexData = [
                0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4,
                1, 5, 6, 6, 2, 1, 0, 4, 7, 7, 3, 0,
                3, 2, 6, 6, 7, 3, 0, 1, 5, 5, 4, 0
            ];
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indexData), gl.STATIC_DRAW);

            const attribVertex = gl.getAttribLocation(program, 'a_vertex');
            gl.vertexAttribPointer(attribVertex, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(attribVertex);

            this.skyBox = {
                program: program,
                texture: gl.createTexture(),
                loaded: false,
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
                draw: function (_lookAtMatrix, _projectionMatrix) {
                    if (!this.loaded) {
                        return;
                    }
                    _lookAtMatrix = new Float32Array(_lookAtMatrix)
                    mat4.rotate(_lookAtMatrix, Math.PI / 2, [1, 0, 0], _lookAtMatrix);
                    _lookAtMatrix[12] = 0;
                    _lookAtMatrix[13] = 0;
                    _lookAtMatrix[14] = 0;
                    gl.useProgram(this.program);
                    gl.bindVertexArray(vao);
                    // brightness
                    gl.uniform1f(this.uniform.u_brightness_value, that.brightness);
                    // skybox
                    gl.uniform1i(this.uniform.texture, 0);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);
                    gl.uniformMatrix4fv(this.uniform.lookAtMatrix, false, _lookAtMatrix);
                    gl.uniformMatrix4fv(this.uniform.projectionMatrix, false, _projectionMatrix);
                    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                    gl.disable(gl.CULL_FACE);
                    gl.disable(gl.DEPTH_TEST);
                    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_BYTE, 0);
                    gl.enable(gl.CULL_FACE);
                    gl.enable(gl.DEPTH_TEST);
                }
            }
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, that.skyBox.texture);
            const loadImageInTexture = (target, image) => {
                const level = 0;
                const internalFormat = gl.RGBA;
                const width = 1;
                const height = 1;
                const format = gl.RGBA;
                const type = gl.UNSIGNED_BYTE;
                gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, new Uint8Array([255, 255, 255, 255]));
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(target, level, internalFormat, format, type, image);
            }

            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_X, resources.sky.posx);
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, resources.sky.negx);
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, resources.sky.posy);
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, resources.sky.negy);
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, resources.sky.posz);
            loadImageInTexture(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, resources.sky.negz);

            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
            this.skyBox.loaded = true;
        });
    }

    // Makes the renderer start tracking a new world and set up the chunk structure.
    // world - The world object to operate on.
    // chunkSize - X, Y and Z dimensions of each chunk, doesn't have to fit exactly inside the world.
    setWorld(world) {
        this.world = world;
        world.renderer = this;
    }

    // setBrightness...
    setBrightness(value) {
        this.brightness = value;
        let mult = Math.min(1, value * 2)
        currentRenderState.fogColor = [
            settings.fogColor[0] * (value * mult),
            settings.fogColor[1] * (value * mult),
            settings.fogColor[2] * (value * mult),
            settings.fogColor[3]
        ]
    }

    // toggleNight...
    toggleNight() {
        if(this.brightness == 1) {
            this.setBrightness(.15);
        } else {
            this.setBrightness(1);
        }
    }

    // Render one frame of the world to the canvas.
    draw(delta) {

        let that = this;
        let gl = this.gl;

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
        gl.uniform1f(this.u_blockSize, this.terrainBlockSize / this.terrainTexSize);
        gl.uniform1f(this.u_pixelSize, 1.0 / this.terrainTexSize);

        this.updateViewport();

        // Говорим WebGL, как преобразовать координаты
        // из пространства отсечения в пиксели
        // gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(...currentRenderState.fogColor);
        gl.uniform4fv(this.u_fogColor, currentRenderState.fogColor);
        gl.uniform1f(this.u_chunkBlockDist, this.world.chunkManager.CHUNK_RENDER_DIST * CHUNK_SIZE_X - CHUNK_SIZE_X * 2);
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
        gl.uniform1f(this.u_mipmap, this.useAnisotropy ? 4.0 : 0.0);
        // resolution
        gl.uniform1f(this.u_brightness, this.brightness);

        gl.enable(gl.BLEND);

        // Draw chunks
        this.world.chunkManager.draw(this);
        this.world.draw(this, delta, this.modelMatrix, this.uModelMat);

        // 3. Draw players
        gl.uniform1f(this.u_mipmap, 0.0);
        gl.disable(gl.CULL_FACE);
        this.drawPlayers(delta);
        gl.enable(gl.CULL_FACE);

        gl.disable(gl.BLEND);

        // 4. Draw HUD
        if(that.HUD) {
            that.HUD.draw();
        }
    }

    // drawPlayers
    drawPlayers(delta) {
        let gl = this.gl;
        gl.useProgram(this.program);
        for(let id of Object.keys(this.world.players)) {
            let player = this.world.players[id];
            if(player.id != this.world.server.id) {
                player.draw(this, this.modelMatrix, this.uModelMat, this.camPos, delta);
            }
        }
        // Restore Matrix
        mat4.identity(this.modelMatrix);
        gl.uniformMatrix4fv(this.uModelMat, false, this.modelMatrix);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.texTerrain);
    }

    /**
    * Check if the viewport is still the same size and update
    * the render configuration if required.
    */
    updateViewport() {
        let gl = this.gl;
        let canvas = this.canvas;
        if (canvas.clientWidth != this.viewportWidth || canvas.clientHeight != this.viewportHeight) {
            this.renderBackend.resize(canvas.clientWidth, canvas.clientHeight);
            this.renderBackend._configure();
            canvas.width      = window.innerWidth * window.devicePixelRatio;
            canvas.height     = window.innerHeight * window.devicePixelRatio;
            // Update perspective projection based on new w/h ratio
            this.setPerspective(this.fov, this.min, this.max);
        }
    }

    // refresh...
    refresh() {
        this.world.chunkManager.refresh();
    }

    // Sets the properties of the perspective projection.
    setPerspective(fov, min, max) {
        this.fov = fov;
        this.min = min;
        this.max = max;
    }

    // Moves the camera to the specified orientation.
    //
    // pos - Position in world coordinates.
    // ang - Pitch, yaw and roll.
    setCamera(pos, ang) {
        let y_add = Math.cos(this.world.localPlayer.walking_frame * (15 * (this.world.localPlayer.running ? 1.5 : 1))) * .025;
        this.camPos = pos;
        mat4.identity(this.viewMatrix);
        mat4.rotate(this.viewMatrix, -ang[0] - Math.PI / 2, [ 1, 0, 0 ], this.viewMatrix);
        mat4.rotate(this.viewMatrix, ang[1], [ 0, 1, 0 ], this.viewMatrix);
        mat4.rotate(this.viewMatrix, ang[2], [ 0, 0, 1 ], this.viewMatrix);
        mat4.translate(this.viewMatrix, [
            -pos[0] + Game.shift.x,
            -pos[2] + Game.shift.z,
            -pos[1] + y_add
        ], this.viewMatrix);
    }

    // drawBuffer...
    drawBuffer(buffer, a_pos) {
        if (buffer.size === 0) {
            return;
        }
        buffer.bind(this);
        let gl = this.gl;
        gl.uniform3fv(this.u_add_pos, [a_pos.x, a_pos.y, a_pos.z]);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffer.size);
    }

    // getVideoCardInfo...
    getVideoCardInfo() {
        if(this.videoCardInfoCache) {
            return this.videoCardInfoCache;
        }
        let gl = this.gl;
        if (!gl) {
            return {
                error: 'no webgl',
            };
        }
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        let resp = null;
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

}
