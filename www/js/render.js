"use strict";

import {DIRECTION, Helpers, Vector} from "./helpers.js";
import {CHUNK_SIZE_X} from "./chunk.js";
import rendererProvider from "./renders/rendererProvider.js";
import {Mth} from "./helpers.js";
import {FrustumProxy} from "./frustum.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import Particles_Block_Destroy from "./particles/block_destroy.js";
import Particles_Block_Drop from "./particles/block_drop.js";
import Particles_Raindrop from "./particles/raindrop.js";
import Particles_Clouds from "./particles/clouds.js";
import {MeshManager} from "./mesh_manager.js";
import { Camera } from "./camera.js";
import { InHandOverlay } from "./ui/inhand_overlay.js";
import { World } from "./world.js";
import { Environment, PRESET_NAMES, SETTINGS as ENV_SET } from "./environment.js";

const {mat4, quat, vec3} = glMatrix;

/**
* Renderer
*
* This class contains the code that takes care of visualising the
* elements in the specified world.
**/
export const ZOOM_FACTOR        = 0.25;
const BACKEND                   = 'webgl'; // disable webgpu temporary because require update to follow webgl
const FOV_CHANGE_SPEED          = 75;
const FOV_FLYING_CHANGE_SPEED   = 35;
const FOV_NORMAL                = 75;
const FOV_FLYING                = FOV_NORMAL * 1.075;
const FOV_WIDE                  = FOV_NORMAL * 1.15;
const FOV_ZOOM                  = FOV_NORMAL * ZOOM_FACTOR;
const NEAR_DISTANCE             = 2 / 16;
const RENDER_DISTANCE           = 800;
const NIGHT_SHIFT_RANGE         = 16;

// Creates a new renderer with the specified canvas as target.
export class Renderer {

    constructor(renderSurfaceId) {
        this.xrMode             = false;
        this.canvas             = document.getElementById(renderSurfaceId);
        this.canvas.renderer    = this;
        this.testLightOn        = false;
        this.sunDir             = [0.9593, 1.0293, 0.6293]; // [0.7, 1.0, 0.85];
        this.frustum            = new FrustumProxy();
        this.step_side          = 0;
        this.clouds             = null;
        this.rainTim            = null;
        this.prevCamPos         = new Vector(0, 0, 0);
        this.prevCamRotate      = new Vector(0, 0, 0);
        this.frame              = 0;
        this.env                = new Environment();

        this.renderBackend = rendererProvider.getRenderer(
            this.canvas,
            BACKEND, {
                antialias: false,
                depth: true,
                premultipliedAlpha: false
            });
        this.meshes = new MeshManager();

        this.camera = new Camera({
            type: Camera.PERSP_CAMERA,
            fov: FOV_NORMAL,
            min: NEAR_DISTANCE,
            max: RENDER_DISTANCE,
            scale: 0.05, // ortho scale
        });

        this.inHandOverlay = null;

    }

    /**
     * Request animation frame
     * This method depend of mode which we runs
     * for XR raf will be provided from session
     * @param {(time, ...args) => void} callback 
     * @returns {number}
     */
    requestAnimationFrame(callback) {
        if (this.xrMode) {
            console.log('Not supported yet');
        }

        return self.requestAnimationFrame(callback);
    }

    /**
     * @deprecated Use camera valies direcly
     */
    get fov() {
        return this.camera.fov;
    }

    /**
     * @deprecated Use camera valies direcly
     */
    get max() {
        return this.camera.max;
    }

