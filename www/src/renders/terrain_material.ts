import * as VAUX from "vauxcel";
import {Color} from "../helpers/color.js";
import {BLEND_MODES, State, UniformGroup} from "vauxcel";
import {TerrainTextureUniforms} from "./common.js";
import type {BaseRenderer} from "./BaseRenderer.js";
import type {BaseTerrainShader} from "./BaseShader.js";
import type {TerrainBaseTexture} from "./TerrainBaseTexture.js";
import {IMaterialGroupOptions, MaterialGroup} from "./material/material_group.js";

export interface ITerrainMaterialOptions {
    shader?: BaseTerrainShader;
    texture?: TerrainBaseTexture;
    texture_n?: TerrainBaseTexture;
    group?: MaterialGroup | IMaterialGroupOptions;
    blendMode?: BLEND_MODES;
}

export const defaultTerrainMaterial = {
    u_opaqueThreshold: 0.5 as float,
    u_blockSize: 1 as float,
    u_pixelSize: 1 as float,
    u_mipmap: 0 as float,
}

export class TerrainMaterial implements Required<ITerrainMaterialOptions> {
    shader: BaseTerrainShader;
    _texture: TerrainBaseTexture = undefined
    texture: TerrainBaseTexture = undefined;
    texture_n: TerrainBaseTexture;
    state = new State();

    context: BaseRenderer;
    options: ITerrainMaterialOptions;
    group: MaterialGroup;

    terrainUniforms: typeof defaultTerrainMaterial;
    terrainUniformGroup: UniformGroup<typeof defaultTerrainMaterial>;
    pixiShader: VAUX.Shader;

    constructor(context: BaseRenderer, options: ITerrainMaterialOptions) {
        this.context = context;
        this.options = options;
        this.shader = options.shader;

        if (options.group instanceof MaterialGroup && options.group.shared) {
            this.group = options.group;
        } else {
            this.group = new MaterialGroup(options.group);
        }
        this.group.applyToState(this.state);

        const terr = {...defaultTerrainMaterial};
        this.terrainUniforms = terr;
        this.terrainUniformGroup = new UniformGroup(terr, false);

        this.texture_n = options.texture_n || null;
        this.texture = options.texture || null;
        this.blendMode = options.blendMode || BLEND_MODES.NORMAL_NPM;


        this.initPixiShader();
    }

    beforeBind()
    {
        const {terrainUniforms} = this;
        this.state.depthMask = this.group.opaque || !(this.shader as any).fluidStatic;
        terrainUniforms.u_opaqueThreshold = this.opaque ? 0.5 : 0.0;

        const tex = this.texture || (this.shader as any).texture;
        if (tex && tex !== this._texture) {
            this._texture = tex;
            const style = tex.style || TerrainTextureUniforms.default;
            terrainUniforms.u_blockSize = style.blockSize;
            terrainUniforms.u_pixelSize = style.pixelSize;
            terrainUniforms.u_mipmap = style.mipmap;
        }
    }

    get opaque(){
        return this.group.opaque;
    }

    get blendMode() {
        return this.state.blendMode;
    }

    set blendMode(val: BLEND_MODES) {
        this.state.blendMode = val;
    }

    initPixiShader() {
        this.pixiShader = new VAUX.Shader(this.shader.program,
            {...this.shader.options.uniforms, globalUniforms: this.context.globalUniforms, terrain: this.terrainUniformGroup});
    }

    destroy() {
        this.shader = null;
        this.context = null;
        this.texture = null;
        this.options = null;
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

    getSubMat(texture = null) {
        // nothing
        return this.context.createMaterial({texture: texture || this.texture, shader: this.shader,
            group: this.group, blendMode: this.blendMode});
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