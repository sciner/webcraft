// ///<reference types='vauxcel'/>

import {IvanArray, Mth, Vector} from '../helpers.js';
import {BatchSystem} from "./batch/BatchSystem.js";
import {ShaderPreprocessor} from "./ShaderPreprocessor.js";
import type GeometryTerrain from '../geometry_terrain.js';
import type {WebGLMaterial} from './webgl/WebGLMaterial.js';
import type {GeomCopyOperation} from "../geom/big_geom_batch_update.js";
import * as VAUX from 'vauxcel';
import {BLEND_MODES, Geometry} from 'vauxcel';
import {GlobalUniformGroup, LightUniformGroup} from "./uniform_groups.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js";

const {mat4} = glMatrix;

export interface PassOptions {
    fogColor?: [number, number, number, number]
    clearColor?: boolean
    clearDepth?: boolean
    target?: BaseRenderTarget
    viewport?: [number, number, number, number]
}

/**
 * BaseRenderTarget
 */
export class BaseRenderTarget {
    [key: string]: any;
    constructor (context, options = {width: 1, height: 1, depth: true}) {
        this.context = context;
        this.options = options;
        /**
         * @type {BaseTexture}
         */
        this.texture = null;
        /**
         * @type {BaseTexture}
         */
        this.depthTexture = null;
        this.valid = false;
    }

    get width() {
        return this.options.width;
    }

    get height() {
        return this.options.height;
    }

    resize(w, h) {
        this.destroy();
        this.options.width = w;
        this.options.height = h;

        this.init();
    }

    init() {
        this.texture = this.context.createTexture(this.options);
        if (this.options.depth) {
            this.depthTexture = this.context.createTexture({ ...this.options, type: 'depth24stencil8' });
        }
        this.valid = true;
    }

    flush() {

    }

