import {BaseTerrainShader} from "../BaseShader.js";
import {UniformGroup} from "vauxcel";
import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import type {Vector} from "../../helpers/vector.js";
import type {TerrainBaseTexture} from "../TerrainBaseTexture.js";
const {mat4} = glMatrix;


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
    posUniforms: { u_add_pos: Float32Array, u_grid_chunk_corner: Float32Array}
    modelUniforms: {
        u_modelMatrix: Float32Array, u_modelMatrixMode: float
    }
    posUniformGroup: UniformGroup;
    texture: TerrainBaseTexture = null;
    texture_n: TerrainBaseTexture = null;
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
            u_grid_chunk_corner: new Float32Array(3),
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
        const { u_add_pos, u_grid_chunk_corner } = this.posUniforms;

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
        u_grid_chunk_corner[0] = (Math.round(pos.x / gridTexSize.x) - 1) * gridTexSize.x - camPos.x;
        u_grid_chunk_corner[1] = (Math.round(pos.z / gridTexSize.z) - 1) * gridTexSize.z - camPos.z;
        u_grid_chunk_corner[2] = (Math.round(pos.y / gridTexSize.y) - 1) * gridTexSize.y - camPos.y;
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
