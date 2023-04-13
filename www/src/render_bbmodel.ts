"use strict";

import { CAMERA_MODE, Vector } from "./helpers.js";
import rendererProvider from "./renders/rendererProvider.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";

import { MeshManager } from "./mesh/manager.js";
import { Camera } from "./camera.js";
import { Environment } from "./environment.js";
import { LIGHT_TYPE, PLAYER_ZOOM } from "./constant.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import {LineGeometry} from "./geom/line_geometry.js";
import type { World } from "./world.js";
import type {Player} from "./player.js";
import type WebGLRenderer from "./renders/webgl/index.js";

export const ZOOM_FACTOR        = 0.25;
export const DEFAULT_FOV_NORMAL = 70;

const BACKEND                   = 'webgl'; // disable webgpu temporary because require update to follow webgl
const FOV_CHANGE_SPEED          = 75;
const FOV_FLYING_CHANGE_SPEED   = 35;
const FOV_FLYING_FACTOR         = 1.075;
const FOV_WIDE_FACTOR           = 1.15;
const FOV_ZOOM                  = DEFAULT_FOV_NORMAL * ZOOM_FACTOR;
const NEAR_DISTANCE             = (2 / 16) * PLAYER_ZOOM;
const RENDER_DISTANCE           = 800;

// Creates a new renderer with the specified canvas as target.
export class RendererBBModel {
    xrMode:                 boolean             = false
    sunDir:                 tupleFloat3         = [0.9593, 1.0293, 0.6293]
    env:                    Environment
    renderBackend:          WebGLRenderer
    meshes:                 MeshManager
    camera:                 Camera
    debugGeom:              LineGeometry
    canvas:                 any
    settings:               any
    options:                any = {FOV_WIDE_FACTOR, FOV_ZOOM, ZOOM_FACTOR, FOV_CHANGE_SPEED, NEAR_DISTANCE, RENDER_DISTANCE, FOV_FLYING_FACTOR, FOV_FLYING_CHANGE_SPEED}
    globalUniforms:         any
    defaultShader:          any
    viewportWidth:          any
    viewportHeight:         any
    projMatrix:             any
    viewMatrix:             any
    camPos:                 any
    blockDayLightTex:       any
    world:                  World
    player:                 Player
    _base_texture:          any
    _base_texture_n:        any

    constructor(qubatchRenderSurfaceId : string) {

        this.canvas             = document.getElementById(qubatchRenderSurfaceId)
        this.canvas.renderer    = this
        this.env                = new Environment(this)

        this.renderBackend = rendererProvider.getRenderer(
            this.canvas,
            BACKEND, {
                antialias: false,
                stencil: true,
                depth: true,
                premultipliedAlpha: false,
                powerPreference: "high-performance"
            }
        )

        this.camera = new Camera({
            type: Camera.PERSP_CAMERA,
            fov: DEFAULT_FOV_NORMAL,
            min: NEAR_DISTANCE,
            max: RENDER_DISTANCE,
            scale: 0.05, // ortho scale
        })

    }

    // Request animation frame
    requestAnimationFrame(callback : FrameRequestCallback) {
        if (this.xrMode) {
            console.log('Not supported yet')
        }
        return self.requestAnimationFrame(callback)
    }

    get gl() {
        return this.renderBackend.gl
    }

