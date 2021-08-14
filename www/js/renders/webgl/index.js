//@ts-check
import BaseRenderer, {BaseTexture} from "../BaseRenderer.js";
import {WebGLMaterial} from "./WebGLMaterial.js";
import {WebGLTerrainShader} from "./WebGLTerrainShader.js";

const TEXTURE_FILTER_GL = {
    'linear': 'LINEAR',
    'nearest': 'NEAREST'
}

export class WebGLTexture extends BaseTexture {
    bind(location) {
        location = location || 0;

        const {
            gl
        } = this.context;

        gl.activeTexture(gl.TEXTURE0 + location);

        if (this.dirty) {
            return this.upload();
        }

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

        this._mat = null;
    }

    async init() {
        const gl = this.gl = this.view.getContext('webgl2', this.options);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        return Promise.resolve(this);
    }

    resize(w, h) {
        super.resize(w, h);

        this.view.width = w;
        this.view.height = h;
    }

    _configure() {
        super._configure();

        const {gl} = this;

        gl.viewportWidth        = this.view.width;
        gl.viewportHeight       = this.view.height;
    }

    createMaterial(options) {
        return new WebGLMaterial(this, options);
    }

    createTexture(options) {
        return new WebGLTexture(this, options);
    }

    createShader(options) {
        return new WebGLTerrainShader(this, options);
    }

    drawMesh(geom, material, a_pos) {
        if (geom.size === 0) {
            return;
        }
        if (this._mat !== material) {
            if (this._mat) {
                this._mat.unbind();
            }
            this._mat = material;
            this._mat.bind();
        }
        geom.bind(material.shader);
        let gl = this.gl;
        if (a_pos) {
            gl.uniform3fv(this.u_add_pos, a_pos);
        } else {
            gl.uniform3fv(this.u_add_pos, [0, 0, 0]);
        }
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, geom.size);
    }

    beginFrame(fogColor) {
        const {gl} = this;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(...fogColor);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    endFrame() {

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