    /**
     * Read pixels from framebuffer
     * @returns {Uint8Array | Promise<Uint8Array>}
     */
    toRawPixels(): any {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    /**
     * @param {'image' | 'bitmap' | 'canvas'} mode
     * @returns {Promise<Image | ImageBitmap | HTMLCanvasElement>}
     */
    async toImage(mode = 'image') {
        let buffer = this.toRawPixels();

        if (buffer instanceof Promise) {
            buffer = await buffer;
        }

        for (let i = 0; i < buffer.length; i += 4) {
            const a = buffer[i + 3] / 0xff;

            if (!a) {
                continue;
            }

            buffer[i + 0] = Math.round(buffer[i + 0] / a);
            buffer[i + 1] = Math.round(buffer[i + 1] / a);
            buffer[i + 2] = Math.round(buffer[i + 2] / a);
        }

        const data = new ImageData(this.width, this.height);

        for(let i = 0; i < this.height; i ++) {
            const invi = this.height - i - 1;
            data.data.set(
                buffer.subarray(invi * this.width * 4, (invi + 1) * this.width * 4),
                i * this.width * 4);
        }

        if (mode === 'bitmap') {
            return self.createImageBitmap(data);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.canvas.width = this.width;
        ctx.canvas.height = this.height;
        ctx.putImageData(data, 0, 0);

        if (mode === 'canvas') {
            return Promise.resolve(canvas);
        }

        const img = new Image(this.width, this.height);

        return new Promise(res => {
            img.onload = () => res(img);
            img.src = ctx.canvas.toDataURL();

            ctx.canvas.width = ctx.canvas.height = 0;
        });
    }

    destroy() {
        this.valid = false;
        if (this.texture) {
            this.texture.destroy();
        }

        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.texture = null;
        this.depthTexture = null;
    }
}

interface BufferOptions {data?: ArrayBufferLike, index?: boolean, bigLength?: number, usage?: 'static' | 'dynamic' }

export class BaseBuffer {
    index: boolean;
    _data: Float32Array | Uint16Array | Int32Array;
    context: BaseRenderer;
    options: BufferOptions;
    bigLength: number;
    dirty: boolean;
    /**
     * notify VAO of big resize
     */
    bigResize = false;

    constructor(context, options: BufferOptions= {}) {
        this.context = context;
        this.options = options;
        this._data = options.data as any;
        this.index = !!options.index;
        this.bigLength = options.bigLength || 0;

        this.dirty = true;
    }
    /**
     *
     * @param {Float32Array | Uint16Array} v
     */
    set data(v) {
        this.dirty = true;
        this._data = v;
    }

    get data() {
        return this._data;
    }

    bind(loc?: number) {
    }

    update(loc?: number) {
        this.dirty = false;
    }

    updatePartial(len: number) {

    }

    multiUpdate(updates) {

    }

    batchUpdate(updBuffer: BaseBuffer, copies: IvanArray<GeomCopyOperation>, stride: number) {
    }

    destroy() {

    }
}

export class BaseTexture {
    [key: string]: any;
    /**
     *
     * @param {BaseRenderer} context
     * @param {number} width
     * @param {number} height
     * @param {'linear' | 'nearest'} magFilter
     * @param {'linear' | 'nearest'} minFilter
     * @param {TerrainTextureUniforms} style
     * @param {'rgba8u' | 'depth24stencil8'} type
     * @param { HTMLCanvasElement | HTMLImageElement | ImageBitmap | Array<HTMLCanvasElement | HTMLImageElement | ImageBitmap> } source
     */
    constructor(context, {
        width = 1,
        height = 1,
        magFilter = 'linear',
        minFilter = 'linear',
        style = null,
        source = null,
        type = 'rgba8u',
        textureWrapMode = null
    } = {}) {
        this.width = width;
        this.height = height;
        this.magFilter = magFilter;
        this.minFilter = minFilter;
        this.source = source;
        this.style = style;
        this.context = context;
        this.type = type;
        this.textureWrapMode = textureWrapMode;

        this.id = BaseRenderer.ID++;
        this.usage = 0;
        this.isEmpty = false;

        if (source && !source.byteLength) {
            this.width = Array.isArray(source) ? source[0].width : source.width;
            this.height = Array.isArray(source) ? source[0].height : source.height;
        }

        this.dirty = true;

        context._textures.push(this);
    }

    get isUsed() {
        return this.usage > 1;
    }

    upload() {
        this.context._activeTextures[this.id] = this;
        this.dirty = false;
    }

    destroy() {
        this.usage --;

        if (this.usage > 0) {
            return;
        }

        delete this.context._activeTextures[this.id];
        this.context._textures = this.context._textures.filter((e) => e !== this);
    }

    bind() {

    }

    isSimilar({
        magFilter = 'linear',
        minFilter = 'linear',
        style = null,
        source = null,
    }) {
        return magFilter === this.magFilter && this.minFilter === minFilter && this.source === source;
    }
}

export class CubeMesh {
    shader: any;
    geom: any;
    state: VAUX.State;

    constructor(shader, geom) {
        this.shader = shader;
        this.geom = geom;
        this.state = new VAUX.State();
        this.state.blendMode = BLEND_MODES.NORMAL_NPM;
    }

    get lookAt() {
        return this.shader.lookAt;
    }

    get proj() {
        return this.shader.proj;
    }

    draw (lookAtMatrix, projMatrix, width, height) {
        const {
            lookAt, proj
        } = this;

        mat4.copy(proj, projMatrix);
        mat4.copy(lookAt, lookAtMatrix);
        // mat4.rotate(lookAt, lookAt, Math.PI / 2, [1, 0, 0]);

        lookAt[12] = 0;
        lookAt[13] = 0;
        lookAt[14] = 0;

        this.shader.resolution = [width, height];
        this.shader.context.drawCube(this);
    }
}

export class BaseCubeGeometry extends Geometry {
    [key: string]: any;

    context: BaseRenderer;
    options: any;
    vertex: VAUX.Buffer;
    constructor(context, options) {
        super();
        this.context = context;
        this.options = options;

        this.initBuffers();
    }

    initBuffers()
    {
        this.vertex = new VAUX.Buffer(new Float32Array([
            -1, -1, 1,
            1, -1, 1,
            1, 1, 1,
            -1, 1, 1,
            -1, -1, -1,
            1, -1, -1,
            1, 1, -1,
            -1, 1, -1
        ]), true);

        this.addAttribute('a_vertex', this.vertex, 3);

        this.addIndex(new VAUX.Buffer(new Uint16Array([
            0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4,
            1, 5, 6, 6, 2, 1, 0, 4, 7, 7, 3, 0,
            3, 2, 6, 6, 7, 3, 0, 1, 5, 5, 4, 0
        ]), true, true));
    }
}

export class BaseRenderer {
    [key: string]: any;

    batch : BatchSystem
    preprocessor = new ShaderPreprocessor();
    globalBufs: Dict<BaseBuffer> = {};
    pixiRender: VAUX.Renderer = null;

    /**
     *
     * @param {HTMLCanvasElement} view
     * @param {*} options
     */
    constructor(view, options) {
        this.view = view;
        this.options = options;
        this.size = {
            width: 0,
            height: 0
        };
        this.stat = {
            drawcalls: 0,
            drawquads: 0,
            multidrawcalls: 0,
        };

        /**
         * @type {[number, number, number, number]}
         */
        this._clearColor = [0,0,0,0];

        /**
         * @type {[number, number, number, number]}
         */
        this._viewport = [0,0,0,0];

        /**
         * @type {BaseRenderTarget}
         */
        this._target = null;

        this._activeTextures = {};

        /**
         * @type {BaseTexture[]}
         */
        this._textures = [];

        this._buffers = {};
        this._emptyTex = this.createTexture({
            source: new Uint8Array(4)
        });
        this._emptyTex.isEmpty = true;
        this._emptyTexInt = this.createTexture({
            type: 'rgba32sint',
            source: new Int32Array(4)
        });
        this._emptyTexInt.isEmpty = true;

        this._emptyTex3D = this.createTexture3D({
            data: new Uint8Array(4)
        })
        this._emptyTex3D.isEmpty = true;
        this._emptyTex3D.emptyRegion = this._emptyTex3D;

        this._emptyTex3DInt = this.createTexture3D({
            data: new Int32Array(1), type: 'r32sint'
        });
        this._emptyTex3DInt.isEmpty = true;
        this._emptyTex3DInt.emptyRegion = this._emptyTex3DInt;

        this._emptyTex3DUint = this.createTexture3D({
            data: new Uint8Array(4), type: 'rgba8uint'
        });
        this._emptyTex3DUint.isEmpty = true;
        this._emptyTex3DUint.emptyRegion = this._emptyTex3DUint;

        this.globalUniforms = new GlobalUniformGroup();
        this.lightUniforms = new LightUniformGroup();
        /**
         * @type {{[key: string]: string}}
         */
        if (options.defines) {
            this.preprocessor.global_defines = Object.assign({}, options.defines);
        }

        this.state3d = new VAUX.State();
        this.state3d.blendMode = VAUX.BLEND_MODES.NORMAL_NPM;
        this.state3d.depthTest = true;
        this.state3d.cullFace = true;

        this.batch = new BatchSystem(this);

        this.multidrawExt = null;
    }

    get kind() {
        return (this.constructor as any).kind;
    }

    async init(options: { shaderPreprocessor?: ShaderPreprocessor} = {}) {
        if (options.shaderPreprocessor) {
            this.preprocessor.merge(options.shaderPreprocessor);
        }
        if (Object.keys(this.preprocessor.blocks).length === 0) {
            console.warn('Shader blocks is empty');
        }
    }

    _onReplace(replace, offset, string, args = {}) {
        const {
            blocks
        } = this;

        const key = replace.trim();

        if (!(key in blocks)) {
            throw '[Preprocess] Block for ' + key + 'not found';
        }

        // compute pad spaces
        let pad = 0;
        for(pad = 0; pad < 32; pad ++) {
            if (string[offset - pad - 1] !== ' ') {
                break;
            }
        }

        let block = blocks[key]
            .split('\n')
            // we should skip first block because pad applied in repalce
            .map((e, i) => (' '.repeat(i === 0 ? 0 : pad) + e))
            .join('\n');

        const defines = args[key] || {};

        if (defines.skip) {
            return '// skip block ' + key;
        }

        for(const argkey in defines) {
            const r = new RegExp(`#define[^\\S]+(${argkey}\\s+)`, 'gmi');

            block = block.replaceAll(r, `#define ${argkey} ${defines[argkey]} // default:`);
        }

        return block;
    }

    resetState()
    {
        this.pixiRender.state.set(this.state3d);
    }

    /**
     * @deprecated
     * @see beginPass
     * @param {BaseRenderTarget} target
     */
    setTarget(target) {
        if (target && !target.valid) {
            throw 'Try bound invalid RenderTarget';
        }

        this._target = target;
    }

    resize(width : number, height : number) {
        this.size = {
            width, height
        }
        this._configure();
    }

    _configure() {

    }

    /**
     * Begin render pass to specific target
     * @param {PassOptions} param0
     */
    beginPass({
        fogColor = [0,0,0,0],
        clearDepth = true,
        clearColor = true,
        target = null,
        viewport = null
    }) {
        if (target && !target.valid) {
            throw 'Try bound invalid RenderTarget';
        }

        this._target = target;

        const { size } = this;

        const limit = target
            ? target
            : size;

        const x = viewport
            ? Mth.clamp(0, limit.width, viewport[0] || 0)
            : 0;

        const y = viewport
            ? Mth.clamp(0, limit.height, viewport[1] || 0)
            : 0;

        const width = viewport
            ? Mth.clamp(0, limit.width, viewport[2] || limit.width)
            : limit.width;


        const height = viewport
            ? Mth.clamp(0, limit.height, viewport[3] || limit.height)
            : limit.height;

        this._viewport[0] = x;
        this._viewport[1] = y;
        this._viewport[2] = width;
        this._viewport[3] = height;

        this._clearColor[0] = fogColor[0] || 0;
        this._clearColor[1] = fogColor[1] || 0;
        this._clearColor[2] = fogColor[2] || 0;
        this._clearColor[3] = fogColor[3] || 0;
    }

    /**
     * Execute render and close current pass
     */
    endPass() {
        this.batch.flush();
    }

    /**
     * @deprecated
     * @see beginPass
     * @param {} fogColor
     */
    beginFrame(fogColor) {

    }

    /**
     * @deprecated
     * @see endPass
     */
    endFrame() {

    }

    clear({
        clearDepth, clearColor
    }) {

    }

    /**
     * Blit one render target to another size-to-size
     * @param {BaseRenderTarget} fromTarget
     * @param {BaseRenderTarget} toTarget
     */
    blit(fromTarget = null, toTarget = null) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    /**
     * Blit active render target to another, can be used for blitting canvas too
     * @param {BaseRenderTarget} toTarget
     */
    blitActiveTo(toTarget) {
        this.blit(this._target, toTarget);
    }

    /**
     * Create render target
     * @param options
     * @return {BaseRenderTarget}
     */
    createRenderTarget(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    /**
     * Create texture unit
     * @param options
     * @return {BaseTexture}
     */
    createTexture(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createTexture3D(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createMaterial(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    drawMesh(geom : GeometryTerrain, material : WebGLMaterial, a_pos : Vector = null, modelMatrix : imat4 = null, draw_type? : string) {
        if (geom.size === 0) {
            return;
        }
        this.batch.setObjectDrawer(this.mesh);
        this.mesh.draw(geom, material, a_pos, modelMatrix, draw_type);
    }

    drawCube(cube) {
        this.batch.setObjectDrawer(this.cube);
        this.cube.draw(cube);
    }

    createShader(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createLineShader(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    /**
     *
     * @param {*} options
     * @returns {Promise<any>}
     */
    async createResourcePackShader(options): Promise<any> {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createBuffer(options): BaseBuffer {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createCubeMap(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    resetBefore() {
        this.pixiRender.shader.reset();
        this.pixiRender.state.reset();
        this.resetState();
    }

    resetAfter() {
        this.pixiRender.shader.reset();
        this.pixiRender.geometry.reset();
    }

    destroy() {

    }

    static ID = 0;
}
