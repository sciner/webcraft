const {mat4} = glMatrix;

export class BaseBuffer {
    constructor(context, options = {}) {
        this.context = context;
        this.options = options;
        this._data = options.data;

        this.dirty = true;
    }

    /**
     *
     * @param {Float32Array} v
     */
    set data(v) {
        this.dirty = true;
        this._data = v;
    }

    get data() {
        return this._data;
    }

    update() {
        this.dirty = false;
    }

    bind() {

    }

    destroy() {

    }
}

export class BaseTexture {
    /**
     *
     * @param {BaseRenderer} context
     * @param {number} width
     * @param {number} height
     * @param {'linear' | 'nearest'} magFilter
     * @param {'linear' | 'nearest'} minFilter
     * @param {number} anisotropy
     * @param { HTMLCanvasElement | HTMLImageElement | ImageBitmap | Array<HTMLCanvasElement | HTMLImageElement | ImageBitmap> } source
     */
    constructor(context, {
        width = 1,
        height = 1,
        magFilter = 'linear',
        minFilter = 'linear',
        anisotropy = 0,
        source = null
    } = {}) {
        this.width = width;
        this.height = height;
        this.magFilter = magFilter;
        this.minFilter = minFilter;
        this.anisotropy = anisotropy;
        this.source = source;
        this.context = context;

        this.id = BaseRenderer.ID++;

        if (source) {
            this.width = Array.isArray(source) ? source[0].width : source.width;
            this.height = Array.isArray(source) ? source[0].height : source.height;
        }

        this.dirty = true;
    }

    upload() {
        this.context._textures[this.id] = this;
        this.dirty = false;
    }

    destroy() {
        delete this.context._textures[this.id];
    }

    bind() {

    }
}

export class BaseMaterial {
    constructor(context, options) {
        this.context = context;

        this.shader = options.shader;
        this.texture = options.texture || null;
        this.cullFace = options.cullFace || false;
        this.opaque = options.opaque || false;
    }
}

export class BaseTerrainShader {
    constructor(context, options) {
        this.context = context;
        this.options = options;

        this.projMatrix         = mat4.create();
        this.viewMatrix         = mat4.create();
        this.modelMatrix        = mat4.create();

        this.blockSize = 1;
        this.pixelSize = 1;
        this.chunkBlockDist = 1;
        this.brightness = 1;
        this.mipmap = 0;
        this.fogAddColor = [0,0,0,0];
        this.fogColor = [1,1,1,1];
    }

    bind() {

    }

    update() {

    }
}

export default class BaseRenderer {
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

        this._textures = {};
        this._buffers = {};
    }

    get kind() {
        return this.constructor.kind;
    }

    async init() {

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

    beginFrame(fogColor) {

    }

    endFrame() {

    }

    /**
     * Create texture unit
     * @param options
     * @return {BaseTexture}
     */
    createTexture(options) {
       throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createMaterial(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    drawMesh(geom, material) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createShader(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }

    createBuffer(options) {
        throw new TypeError('Illegal invocation, must be overridden by subclass');
    }
}

BaseRenderer.ID = 0;
