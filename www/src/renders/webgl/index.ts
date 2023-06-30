//@ts-check
import {BaseRenderer, BaseCubeGeometry, CubeMesh} from "../BaseRenderer.js";
import {WebGLTerrainShader} from "./WebGLTerrainShader.js";
import {Resources} from "../../resources.js";
import { WebGLUniversalShader } from "./WebGLUniversalShader.js";
import {GLMeshDrawer} from "./GLMeshDrawer.js";
import {GLCubeDrawer} from "./GLCubeDrawer.js";
import {GLChunkDrawer} from "./GLChunkDrawer.js";
import {GLLineDrawer} from "./GLLineDrawer.js";
import {WebGLFluidShader} from "./WebGLFluidShader.js";
import * as VAUX from 'vauxcel';

import glMatrix from "@vendors/gl-matrix-3.3.min.js";
const {mat4} = glMatrix;

const clamp = (a, b, x) => Math.min(b, Math.max(a, x));

VAUX.extensions.add(GLChunkDrawer, GLLineDrawer, GLMeshDrawer, GLCubeDrawer);

export class WebGLCubeShader extends WebGLUniversalShader {
    constructor(context, options) {

        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }
        Object.assign(options.uniforms, {
            u_viewMatrix2: mat4.create(),
            u_projMatrix2: mat4.create(),
        });
        super(context, options);
    }

    /**
     * @deprecated
     */
    get lookAt() {
        return this.uniforms['u_viewMatrix2']
    }

    /**
     * @deprecated
     */
    get proj() {
        return this.uniforms['u_projMatrix2'];
    }

    bind(force = false) {
        super.bind(force);
    }

}

export class WebGLCubeGeometry extends BaseCubeGeometry {
}

export default class WebGLRenderer extends BaseRenderer {
    [key: string]: any;

    constructor(view, options) {
        super(view, options);
        /**
         *
         * @type {WebGL2RenderingContext}
         */
        this.gl = null;
        this._activeTextures = {};

        // test only
        /**
         * @type {WebGLRenderTarget}
         */
        this._mainFrame = null;

        this.depthState = {
            write: true,
            test: true,
        }
    }

    async init(args) {
        await super.init(args);

        this.pixiRender = new VAUX.Renderer({...this.options,
            clearBeforeRender: false,
            view: this.view, width: this.view.width, height: this.view.height});

        this.pixiRender.geometry.copier = new VAUX.TFBufferCopier(16);

        for (let key in this.pixiRender.plugins) {
            let val = this.pixiRender.plugins[key];
            if (val.initQubatch) {
                this[key] = val;
                val.initQubatch(this);
            }
        }

        this.batch = this.pixiRender.batch;

        const gl = this.gl = this.pixiRender.gl;

        this.pixiRender.texture.bind(this._emptyTex3D, 0);
        (this.pixiRender.texture as any).emptyTextures[gl.TEXTURE_3D] = this._emptyTex3D._glTextures[this.pixiRender.CONTEXT_UID];

        this.resetBefore();
        this.multidrawExt = gl.getExtension('WEBGL_multi_draw');
        this.multidrawBaseExt = gl.getExtension('WEBGL_multi_draw_instanced_base_vertex_base_instance');

        this.line.init();
    }

    resize(w, h) {
        if (this.size.width === w && this.size.height === h) {
            return;
        }
        super.resize(w, h);
        this.resolution = [w, h];
    }
    createProgram({vertex, fragment, tfVaryings}, preprocessArgs = {}) {
        const program = new VAUX.Program({
            vertex: this.preprocessor.applyBlocks(vertex, preprocessArgs),
            fragment: this.preprocessor.applyBlocks(fragment, preprocessArgs),
        }, tfVaryings ? { transformFeedbackVaryings : {
            names: tfVaryings,
            bufferMode: 'interleaved'
        }} : null );

        const shader = new VAUX.Shader(program);
        this.pixiRender.shader.bind(shader, true);

        return program;
    }

    createShader(options) {
        return new WebGLTerrainShader(this, options);
    }

    async createResourcePackShader(options) {
        let shaderCode = await Resources.loadWebGLShaders(options.vertex, options.fragment);
        if (options.shaderName === 'fluidShader') {
            return new WebGLFluidShader(this, shaderCode);
        }
        return this.createShader(shaderCode);
    }

