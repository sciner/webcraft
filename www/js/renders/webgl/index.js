//@ts-check
import BaseRenderer, {BaseCubeGeometry, BaseCubeShader, BaseTexture, CubeMesh} from "../BaseRenderer.js";
import {WebGLMaterial} from "./WebGLMaterial.js";
import {WebGLTerrainShader} from "./WebGLTerrainShader.js";
import {WebGLBuffer} from "./WebGLBuffer.js";
import {Helpers} from "../../helpers.js";

const TEXTURE_FILTER_GL = {
    'linear': 'LINEAR',
    'nearest': 'NEAREST'
}

const TEXTURE_MODE = {
    '2d': 'TEXTURE_2D',
    'cube': 'TEXTURE_CUBE_MAP'
}

export class WebGLCubeShader extends BaseCubeShader {
    constructor(context, options) {
        super(context, options);

        const {
            gl
        } = this.context;

        Helpers.createGLProgram(gl, options.code, (ret) => {
            this.program = ret.program;
        });

        this.u_texture =  gl.getUniformLocation(this.program, 'u_texture');
        this.u_lookAtMatrix = gl.getUniformLocation(this.program, 'u_lookAtMatrix');
        this.u_projectionMatrix = gl.getUniformLocation(this.program, 'u_projectionMatrix');
        this.u_brightness_value = gl.getUniformLocation(this.program, 'u_brightness_value');
        this.a_vertex = gl.getAttribLocation(this.program, 'a_vertex');
    }

    bind() {
        this.texture.bind(0);
        const { gl } = this.context;

        gl.useProgram(this.program);
        gl.uniform1f(this.u_brightness_value, this.brightness);
        gl.uniform1i(this.u_texture, 0);

        gl.uniformMatrix4fv(this.u_lookAtMatrix, false, this.lookAt);
        gl.uniformMatrix4fv(this.u_projectionMatrix, false, this.proj);
    }
}

export class WebGLCubeGeometry extends BaseCubeGeometry {
    constructor(context, options) {
        super(context, options);

        this.vao = null;
    }

    bind(shader) {
        const { gl } = this.context;

        if (this.vao) {
            this.context.gl.bindVertexArray(this.vao);
            return;
        }

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        this.vertex.bind();
        this.index.bind();

        gl.vertexAttribPointer(shader.a_vertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shader.a_vertex);
    }

    unbind() {
        this.context.gl.bindVertexArray(null);
    }
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

        gl.bindTexture(gl[TEXTURE_MODE[this.mode]] || gl.TEXTURE_2D, texture);
    }

    upload() {
        const { gl } = this.context;
        /**
         * @type {WebGLTexture}
         */

        const mode = Array.isArray(this.source) ? 'cube' : '2d';
        this.mode = mode;

        const t = this.texture = this.texture || gl.createTexture();
        const type = gl[TEXTURE_MODE[mode]] || gl.TEXTURE_2D;

        gl.bindTexture(type, t);

        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        if (mode === '2d') {
            if (this.source) {
                gl.texImage2D(type, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
            } else {
                gl.texImage2D(type, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            }

            gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl[TEXTURE_FILTER_GL[this.minFilter]] || gl.LINEAR);
            gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, gl[TEXTURE_FILTER_GL[this.magFilter]] || gl.LINEAR);

            super.upload();
            return;
        }
        for(let i = 0; i < 6; i ++) {
            const start = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            if (this.source) {
                gl.texImage2D(start + i, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source[i]);
            } else {
                gl.texImage2D(start + i, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            }
        }

        gl.generateMipmap(type);
        gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
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
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        return Promise.resolve(this);
    }

    resize(w, h) {
        if (this.size.width === w && this.size.height === h) {
            return;
        }

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

    createBuffer(options) {
        return new WebGLBuffer(this, options);
    }

    drawMesh(geom, material, a_pos = null, modelMatrix = null) {
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
        material.shader.updatePos(a_pos, modelMatrix);
        let gl = this.gl;
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

    createCubeMap(options) {
        return new CubeMesh(new WebGLCubeShader(this, options), new WebGLCubeGeometry(this, options));
    }

    drawCube(cube) {
        cube.shader.bind();
        cube.geom.bind(cube.shader);

        const  {
            gl
        } = this;

        gl.disable(gl.CULL_FACE);
        gl.disable(gl.DEPTH_TEST);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
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
