import {BaseMaterial} from "../TerrainMaterial.js";

export class WebGLMaterial extends BaseMaterial {
    _dirty: boolean
    constructor(context, options) {
        super(context, options);

        this._dirty = true;
    }

    bind() {
        const { pixiRender } = this.context;

        this.beforeBind();
        pixiRender.shader.bind(this.pixiShader);

        pixiRender.state.set(this.state);
        const tex = this.texture || this.shader.texture;
        const texN = this.texture_n || this.shader.texture_n;
        if (!tex.castToBaseTexture) {
            console.log("WTF")
        }
        pixiRender.texture.bind(tex, 4);
        if (texN) {
            pixiRender.texture.bind(texN, 5);
        }
    }

    unbind() {
    }

    getSubMat(texture = null) {
        // nothing
        return this.context.createMaterial({texture: texture || this.texture, shader: this.shader,
            cullFace: this.cullFace, opaque: this.opaque, ignoreDepth: this.ignoreDepth, decalOffset: this.decalOffset,
            blendMode: this.blendMode});
    }

    /**
     * unused, works only in webgpu
     * @param addPos
     * @param modelMatrix
     */
    updatePos(addPos, modelMatrix = null) {
        this.shader.updatePos(addPos, modelMatrix);
    }
}
