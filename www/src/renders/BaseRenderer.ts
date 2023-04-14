import {Color, IvanArray, Mth, Vector} from '../helpers.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import {BatchSystem} from "./batch/BatchSystem.js";
import {ShaderPreprocessor} from "./ShaderPreprocessor.js";
import type {IGeomCopyOperation} from "../geom/big_geom_batch_update.js";

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

    batchUpdate(updBuffer: BaseBuffer, copies: IvanArray<IGeomCopyOperation>, stride: number) {
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

export const BLEND_MODES = {
    NORMAL: 0,
    ADD: 1,
    MULTIPLY: 2,
    SCREEN: 3
}

export class BaseMaterial {
    [key: string]: any;
    decalOffset: number;
    constructor(context, options) {
        this.context = context;
        this.options = options;
        this.shader = options.shader;
        this.texture = options.texture || null;
        this.texture_n = options.texture_n || null;
        this.lightTex = options.lightTex || null;
        this.cullFace = options.cullFace || false;
        this.opaque = options.opaque || false;
        this.ignoreDepth = options.ignoreDepth || false;
        this.mipmap = options.mipmap || false;
        this.blendMode = options.blendMode || BLEND_MODES.NORMAL;
        this.tintColor = options.tintColor || new Color(0, 0, 0, 0);
        this.decalOffset = options.decalOffset || 0;
    }

    changeLighTex(light) {
        this.lightTex = light;
    }

    getSubMat() {
        return null;
    }

    destroy() {
        this.shader = null;
        this.context = null;
        this.texture = null;
        this.options = null;
    }
}

export class GlobalUniformGroup {
    [key: string]: any;

    constructor(options ? : any) {
        this.projMatrix         = mat4.create();
        this.viewMatrix         = mat4.create();

        this.chunkBlockDist = 1;
        this.brightness = 1;
        this.resolution = [1, 1];
        this.fogAddColor = [0,0,0,0];
        this.fogColor = [1,1,1,1];
        this.time = performance.now();

        this.testLightOn = 0;
        this.crosshairOn = true;

        this.sunDir = [0, 0, 0];
        this.useSunDir = false;

        this.updateID = 0;
        this.camPos = new Vector();
        this.useNormalMap = false;

        this.localLigthRadius = 0;
        this.rainStrength = 0;
        this.lightOverride = -1;
    }

    update() {
        this.updateID++;
    }

}

export class CubeMesh {
    shader: any;
    geom: any;

    constructor(shader, geom) {
        this.shader = shader;
        this.geom = geom;
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

        proj.set(projMatrix);
        lookAt.set(lookAtMatrix);
        mat4.rotate(lookAt, lookAt, Math.PI / 2, [1, 0, 0]);

        lookAt[12] = 0;
        lookAt[13] = 0;
        lookAt[14] = 0;

        this.shader.resolution = [width, height];

        this.shader.context.drawCube(this);
    }
}

export class BaseCubeGeometry {
    [key: string]: any;

    constructor(context, options) {
        this.context = context;
        this.options = options;

        this.index = context.createBuffer({
            data: new Uint16Array([
                0, 1, 2, 2, 3, 0, 4, 5, 6, 6, 7, 4,
                1, 5, 6, 6, 2, 1, 0, 4, 7, 7, 3, 0,
                3, 2, 6, 6, 7, 3, 0, 1, 5, 5, 4, 0
            ]),
            index: true
        });

        this.vertex = context.createBuffer({
            data: new Float32Array([
                -1, -1, 1,
                1, -1, 1,
                1, 1, 1,
                -1, 1, 1,
                -1, -1, -1,
                1, -1, -1,
                1, 1, -1,
                -1, 1, -1
            ])
        });

        this.buffers = [
            this.vertex, this.index
        ];
    }

}

export default class BaseRenderer {
    [key: string]: any;

    batch : BatchSystem
    preprocessor = new ShaderPreprocessor();
    globalBufs: Dict<BaseBuffer> = {};

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

        this.globalUniforms = new GlobalUniformGroup();
        /**
         * @type {{[key: string]: string}}
         */
        if (options.defines) {
            this.preprocessor.global_defines = Object.assign({}, options.defines);
        }

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

    /**
     *
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
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

    drawMesh(geom, material, a_pos = null, modelMatrix = null, draw_type? : string) {
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
    }

    resetAfter() {
    }

    destroy() {

    }

    static ID = 0;
}
