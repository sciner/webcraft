import {IndexedColor, Vector} from "../helpers.js";
import type { BBModel_Model } from "./model.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"

const {mat4, vec3, quat} = glMatrix;
const TX_SIZE = 16;
const zeroArr = vec3.create();
const oneArr = vec3.create();
const tempQuat = quat.create();
const tempArr = [0, 0, 0]
oneArr[0] = oneArr[1] = oneArr[2] = 1;

export class BBModel_Child {
    model:              BBModel_Model
    json:               any
    pivot:              Vector
    rot:                Vector
    matrix:             any
    visibility:         boolean
    orig_visibility:    boolean

    constructor(model? : BBModel_Model, json? : any) {
        this.model = model
        this.json = json
        this.pivot = new Vector()
        this.rot = new Vector()
        this.matrix = mat4.create()
        this.visibility = true
        this.orig_visibility = true
    }

    updateLocalTransform() {
        const { rot, matrix } = this;
        tempArr[0] = this.pivot.x / TX_SIZE
        tempArr[1] = this.pivot.y / TX_SIZE
        tempArr[2] = this.pivot.z / TX_SIZE
        quat.fromEuler(tempQuat, rot.x, rot.y, rot.z, "zyx");
        mat4.fromRotationTranslationScaleOrigin(matrix, tempQuat, zeroArr, oneArr, tempArr)
    }

    pushVertices(vertices : float[], pos : Vector, lm : IndexedColor, parentMatrix : imat4) {}

}