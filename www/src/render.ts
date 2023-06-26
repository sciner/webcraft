"use strict";

import {Mth, CAMERA_MODE, DIRECTION, Helpers, Vector, IndexedColor, fromMat3, QUAD_FLAGS, Color, blobToImage} from "./helpers.js";
import { INVENTORY_ICON_COUNT_PER_TEX, INVENTORY_ICON_TEX_HEIGHT, INVENTORY_ICON_TEX_WIDTH} from "./chunk_const.js";
import rendererProvider from "./renders/rendererProvider.js";
import {Resources} from "./resources.js";
import {BLOCK, DBItemBlock} from "./blocks.js";
import {BLEND_MODES, LayerPass} from 'vauxcel';

// Particles
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { Mesh_Object_Asteroid } from "./mesh/object/asteroid.js";
import Mesh_Object_Clouds from "./mesh/object/clouds.js";
import Mesh_Object_Rain from "./mesh/object/rain.js";
import { Mesh_Object_Stars } from "./mesh/object/stars.js";

import { MeshManager } from "./mesh/manager.js";
import { Camera_3d } from "./renders/camera_3d.js";
import { InHandOverlay } from "./ui/inhand_overlay.js";
import { Environment, PRESET_NAMES } from "./environment.js";
import { GeometryTerrain } from "./geometry_terrain.js";
import { CubeSym } from "./core/CubeSym.js";
import {
    DEFAULT_CLOUD_HEIGHT,
    MIN_BRIGHTNESS,
    NOT_SPAWNABLE_BUT_INHAND_BLOCKS,
} from "./constant.js";
import { Weather } from "./block_type/weather.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import { PACKED_CELL_LENGTH, PACKET_CELL_WATER_COLOR_G, PACKET_CELL_WATER_COLOR_R } from "./fluid/FluidConst.js";
import {LineGeometry} from "./geom/line_geometry.js";
import { BuildingTemplate } from "./terrain_generator/cluster/building_template.js";
import { AABB } from "./core/AABB.js";
import { SpriteAtlas } from "./core/sprite_atlas.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { World } from "./world.js";
import type { MobModel } from "./mob_model.js";
import type { HUD } from "./hud.js";
import type {Player} from "./player.js";
import type WebGLRenderer from "./renders/webgl/index.js";
import {TerrainBaseTexture} from "./renders/TerrainBaseTexture.js";
import {BufferBaseTexture} from "./renders/BufferBaseTexture.js";
import {GameCamera, DEFAULT_FOV_NORMAL} from "./game_camera.js";

const {mat3, mat4, quat, vec3} = glMatrix;

/**
* Renderer
*
* This class contains the code that takes care of visualising the
* elements in the specified world.
**/
const BACKEND                   = 'webgl'; // disable webgpu temporary because require update to follow webgl

const NIGHT_SHIFT_RANGE         = 16;

class DrawMobsStat {
    count: int = 0
    time: float = 0
}

// Creates a new renderer with the specified canvas as target.
export class Renderer {
    draw_mobs_stat:         DrawMobsStat        = new DrawMobsStat()
    xrMode:                 boolean             = false
    testLightOn:            boolean             = false
    sunDir:                 tupleFloat3         = [0.9593, 1.0293, 0.6293] // [0.7, 1.0, 0.85];
    frame:                  number              = 0
    clouds?:                Mesh_Object_Clouds
    rain?:                  Mesh_Object_Rain
    env:                    Environment
    renderBackend:          WebGLRenderer
    meshes:                 MeshManager
    camera:                 GameCamera
    debugGeom:              LineGeometry
    inHandOverlay?:         InHandOverlay
    canvas:                 any
    drop_item_meshes:       any[]
    settings:               any
    videoCardInfoCache:     any
    defaultShader:          any
    defaultFluidShader:     any
    viewportWidth:          any
    viewportHeight:         any
    projMatrix:             any
    viewMatrix:             any
    camPos:                 any
    HUD:                    HUD
    maskColorTex:           any
    stars:                  any
    blockDayLightTex:       any
    world:                  World
    player:                 Player
    _base_texture:          any
    _base_texture_n:        any
    make_screenshot:        any
    timeKillRain:           any
    weather_name:           string
    material_shadow:        any
    cullID:                 int = 0
    lastDeltaForMeGui:      int = 0
    mobsDrawnLast:          MobModel[] = [] // список мобов, отложенных при 1-м вызове drawMobs, чтобы быть нарисованными на 2-м
    nightVision:            boolean = false;
    _debug_aabb:            AABB[] = []

