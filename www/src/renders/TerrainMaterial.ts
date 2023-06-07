import type {BaseShader} from "./BaseShader.js";
import * as VAUX from "vauxcel";
import {Color} from "../helpers/color.js";
import {State, UniformGroup} from "vauxcel";
import {TerrainTextureUniforms} from "./common.js";
import type {BaseRenderer, BaseTexture} from "./BaseRenderer.js";

export interface ITerrainMaterialOptions {
    decalOffset?: number;
    shader?: BaseShader;
    texture?: BaseTexture;
    texture_n?: BaseTexture;
    cullFace?: boolean;
    opaque?: boolean;
    ignoreDepth?: boolean;
    blendMode?: VAUX.BLEND_MODES;
    tintColor?: Color;
}

export const defaultTerrainMaterial = {
    u_opaqueThreshold: 0.5 as float,
    u_blockSize: 1 as float,
    u_pixelSize: 1 as float,
    u_mipmap: 0 as float,
    u_tintColor: [0, 0, 0, 0],
}

export class BaseMaterial implements Required<ITerrainMaterialOptions> {
    shader: BaseShader;
    _texture: BaseTexture = undefined
    texture: BaseTexture = undefined;
    texture_n: BaseTexture;
    opaque: boolean;
    _tintColor = new Color(0, 0, 0, 0);

    context: BaseRenderer;
    options: ITerrainMaterialOptions;
    state = new State();

    terrainUniforms: typeof defaultTerrainMaterial;
    terrainUniformGroup: UniformGroup<typeof defaultTerrainMaterial>;
    pixiShader: VAUX.Shader;

    constructor(context: BaseRenderer, options: ITerrainMaterialOptions) {
        this.context = context;
        this.options = options;
        this.shader = options.shader;

        const terr = {...defaultTerrainMaterial};
        this.terrainUniforms = terr;
        this.terrainUniformGroup = new UniformGroup(terr);

        this.texture_n = options.texture_n || null;
        this.opaque = options.opaque || false;

        this.texture = options.texture || null;
        this.cullFace = options.cullFace || false;
        this.ignoreDepth = options.ignoreDepth || false;
        this.blendMode = options.blendMode || VAUX.BLEND_MODES.NORMAL_NPM;
        this.tintColor = options.tintColor || new Color(0, 0, 0, 0);
        this.decalOffset = options.decalOffset || 0;

        this.initPixiShader();
    }

    beforeBind()
    {
        this.state.depthMask = this.opaque || !this.shader.fluidFlags;
        this.terrainUniforms.u_opaqueThreshold = this.opaque ? 0.5 : 0.0;

        const tex = this.texture || this.shader.texture;
        if (tex && tex !== this._texture) {
            this._texture = tex;
            const {terrainUniforms} = this;
            const style = tex.style || TerrainTextureUniforms.default;
            terrainUniforms.u_blockSize = style.blockSize;
            terrainUniforms.u_pixelSize = style.pixelSize;
            terrainUniforms.u_mipmap = style.mipmap;
        }
    }

    set tintColor(val: Color)
    {
        this._tintColor.copyFrom(val);
        this.terrainUniforms.u_tintColor = this._tintColor.toArray();
    }

    get tintColor()
    {
        return this._tintColor;
    }

    initPixiShader() {
        this.pixiShader = new VAUX.Shader(this.shader.program,
            {...this.shader.options.uniforms, terrain: this.terrainUniformGroup});
    }

    get blendMode() {
        return this.state.blendMode;
    }

    set blendMode(val: VAUX.BLEND_MODES) {
        this.state.blendMode = val;
    }

    get cullFace() {
        return this.state.culling;
    }

    set cullFace(val: boolean) {
        this.state.culling = val;
    }

    get ignoreDepth() {
        return !this.state.depthTest;
    }
    set ignoreDepth(val: boolean) {
        this.state.depthTest = !val;
    }

    get decalOffset() {
        return -this.state._polygonOffsetValue;
    }

    set decalOffset(val: number) {
        this.state.polygonOffsetValue = -val;
        this.state.polygonOffsetScale = -2 * val;
    }

    getSubMat() {
        return null;
    }

    destroy() {
        this.shader = null;
        this.context = null;
        this.texture = null;
        this.options = null;
    }
}