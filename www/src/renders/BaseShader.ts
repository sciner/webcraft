import {Color, Vector} from '../helpers.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import {Program, Shader, BLEND_MODES, State, UniformGroup} from "vauxcel";
import type {BaseRenderer} from "./BaseRenderer.js";
import type {GlobalUniformGroup} from "./uniform_groups";

const {mat4} = glMatrix;

export class BaseShader {
    state: State = null;
    program: Program;
    context: BaseRenderer;
    options: any;
    defShader: Shader;
    code: any;
    globalUniforms: GlobalUniformGroup;

    constructor(context, options) {
        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }
        this.context = context;
        this.options = options;
        // context.createProgram({vertex, fragment,
        this.initProgram();
        this.globalUniforms = context.globalUniforms;
        this.defShader = new Shader(this.program, { globalUniforms: context.globalUniforms, ...options.uniforms });
        /**
         * @type {{vertex: string, fragment: string}}
         */
        this.code = options.code;
    }

    getAttribLocation(attrName) {
        return this.program.attributeData[attrName].location;
    }
    initProgram()
    {
        const { context, options } = this;
        this.program = context.createProgram(options.code, options.defines || {});
    }

    bind() {
    }

    update() {
    }

}

export class BaseCubeShader extends BaseShader {
    [key: string]: any;

    /**
     *
     * @param {BaseRenderer} context
     * @param {{code, sides: *[]}} options
     */
    constructor(context, options) {

        super(context, options);

        /**
         *
         * @type {BaseTexture}
         */
        this.texture = context.createTexture({
            source: options.sides
        });
        this.texture.bind();

        // Default values
        this.resolution_value   = [1, 1];
        this.testLightOn_value  = false;
        this.crosshairOn_value  = true;

        this.mergedBuffer = new Float32Array(16 * 2 + 1);

        this.lookAt = new Float32Array(this.mergedBuffer.buffer,0, 16);
        this.proj = new Float32Array(this.mergedBuffer.buffer, 16 * 4, 16 );

        this.mergedBuffer[32] = 1;

        this.cull = false;
        this.depth = false;
    }

    set brightness (v) {
        this.mergedBuffer[16 * 2] = v;
    }

    get brightness () {
        return this.mergedBuffer[16 * 2];
    }

    set resolution(v) {
        this.resolution_value = v;
    }

    get resolution() {
        return this.resolution_value;
    }

    set testLightOn(v) {
        this.testLightOn_value = v;
    }

    get testLightOn() {
        return this.testLightOn_value;
    }

    set crosshairOn(v) {
        this.crosshairOn_value = v;
    }

    get crosshairOn() {
        return this.crosshairOn_value;
    }

    bind() {
    }

    update() {
    }

}

export class BaseTerrainShader extends BaseShader {
    [key: string]: any;
    constructor(context, options) {
        super(context, options);

        this.lightUniforms = context.lightUniforms;
        this.modelMatrix        = mat4.create();

        this.blockSize = 1;
        this.pixelSize = 1;
        this.mipmap = 0;
        this.addPos = [0,0,0];
        this.texture = null;
        this.tintColor = new Color(0, 0, 0, 0);
        this.crosshairOn = true;
    }

    bind() {
    }
    unbind() {
    }

    update() {
    }

    updatePos(pos, modelMatrix) {
    }
}

export class BaseLineShader extends BaseShader {
    posUniforms: { u_add_pos: Float32Array }
    posUniformGroup: UniformGroup;
    constructor(context, options) {

        const posUniforms = { u_add_pos: new Float32Array(3) };
        const posUniformGroup = new UniformGroup(posUniforms);
        if (!options.uniforms) {
            options = {...options, uniforms: {}}
        }
        options.uniforms = {...options.uniforms, pos: posUniformGroup}

        super(context, options);

        this.posUniforms = posUniforms;
        this.posUniformGroup = posUniformGroup;
        this.globalUniforms = context.globalUniforms;

        this.state = new State();
        this.state.blendMode = BLEND_MODES.NORMAL_NPM;
        this.state.depthTest = true;
        this.state.cullFace = true;
        this.state.polygonOffsetValue = -2;
        this.state.polygonOffsetScale = -4;
    }

    updatePos(pos) {
        const { camPos } = this.globalUniforms;
        const { u_add_pos } = this.posUniforms;
        this.posUniformGroup.update();
        pos = pos || Vector.ZERO;
        u_add_pos[0] = pos.x - camPos.x;
        u_add_pos[1] = pos.z - camPos.z;
        u_add_pos[2] = pos.y - camPos.y;
    }
}