    constructor(qubatchRenderSurfaceId : string) {
        this.canvas             = document.getElementById(qubatchRenderSurfaceId);
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
            });

        this.camera = new GameCamera({});

        //
        this.drop_item_meshes = Array(4096); // new Map();
    }

    get globalUniforms() {
        return this.renderBackend.globalUniforms;
    }

    get lightUniforms() {
        return this.renderBackend.lightUniforms;
    }

    //
    addDropItemMesh(block_id, material_id, vertices) {
        let div = this.drop_item_meshes[block_id]; // .get(block_id);
        if(!div) {
            div = {vertices: {}};
            this.drop_item_meshes[block_id] = div;
        }
        div.vertices[material_id] = vertices;
    }

    nextCameraMode() {
        this.camera.mode = ++this.camera.mode % CAMERA_MODE.COUNT;
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

    get gl() {
        return this.renderBackend.gl;
    }

    // todo
    // GO TO PROMISE
    async init(world, settings) {
        this.setWorld(world);
        this.settings = settings;
        this.meshes = new MeshManager(world);

        const {renderBackend} = this;
        const {pixiRender} = renderBackend;

        const renderList = world.chunkManager.renderList;
        if (renderBackend.gl) {
            /*if (settings.use_light === LIGHT_TYPE.RTX) {
                renderList.setLightTexFormat(true);
                renderBackend.preprocessor.useNormalMap = true;
                renderBackend.globalUniforms.useNormalMap = true;
            } else {*/
                renderList.setLightTexFormat(false);
            //}
        } else {
            renderList.setLightTexFormat(false);
        }


        this.videoCardInfoCache = null;

        if(!settings || !settings?.disable_env) {
            this.env.init(this)
            this.env.setBrightness(1)
        }

        renderBackend.resize(this.canvas.width, this.canvas.height)

        // Init shaders for all resource packs
        await BLOCK.resource_pack_manager.initShaders(renderBackend);
        await BLOCK.resource_pack_manager.initTextures(renderBackend, settings);

        // Make materials for all shaders
        for(let rp of BLOCK.resource_pack_manager.list.values()) {
            rp.shader.materials = {
                regular: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader}),
                creative_regular: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader}),
                doubleface: renderBackend.createMaterial({ cullFace: false, opaque: true, shader: rp.shader}),
                decal1: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader, decalOffset: 1}),
                decal2: renderBackend.createMaterial({ cullFace: true, opaque: true, shader: rp.shader, decalOffset: 2}),
                transparent: renderBackend.createMaterial({ cullFace: true, opaque: false, shader: rp.shader}),
                doubleface_transparent: renderBackend.createMaterial({ cullFace: false, opaque: false, shader: rp.shader}),
                label: renderBackend.createMaterial({ cullFace: false, ignoreDepth: true, shader: rp.shader}),
            }
            if (rp.fluidShader) {
                rp.fluidShader.materials = {
                    doubleface: renderBackend.createMaterial({cullFace: false, opaque: true, decalOffset: -2, shader: rp.fluidShader}),
                    doubleface_transparent: renderBackend.createMaterial({
                        cullFace: false,
                        opaque: false,
                        decalOffset: -4,
                        shader: rp.fluidShader,
                    }),
                }
            }
        }

        // Prepare base resource pack shader
        const rp                = BLOCK.resource_pack_manager.get('base');
        this.defaultShader      = rp.shader;
        this.defaultFluidShader = rp.fluidShader;

        this.camera.renderType  = this.renderBackend.gl ? 'webgl' : 'webgpu';
        this.camera.setSize(this.viewportWidth, this.viewportHeight);

        // Create projection and view matrices
        // we can use it directly from camera, but will be problems with reference in multicamera
        this.projMatrix         = this.globalUniforms.projMatrix;
        this.viewMatrix         = this.globalUniforms.viewMatrix;
        this.camPos             = this.globalUniforms.camPos;

        this.camera.setSettingsFov(settings.fov = settings.fov || DEFAULT_FOV_NORMAL);

        // HUD
        this.HUD = Qubatch.hud;
        // this.HUD.wm.initRender();
        this.updateViewport();

        //
        const mci = Resources.maskColor;
        this.maskColorTex = new TerrainBaseTexture({
            source:         mci,
            minFilter:      'linear',
            magFilter:      'linear'
        });
        pixiRender.texture.bind(this.maskColorTex, 1);

        // Add getColorAt() for maskColorTex
        const canvas        = document.createElement('canvas');
        const ctx           = canvas.getContext('2d');
        canvas.width        = mci.width;
        canvas.height       = mci.height;
        ctx.drawImage(mci, 0, 0, mci.width, mci.height, 0, 0, mci.width, mci.height);
        this.maskColorTex.imageData = ctx.getImageData(0, 0, mci.width, mci.height);
        this.maskColorTex.getColorAt = function(x, y) {
            const imd = this.imageData.data;
            const ax = x | 0;
            const ay = y | 0;
            const index = ((ay * this.width) + ax) * 4;
            return new Color(imd[index + 0], imd[index + 1], imd[index + 2], imd[index + 3]);
        }

        const promises = []

        // generate prev
        promises.push(this.generatePrev(settings.generate_prev_callback))
        this.generateDropItemVertices();

        // Clouds
        // @todo Переделать в связи с появлением TBlock
        this.clouds = new Mesh_Object_Clouds(this, DEFAULT_CLOUD_HEIGHT);

        // Stars
        this.stars = this.meshes.add(new Mesh_Object_Stars());

        world.chunkManager.postWorkerMessage(['setDropItemMeshes', this.drop_item_meshes]);

        this.blockDayLightTex = new TerrainBaseTexture({
            source: Resources.blockDayLight,
            minFilter: 'linear',
            magFilter: 'linear'
        });

        this.checkLightTextures();

        this.debugGeom = new LineGeometry();
        this.debugGeom.pos = this.camPos;

        // this.HUD.wm.initRender(this)
        this.HUD.wm.loadFont()

        return Promise.all(promises)

    }

    // Generate drop item vertices
    generateDropItemVertices() {
        const all_blocks = BLOCK.getAll();
        // Drop for item in frame
        const frame_matrix = mat4.create();
        mat4.rotateY(frame_matrix, frame_matrix, -Math.PI / 2);
        all_blocks.forEach((mat) => {
            if(mat.id < 1 || mat.deprecated) {
                return;
            }
            const b = {id: mat.id};
            //
            let cardinal_direction = 0;
            let mx = mat3.create();
            let mx4 = fromMat3(new Float32Array(16), CubeSym.matrices[cardinal_direction]);
            mat3.fromMat4(mx, mx4);
            //
            const drop = new Mesh_Object_Block_Drop(this.world, null, null, [b], Vector.ZERO, frame_matrix, null);
            drop.mesh_group.meshes.forEach((mesh, _, map) => {
                this.addDropItemMesh(drop.block.id, _, mesh.vertices);
            });
        });
    }

    //
    async generatePrev(callback) {
        this.resetBefore();

        const { renderBackend } = this;

        const inventoryPass = new LayerPass({
            screenSize: {
                width: INVENTORY_ICON_TEX_WIDTH,
                height: INVENTORY_ICON_TEX_HEIGHT,
            },
            useRenderTexture: true,
            useDepth: true,
            clearColor: true,
            clearDepth: true,
        });
        const target = inventoryPass.getRenderTexture();

        const ASPECT = target.height / target.width;
        const ZERO = new Vector();
        const GRID_X = INVENTORY_ICON_COUNT_PER_TEX;
        const GRID_Y = GRID_X * ASPECT;
        const all_blocks = BLOCK.getAll();

        const atlas_map = {
            "meta": {
                "scale": 1
            },
            "frames_count": 0,
            "frames": {
            }
        }

        const addAtlasSprite = (block) => {
            const frame = target.width / INVENTORY_ICON_COUNT_PER_TEX
            const pos = BLOCK.getInventoryIconPos(block.inventory_icon_id, target.width, frame)
            atlas_map.frames_count++
            atlas_map.frames[block.name] = {
                "frame": {"x":pos.x,"y":pos.y,"w":pos.width,"h":pos.height},
                "rotated": false,
                "trimmed": false,
                "spriteSourceSize": {"x":0,"y":0,"w":pos.width,"h":pos.height},
                "sourceSize": {"w":pos.width,"h":pos.height}
            }
        }

        let inventory_icon_id = 0;

        const extruded = [];
        const regular = all_blocks.map((block, i) => {
            let draw_style = block.inventory_style
                ? block.inventory_style
                : block.style;
            if('inventory' in block) {
                draw_style = block.inventory.style;
            }
            // pass extruded manually
            if (draw_style === 'extruder') {
                block.inventory_icon_id = inventory_icon_id++;
                addAtlasSprite(block)
                extruded.push(block);
                return;
            }

            try {
                if(!block.spawnable && !NOT_SPAWNABLE_BUT_INHAND_BLOCKS.includes(block.name)) {
                    return null;
                }
                const drop = new Mesh_Object_Block_Drop(this.world, this.gl, null, [{id: block.id, extra_data: block.extra_data}], ZERO);
                drop.block_material.inventory_icon_id = inventory_icon_id++;
                addAtlasSprite(drop.block_material)
                return drop;
            } catch(e) {
                console.log('Error on', block.id, draw_style, block, e);
                return null;
            }
        }).filter(Boolean);

        //
        const camera = new Camera_3d({
            type: Camera_3d.ORTHO_CAMERA,
            max: 100,
            min: 0.01,
            fov: 60,
            renderType: this.renderBackend.gl ? 'webgl' : 'webgpu',
            width: GRID_X * 2, // block size is 2
            height: GRID_Y * 2,
        });
        //
        const gu = this.globalUniforms;
        //
        const matrix_empty = mat4.create();
        const matrix_base = mat4.create();
        mat4.scale(matrix_base, matrix_base, [0.75, 0.75, 0.75]);
        //
        const matrix = mat4.create();
        mat4.rotateX(matrix, matrix, Math.PI / 6);
        mat4.rotateY(matrix, matrix, Math.PI / 4);
        //
        camera.set(new Vector(0, 0, 5), new Vector(0, 0, Math.PI));
        // larg for valid render results
        gu.fogColor = [0, 0, 0, 0];
        // gu.fogDensity = 100;
        gu.chunkBlockDist = 100;
        gu.resolution = [target.width, target.height];

        // when use a sun dir, brightness is factor how many of sunfactor is applied
        // sun light is additive
        gu.brightness = MIN_BRIGHTNESS; // 0.55 * 1.0; // 1.3
        gu.sunDir = [-1, -1, 1];
        gu.useSunDir = true;

        camera.use(gu, true);
        gu.update();
        this.defaultShader.bind(true);

        renderBackend.beginPass(inventoryPass);
        this.checkLightTextures();

        regular.forEach((drop, i) => {
            const pos = drop.block_material.inventory_icon_id;
            const x = GRID_X - 1 - (pos % GRID_X) * 2;
            const y = GRID_Y - 1 - ((pos / (GRID_X)) | 0) * 2;
            const multipart = drop.mesh_group.multipart;

            drop.mesh_group.meshes.forEach((mesh, _, map) => {

                if(!mesh.material) {
                    console.log(mesh)
                    debugger;
                }

                // this.addDropItemMesh(drop.block.id, _, mesh.vertices);

                // use linear for inventory
                mesh.material.texture.minFilter = 'linear';
                mesh.material.texture.magFilter = 'linear';

                if(drop.block_material.name == 'COOPER_AXE') {
                    debugger
                }

                let pers_matrix = null;
                const mat = drop.block_material

                const display = mat.bb?.model?.json?.display?.gui
                if(display) {
                    pers_matrix = mat4.create();

                    const BB_GUI_SCALE = 1.5

                    const tempQuat = quat.create()
                    const position = vec3.create()
                    const scale = vec3.set(vec3.create(), 1 * BB_GUI_SCALE, 1 * BB_GUI_SCALE, 1 * BB_GUI_SCALE)
                    const pivot = vec3.set(vec3.create(), 0, -0.5, 0);
                    const rotate = vec3.create();

                    if(display.rotation) {
                        rotate[0] = display.rotation[0];//+display.rotation[0] + Math.PI / 2
                        rotate[1] = -display.rotation[1];
                        rotate[2] = -display.rotation[2];
                    }

                    if(display.scale) {
                        vec3.set(scale, display.scale[0] * BB_GUI_SCALE, display.scale[1] * BB_GUI_SCALE, display.scale[2] * BB_GUI_SCALE)
                    }

                    const s16 = BB_GUI_SCALE / 16;
                    if(display.translation) {
                        vec3.set(position, -display.translation[0] * s16, display.translation[1] * s16 + 0.5, -display.translation[2] * s16);
                    }

                    quat.fromEuler(tempQuat, rotate[0], rotate[1], rotate[2], 'xyz')
                    mat4.fromRotationTranslationScaleOrigin(pers_matrix, tempQuat, position, scale, pivot)
                    mat4.rotateY(pers_matrix, pers_matrix, Math.PI)
                    // mat4.translate(pers_matrix, pers_matrix, position);
                    // if(display.rotation) {
                    //     const icon_rotate = display.rotation
                    //     for(let i = 0; i < icon_rotate.length; i++) {
                    //         if(!icon_rotate[i]) continue;
                    //         const rot_arr = [0, 0, 0]
                    //         rot_arr[i] = 1
                    //         mat4.rotate(pers_matrix, pers_matrix, icon_rotate[i] / 180 * Math.PI, rot_arr)
                    //     }
                    // }

                    // mat4.translate(pers_matrix, pers_matrix, [0, 0, 4/16])

                } else if(mat.inventory) {
                    if(mat.inventory.rotate) {
                        const icon_rotate = new Vector(mat.inventory.rotate).toArray()
                        pers_matrix = pers_matrix || [...(multipart ? matrix_base : matrix)];
                        for(let i = 0; i < icon_rotate.length; i++) {
                            if(!icon_rotate[i]) continue;
                            const rot_arr = [0, 0, 0];
                            rot_arr[i] = 1;
                            mat4.rotate(pers_matrix, pers_matrix, icon_rotate[i], rot_arr);
                        }
                    }
                    if(mat.inventory.scale) {
                        const icon_scale = mat.inventory.scale;
                        pers_matrix = pers_matrix || [...(multipart ? matrix_base : matrix)];
                        mat4.scale(pers_matrix, pers_matrix, [icon_scale, icon_scale, icon_scale]);
                        mat4.translate(pers_matrix, pers_matrix, [0, 0, icon_scale / 10]);
                    }
                    if(mat.inventory.move) {
                        const icon_move = mat.inventory.move;
                        pers_matrix = pers_matrix || [...(multipart ? matrix_base : matrix)];
                        mat4.translate(pers_matrix, pers_matrix, new Vector(icon_move).toArray());
                    }
                }

                //if(this.block_material?.inventory?.move) {
                //    mat4.translate(this.modelMatrix, this.modelMatrix, new Vector(this.block_material?.inventory?.move).toArray());
                //}

                this.renderBackend.drawMesh(
                    mesh.buffer,
                    mesh.material,
                    new Vector(x, y, 0),
                    pers_matrix ? pers_matrix : (multipart ? matrix_base : matrix)
                );

                mesh.material.texture.minFilter = 'nearest';
                mesh.material.texture.magFilter = 'nearest';

            });

        });

        renderBackend.endPass(inventoryPass);

        return new Promise((resolve, reject) => {
            this.renderBackend.rtToImage(target, 'canvas').then((data : any) => {
                /**
                 * @type {CanvasRenderingContext2D}
                 */
                const ctx = data.getContext('2d');

                const tmpCanvas = document.createElement('canvas');
                const tmpContext = tmpCanvas.getContext('2d');
                tmpCanvas.width = target.width / GRID_X;
                tmpCanvas.height = target.height / GRID_Y;

                tmpContext.imageSmoothingEnabled = false;
                ctx.imageSmoothingEnabled = false;

                //
                const texs = new Map()
                const getTextureOrigImage = (tex) => {
                    let canvas = texs.get(tex)
                    if(!canvas) {
                        const imagedata = tex.getImageData()
                        canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = imagedata.width;
                        canvas.height = imagedata.height;
                        ctx.putImageData(imagedata, 0, 0);
                        texs.set(tex, canvas)
                    }
                    return canvas // tex.texture.source
                }

                // render plain preview that not require 3D view
                // and can be draw directly
                extruded.forEach((material) => {
                    const pos = material.inventory_icon_id;
                    const w = target.width / GRID_X;
                    const h = target.height / (GRID_Y);
                    const x = (pos % GRID_X) * w;
                    const y = ((pos / GRID_X) | 0) * h;

                    // const c = BLOCK.calcMaterialTexture(material, DIRECTION.UP);

                    const resource_pack = material.resource_pack;
                    let texture_id = 'default';
                    let texture = material.texture;
                    let mask_color = material.mask_color;
                    if('inventory' in material) {
                        if('texture' in material.inventory) {
                            texture = material.inventory.texture;
                        }
                        if('mask_color' in material.inventory) {
                            mask_color = material.inventory.mask_color;
                        }
                    }
                    if(typeof texture == 'object' && 'id' in texture) {
                        texture_id = texture.id;
                    }
                    const tex = resource_pack.textures.get(texture_id);
                    if(!tex) {
                        console.error(material)
                        debugger
                        throw 'error_empty_tex'
                    }
                    // let imageData = tex.imageData;
                    const c = BLOCK.calcTexture(texture, DIRECTION.FORWARD, tex.tx_cnt);

                    let tex_w = Math.round(c[2] * tex.width);
                    let tex_h = Math.round(c[3] * tex.height);
                    let tex_x = Math.round(c[0] * tex.width) - tex_w/2 | 0;
                    let tex_y = Math.round(c[1] * tex.height) - tex_h/2 | 0;

                    let image = getTextureOrigImage(tex)

                    const tint = material.tags && (
                        material.tags.includes('mask_biome') ||
                        material.tags.includes('mask_color') ||
                        mask_color
                    );

                    ctx.globalCompositeOperation = 'source-over';

                    if (tint) {
                        tmpContext.globalCompositeOperation = 'source-over';
                        if(mask_color) {
                            tmpContext.fillStyle = this.maskColorTex.getColorAt(mask_color.r, mask_color.g).toHex();
                        } else {
                            // default grass color
                            tmpContext.fillStyle = "#7ba83d";
                        }
                        tmpContext.fillRect(0, 0, w, h);

                        tmpContext.globalCompositeOperation = 'multiply';
                        tmpContext.drawImage(
                            image,
                            tex_x + tex_w, tex_y, tex_w, tex_h,
                            0, 0, w , h
                        );
                        tmpContext.globalCompositeOperation = 'lighter';
                        tmpContext.drawImage(
                            image,
                            tex_x, tex_y, tex_w, tex_h,
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

                })

                tmpCanvas.width = tmpCanvas.height = 0
                Resources.inventory.image = data

                data.toBlob(async (blob : Blob) => {
                    Resources.inventory.atlas = await SpriteAtlas.fromJSON(await blobToImage(blob) as HTMLImageElement, atlas_map)
                    if(callback instanceof Function) {
                        callback(blob)
                    }
                    resolve(Resources.inventory)
                }, 'image/png')

                inventoryPass.destroy();
            })

            // disable
            gu.useSunDir = false;

            this.resetAfter();

        })
    }

    /**
     * Makes the renderer start tracking a new world and set up the chunk structure.
     * world - The world object to operate on.
     * chunkSize - X, Y and Z dimensions of each chunk, doesn't have to fit exactly inside the world.
     */
    setWorld(world : World) {
        this.world = world;
    }

    setPlayer(player: Player) {
        this.player = player;
    }

    update(delta : float, args) {

        this.frame++;

        // this.env.computeFogRelativeSun();
        // todo - refact this
        // viewport is context-dependent
        this.updateViewport();

        const { renderBackend, player } = this;
        const { size, globalUniforms } = renderBackend;
        const { chunkSize } = this.world.chunkManager.grid

        globalUniforms.resolution = [size.width, size.height];
        globalUniforms.localLigthRadius = 0;

        // rain strength
        this.rain?.update(this.getWeather(), delta)
        globalUniforms.rainStrength = this.rain?.strength_val ?? 0

        let chunkBlockDist = player.state.chunk_render_dist * chunkSize.x - chunkSize.x;
        let nightshift = 1.;
        let preset = PRESET_NAMES.NORMAL;

        if(player.pos.y < 0 && this.world.info.generator.id !== 'flat') {
             nightshift = 1 - Math.min(-player.pos.y / NIGHT_SHIFT_RANGE, 1);
        }

        const getPlayerBlockColor = () : Color | null => {
            const cm = this.world.chunkManager;
            const chunk = cm.getChunk(player.chunkAddr);
            if(chunk?.inited) {
                const x = player.blockPos.x - player.chunkAddr.x * chunkSize.x
                const z = player.blockPos.z - player.chunkAddr.z * chunkSize.z
                // const biome_id = player.getOverChunkBiomeId()
                // const biome = biome_id > 0 ? player.world.chunkManager.biomes.byID.get(biome_id) : null
                // if(biome.is_sand) {
                //     return new Color(255, 255, 0, 1)
                // }
                const cell_index = z * chunkSize.x + x;
                const x_pos = chunk.packedCells[cell_index * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_R];
                const y_pos = chunk.packedCells[cell_index * PACKED_CELL_LENGTH + PACKET_CELL_WATER_COLOR_G];
                return this.maskColorTex.getColorAt(x_pos, y_pos)
            }
            return null
        }

        if(player.eyes_in_block) {
            if(player.eyes_in_block.is_water) {
                preset = PRESET_NAMES.WATER;
                chunkBlockDist = 8;

                Environment.replacePresetColor(preset, getPlayerBlockColor())

            } else if(player.eyes_in_block.name == 'NETHER_PORTAL') {
                preset = PRESET_NAMES.NETHER_PORTAL;
                chunkBlockDist = 6; //
            } else {
                preset = PRESET_NAMES.LAVA;
                chunkBlockDist = 4; //
            }
        } else if (this.clouds.isCameraInCloud(this)) {
            preset = PRESET_NAMES.CLOUD
        } else {
            const biome_id = player.getOverChunkBiomeId()
            const biome = biome_id > 0 ? this.world.chunkManager.biomes.byID.get(biome_id) : null;
            if(biome?.fog_preset_name) {
                preset = biome.fog_preset_name;
            }
        }

        this.env.setEnvState({
            chunkBlockDist,
            nightshift,
            preset
        })

        this.env.update(delta, args)

        this.checkLightTextures()

        if (this.player.currentInventoryItem) {
            const mat = BLOCK.fromId(this.player.currentInventoryItem.id);
            if(!mat.is_dummy && !mat.is_dynamic_light) {
                const power = mat.light_power_number;
                // and skip all block that have power greater that 0x0f
                // it not a light source, it store other light data
                globalUniforms.localLigthRadius = +(power <= 0x0f) * (power & 0x0f);
            }
        }

        // Base texture
        if(!this._base_texture) {
            this._base_texture = BLOCK.resource_pack_manager.get('base').textures.get('default').texture
        }
        if(!this._base_texture_n) {
            this._base_texture_n = BLOCK.resource_pack_manager.get('base').textures.get('default').texture_n
        }

        this.fallTreeLeafes()

    }

    /**
     * Trees leaf falling
     */
    fallTreeLeafes() {
        const world = this.world
        if(!world.settings.leaf_fall) {
            return false
        }
        const player_pos = this.player.lerpPos
        const xyz = new Vector()
        for(let i = 0; i < 10; i++) {
            xyz.set(
                (Math.random() - Math.random()) * 16,
                (Math.random() - Math.random()) * 16,
                (Math.random() - Math.random()) * 16
            ).addSelf(player_pos).flooredSelf()
            const tblock = world.getBlock(xyz)
            if(tblock.hasTag && tblock?.hasTag('leaves')) {
                const tblock_under = world.getBlock(tblock.posworld.add(Vector.YN))
                if(tblock_under?.id === 0) {
                    this.destroyBlock(tblock, tblock.posworld.clone().addScalarSelf(.5, .5, .5), false, 1, 0, 1)
                }
            }
        }
    }

    checkLightTextures(bindLights = true) {
        const {renderBackend} = this;
        const {pixiRender} = renderBackend;

        (pixiRender.texture as any).hasIntegerTextures = true;
        if (!this.world) {
            pixiRender.texture.bind(renderBackend._emptyTexInt, 3);
            pixiRender.texture.bind(renderBackend._emptyTex3DInt, 6);
            pixiRender.texture.bind(renderBackend._emptyTex3DInt, 7);
            pixiRender.texture.bind(renderBackend._emptyTex3DInt, 8);
            return;
        }
        const cm = this.world.chunkManager;
        // TODO: move to batcher
        pixiRender.texture.bind(cm.chunkDataTexture.getTexture(BufferBaseTexture), 3);
        pixiRender.texture.bind(cm.renderList.chunkGridTex.getTexture(), 6);
        const lp = cm.renderList.lightPool;

        // webgl bind all texture-3d-s
        if (lp) {
            // renderBackend._emptyTex3D.bind(6);
            for (let i = 1; i <= 2; i++) {
                const tex = (bindLights && lp.boundTextures[i]) || renderBackend._emptyTex3DInt;
                if (tex) {
                    pixiRender.texture.bind(tex, 6 + i);
                }
            }
        }
    }

    // Render one frame of the world to the canvas.
    draw(delta : float, args) {
        const { renderBackend, camera, player } = this;
        const { globalUniforms } = renderBackend;
        const { renderList } = this.world.chunkManager;

        this.resetBefore();

        renderBackend.stat.multidrawcalls = 0;
        renderBackend.stat.drawcalls = 0;
        renderBackend.stat.drawquads = 0;
        this.defaultShader.texture = this._base_texture;
        this.defaultShader.texture_n = this._base_texture_n;

        // upload GU data from environment
        this.env.sync(renderBackend.globalUniforms);

        // apply camera state;
        // it can depend of passes count
        camera.use(renderBackend.globalUniforms, true);

        globalUniforms.eyeinwater = player.eyes_in_block?.is_water ? 1. : 0.;
        globalUniforms.gridChunkSize.copyFrom(this.world.chunkManager.grid.chunkSize);
        globalUniforms.gridTexSize.copyFrom(renderList.chunkGridTex.size).multiplyVecSelf(globalUniforms.gridChunkSize);
        globalUniforms.update();

        this.debugGeom.clear();

        const framePass = renderBackend.beginPass({
            bgColor: this.env.interpolatedClearValue,
            clearColor: true,
            clearDepth: true,
        });

        this.env.draw(this);
        this.lightUniforms.pushOverride(this.nightVision ? 0xff: -1);
        this.defaultShader.bind(true);

        // upload important buffers here!
        renderList.uploadBuffers(this);

        // layers??
        // maybe we will create a real layer group
        for(let transparent of [false, true]) {
            if (transparent) {
                this.clouds.draw(this, delta);
            }
            for(let rp of BLOCK.resource_pack_manager.list.values()) {
                // 2. Draw chunks
                renderList.draw(this, rp, transparent);
            }
            renderBackend.batch.flush();
            if(!transparent) {
                const shader = this.defaultShader;
                // @todo Тут не должно быть этой проверки, но без нее зачастую падает, видимо текстура не успевает в какой-то момент прогрузиться
                if (shader.texture) {
                    shader.bind(true);
                    // 3. Draw mobs
                    this.drawMobs(delta, false);
                    // 4. Draw players and rain
                    // После мобов, это важно. draw также обновляет состояние. Моб-транспорт должен обработаться первым и изменить позицию модели игрока.
                    this.drawPlayers(delta);
                    // 5. Draw drop items
                    this.drawDropItems(delta);
                    // 6. Draw meshes
                    // this.meshes.draw(this, delta, player.lerpPos);
                    // 7. Draw mobs that must be drawn last (boats)
                    this.drawMobs(delta, true);
                    // 8. Draw shadows
                    this.drawShadows();
                }
            } else {
                const shader = this.defaultShader;
                if (shader.texture) {
                    // 6. Draw meshes
                    this.meshes.draw(this, delta, player.lerpPos);
                }
            }
        }
        this.lightUniforms.popOverride();

        if(this._debug_aabb.length > 0) {
            for(let aabb of this._debug_aabb) {
                this.debugGeom.addBlockGrid({
                    pos:        aabb.position,
                    size:       aabb.size,
                    lineWidth:  .15,
                    colorABGR:  0xFFFF0000, // ABGR
                })
            }
        }

        if(this.player.pos1pos2) {
            this.debugGeom.addAABB(this.player.pos1pos2, {lineWidth: .15, colorABGR: 0xFFFF0000})
            // this.debugGeom.addBlockGrid({
            //     pos:        this.player.pos1pos2.position,
            //     size:       this.player.pos1pos2.size,
            //     lineWidth:  .15,
            //     colorABGR:  0xFFFF0000, // ABGR
            // })
        }

        const overChunk = player.getOverChunk();
        if (overChunk) {
            // chunk
            if(this.world.chunkManager.draw_debug_grid) {
                // this.debugGeom.addLine(player.blockPos, overChunk.coord, {});
                this.debugGeom.addBlockGrid({
                    pos:        overChunk.coord,
                    size:       overChunk.size,
                    lineWidth:  .15,
                    colorABGR:  0xFF00FF00, // ABGR
                })
            }
            // cluster
            if(this.world.chunkManager.cluster_draw_debug_grid) {
                const CSZ = new Vector(this.world.info.generator.cluster_size)
                const cluster_coord = overChunk.coord.div(CSZ).flooredSelf().multiplyVecSelf(CSZ)
                this.debugGeom.addAABB(new AABB(
                    cluster_coord.x, cluster_coord.y, cluster_coord.z,
                    cluster_coord.x + CSZ.x, cluster_coord.y + CSZ.y, cluster_coord.z + CSZ.z
                ), {lineWidth: .25, colorABGR: 0xFFFFFFFF}) // ABGR
            }
        }

        // buildings grid
        if(this.world.mobs.draw_debug_grid) {
            if(this.world.info && this.world.isBuildingWorld()) {
                const _schema_coord = new Vector(0, 0, 0)
                const _schema_size = new Vector(0, 0, 0)
                for(const schema of BuildingTemplate.schemas.values()) {
                    _schema_size.copyFrom(schema.world.pos1).subSelf(schema.world.pos2).addScalarSelf(1, 0, 1)
                    _schema_size.y = _schema_size.y * -1 + 1
                    _schema_coord.set(schema.world.pos2.x, schema.world.pos1.y - 1, schema.world.pos2.z)
                    _schema_coord.y++
                    this.debugGeom.addAABB(new AABB(
                        _schema_coord.x, _schema_coord.y, _schema_coord.z,
                        _schema_coord.x + _schema_size.x, _schema_coord.y + _schema_size.y, _schema_coord.z + _schema_size.z
                    ), {lineWidth: .15, colorABGR: 0xFFFFFFFF}) // ABGR
                    // door
                    const dbtm = schema.world.entrance
                    this.debugGeom.addAABB(new AABB(
                        dbtm.x, dbtm.y, dbtm.z,
                        dbtm.x + 1, dbtm.y + 2, dbtm.z + 1
                    ), {lineWidth: .15, colorABGR: 0xFFFF00FF})
                    /*
                    this.debugGeom.addBlockGrid({
                        pos:        _schema_coord,
                        size:       _schema_size,
                        lineWidth:  .15,
                        colorABGR:  0xFFFFFFFF, // ABGR
                    })
                    */
                }
            }
        }

        if(player.game_mode.isSurvival() || player.game_mode.isCreative()) {
            player.pickAt.draw();
        }

        this.debugGeom.draw(renderBackend);

        // @todo и тут тоже не должно быть
        this.defaultShader.bind();
        if(!player.game_mode.isSpectator() && Qubatch.hud.active && !player.controlManager.isFreeCam) {
            this.drawInhandItem(delta)
        }

        // 4. Draw HUD
        this.HUD.draw();

        // 5. Screenshot
        if(this.make_screenshot) {
            const callback = this.make_screenshot;
            delete(this.make_screenshot);
            this.renderBackend.screenshot('image/webp', callback);
        }

        renderBackend.endPass(framePass);

        this.resetAfter();
    }

    //
    drawInhandItem(delta : float) {

        if (!this.inHandOverlay) {
            this.inHandOverlay = new InHandOverlay(this.world, this.player.skin, this);
        }

        if(this.camera.mode == CAMERA_MODE.SHOOTER) {
            this.inHandOverlay.draw(this, delta);
        }

        // we should reset camera state because a viewMatrix used for picking
        this.camera.use(this.globalUniforms);
        this.defaultShader.bind(true);
    }

    // Destroy block particles
    destroyBlock(block, pos, small, scale = 1, force = 1, count? : number) {
        const block_manager = Qubatch.world.block_manager;
        this.meshes.effects.createEmitter('destroy_block', pos, {block, small, scale, force, block_manager, count});
    }

    // Add particles
    addParticles(data) {
        let pos = new Vector(data.pos);
        this.meshes.effects.createEmitter(data.type,  pos, data);
    }

    // addAsteroid
    addAsteroid(pos, rad) {
        this.meshes.add(new Mesh_Object_Asteroid(this.world, this, pos, rad));
    }

    /**
     * Create mesh object and retrn it or null if unrecognize bbname
     */
    addBBModelForChunk(pos : Vector, bbname : string, rotate : Vector, animation_name : string, hide_groups? : any, key? : string, doubleface : boolean = false, matrix?: imat4, item_block? : DBItemBlock) : Mesh_Object_BBModel | null {
        const model = Resources._bbmodels.get(bbname)
        if(!model) {
            return null
        }
        const bbmodel = new Mesh_Object_BBModel(this, pos, rotate, model, animation_name, doubleface, false, matrix, hide_groups, item_block)
        const chunk_addr = this.world.chunkManager.grid.getChunkAddr(pos.x, pos.y, pos.z)
        return this.meshes.addForChunk(chunk_addr, bbmodel, key)
    }

    /**
     * Create mesh object and retrn it or null if unrecognize bbname
     * @param pos : Vector
     * @param bbname : string
     * @param rotate : Vector
     * @param animation_name : string
     * @param key : string
     * @param doubleface : boolean
     * @returns string
     */
    addBBModel(pos : Vector, bbname : string, rotate : Vector, animation_name : string, key? : string, doubleface : boolean = false) : Mesh_Object_BBModel | null {
        const model = Resources._bbmodels.get(bbname)
        if(!model) {
            return null
        }
        const bbmodel = new Mesh_Object_BBModel(this, pos, rotate, model, animation_name, doubleface)
        bbmodel.setAnimation(animation_name)
        return this.meshes.add(bbmodel, key)
    }

    /**
     * Set weather
     * @param {Weather} weather
     * @param {ChunkManager} chunkManager
     */
    setWeather(weather, chunkManager) {
        if(this.timeKillRain) {
            clearInterval(this.timeKillRain)
            this.timeKillRain = null
        }
        let rain = this.meshes.get('weather');
        this.weather_name = Weather.getName(weather)
        if((!rain || rain.type != this.weather_name) && weather != Weather.CLEAR) {
            if(rain) {
                rain.destroy();
            }
            rain = new Mesh_Object_Rain(this.world, this, this.weather_name, chunkManager);
            this.meshes.add(rain, 'weather');
            this.rain = rain
        }
        if(!rain) {
            return
        }
        const enabled_val = weather != Weather.CLEAR
        if(enabled_val) {
            rain.enabled = enabled_val;
        }
    }

    getWeather() {
        const name = this.weather_name // this.meshes.get('weather')?.type;
        return Weather.BY_NAME[name] || Weather.CLEAR;
    }

    // drawPlayers
    drawPlayers(delta : float) {
        this.lastDeltaForMeGui = delta
        if(this.world.players.count < 1) {
            return
        }
        let shader_binded = false
        for(const player_model of this.world.players.values()) {
            // this.camPos.distance
            if(player_model.distance != null || player_model.itsMe()) {
                if(player_model.itsMe()) {
                    this.lastDeltaForMeGui = 0
                    if(this.camera.mode == CAMERA_MODE.SHOOTER || this.player.game_mode.isSpectator()) {
                        continue;
                    }
                    if(player_model.nametag) {
                        player_model.nametag.visible = false
                    }
                }
                if(!shader_binded) {
                    shader_binded = true
                    this.defaultShader.bind()
                }
                player_model.draw(this, this.camPos, delta, this.world.mobs.draw_debug_grid)
            }
        }
    }

    // drawMobs
    drawMobs(delta : float, renderLast: boolean) : DrawMobsStat | null {

        const mobs_list = this.world.mobs.list
        if(mobs_list.size < 1) {
            return this.draw_mobs_stat
        }

        const pos_of_interest = this.player.getEyePos()

        if (renderLast) {
            for(const mob of this.mobsDrawnLast) {
                mob.draw(this, pos_of_interest, delta, this.world.mobs.draw_debug_grid)
            }
            this.mobsDrawnLast.length = 0
            return null
        }

        this.draw_mobs_stat.count = 0
        this.draw_mobs_stat.time = performance.now()
        this.defaultShader.bind()

        let prev_chunk = null
        for(let mob of mobs_list.values()) {
            const ca = mob.chunk_addr
            if(!prev_chunk || !prev_chunk.addr.equal(ca)) {
                prev_chunk = this.world.chunkManager.getChunk(ca)
            }
            if(prev_chunk && prev_chunk.cullID === this.cullID) {
                if(mob.renderLast) {
                    // запомнить моба чтобы нарисовать его на втором проходе быстро без проверок чанка
                    this.mobsDrawnLast.push(mob)
                    mob.processNetState() // даже если моб не рисуется на первом проходе - обновить его (например, чтобы его вождение обновило других мобов)
                    continue
                }
                mob.draw(this, pos_of_interest, delta, this.world.mobs.draw_debug_grid)
                this.draw_mobs_stat.count++
            }
        }

        this.draw_mobs_stat.time = performance.now() - this.draw_mobs_stat.time
        return this.draw_mobs_stat
    }

    // Draw dropped items
    drawDropItems(delta : float) {
        if(this.world.drop_items.list.size < 1) {
            return
        }
        this.defaultShader.bind()
        for(const drop_item of this.world.drop_items.list.values()) {
            drop_item.updatePlayer(this.player, delta)
            drop_item.draw(this, delta, this.world.mobs.draw_debug_grid)
        }
    }

    // Draw shadows
    drawShadows() {
        if([CAMERA_MODE.THIRD_PERSON, CAMERA_MODE.THIRD_PERSON_FRONT].indexOf(this.camera.mode) < 0) {
            return false;
        }
        const player : Player = Qubatch.player;
        if(player.game_mode.isSpectator() || player.state.sleep || player.state.sitting) {
            return false;
        }

        if(player.eyes_in_block?.is_water) {
            return false
        }

        const world = Qubatch.world;
        const TARGET_TEXTURES : [number, number, number, number] = [.5, .5, 1, 1]
        // Material (shadow)
        if(!this.material_shadow) {
            const mat = this.renderBackend.createMaterial({
                cullFace: false,
                opaque: false,
                decalOffset: 3,
                blendMode: BLEND_MODES.MULTIPLY,
                shader: this.defaultShader,
            });
            // Material
            this.material_shadow = mat.getSubMat(new TerrainBaseTexture({
                source: Resources.shadow.main,
                minFilter: 'nearest',
                magFilter: 'nearest'
            }));
        }
        //
        const a_pos = new Vector(0.5, 0.5, 0.5).addSelf(player.blockPos);
        // Build vertices for each player
        const player_pos = player.lerpPos;
        const blockPosDiff = player_pos.sub(player.blockPos);
        const vertices = [];
        const vec = new Vector();
        const appendPos = (pos : Vector) => {
            const shapes = [];
            for(let x = -1; x <= 1; x++) {
                for(let z = -1; z <= 1; z++) {
                    for(let y = 0; y >= -2; y--) {
                        vec.copyFrom(pos).addScalarSelf(x, y, z).flooredSelf();
                        const block = world.getBlock(vec);
                        if(!block?.material?.can_take_shadow) {
                            continue;
                        }
                        const block_shapes = BLOCK.getShapes(block, world, false, false);
                        for(let i = 0; i < block_shapes.length; i++) {
                            const s = [...block_shapes[i]];
                            if(s[0] < 0) s[0] = 0;
                            if(s[1] < 0) s[1] = 0;
                            if(s[2] < 0) s[2] = 0;
                            if(s[3] > 1) s[3] = 1;
                            if(s[4] > 1) s[4] = 1;
                            if(s[5] > 1) s[5] = 1;
                            if(s[4] + y <= pos.y + .5) {
                                s[0] += x;
                                // s[1] += y;
                                s[1] = (pos.y - a_pos.y - .5) - s[1] - y; // opacity value for shader
                                s[2] += z;
                                s[3] += x;
                                s[4] += y;
                                s[5] += z;
                                shapes.push(s);
                                s[1] = Math.min(Math.max(1.3 - s[1], 0), 1) * .8;
                                // const scale = 0.3;
                                // s[0] -= (s[0] - (pos.x - Math.floor(pos.x) + x - .5)) * (1 - scale);
                                // s[2] -= (s[2] - (pos.z - Math.floor(pos.z) + z - .5)) * (1 - scale);
                            }
                        }
                        break;
                    }
                }
            }
            const player_vertices = [];
            this.createShadowVertices(player_vertices, shapes, pos, TARGET_TEXTURES);
            //if(player.username != player.session.username) {
                const dist = player_pos.sub(pos.flooredSelf()).subSelf(blockPosDiff)
                for(let i = 0; i < player_vertices.length; i += GeometryTerrain.strideFloats) {
                    player_vertices[i + 0] -= dist.x;
                    player_vertices[i + 1] -= dist.z;
                    player_vertices[i + 2] -= dist.y;
                }
            //}
            vertices.push(...player_vertices);
        };
        // draw players shadow
        const _pos = new Vector()
        for(const player of world.players.values()) {
            appendPos(_pos.copyFrom(player.pos))
        }
        /*
        // draw drop items shadow
        for(let drop_item of world.drop_items.list.values()) {
            const pos = drop_item.pos.clone();
            appendPos(pos);
        }
        */
        // Create buffer, draw and destroy
        const buf = new GeometryTerrain(vertices);
        const modelMatrix = mat4.create();
        this.renderBackend.drawMesh(buf, this.material_shadow, a_pos, modelMatrix);
        buf.destroy();
    }

    // createShadowBuffer...
    createShadowVertices(vertices : float[], shapes : tupleFloat6[], pos : Vector, c : tupleFloat4) {
        let lm          = new IndexedColor(0, 0, Math.round((performance.now() / 1000) % 1 * 255));
        let flags       = QUAD_FLAGS.FLAG_QUAD_OPACITY, sideFlags = 0, upFlags = QUAD_FLAGS.FLAG_NO_FOG;
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            let x1 = shape[0];
            let y1 = shape[1];
            let z1 = shape[2];
            let x2 = shape[3];
            let y2 = shape[4];
            let z2 = shape[5];
            let xw = x2 - x1; // ширина по оси X
            let zw = z2 - z1; // ширина по оси Z
            let x = -.5 + x1 + xw/2;
            let y_top = -.5 + y2;
            lm.b = Mth.clamp(Math.round(y1 * 255), 0, 255);
            let z = -.5 + z1 + zw/2;
            //
            let c0 = Math.floor(x1 + pos.x) + c[0];
            let c1 = Math.floor(z1 + pos.z) + c[1];
            const dist = Math.sqrt((pos.x - c0) * (pos.x - c0) + (pos.z - c1) * (pos.z - c1));
            //
            if(dist <= 1.1) {
                c0 = pos.x - c0 - .5;
                c1 = pos.z - c1 - .5;
                //
                // const scale = 0.3;
                // xw *= scale;
                // zw *= scale;
                //
                vertices.push(x, z, y_top,
                    xw, 0, 0,
                    0, zw, 0,
                    -c0, -c1, c[2], c[3],
                    lm.pack(), flags | upFlags);
            }
        }
    }

    resetBefore(bindLights = true) {
        // webgl state was reset, we have to re-bind textures
        this.renderBackend.resetBefore();
        const {pixiRender}  = this.renderBackend;
        pixiRender.texture.bind(this.maskColorTex, 1);
        pixiRender.texture.bind(this.blockDayLightTex, 2);
        this.checkLightTextures(bindLights);
        this.defaultShader?.bind();
    }

    resetAfter() {
        this.renderBackend.resetAfter();
    }

    /**
    * Check if the viewport is still the same size and update
    * the render configuration if required.
    */
    updateViewport() {
        const actual_width = this.canvas.width
        const actual_height = this.canvas.height

        if (actual_width === this.viewportWidth && actual_height === this.viewportHeight)
        {
            return;
        }
        this.viewportWidth = actual_width | 0;
        this.viewportHeight = actual_height | 0;
        this.renderBackend.resize(
            actual_width | 0,
            actual_height | 0);

        this.HUD.resize(actual_width, actual_height)
        this.camera.setSize(actual_width, actual_height);
    }

    guiCam = null;

    /**
     * posX , posY in zoom
     */
    drawFromPixi(pixiRender, worldTransform, pixiBlockSize = 64, lambda: (render: Renderer) => void ) {
        const {globalUniforms:gu, lightUniforms: lu} = this;
        pixiRender.batch.flush();
        this.resetBefore(false);
        const {screen} = pixiRender;
        if (!this.guiCam) {
            this.guiCam = new Camera_3d({
                type: Camera_3d.ORTHO_CAMERA,
                max: -10,
                min: 10,
                fov: 60,
                renderType: this.renderBackend.gl ? 'webgl' : 'webgpu',
                width: screen.width,
                height: screen.height,
            });
        }
        const guiCam = this.guiCam;
        guiCam.width = -screen.width;
        guiCam.height = screen.height;
        guiCam.shiftX = worldTransform.tx - screen.width / 2;
        guiCam.shiftY = worldTransform.ty - screen.height / 2;
        // our cube side should be 64px in pixi standard?
        // negative scale because camera should look from NORTH
        guiCam.scale = 1 / worldTransform.a / pixiBlockSize;
        guiCam._updateProj();
        // larg for valid render results
        gu.fogColor = [0, 0, 0, 0];
        // gu.fogDensity = 100;
        gu.chunkBlockDist = 100;

        // when use a sun dir, brightness is factor how many of sunfactor is applied
        // sun light is additive
        gu.brightness = MIN_BRIGHTNESS; // 0.55 * 1.0; // 1.3
        // gu.sunDir = [-1, -1, 1];
        // gu.useSunDir = true;
        lu.pushOverride(0x100ff);

        guiCam.use(gu, true);
        gu.update();

        this.defaultShader.bind(true);

        lambda(this);

        this.resetAfter();

        lu.popOverride();
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
        } else {
            resp = {
                error: 'no WEBGL_debug_renderer_info',
            };
        }
        this.videoCardInfoCache = resp;
        return resp;
    }

    updateNightVision(val) {
        this.nightVision = val;
    }

    screenshot(callback) {
        this.make_screenshot = callback;
    }

    downloadTextImage() {
        Helpers.downloadImage(Qubatch.world.block_manager.resource_pack_manager.list.get('base').materials.get('base/regular/alphabet').texture.source, 'alphabet.png');
    }

    downloadInventoryImage() {
        Helpers.downloadImage(Resources.inventory.image, 'inventory.png');
    }

}