    /**
     * @deprecated Use camera valies direcly
     */
    get min() {
        return this.camera.min;
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

        await renderBackend.init({
            blocks: Resources.shaderBlocks
        });

        this.env.init(this);

        this.videoCardInfoCache = null;
        this.options            = {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, ZOOM_FACTOR, FOV_CHANGE_SPEED, NEAR_DISTANCE, RENDER_DISTANCE, FOV_FLYING, FOV_FLYING_CHANGE_SPEED};

        this.setBrightness(1); // this.brightness = 1;
        renderBackend.resize(this.canvas.width, this.canvas.height);

        // Init shaders for all resource packs
        await BLOCK.resource_pack_manager.initShaders(renderBackend);
        await BLOCK.resource_pack_manager.initTextures(renderBackend, settings);

        this.globalUniforms = renderBackend.globalUniforms;

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

        // Prepare base resource pack shader
        let rp                  = BLOCK.resource_pack_manager.get('base');
        this.defaultShader      = rp.shader;

        this.camera.renderType  = this.renderBackend.gl ? 'webgl' : 'webgpu';
        this.camera.width       = this.viewportWidth;
        this.camera.height      = this.viewportHeight;

        // Create projection and view matrices
        // we can use it directly from camera, but will be problems with reference in multicamera
        this.projMatrix         = this.globalUniforms.projMatrix;
        this.viewMatrix         = this.globalUniforms.viewMatrix;
        this.camPos             = this.globalUniforms.camPos;

        this.setPerspective(FOV_NORMAL, NEAR_DISTANCE, RENDER_DISTANCE);

        // HUD
        // Build main HUD
        this.HUD = {
            tick: 0,
            bufRect: null,
            draw: function() {
                Game.hud.draw();
            }
        }

        this.generatePrev();
        callback();

    }

