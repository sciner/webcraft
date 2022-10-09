//
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
const {mat4, vec3, quat} = glMatrix;
import {Vector} from "../helpers.js";

const TX_SIZE = 16;
const zeroArr = vec3.create();
const oneArr = vec3.create();
const tempQuat = quat.create();
oneArr[0] = oneArr[1] = oneArr[2] = 1;

export class BBModel_Child {

    constructor() {
        this.pivot = new Vector();
        this.rot = new Vector();
        this.matrix = mat4.create();
    }

    updateLocalTransform() {
        const { rot, matrix } = this;
        const arr = this.pivot.toArray();
        arr[0] /= TX_SIZE;
        arr[1] /= TX_SIZE;
        arr[2] /= TX_SIZE;
        quat.fromEuler(tempQuat, rot.x, rot.y, rot.z, "xyz");
        mat4.fromRotationTranslationScaleOrigin(matrix, tempQuat, zeroArr, oneArr, arr);
    }

}