import {BaseMaterial, BLEND_MODES} from "../BaseRenderer.js";
import {TerrainTextureUniforms} from "../common.js";

export class WebGLMaterial extends BaseMaterial {
    [key: string]: any;
    constructor(context, options) {
        super(context, options);

        this._dirty = true;
    }

    bind() {
        const { gl } = this.context;
        const { shader } = this;

        this.shader.bind();

        const prevMat = this.shader._material;

        if (!shader.tintColor.equals(this.tintColor)) {
            gl.uniform4fv(shader.u_tintColor, this.tintColor.toArray());
            shader.tintColor.copyFrom(this.tintColor);
        }

        if (prevMat === this && !this._dirty)
        {
            return;
        }

        if (prevMat)
        {
            prevMat.unbind();
        }

        this.shader._material = this;
        if (!this.cullFace) {
            gl.disable(gl.CULL_FACE);
        }
        if (this.opaque) {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.5);
        } else {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.0);
        }
        if (!this.opaque && this.shader.fluidFlags) {
            gl.depthMask(false);
        }
        if (this.ignoreDepth) {
            gl.disable(gl.DEPTH_TEST);
        }

        const tex = this.texture || this.shader.texture;
        const texN = this.texture_n || this.shader.texture_n;
        if (WebGLMaterial.texState !== this.texture) {
            tex.bind(4);
            WebGLMaterial.texState = this.texture;
            if (texN) {
                texN.bind(5);
            }
        }
        if (!prevMat || prevMat.texture !== this.texture)
        {
            const style = tex.style || TerrainTextureUniforms.default;

            gl.uniform1f(shader.u_blockSize, style.blockSize);
            gl.uniform1f(shader.u_pixelSize, style.pixelSize);
            gl.uniform1f(shader.u_mipmap, style.mipmap);
        }

        if (this.blendMode !== BLEND_MODES.NORMAL) {
            switch (this.blendMode) {
                case BLEND_MODES.ADD:
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); break;
                case BLEND_MODES.MULTIPLY:
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
                case BLEND_MODES.SCREEN:
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
            }
        }
        if (this.decalOffset) {
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(-this.decalOffset, -2 * this.decalOffset);
        }

        this._dirty = false;
    }

    unbind() {
        const { gl } = this.context;
        if (!this.cullFace) {
            gl.enable(gl.CULL_FACE);
        }
        if (!this.opaque && this.shader.fluidFlags) {
            gl.depthMask(true);
        }
        if (this.ignoreDepth) {
            gl.enable(gl.DEPTH_TEST);
        }
        if (this.blendMode !== BLEND_MODES.NORMAL) {
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
        if (this.decalOffset) {
            gl.disable(gl.POLYGON_OFFSET_FILL);
        }
    }

    getSubMat(texture = null) {
        // nothing
        return this.context.createMaterial({texture: texture || this.texture, shader: this.shader,
            cullFace: this.cullFace, opaque: this.opaque, ignoreDepth: this.ignoreDepth, decalOffset: this.decalOffset });
    }

    /**
     * unused, works only in webgpu
     * @param addPos
     * @param modelMatrix
     */
    updatePos(addPos, modelMatrix = null) {
        this.shader.updatePos(addPos, modelMatrix);
    }

    static texState = null;
}
