import {IndexedColor, Vector} from "../helpers.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from "./model.js";
import type { BBModel_Group } from "./group.js";

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
    name:               string
    path:               string

    private _parent:    BBModel_Group

    constructor(model? : BBModel_Model, json? : any) {
        this.model = model
        this.json = json
        if(json) {
            this.name = json.name ?? null
        }
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

    get parent() : BBModel_Group {
        return this._parent
    }

    set parent(value : BBModel_Group) {
        this._parent = value
        const path = [this.name]
        while(value) {
            path.unshift(value.name)
            value = value.parent
        }
        path.shift()
        this.path = path.join('/').toLowerCase()
    }

}