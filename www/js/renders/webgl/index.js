//@ts-check
import BaseRenderer,  { BaseTexture } from "../BaseRenderer.js";

const TEXTURE_FILTER_GL = {
    'linear': 'LINEAR',
    'nearest': 'NEAREST'
}

export class WebGLTexture extends BaseTexture {

    bind() {
        if (this.dirty) {
            return this.upload();
        }

        const {
            gl
        } = this.context;

        const {
            texture
        } = this;

        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    upload() {
        const { gl } = this.context;
        /**
         * @type {WebGLTexture}
         */
        const t = this.texture = this.texture || gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);

        if (this.source) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[TEXTURE_FILTER_GL[this.minFilter]] || gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl[TEXTURE_FILTER_GL[this.magFilter]] || gl.LINEAR);

        super.upload();
    }

    destroy() {
        if (!this.texture) {
            return;
        }

        const  { gl } = this.context;

        gl.deleteTexture(this.texture);

        this.texture = null;
        this.source = null;
        this.width = this.height = 0;

        super.destroy();
    }
}

export default class WebGLRenderer extends BaseRenderer {
    constructor(view, options) {
        super(view, options);
        /**
         *
         * @type {WebGL2RenderingContext}
         */
        this.gl = null;

        this._textures = [];
    }

    async init() {
        this.gl = this.view.getContext('webgl2', this.options);

        return Promise.resolve(this);
    }

    resize(w, h) {
        super.resize(w, h);

        this.view.width = w;
        this.view.height = h;
    }

    _configure() {
        super._configure();
    }

    createTexture(options) {
        return new WebGLTexture(this, options);
    }
}

/**
 * 
 * @param {HTMLCanvasElement} view 
 */
WebGLRenderer.test = function(view, options = {}) {
    /**
     * @type {*}
     */
    const context = view.getContext('webgl2', options);

    return !!context;
}

WebGLRenderer.kind = 'webgl';