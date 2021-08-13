export class BaseTexture {
    /**
     *
     * @param {BaseRenderer} context
     * @param {number} width
     * @param {number} height
     * @param {'linear' | 'nearest'} magFilter
     * @param {'linear' | 'nearest'} minFilter
     * @param {number} anisotropy
     * @param { HTMLCanvasElement | HTMLImageElement | ImageBitmap } source
     */
    constructor(context, {
        width = 1,
        height = 1,
        magFilter = 'linear',
        minFilter = 'linear',
        anisotropy = 16,
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

    /**
     * Create texture unit
     * @param options
     * @return {BaseTexture}
     */
    createTexture(options) {
       throw new TypeError('Illegal invocation, must be overridden by subclass');
    }
}

BaseRenderer.ID = 0;