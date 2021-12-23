import { BaseRenderTarget, BaseTerrainShader } from "../BaseRenderer.js";

export class WebGLRenderTarget extends BaseRenderTarget {
    constructor(context, options) {
        super(context, options);

        /**
         * @type {WebGLFramebuffer}
         */
        this.framebuffer = null; 

        /**
         * @type {WebGLRenderbuffer}
         */
        this.depthBuffer = null;

        this.init();
    }

    /**
     * Read pixels from framebuffer
     * @returns {Uint8Array}
     */
    toRawPixels() {
        /**
         * @type {WebGL2RenderingContext}
         */
        const gl = this.context.gl;
        const old = this.context._target;
        const buffer = new Uint8Array(this.width * this.height * 4);

        this.context.setTarget(this);

        gl.readPixels(0,0,this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);

        this.context.setTarget(old);

        return buffer;
    }

    init() {
        super.init();
        /**
         * @type {WebGL2RenderingContext}
         */
        const gl = this.context.gl;

        // we should init texture before linking
        this.texture.upload();
        this.framebuffer = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.texture.texture,
            0
        );
        
        if (this.options.depth) {
            this.depthBuffer = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer);
            gl.renderbufferStorage(
                gl.RENDERBUFFER,
                gl.DEPTH_STENCIL,
                this.width,
                this.height
            );
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.RENDERBUFFER,
                this.depthBuffer
            );
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }

    destroy() {
        if (!this.framebuffer) {
            return;
        }

        super.destroy();

        this.framebuffer && this.context.gl.deleteFramebuffer(this.framebuffer);
        this.depthBuffer && this.context.gl.deleteRenderbuffer(this.depthBuffer);
        this.framebuffer = null;
        this.depthBuffer = null;
    }
}