    generatePrev() {
        const target = this.renderBackend.createRenderTarget({
            width: 2048,
            height: 2048,
            depth: true
        });
        const ZERO = new Vector();
        const GRID = 16;
        const all_blocks = BLOCK.getAll();

        let inventory_icon_id = 0;

        const extruded = [];
        const regular = Array.from(all_blocks.values()).map((block, i) => {
            const draw_style = block.inventory_style
                ? block.inventory_style 
                : block.style;
            // pass extruded manually
            if (draw_style === 'extruder') {
                block.inventory_icon_id = inventory_icon_id++;
                extruded.push(block);
                return;
            }

            try {
                if(!block.spawnable) {
                    return null;
                }
                let drop = new Particles_Block_Drop(this.gl, null, [{id: block.id}], ZERO);
                drop.block_material.inventory_icon_id = inventory_icon_id++;
                return drop;
            } catch(e) {
                console.log('Error on', block.id, e);
                return null;
            }
        }).filter(Boolean);

        //
        const camera = new Camera({
            type: Camera.ORTHO_CAMERA,
            max: 100,
            min: 0.01,
            fov: 60,
            renderType: this.renderBackend.gl ? 'webgl' : 'webgpu',
            width: GRID * 2, // block size is 2
            height: GRID * 2,
        });
        //
        const gu = this.globalUniforms;
        //
        const matrix_empty = mat4.create();
        mat4.scale(matrix_empty, matrix_empty, [0.75, 0.75, 0.75]);
        //
        const matrix = mat4.create();
        mat4.rotateX(matrix, matrix, Math.PI / 6);
        mat4.rotateZ(matrix, matrix, Math.PI + Math.PI / 4);
        //
        camera.set(new Vector(0, 0, -2), new Vector(0, 0, 0));
        // larg for valid render results 
        gu.testLightOn = true;
        gu.fogColor = [0, 0, 0, 1];
        gu.fogDensity = 100;
        gu.chunkBlockDist = 100;
        gu.resolution = [target.width, target.height];

        // when use a sun dir, brightness is factor how many of sunfactor is applied
        // sun light is additive
        gu.brightness = 0.55;
        gu.sunDir = [-1, -1, 1];
        gu.useSunDir = true;

        camera.use(gu, true);
        gu.update();
        
        this.renderBackend.beginPass({
            target
        });

        regular.forEach((block, i) => {
            const pos = block.block_material.inventory_icon_id;
            const x = -GRID + 1 + (pos % GRID) * 2;
            const y = GRID - 1 - ((pos / GRID) | 0) * 2;
            const multipart = block.parts > 1;

            // use linera for inventory
            block.material.texture.minFilter = 'linear';
            block.material.texture.magFilter = 'linear';
            
            this.renderBackend.drawMesh(
                block.buffer,
                block.material,
                new Vector(x, y, 0),
                multipart ? matrix_empty : matrix
            );

            block.material.texture.minFilter = 'nearest';
            block.material.texture.magFilter = 'nearest';

        });

        this.renderBackend.endPass();

        // render target to Canvas
        target.toImage('canvas').then((data) => {
            /**
             * @type {CanvasRenderingContext2D}
             */
            const ctx = data.getContext('2d');

            const tmpCanvas = document.createElement('canvas');
            const tmpContext = tmpCanvas.getContext('2d');
            tmpCanvas.width = target.width / GRID;
            tmpCanvas.height = target.height / GRID;

            tmpContext.imageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;

            // render plain preview that not require 3D view
            // and can be draw directly
            extruded.forEach((material) => {
                const pos = material.inventory_icon_id;
                const w = target.width / GRID;
                const h = target.height / GRID;
                const x = (pos % GRID) * w;
                const y = ((pos / GRID) | 0) * h;

                // const c = BLOCK.calcMaterialTexture(material, DIRECTION.UP);

                const resource_pack = material.resource_pack;
                let texture_id = 'default';
                if(typeof material.texture == 'object' && 'id' in material.texture) {
                    texture_id = material.texture.id;
                }
                const tex = resource_pack.textures.get(texture_id);
                // let imageData = tex.imageData;
                const c = BLOCK.calcTexture(material.texture, DIRECTION.UP, tex.tx_cnt);

                let tex_w = Math.round(c[2] * tex.width);
                let tex_h = Math.round(c[3] * tex.height);
                let tex_x = Math.round(c[0] * tex.width) - tex_w/2 | 0;
                let tex_y = Math.round(c[1] * tex.height) - tex_h/2 | 0;

                let image = tex.texture.source;

                const tint = material.tags && material.tags.indexOf('mask_biome') > -1;

                ctx.globalCompositeOperation = 'source-over';
 
                if (tint) {
                    tmpContext.globalCompositeOperation = 'source-over';
                    tmpContext.fillStyle = "#7ba83d";
                    tmpContext.fillRect(0, 0, w, h);

                    tmpContext.globalCompositeOperation = 'multiply';
                    tmpContext.drawImage(
                        image,
                        tex_x + tex_w, tex_y, tex_w, tex_h,
                        0, 0, w , h
                    );

                    tmpContext.globalCompositeOperation = 'destination-in';
                    tmpContext.drawImage(
                        image,
                        tex_x + tex_w, tex_y, tex_w, tex_h,
                        0, 0, w , h
                    );

                    image = tmpContext.canvas;
                    tex_x = 0;
                    tex_y = 0;
                    tex_w = w;
                    tex_h = h;
                }

                ctx.drawImage(
                    image,
                    tex_x, tex_y, tex_w, tex_h,
                    x + 0.1 * w, y + 0.1 * h,
                    w * 0.8, h * 0.8
                );

            });

            tmpCanvas.width = tmpCanvas.height = 0;

            Resources.inventory.image = data;
        });
        
        this.renderBackend.endPass();

        // disable
        gu.useSunDir = false;

        target.destroy();
    }

    /**
     * Makes the renderer start tracking a new world and set up the chunk structure.
     * world - The world object to operate on.
     * chunkSize - X, Y and Z dimensions of each chunk, doesn't have to fit exactly inside the world.
     * @param {World} world 
     */
    setWorld(world) {
        this.world = world;
    }

    setPlayer(player) {
        this.player = player;
    }

    /**
     * @deprecated use a this.env.setBrightness
     * @param {number} value 
     */
    setBrightness(value) {
        this.env.setBrightness(value);
    }

    // toggleNight...
    toggleNight() {
        if(this.env.brightness == 1) {
            this.setBrightness(0);
        } else {
            this.setBrightness(1);
        }
    }

