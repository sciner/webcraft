import { Vector } from '../helpers.js';
import glMatrix from './../../vendors/gl-matrix-3.3.min.js'
import { Component } from './Component.js';

const {mat4, vec3, quat, glMatrix} = glMatrix;

/**
 * Returns an euler angle representation of a quaternion
 * @param  {vec3} out Euler angles, pitch-yaw-roll
 * @param  {quat} mat Quaternion
 * @return {vec3} out
 */
export function getEuler(out, quat) {
    let x = quat[0],
        y = quat[1],
        z = quat[2],
        w = quat[3],
        x2 = x * x,
        y2 = y * y,
        z2 = z * z,
        w2 = w * w;

    let unit = x2 + y2 + z2 + w2;
    let test = x * w - y * z;

    if (test > (0.5 - glmatrix.EPSILON) * unit) {
        // singularity at the north pole
        out[0] = Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else if (test < -(0.5 - glmatrix.EPSILON) * unit) { //TODO: Use glmatrix.EPSILON
        // singularity at the south pole
        out[0] = -Math.PI / 2;
        out[1] = 2 * Math.atan2(y, x);
        out[2] = 0;
    } else {
        out[0] = Math.asin(2 * (x * z - w * y));
        out[1] = Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2));
        out[2] = Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2));
    }

    const TO_DEG = 180 / Math.PI;

    out[0] *= TO_DEG;
    out[1] *= TO_DEG;
    out[2] *= TO_DEG;

    return out;
}

/**
 * Tmp store, used for copy from vector object to gl-matrix and back
 */
const COPY_VECTOR_STORAGE = [0,0,0];

/**
 * Transform component for scene system
 */
export class Transform extends Component {
    [key: string]: any;
    static key = 'transform';

    constructor() {
        super();
        /**
         * @type {Float32Array}
         */
        this._matrix = mat4.create();

        /**
         * @type {Float32Array}
         */
        this._matrixWorld = mat4.create();

        /**
         * @deprecated
         * I don't know how right use it, please  not use manually
         * Because we can't decomposite pivot onto matrix
         */
        this._pivot = new Vector();

        this._position = new Vector();

        this._rotation = new Vector();

        this._scale = new Vector();

        /**
         * @todo Create object proxy abstraction for it
         */
        this._quat = quat.create();

        this._parentMatrixId = -1;
        this._oldMatrixId = -1;
        this._oldMatrixWorldId = -1;

        this.matrixId = 0;
        this.matrixWorldId = 0;

        /**
         * Parent transform if present
         * @type {Transform}
         */
        this.parent = null;
    }

    /**
     * Local position of node
     */
    get position() {
        this._decompositeLocal();
        return this._position;
    }

    set position(v) {
        let x, y, z;

        if ('x' in v) {
            x = v.x;
            y = v.y;
            z = v.z;
        } else {
            x = v[0];
            x = v[1];
            x = v[2];
        }

        this._position.set(x, y, z);

        this.updateMatrix();
    }

    /**
     * Local Euler rotation of node in degs
     */
    get rotation() {
        this._decompositeLocal();
        return this._rotation;
    }

    set rotation(v) {
        let x, y, z;

        if ('x' in v) {
            x = v.x;
            y = v.y;
            z = v.z;
        } else {
            x = v[0];
            x = v[1];
            x = v[2];
        }

        this._rotation.set(x, y, z);

        quat.fromEuler(this._quat, x, y, z);

        this.updateMatrix();
    }

    get quat() {
        this._decompositeLocal();

        return this._quat;
    }

    set quat(v) {
        let x, y, z, w;

        if ('x' in v) {
            x = v.x;
            y = v.y;
            z = v.z;
            w = v.w;
        } else {
            x = v[0];
            y = v[1];
            z = v[2];
            w = v[3];
        }

        this._quat.set([x, y, z, w]);

        getEuler(this._rotation, this._quat);

        this.updateMatrix();
    }


    get buffer() {
        return this.terrainGeometry;
    }

    _decompositeLocal() {
        if (this.matrixId === this._oldMatrixId) {
            return;
        }

        // we can't use vector directly =(
        mat4.getTranslation(COPY_VECTOR_STORAGE, matrix);
        this._position.set(...COPY_VECTOR_STORAGE);

        mat4.getScaling(COPY_VECTOR_STORAGE, matrix);
        this._scale.set(...COPY_VECTOR_STORAGE);

        mat4.getRotation(this._quat, matrix);

        // there are not methods inside gl-matrix
        // use custom
        getEuler(COPY_VECTOR_STORAGE, quat);
        this._rotation.set(...COPY_VECTOR_STORAGE);

        // we can't decomposte with pivot
        // or can?
        this._pivot.set(0,0,0);

        this._position.updateId ++;
        this._scale.updateId ++;
        this._position.updateId ++;

        this._oldMatrixId = this.matrixId;
    }

    _compositeLocal() {
        if (this.matrixId === this._oldMatrixId) {
            return;
        }

        mat4.fromRotationTranslationScaleOrigin(
            this._matrix,
            this._quat,
            this._position,
            this._scale,
            this._pivot
        );

        this._oldMatrixId = this.matrixId;
    }

    _compositeWorld() {
        this._compositeLocal();

        if (!this.parent) {
            return;
        }

        const parentMatrix = this.parent.matrixWorld;

        if (this._oldMatrixId !== this.matrixWorldId || this._parentMatrixId !== this.parent.matrixWorldId) {
            mat4.multiply(this._matrixWorld, parentMatrix, this.matrix);

            // because we update matrix, change their ID to track in next child
            this.matrixWorldId ++;
        }

        this._oldMatrixWorldId = this.matrixWorldId;
        this._parentMatrixId = this.parent.matrixWorldId;
    }

    /**
     * Update matrix
     * @param {boolean} [compose] matrix can be composed ASAP, slow, try not use this
     */
    updateMatrix(compose = false) {
        this.matrixId++;
        this.matrixWorldId++;

        if (compose) {
            this._compositeWorld();
        }
    }

    /**
     * Local matrix for this node
     * @type {Float32Array}
     */
    get matrix() {
        this._compositeLocal();

        return this._matrix;
    }

    /**
     * Set matrix for this node, can be decomposed lazy
     * @type {Float32Array}
     */
    set matrix(matrix) {
        mat4.copy(this._matrix, matrix);

        this.updateMatrix();
    }

    /**
     * World matrix for this node
     * @type {Float32Array}
     */
    get matrixWorld() {
        if (!this.parent) {
            this._compositeLocal();

            return this._matrix;
        }

        this._compositeWorld();
        return this._matrixWorld;
    }
}
