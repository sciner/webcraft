import {BaseMaterial} from "../TerrainMaterial.js";

export class WebGLMaterial extends BaseMaterial {
    _dirty: boolean
    constructor(context, options) {
        super(context, options);

        this._dirty = true;
    }

    bind() {
        const { gl, pixiRender } = this.context;
        const { shader } = this;

        this.beforeBind();

        shader.bind();
        pixiRender.shader.bind(this.pixiShader);

        const prevMat = this.shader._material;

        if (prevMat === this && !this._dirty)
        {
            return;
        }

        if (prevMat)
        {
            prevMat.unbind();
        }

        pixiRender.state.set(this.state);

        this.shader._material = this;

        const tex = this.texture || this.shader.texture;
        const texN = this.texture_n || this.shader.texture_n;
        if (WebGLMaterial.texState !== this.texture) {
            tex.bind(4);
            WebGLMaterial.texState = this.texture;
            if (texN) {
                texN.bind(5);
            }
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
