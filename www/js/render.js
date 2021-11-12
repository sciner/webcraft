"use strict";

import { Vector } from "./helpers.js";
import {CHUNK_SIZE_X} from "./chunk.js";
import rendererProvider from "./renders/rendererProvider.js";
import {Mth, VectorCollector} from "./helpers.js";
import {Vox_Loader} from "./vox/loader.js";
import {Vox_Mesh} from "./vox/mesh.js";
import {FrustumProxy} from "./frustum.js";
import {Resources} from "./resources.js";
import { BLOCK } from "./blocks.js";
import Particles_Block_Destroy from "./particles/block_destroy.js";
import Particles_Raindrop from "./particles/raindrop.js";
import Particles_Sun from "./particles/sun.js";
import Particles_Clouds from "./particles/clouds.js";
import {MeshManager} from "./mesh_manager.js";

const {mat4} = glMatrix;

/**
* Renderer
*
* This class contains the code that takes care of visualising the
* elements in the specified world.
**/
export const ZOOM_FACTOR    = 0.25;
const BACKEND               = 'auto';
const FOV_CHANGE_SPEED      = 150;
const FOV_NORMAL            = 75;
const FOV_WIDE              = FOV_NORMAL * 1.15;
const FOV_ZOOM              = FOV_NORMAL * ZOOM_FACTOR;
const RENDER_DISTANCE       = 800;

let settings = {
    fogColor:               [118 / 255, 194 / 255, 255 / 255, 1], // [185 / 255, 210 / 255, 255 / 255, 1],
    fogUnderWaterColor:     [55 / 255, 100 / 255, 230 / 255, 1],
    fogAddColor:            [0, 0, 0, 0],
    fogUnderWaterAddColor:  [55 / 255, 100 / 255, 230 / 255, 0.45],
    fogDensity:             2.52 / 320,
    fogDensityUnderWater:   0.1
};

let currentRenderState = {
    fogColor:           [118 / 255, 194 / 255, 255 / 255, 1],
    fogDensity:         0.02,
    underWater:         false
};

// Creates a new renderer with the specified canvas as target.
export class Renderer {

    constructor(renderSurfaceId) {
        this.canvas             = document.getElementById(renderSurfaceId);
        this.canvas.renderer    = this;
        this.testLightOn        = false;
        this.sunDir             = [0.9593, 1.0293, 0.6293]; // [0.7, 1.0, 0.85];
        this.frustum            = new FrustumProxy();
        this.step_side          = 0;
        this.clouds             = null;
        this.rainTim            = null;
        this.renderBackend = rendererProvider.getRenderer(
            this.canvas,
            BACKEND, {
                antialias: false,
                depth: true,
                premultipliedAlpha: false
            });
        this.meshes = new MeshManager();
    }

    get gl() {
        return this.renderBackend.gl;
    }

    async init(world, settings) {
        return new Promise(resolve => {
            (async () => {
                await this._init(world, settings, resolve);
            })();
        })
    }