    update (delta, args) {
        this.frame++;
        
        // this.env.computeFogRelativeSun();
        // todo - refact this
        // viewport is context-dependent
        this.updateViewport();

        const { renderBackend, player } = this;
        const { size, globalUniforms } = renderBackend;

        globalUniforms.resolution       = [size.width, size.height];
        globalUniforms.localLigthRadius = 0;

        renderBackend.stat.drawcalls = 0;
        renderBackend.stat.drawquads = 0;

        let blockDist = player.state.chunk_render_dist * CHUNK_SIZE_X - CHUNK_SIZE_X * 2;
        let nightshift = 1.;
        let preset = PRESET_NAMES.NORMAL;

        if(player.pos.y < 0 && this.world.info.generator.id !== 'flat') {
            nightshift = 1 - Math.min(-player.pos.y / NIGHT_SHIFT_RANGE, 1);
        }
  
        if(player.eyes_in_water) {
            if(player.eyes_in_water.is_water) {
                preset = PRESET_NAMES.WATER;
                blockDist = 8; //
            } else {
                preset = PRESET_NAMES.LAVA;
                blockDist = 4; //
            }
        }

        this.env.setEnvState({
            chunkBlockDist: blockDist,
            nightshift: nightshift,
            preset: preset
        });

        this.env.update(delta, args);

        // Clouds
        if(!this.clouds) {
            let pos = new Vector(player.pos);
            pos.y = 128.1;
            this.clouds = this.createClouds(pos);
        }

        //
        if(this.frame % 3 == 0) {
            this.world.chunkManager.rendered_chunks.fact = 0;
            this.world.chunkManager.prepareRenderList(this);
        }

        if (this.player.currentInventoryItem) {
            const block = BLOCK.BLOCK_BY_ID.get(this.player.currentInventoryItem.id);
            const power = BLOCK.getLightPower(block);
            // and skip all block that have power greater that 0x0f
            // it not a light source, it store other light data
            globalUniforms.localLigthRadius = +(power <= 0x0f) * (power & 0x0f);
        }

        this.defaultShader.texture = BLOCK.resource_pack_manager.get('base').textures.get('default').texture;
    }

    // Render one frame of the world to the canvas.
    draw (delta, args) {
        const { renderBackend, camera, player } = this;
        const { globalUniforms } = renderBackend;

        // upload GU data from environment
        this.env.sync(renderBackend.globalUniforms);

        // apply camera state;
        // it can depend of passes count
        camera.use(renderBackend.globalUniforms, true);

        globalUniforms.update();

        renderBackend.beginPass({
            fogColor : this.env.actualFogColor
        });

        this.env.draw(this);

        this.defaultShader.bind(true);

        // layers??
        // maybe we will create a real layer group
        for(let transparent of [false, true]) {
            for(let [_, rp] of BLOCK.resource_pack_manager.list) {
                // 2. Draw chunks
                this.world.chunkManager.draw(this, rp, transparent);
            }
            if(!transparent) {
                let shader = this.defaultShader;
                // @todo Тут не должно быть этой проверки, но без нее зачастую падает, видимо текстура не успевает в какой-то момент прогрузиться
                if (shader.texture) {
                    shader.bind(true);
                    if(player.game_mode.isSurvival() || player.game_mode.isCreative()) {
                        player.pickAt.draw();
                    }
                    // 3. Draw players and rain
                    this.drawPlayers(delta);
                    // 4. Draw mobs
                    this.drawMobs(delta);
                    // 5. Draw drop items
                    this.drawDropItems(delta);

                    this.meshes.draw(this, delta);
                }
            }
        }

        if(!player.game_mode.isSpectator()) {
            this.drawInhandItem(delta);
        }

        // 4. Draw HUD
        if(this.HUD) {
            this.HUD.draw();
        }

        // 5. Screenshot
        if(this.make_screenshot) {
            this.make_screenshot = false;
            this.renderBackend.screenshot();
        }

        renderBackend.endPass();
    }

    //
    drawInhandItem(dt) {

        if (!this.inHandOverlay) {
            this.inHandOverlay = new InHandOverlay(this.player.state.skin, this);
        }

        this.inHandOverlay.draw(this, dt);

        // we should reset camera state because a viewMatrix used for picking
        this.camera.use(this.globalUniforms);
    }

    // destroyBlock
    destroyBlock(block, pos, small) {
        this.meshes.add(new Particles_Block_Destroy(this, block, pos, small));
    }

