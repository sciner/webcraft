import {BaseMaterial, BLEND_MODES} from "../BaseRenderer.js";
import {TerrainTextureUniforms} from "../common.js";
import { WebGLTerrainShaderNew } from "./WebGLTerrainShaderNew.js";

export class WebGLMaterial extends BaseMaterial {
    constructor(context, options) {
        super(context, options);

        this._dirty = true;
        this._newShader = this.shader instanceof WebGLTerrainShaderNew;
    }

    changeLighTex(tex) {
        if (tex === this.lightTex) {
            return;
        }
        this._dirty = true;

        super.changeLighTex(tex);
    }

    bind() {
        const { gl } = this.context;
        const { shader } = this;

        let upload = false;

        this.shader.bind();

        const prevMat = this.shader._material;
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
        
        if (this._newShader) {
            shader.uniforms['u_opaqueThreshold'].value = this.opaque ?  0.5 : 0;
            upload = true;
        } else {
            if (this.opaque) {
                gl.uniform1f(this.shader.u_opaqueThreshold, 0.5);
            } else {
                gl.uniform1f(this.shader.u_opaqueThreshold, 0.0);
            }
        }

        if (this.ignoreDepth) {
            gl.disable(gl.DEPTH_TEST);
        }

        const tex = this.texture || this.shader.texture;
        if (WebGLMaterial.texState !== this.texture) {
            tex.bind(4);
            WebGLMaterial.texState = this.texture;
        }
        if (!prevMat || prevMat.texture !== this.texture)
        {
            const style = tex.style || TerrainTextureUniforms.default;

            if (this._newShader) {
                upload = true;

                shader.uniforms['u_blockSize'].value = style.blockSize;
                shader.uniforms['u_pixelSize'].value = style.pixelSize;
                shader.uniforms['u_mipmap'].value = style.mipmap;
                
            } else {
                gl.uniform1f(shader.u_blockSize, style.blockSize);
                gl.uniform1f(shader.u_pixelSize, style.pixelSize);
                gl.uniform1f(shader.u_mipmap, style.mipmap);
            }
        }
        if (WebGLMaterial.lightState !== this.lightTex) {
            const tex = this.lightTex || this.context._emptyTex3D;
            tex.bind(5);
            WebGLMaterial.lightState = this.lightTex;
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

        this._dirty = false;

        // we not should upload shader in this case
        // renderer do this in updatePos
        if (this._newShader && upload) {
            //shader._applyUniforms();
        }
    }

    unbind() {
        const { gl } = this.context;
        if (!this.cullFace) {
            gl.enable(gl.CULL_FACE);
        }
        if (this.ignoreDepth) {
            gl.enable(gl.DEPTH_TEST);
        }
        if (this.blendMode !== BLEND_MODES.NORMAL) {
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
    }

    getSubMat(texture = null) {
        // nothing
        return this.context.createMaterial({texture: texture || this.texture, shader: this.shader,
            cullFace: this.cullFace, opaque: this.opaque, ignoreDepth: this.ignoreDepth });
    }

    getLightMat(lightTex = null) {
        // nothing
        return this.context.createMaterial({texture: this.texture, lightTex, shader: this.shader,
            cullFace: this.cullFace, opaque: this.opaque, ignoreDepth: this.ignoreDepth });
    }

    static texState = null;
    static lightState = null;
}
