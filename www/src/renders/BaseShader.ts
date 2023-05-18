import {Color} from '../helpers.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js";

const {mat4} = glMatrix;

export class BaseShader {
    [key: string]: any;
    constructor(context, options) {
        this.context = context;
        this.options = options;
        /**
         * @type {{vertex: string, fragment: string}}
         */
        this.code = options.code;
        this.bindings = [];
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

        this.globalUniforms = context.globalUniforms;
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
    [key: string]: any;
    constructor(context, options) {
        super(context, options);

        this.globalUniforms = context.globalUniforms;
    }
}
