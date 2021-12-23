import glMatrix from "../vendors/gl-matrix-3.3.min.js";
import { Vector } from "./helpers";

const {mat4} = glMatrix;

export class Camera {
    constructor (options = {min: 2/16, max: 1000, renderType: 'webgl'}) {
        this.options = options;

        this.min = options.min || 2/16;
        this.max = options.max || 1000;
        /**
         * @type {'webgl' | 'webgpu'}
         */
        this.renderType = options.renderType || 'webgl';

        this.projMatrix = mat4.create();
        this.viewMatrix = mat4.create();
        this.bobPrependMatrix = mat4.create();

        // not fully required 
        this._viewProjMatrix = null ;//mat4.create();

        this.pos = new Vector();
        this.rot = new Vector();
    }

    get viewProjMatrix() {
        if (!this._viewProjMatrix) {
            this._viewProjMatrix = mat4.create();
        }

        mat4.multiply(this._viewProjMatrix, this.projMatrix, this.viewMatrix);

        return this._viewProjMatrix;
    }

    /**
     * Set camera state
     * @param {Vector} pos 
     * @param {Vector} rotate 
     * @param {mat4} bobMatrix - matrix of player movement
     */
    set (pos, rotate, bobMatrix = null) {
        this.pos.copyFrom(pos);
        this.rotate.copyFrom(rotate);

        if (bobMatrix) {
            mat4.copy(this.bobPrependMatrix, bobMatrix);
        } else {
            mat4.identity(this.bobPrependMatrix);
        }

        this.update();
    }

    update() {
        mat4.copy(this.viewMatrix, this.bobPrependMatrix);

        // @todo Возможно тут надо поменять Z и Y местами
        const pitch           = this.rotate.x; // X
        const roll            = this.rotate.y; // Z
        const yaw             = this.rotate.z; // Y

        //
        mat4.rotate(this.viewMatrix, this.viewMatrix, -pitch - Math.PI / 2, [1, 0, 0]); // x
        mat4.rotate(this.viewMatrix, this.viewMatrix, roll, [0, 1, 0]); // z
        mat4.rotate(this.viewMatrix, this.viewMatrix, yaw, [0, 0, 1]); // y
    }

    /**
     * Apply camera state onto renderer
     * @param {Renderer} renderer 
     */
    use(renderer) {

    }
}

export class PerspectiveCamera extends Camera {
    constructor(options = {fov: 75, aspect: 1}) {
        super(options);

        this.fov = options.fov;
        this.aspect = options.aspect;
    }

    update() {
        if (this.renderType === 'webgl') {
            mat4.perspectiveNO(this.projMatrix, this.fov * Math.PI / 180.0, this.aspect, this.min, this.max);
        } else {
            mat4.perspectiveZO(this.projMatrix, this.fov * Math.PI / 180.0, this.aspect, this.min, this.max);
        }

        super.update();
    }
}

export class OrthoCamera extends Camera {
    constructor(options = {width: 1000, height: 1000}) {
        super(options);

        this.width = options.width;
        this.height = options.height;
    }

    update() {
        const {
            width, height
        } = this;

        if (this.renderType === 'webgl') {
            mat4.orthoNO(this.projMatrix, -width / 2, width / 2, height / 2, -height / 2, this.min, this.max);
        } else {
            mat4.orthoZO(this.projMatrix, -width / 2, width / 2, height / 2, -height / 2, this.min, this.max);
        }

        super.update();
    }
}