    async init(world, settings) {
        this.setWorld(world)
        this.settings = settings
        this.meshes = new MeshManager(world)

        const {renderBackend} = this

        if (renderBackend.gl) {
            if (settings.use_light === LIGHT_TYPE.RTX) {
                renderBackend.preprocessor.useNormalMap = true
                renderBackend.globalUniforms.useNormalMap = true
            }
        }

        // if(!settings || !settings?.disable_env) {
        //     this.env.init(this)
        //     this.env.setBrightness(1)
        // }

        renderBackend.resize(this.canvas.width, this.canvas.height)

        // Init shaders for all resource packs
        await BLOCK.resource_pack_manager.initShaders(renderBackend)
        await BLOCK.resource_pack_manager.initTextures(renderBackend, settings)

        this.globalUniforms = renderBackend.globalUniforms

        // Make materials for all shaders
        for(let rp of BLOCK.resource_pack_manager.list.values()) {
            rp.shader.materials = {
                regular: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader}),
                doubleface: renderBackend.createMaterial({ cullFace: false, opaque: true, shader: rp.shader}),
                // decal1: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader, decalOffset: 1}),
                // decal2: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader, decalOffset: 2}),
                // transparent: renderBackend.createMaterial({ cullFace: true, opaque: false, shader: rp.shader}),
                doubleface_transparent: renderBackend.createMaterial({ cullFace: false, opaque: false, shader: rp.shader}),
                // label: renderBackend.createMaterial({ cullFace: false, ignoreDepth: true, shader: rp.shader}),
            }
        }

        // Prepare base resource pack shader
        const rp                = BLOCK.resource_pack_manager.get('base')
        this.defaultShader      = rp.shader

        this.camera.renderType  = this.renderBackend.gl ? 'webgl' : 'webgpu'
        this.camera.width       = this.viewportWidth
        this.camera.height      = this.viewportHeight

        // Create projection and view matrices
        // we can use it directly from camera, but will be problems with reference in multicamera
        this.projMatrix         = this.globalUniforms.projMatrix
        this.viewMatrix         = this.globalUniforms.viewMatrix
        this.camPos             = this.globalUniforms.camPos

        settings.fov = settings.fov || DEFAULT_FOV_NORMAL
        this.setPerspective(settings.fov, NEAR_DISTANCE, RENDER_DISTANCE)

        this.updateViewport()

        this.blockDayLightTex = renderBackend.createTexture({
            source: Resources.blockDayLight,
            minFilter: 'linear',
            magFilter: 'linear'
        })
        this.blockDayLightTex.bind(2)

        this.debugGeom = new LineGeometry()
        this.debugGeom.pos = this.camPos

    }

    update(delta : float, args : any) {

        this.updateViewport()

        const { renderBackend } = this
        const { size, globalUniforms } = renderBackend

        globalUniforms.resolution = [size.width, size.height]

        if (this.player.currentInventoryItem) {
            const mat = BLOCK.fromId(this.player.currentInventoryItem.id)
            if(mat && !mat.is_dynamic_light) {
                const power = mat.light_power_number
                // and skip all block that have power greater that 0x0f
                // it not a light source, it store other light data
                globalUniforms.localLigthRadius = +(power <= 0x0f) * (power & 0x0f)
            }
        }

    }

    // Render one frame of the world to the canvas.
    draw(delta : float, args : any = null) {
        const { renderBackend, camera, player } = this
        const { globalUniforms } = renderBackend

        this.resetBefore()

        // upload GU data from environment
        this.env.sync(renderBackend.globalUniforms)

        // apply camera state;
        // it can depend of passes count
        camera.use(renderBackend.globalUniforms, true)

        globalUniforms.update()

        this.debugGeom.clear()

        renderBackend.beginPass({
            fogColor : this.env.interpolatedClearValue
        });

        this.env.draw(this)
        this.defaultShader.bind(true)
        this.meshes.draw(this, delta, player.lerpPos)
        this.debugGeom.draw(renderBackend)
        this.defaultShader.bind()
        renderBackend.endPass()

        this.resetAfter()
    }

    addBBModel(pos : Vector, bbname : string, rotate : Vector, animation_name : string, key : string, doubleface : boolean = false) : Mesh_Object_BBModel | null {
        const model = Resources._bbmodels.get(bbname)
        if(!model) {
            return null
        }
        const bbmodel = new Mesh_Object_BBModel(this, pos, rotate, model, animation_name, doubleface)
        bbmodel.setAnimation(animation_name)
        return this.meshes.add(bbmodel, key)
    }

    resetBefore() {
        // webgl state was reset, we have to re-bind textures
        this.renderBackend.resetBefore()
        const defTex = this.env.skyBox?.shader.texture || this.renderBackend._emptyTex
        defTex.bind(0)
        this.renderBackend._emptyTex3D.bind(6)
        this.blockDayLightTex?.bind(2)
        this.defaultShader?.bind()
    }

    resetAfter() {
        this.renderBackend.resetAfter();
    }

    // Check if the viewport is still the same size and update the render configuration if required.
    updateViewport() {
        const actual_width = this.canvas.width
        const actual_height = this.canvas.height
        if (actual_width !== this.viewportWidth || actual_height !== this.viewportHeight) {
            this.renderBackend.resize(
                actual_width | 0,
                actual_height | 0)
            this.viewportWidth = actual_width | 0
            this.viewportHeight = actual_height | 0
            this.setPerspective(this.camera.fov, this.camera.min, this.camera.max)
        }
    }

    // Sets the properties of the perspective projection.
    setPerspective(fov, min, max) {
        this.camera.width = this.renderBackend.size.width
        this.camera.height = this.renderBackend.size.height
        this.camera.fov = fov
        this.camera.min = min
        this.camera.max = max
    }

    setWorld(world) {
        this.world = world
    }

}