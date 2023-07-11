import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import { Vector } from "../helpers.js";
//import { GlobalUniformGroup } from "./renders/BaseRenderer.js";

const {mat4, vec3} = glMatrix;

interface ICameraOptions {
    type?: string
    min?: number
    max?: number
    renderType?: string
    fov?: number,
    width?: number
    height?: number
    scale?: number
}

const tmp1 = vec3.create();
const tmp2 = vec3.create();

export class Camera_3d {
    [key: string]: any;
    static PERSP_CAMERA = 'perspective';
    static ORTHO_CAMERA = 'ortho';

    private _horizontalFovRad: float
    min     : float
    max     : float
    fov     : float
    width   : number
    height  : number

    viewMatrix: imat4;
    viewInverted: imat4;

    constructor (options: ICameraOptions = {
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
        this.type = options.type || Camera_3d.PERSP_CAMERA;

        /**
         * @type {'webgl' | 'webgpu'}
         */
        this.renderType = options.renderType || 'webgl';

        this.projMatrix = mat4.create();
        this.viewMatrix = mat4.create();
        this.bobPrependMatrix = mat4.create();
        this.viewInverted = mat4.create();

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

    get horizontalFovRad(): float { return this._horizontalFovRad }

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

    /**
     * -aspect<x<aspect, -1<=y<=1
     */
    calcNearPlanePosition(x, y, out?: Vector): Vector {
        out = out || new Vector();

        mat4.invert(this.viewInverted, this.viewMatrix);

        const near = 0.8; //this.min;
        const h = Math.tan(this.fov * 0.5 * Math.PI / 180);
        tmp1[0] = x * near * h;
        tmp1[1] = y * near * h;
        tmp1[2] = -near; //near

        vec3.transformMat4(tmp2, tmp1, this.viewInverted);

        out.set(tmp2[0], tmp2[2], tmp2[1]);

        return out;
    }

    shiftX = 0;
    shiftY = 0;

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
            type,
            shiftX,
            shiftY,
        } = this;

        if (type === Camera_3d.PERSP_CAMERA) {
            const func = renderType === 'webgl' ? mat4.perspectiveNO : mat4.perspectiveZO;
            const fovRad = fov * (Math.PI / 180.0)
            func(projMatrix, fovRad, width / height, min, max);
            this._horizontalFovRad = fovRad * width / height

            return;
        } else if(type === Camera_3d.ORTHO_CAMERA) {
            const func = renderType === 'webgl' ? mat4.orthoNO : mat4.orthoZO;
            func(projMatrix, scale * (- width / 2 + shiftX), scale * (width / 2 + shiftX),
                scale * (- height / 2 + shiftY), scale * (height / 2 + shiftY), min, max);
            this._horizontalFovRad = Math.PI / 2 // it's incorrect, but convenient: the callers don't have to make exceptions for ortho

            return;
        }

        throw new TypeError('Unknow camera type:' + type);
    }

    setSize(widthPx: number, heightPx: number)
    {
        this.width = widthPx;
        this.height = heightPx;
    }

    setPerspective(fov: number, min: number, max: number)
    {
        this.fov = fov;
        this.min = min;
        this.max = max;
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
