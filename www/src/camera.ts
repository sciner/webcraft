import glMatrix from "../vendors/gl-matrix-3.3.min.js";
import { Vector } from "./helpers.js";
//import { GlobalUniformGroup } from "./renders/BaseRenderer.js";

const {mat4} = glMatrix;

export class Camera {
    [key: string]: any;
    static PERSP_CAMERA = 'perspective';
    static ORTHO_CAMERA = 'ortho';

    constructor (options = {
        type: 'perspective', // | 'ortho',
        min: 2/16,
        max: 1000,
        renderType: 'webgl',
        fov: 75,   // perspective only
        width: 1, // ortho or for aspect
        height: 1, // ortho or for aspect
        scale: 1, // ortho scale
    }) {
        this.options = options;

        this.min = options.min || 2/16;
        this.max = options.max || 1000;
        this.fov = options.fov || 75;
        this.width = options.width || 1;
        this.height = options.height || 1;
        this.scale = options.scale || 1;
        this.type = options.type || Camera.PERSP_CAMERA;

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
        this.rotate = new Vector();

        this.savedState = {
            fov: null,
            pos: null,
            rotate: null,
            proj: null,
            view: null,
            bob: null
        };
    }

    // save camera state
    save() {
        this.savedState = {
            fov: this.fov,
            pos: this.pos.clone(),
            rotate: this.rotate.clone(),
            proj: mat4.clone(this.projMatrix),
            view: mat4.clone(this.viewMatrix),
            bob: mat4.clone(this.bobPrependMatrix)
        };
    }

    restore() {
        if (!this.savedState || !this.savedState.pos) {
            return;
        }

        this.fov = this.savedState.fov;
        this.pos.copyFrom(this.savedState.pos);
        this.rotate.copyFrom(this.savedState.rotate);

        mat4.copy(this.projMatrix, this.savedState.proj);
        mat4.copy(this.viewMatrix, this.savedState.view);
        mat4.copy(this.bobPrependMatrix, this.savedState.bob);

        this.savedState = null;
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

    _updateProj() {
        const {
            projMatrix,
            width,
            height,
            scale,
            min,
            max,
            fov,
            renderType,
            type
        } = this;

        if (type === Camera.PERSP_CAMERA) {
            const func = renderType === 'webgl' ? mat4.perspectiveNO : mat4.perspectiveZO;
            func(projMatrix, fov * Math.PI / 180.0, width / height, min, max);

            return;
        } else if(type === Camera.ORTHO_CAMERA) {
            const func = renderType === 'webgl' ? mat4.orthoNO : mat4.orthoZO;
            func(projMatrix, - scale * width / 2, scale * width / 2, -scale * height / 2, scale * height / 2, min, max);

            return;
        }

        throw new TypeError('Unknow camera type:' + type);
    }

    update() {
        this._updateProj();

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
     * Apply camera state onto unfiforms
     * @param {GlobalUniformGroup} gu
     * @param {boolean} update - force update before apply to uniforms
     */
    use(gu, update = false) {
        if (update) {
            this.update();
        }

        mat4.copy(gu.projMatrix, this.projMatrix);
        mat4.copy(gu.viewMatrix, this.viewMatrix);

        gu.camPos.copyFrom(this.pos);
    }
}
