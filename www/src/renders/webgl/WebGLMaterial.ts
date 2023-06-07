import {BaseMaterial} from "../BaseRenderer.js";
import {TerrainTextureUniforms} from "../common.js";
import {BLEND_MODES, State} from 'vauxcel';

export class WebGLMaterial extends BaseMaterial {
    _dirty: boolean
    constructor(context, options) {
        super(context, options);

        this._dirty = true;
    }

    bind() {
        const { gl, pixiRender } = this.context;
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

        this.state.depthMask = this.opaque || !this.shader.fluidFlags;

        pixiRender.state.set(this.state);

        this.shader._material = this;
        if (this.opaque) {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.5);
        } else {
            gl.uniform1f(this.shader.u_opaqueThreshold, 0.0);
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

        this._dirty = false;
    }

    unbind() {
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