    // rainDrop
    rainDrop(pos) {
        this.meshes.add(new Particles_Raindrop(this, pos));
    }

    // createClouds
    createClouds(pos) {
        // @todo Переделать в связи с появлением TBlock
        return this.meshes.add(new Particles_Clouds(this, pos));
    }

    // setRain
    setRain(value) {
        if(value) {
            if(!this.rainTim) {
                this.rainTim = setInterval(() => {
                    let pos = this.player.pos;
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
        const {renderBackend, defaultShader} = this;
        defaultShader.bind();
        for(let [id, player] of this.world.players.list) {
            if(player.itsMe() && id != 'itsme') continue;
            if(player.username != Game.App.session.username) {
                player.draw(this, this.camPos, delta);
            }
        }
    }

    // drawMobs
    drawMobs(delta) {
        const {renderBackend, defaultShader} = this;
        defaultShader.bind();
        for(let [id, mob] of this.world.mobs.list) {
            mob.draw(this, this.camPos, delta);
        }
    }

    // drawDropItems
    drawDropItems(delta) {
        const {renderBackend, defaultShader} = this;     
        defaultShader.bind();
        for(let drop_item of this.world.drop_items.list.values()) {
            drop_item.draw(this, delta);
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
        //this.fov = fov;
        //this.min = min;
        //this.max = max;

        this.camera.width = this.renderBackend.size.width;
        this.camera.height = this.renderBackend.size.height;
        this.camera.fov = fov;
        this.camera.min = min;
        this.camera.max = max;
    }

    // Moves the camera to the specified orientation.
    // pos - Position in world coordinates.
    // ang - Pitch, yaw and roll.
    setCamera(player, pos, rotate) {
        const tmp = mat4.create();

        this.bobView(player, tmp);
        this.camera.set(pos, rotate, tmp);
        this.frustum.setFromProjectionMatrix(this.camera.viewProjMatrix, this.camera.pos);
    }

    // Original bobView
    bobView(player, viewMatrix, forDrop = false) {
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
        
            if (!forDrop) {
                
                mat4.multiply(viewMatrix, viewMatrix, mat4.fromZRotation([], zmul * m));
                mat4.multiply(viewMatrix, viewMatrix, mat4.fromXRotation([], xmul * m));
                
                mat4.translate(viewMatrix, viewMatrix, [
                    Mth.sin(f1 * Math.PI) * f2 * 0.5,
                    0.0,
                    -Math.abs(Mth.cos(f1 * Math.PI) * f2),
                ]);
            } else {
                mat4.translate(viewMatrix, viewMatrix, [
                    Mth.sin(f1 * Math.PI) * f2 * 0.25,
                    -Math.abs(Mth.cos(f1 * Math.PI) * f2) * 1,
                    0.0,
                ]);
            }
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

    // updateFOV...
    updateFOV(delta, zoom, running, flying) {
        const {FOV_NORMAL, FOV_WIDE, FOV_ZOOM, FOV_CHANGE_SPEED, NEAR_DISTANCE, RENDER_DISTANCE, FOV_FLYING, FOV_FLYING_CHANGE_SPEED} = this.options;
        let target_fov = FOV_NORMAL;
        let new_fov = null;
        if(zoom) {
            target_fov = FOV_ZOOM;
        } else {
            if(running) {
                target_fov = FOV_WIDE;
            } else if(flying) {
                target_fov = FOV_FLYING;
            }
        }
        if(this.fov < target_fov) {
            new_fov = Math.min(this.fov + FOV_CHANGE_SPEED * delta, target_fov);
        }
        if(this.fov > target_fov) {
            new_fov = Math.max(this.fov - FOV_CHANGE_SPEED * delta, target_fov);
        }
        if(new_fov !== null) {
            this.setPerspective(new_fov, NEAR_DISTANCE, RENDER_DISTANCE);
        }
    }

    downloadScreenshot() {
        this.make_screenshot = true;
    }

    downloadInventoryImage() {
        Helpers.downloadImage(Resources.inventory.image, 'inventory.png');
    }

}