    // todo
    // GO TO PROMISE
    async _init(world, settings, callback) {

        this.setWorld(world);
        const {renderBackend} = this;
        await renderBackend.init();

        this.skyBox             = null;
        this.videoCardInfoCache = null;
        this.options            = {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, ZOOM_FACTOR, FOV_CHANGE_SPEED, RENDER_DISTANCE};

        this.brightness         = 1;
        this.viewportWidth      = this.canvas.width;
        this.viewportHeight     = this.canvas.height;
        renderBackend.resize(this.viewportWidth, this.viewportHeight);

        // Init shaders for all resource packs
        await BLOCK.resource_pack_manager.initShaders(renderBackend);
        await BLOCK.resource_pack_manager.initTextures(renderBackend, settings);

        // Make materials for all shaders
        for(let [_, rp] of BLOCK.resource_pack_manager.list) {
            rp.shader.materials = {
                regular: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader}),
                doubleface: renderBackend.createMaterial({ cullFace: false, opaque: true, shader: rp.shader}),
                transparent: renderBackend.createMaterial({ cullFace: true, opaque: false, shader: rp.shader}),
                doubleface_transparent: renderBackend.createMaterial({ cullFace: false, opaque: false, shader: rp.shader}),
                label: renderBackend.createMaterial({ cullFace: false, ignoreDepth: true, shader: rp.shader}),
            }
        }

        // Prepare default resource pack shader
        let rp                  = BLOCK.resource_pack_manager.get('default');
        this.shader             = rp.shader;

        // Create projection and view matrices
        this.projMatrix         = this.shader.projMatrix;
        this.viewMatrix         = this.shader.viewMatrix;
        this.camPos             = this.shader.camPos;

        this.setPerspective(FOV_NORMAL, 0.01, RENDER_DISTANCE);

        if (renderBackend) {
            // SkyBox
            this.initSky();
        }

        // HUD
        // Build main HUD
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
        return this.skyBox = this.renderBackend.createCubeMap({
            code: Resources.codeSky,
            uniforms: {
                u_brightness: 1.0,
                u_textureOn: true
            },
            sides: [
                Resources.sky.posx,
                Resources.sky.negx,
                Resources.sky.posy,
                Resources.sky.negy,
                Resources.sky.posz,
                Resources.sky.negz
            ]
        });
    }

    // Makes the renderer start tracking a new world and set up the chunk structure.
    // world - The world object to operate on.
    // chunkSize - X, Y and Z dimensions of each chunk, doesn't have to fit exactly inside the world.
    setWorld(world) {
        this.world = world;
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
        ];
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
        const { gl, shader, renderBackend } = this;
        renderBackend.stat.drawcalls = 0;
        renderBackend.stat.drawquads = 0;
        let player = Game.player;
        currentRenderState.fogDensity   = settings.fogDensity;
        currentRenderState.fogAddColor  = settings.fogAddColor;
        this.updateViewport();
        let fogColor = player.eyes_in_water ? settings.fogUnderWaterColor : currentRenderState.fogColor;
        renderBackend.beginFrame(fogColor);
        //
        const {
            width, height
        } = renderBackend.size;
        //
        if (renderBackend.gl) {
            mat4.perspectiveNO(this.projMatrix, this.fov * Math.PI/180.0, width / height, this.min, this.max);
        } else {
            mat4.perspectiveZO(this.projMatrix, this.fov * Math.PI/180.0, width / height, this.min, this.max);
        }
        // 1. Draw skybox
        if(this.skyBox) {
            if(this.skyBox.shader.uniforms) {
                this.skyBox.shader.uniforms.u_textureOn.value = this.brightness == 1 && !player.eyes_in_water;
                this.skyBox.shader.uniforms.u_brightness.value = this.brightness;
            }
            this.skyBox.draw(this.viewMatrix, this.projMatrix, width, height);
        }
        // Clouds
        if(!this.clouds) {
            let pos = new Vector(player.pos);
            pos.y = 128.1;
            this.clouds = this.createClouds(pos);
        }
        //
        this.world.chunkManager.rendered_chunks.vc = new VectorCollector();
        for(let transparent of [false, true]) {
            for(let [_, rp] of BLOCK.resource_pack_manager.list) {
                let shader                  = rp.shader;
                // In water
                if(player.eyes_in_water) {
                    shader.fogColor         = fogColor;
                    shader.chunkBlockDist   = 8;
                    shader.fogAddColor      = settings.fogUnderWaterAddColor;
                    shader.brightness       = this.brightness;
                } else {
                    shader.fogColor         = fogColor;
                    shader.chunkBlockDist   = this.world.chunkManager.CHUNK_RENDER_DIST * CHUNK_SIZE_X - CHUNK_SIZE_X * 2;
                    shader.fogAddColor      = currentRenderState.fogAddColor;
                    shader.brightness       = this.brightness;
                }
                //
                shader.projMatrix           = this.shader.projMatrix;
                shader.viewMatrix           = this.shader.viewMatrix;
                shader.camPos               = this.shader.camPos;
                shader.time                 = performance.now();
                shader.fogDensity           = currentRenderState.fogDensity;
                shader.resolution           = [width, height];
                shader.testLightOn          = this.testLightOn;
                shader.sunDir               = this.sunDir;
                // 2. Draw chunks
                this.world.chunkManager.draw(this, rp, transparent);
            }
            if(!transparent) {
                let shader = this.shader;
                // @todo Тут не должно быть этой проверки, но без нее зачастую падает, видимо текстура не успевает в какой-то момент прогрузиться
                if(shader.texture) {
                    shader.bind();
                    this.meshes.draw(this, delta);
                    // this.world.draw(this, delta);
                    player.pickAt.draw();
                    // 3. Draw players and rain
                    this.drawPlayers(delta);
                }
            }
        }

        this.world.chunkManager.rendered_chunks.fact = this.world.chunkManager.rendered_chunks.vc.size;
        // 4. Draw HUD
        if(this.HUD) {
            this.HUD.draw();
        }
        renderBackend.endFrame();
    }

    // destroyBlock
    destroyBlock(block, pos, small) {
        this.meshes.add(new Particles_Block_Destroy(this.gl, block, pos, small));
    }

    // rainDrop
    rainDrop(pos) {
        this.meshes.add(new Particles_Raindrop(this.gl, pos));
    }

    // createClouds
    createClouds(pos) {
        // @todo Переделать в связи с появлением TBlock
        return this.meshes.add(new Particles_Clouds(this.gl, pos));
    }

    // setRain
    setRain(value) {
        if(value) {
            if(!this.rainTim) {
                this.rainTim = setInterval(() => {
                    let pos = Game.player.pos;
                    this.rainDrop(new Vector(pos.x, pos.y + 20, pos.z));
                }, 25);
            }
        } else {
            if(this.rainTim) {
                clearInterval(this.rainTim);
                this.rainTim = null;
            }
        }
    }

    // drawPlayers
    drawPlayers(delta) {
        const {renderBackend, shader} = this;
        shader.bind();
        for(let [id, player] of this.world.players.list) {
            if(player.itsme && id != 'itsme') continue;
            if(player.id != this.world.server.id) {
                player.draw(this, this.camPos, delta);
            }
        }
    }

    /**
    * Check if the viewport is still the same size and update
    * the render configuration if required.
    */
    updateViewport() {
        let canvas = this.canvas;
        if (canvas.clientWidth !== this.viewportWidth ||
            canvas.clientHeight !== this.viewportHeight
        ) {
            // resize call _configure automatically but ONLY if dimension changed
            // _configure very slow!
            this.renderBackend.resize(
                window.innerWidth * self.devicePixelRatio | 0,
                window.innerHeight * self.devicePixelRatio | 0);
            this.viewportWidth = window.innerWidth | 0;
            this.viewportHeight = window.innerHeight | 0;
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
    // pos - Position in world coordinates.
    // ang - Pitch, yaw and roll.
    setCamera(player, pos, rotate) {
        // @todo Возможно тут надо поменять Z и Y местами
        let pitch           = rotate.x; // X
        let roll            = rotate.y; // Z
        let yaw             = rotate.z; // Y
        this.camPos.copyFrom(pos);
        mat4.identity(this.viewMatrix);
        // bobView
        this.bobView(player, this.viewMatrix);
        //
        mat4.rotate(this.viewMatrix, this.viewMatrix, -pitch - Math.PI / 2, [1, 0, 0]); // x
        mat4.rotate(this.viewMatrix, this.viewMatrix, roll, [0, 1, 0]); // z
        mat4.rotate(this.viewMatrix, this.viewMatrix, yaw, [0, 0, 1]); // y

        // Setup frustum
        let matrix = new Float32Array(this.projMatrix);
        mat4.multiply(matrix, matrix, this.viewMatrix);
        this.frustum.setFromProjectionMatrix(matrix, this.camPos);
        
        // Test frustum
        // let radius = 1;
        // let sphere = new Sphere(new Vector(2896.5, 67.5, 2790.5), Math.sqrt(3) * radius / 2);
        // console.log(this.frustum.intersectsSphere(sphere));
        // console.log(this.frustum.containsPoint(sphere.center));

    }

    // Original bobView
    bobView(player, viewMatrix) {
        if(player && player.walking && !player.getFlying() && !player.in_water ) {
            let p_109140_ = player.walking_frame * 2 % 1;
            //
            let speed_mul = 1.0;
            let f = player.walkDist * speed_mul - player.walkDistO * speed_mul;
            let f1 = -(player.walkDist * speed_mul + f * p_109140_);
            let f2 = Mth.lerp(p_109140_, player.oBob, player.bob);
            //
            let zmul = Mth.sin(f1 * Math.PI) * f2 * 3.0;
            let xmul = Math.abs(Mth.cos(f1 * Math.PI - 0.2) * f2) * 5.0;
            let m = Math.PI / 180;
            mat4.multiply(viewMatrix, viewMatrix, mat4.fromZRotation([], zmul * m));
            mat4.multiply(viewMatrix, viewMatrix, mat4.fromXRotation([], xmul * m));
            //
            mat4.translate(viewMatrix, viewMatrix, [
                Mth.sin(f1 * Math.PI) * f2 * 0.5,
                0.0,
                -Math.abs(Mth.cos(f1 * Math.PI) * f2),
            ]);
            if(Math.sign(viewMatrix[1]) != Math.sign(this.step_side)) {
                this.step_side = viewMatrix[1];
                player.onStep(this.step_side);
            }
        }
    }

    // getVideoCardInfo...
    getVideoCardInfo() {
        if(this.videoCardInfoCache) {
            return this.videoCardInfoCache;
        }
        let gl = this.renderBackend.gl;
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