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
        anisotropy = 16,
        mode = '2d',
        source = null
    } = {}) {
        this.width = width;
        this.height = height;
        this.magFilter = magFilter;
        this.minFilter = minFilter;
        this.anisotropy = anisotropy;
        this.source = source;
        this.context = context;
        this.mode = mode;

        this.id = BaseRenderer.ID++;

        if (source) {
            this.width = source.width;
            this.height = source.height;
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

        this.projMatrix         = mat4.create();
        this.viewMatrix         = mat4.create();
        this.modelMatrix        = mat4.create();

        this.blockSize = 1;
        this.pixelSize = 1;
        this.chunkBlockDist = 1;
        this.brightness = 1;
        this.mipmap = 0;
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
}

BaseRenderer.ID = 0;