    /**
     * Blit color from current attached framebuffer to specific area of canvas
     * @param {{x?: number, y?: number, w?: number, h?: number}} param0
     * @returns
     */
    blitRenderTarget({x = 0, y = 0, w = null, h = null} = {}) {
        /**
         * @type {WebGLRenderTarget}
         */
        const target = this._target;
        if (!target) {
            return;
        }

        const gl = this.gl;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

        gl.blitFramebuffer(
            0, 0, target.width, target.height,
            x, y, (w || this.size.width) + x, (h || this.size.height) + y,
            gl.COLOR_BUFFER_BIT, gl.LINEAR
        );

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    }

    /**
     * Blit one render target to another size-to-size
     * @param {WebGLRenderTarget} fromTarget
     * @param {WebGLRenderTarget} toTarget
    */
    blit(fromTarget = null, toTarget = null) {
        fromTarget = fromTarget || null;
        toTarget = toTarget || null;

        if (fromTarget === toTarget) {
            throw new TypeError('fromTarget and toTarget should be different');
        }

        /**
         * @type {WebGLRenderTarget}
         */
        const target = this._target;
        const gl = this.gl;

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fromTarget ? fromTarget.framebuffer : null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, toTarget ? toTarget.framebuffer : null);

        const fromSize = fromTarget ? fromTarget : this.size;
        const toSize = toTarget ? toTarget : this.size;
        const fromDepth = fromTarget ? fromTarget.options.depth : true;
        const toDepth = toTarget ? toTarget.options.depth : true;
        const bits = (toDepth && fromDepth)
            ? (gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
            : gl.COLOR_BUFFER_BIT;


        gl.blitFramebuffer(
            0, 0, fromSize.width, fromSize.height,
            0, 0, toSize.width, toSize.height,
            bits, gl.LINEAR
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    }

    createCubeMap(options) : CubeMesh {
        return new CubeMesh(new WebGLCubeShader(this, options), new WebGLCubeGeometry(this, options));
    }

    /**
     * Read pixels from framebuffer
     * @returns {Uint8Array}
     */
    toRawPixels() {
        const buffer = new Uint8Array(this.view.width * this.view.height * 4);
        this.gl.readPixels(0,0, this.view.width, this.view.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, buffer);
        return buffer;
    }

    /**
     *
     * @param {string} format
     * @param {Function} callback
     */
    async screenshot(format, callback) {
        const buffer = this.toRawPixels();
        const width = this.view.width;
        const height = this.view.height;
        for (let i = 0; i < buffer.length; i += 4) {
            const a = buffer[i + 3] / 0xff;
            if (!a) {
                continue;
            }
            buffer[i + 0] = Math.round(buffer[i + 0] / a);
            buffer[i + 1] = Math.round(buffer[i + 1] / a);
            buffer[i + 2] = Math.round(buffer[i + 2] / a);
        }
        const data = new ImageData(width, height);
        for(let i = 0; i < height; i ++) {
            const invi = height - i - 1;
            data.data.set(
                buffer.subarray(invi * width * 4, (invi + 1) * width * 4),
                i * width * 4);
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.canvas.width = width;
        ctx.canvas.height = height;
        ctx.putImageData(data, 0, 0);
        ctx.drawImage(Qubatch.hud.canvas, 0, 0, width, height);
        ctx.canvas.toBlob(function(blob) {
            callback(blob);
        }, format);
    }

    reportTexture(target: number) {
        const props = [
            'TEXTURE_BASE_LEVEL',
            'TEXTURE_IMMUTABLE_FORMAT',
            'TEXTURE_IMMUTABLE_LEVELS',
            'TEXTURE_MAX_LEVEL',
            'TEXTURE_MAX_LOD',
            'TEXTURE_MIN_LOD',
            'TEXTURE_MAG_FILTER',
            'TEXTURE_MIN_FILTER'
        ];
        const {gl} = this;
        target = target | gl.TEXTURE_2D;
        console.log(`isTexture = ${gl.isTexture(this.texture)}`)
        for (let k = 0; k < props.length;k++) {
            console.log(`${props[k]} = ${gl.getTexParameter(target, gl[props[k]])}`);
        }
    }

    destroy() {
        this.gl?.getExtension("WEBGL_lose_context").loseContext();
    }

    static test(view: HTMLCanvasElement, options: WebGLContextAttributes = {}) {
        const context = view.getContext('webgl2', options);
        return !!context;
    }

    static kind = 'webgl';
}
