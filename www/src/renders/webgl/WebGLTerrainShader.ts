import {BaseTerrainShader} from "../BaseShader.js";
import {UniformGroup} from "vauxcel";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type {BaseTexture} from "../BaseRenderer.js";
import type {Vector} from "../../helpers/vector.js";
const {mat4, vec3} = glMatrix;


export const defaultTerrainStaticUniforms = {
    u_texture: 4 as int,
    u_texture_n: 5 as int,
    u_chunkDataSampler: 3 as int,
    u_gridChunkSampler: 6 as int,
    u_lightTex: [7, 8] as int[],
    u_maskColorSampler: 1 as int,
    u_blockDayLightSampler: 2 as int,
};

export const terrainStatic = new UniformGroup<typeof defaultTerrainStaticUniforms>(defaultTerrainStaticUniforms, true);

export class WebGLTerrainShader extends BaseTerrainShader {
    [key: string]: any;
    terrainStatic = terrainStatic
    posUniforms: { u_add_pos: Float32Array, u_gridChunkOffset: Float32Array}
    modelUniforms: {
        u_modelMatrix: Float32Array, u_modelMatrixMode: float
    }
    posUniformGroup: UniformGroup;
    texture: BaseTexture = null;
    texture_n: BaseTexture = null;
    /**
     *
     * @param {WebGLRenderer} context
     * @param {*} options
     */
    constructor(context, options) {

        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }

        const posUniforms = {
            u_add_pos: new Float32Array(4),
            u_gridChunkOffset: new Float32Array(3),
        };
        const modelUniforms = {
            u_modelMatrix: new Float32Array(16),
            u_modelMatrixMode: 0 as float,
        }
        const posUniformGroup = new UniformGroup(posUniforms);
        const modelUniformGroup = new UniformGroup(modelUniforms, true);

        options.uniforms = {...options.uniforms,
            terrainStatic, lightStatic: context.lightUniforms,
            pos: posUniformGroup,
            model: modelUniformGroup};
        super(context, options);

        this.posUniforms = posUniforms;
        this.posUniformGroup = posUniformGroup;

        this.modelUniforms = modelUniforms;
        this.modelUniformGroup = modelUniformGroup;

        this.hasModelMatrix = false;

        this._material = null;
        this.globalID = -1;
    }

    bind(force = false) {
        this.context.pixiRender.shader.bind(this.defShader);
    }

    unbind() {
        if (this._material)
        {
            this._material.unbind();
            this._material = null;
        }
        this.context._shader = null;
    }

    updateGlobalUniforms() {
    }

    update() {
        const gu = this.globalUniforms;
        if (this.globalID === gu.dirtyId) {
            return;
        }
        this.globalID = gu.dirtyId;
        this.resetMatUniforms();
    }

    updatePosOnly(pos: Vector) {
        const {camPos, gridTexSize} = this.globalUniforms;
        const { u_add_pos, u_gridChunkOffset } = this.posUniforms;

        this.posUniformGroup.update();
        if (pos) {
            u_add_pos[0] = pos.x - camPos.x;
            u_add_pos[1] = pos.z - camPos.z;
            u_add_pos[2] = pos.y - camPos.y;
        } else {
            u_add_pos[0] = - camPos.x;
            u_add_pos[1] = - camPos.z;
            u_add_pos[2] = - camPos.y;

            pos = camPos;
        }
        u_gridChunkOffset[0] = - pos.x + (-1 + Math.round(pos.x / gridTexSize.x)) * gridTexSize.x;
        u_gridChunkOffset[1] = - pos.z + (-1 + Math.round(pos.z / gridTexSize.z)) * gridTexSize.z;
        u_gridChunkOffset[2] = - pos.y + (-1 + Math.round(pos.y / gridTexSize.y)) * gridTexSize.y;

    }
    updatePos(pos, modelMatrix) {
        this.updatePosOnly(pos);

        const {modelUniformGroup, modelUniforms} = this;

        if (modelMatrix) {
            modelUniformGroup.update();
            modelUniforms.u_modelMatrix.set(modelMatrix, 0);
            modelUniforms.u_modelMatrixMode = 1;
            this.hasModelMatrix = true;
        } else {
            if (this.hasModelMatrix) {
                modelUniformGroup.update();
                mat4.identity(modelUniforms.u_modelMatrix);
                modelUniforms.u_modelMatrixMode = 0;
            }
            this.hasModelMatrix = false;
        }
    }
}
