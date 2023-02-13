import { BaseRenderTarget } from "../BaseRenderer.js";

export class WebGLRenderTarget extends BaseRenderTarget {
    [key: string]: any;
    constructor(context, options) {
        super(context, options);

        /**
         * @type {WebGLFramebuffer}
         */
        this.framebuffer = null;

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
        this.texture.bind(0);
        this.framebuffer = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.texture.texture,
            0
        );

        if (this.depthTexture) {
            this.depthTexture.bind(0);

            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_STENCIL_ATTACHMENT,
                gl.TEXTURE_2D,
                this.depthTexture.texture,
                0
            );
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    destroy() {
        if (!this.framebuffer) {
            return;
        }

        super.destroy();

        this.framebuffer && this.context.gl.deleteFramebuffer(this.framebuffer);
        this.depthTexture && this.context.gl.deleteRenderbuffer(this.depthTexture);
        this.framebuffer = null;
        this.depthTexture = null;
    }
}