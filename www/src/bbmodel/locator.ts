import { BBModel_Child } from "./child.js";
import { IndexedColor, StringHelpers, Vector } from "../helpers.js";
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from "./model.js";
const {vec3} = glMatrix;

const _emmiter_pos = new Vector(0, 0, 0)
const tempVec3 = vec3.create();

//
export class BBModel_Locator extends BBModel_Child {
    size: Vector
    translate: Vector
    element: any
    name: string

    constructor(model : BBModel_Model, json : any, size : Vector, translate : Vector) {
        super(model, json)
        this.size = size
        this.translate = translate
        this.element = json
        this.name = json.name
    }

    pushVertices(vertices : float[], pos : Vector, lm : IndexedColor, parent_matrix : imat4, emmit_particles_func? : Function) {
        tempVec3[0] = -this.json.position[0] / 16;
        tempVec3[1] = this.json.position[1] / 16;
        tempVec3[2] = this.json.position[2] / 16;
        vec3.transformMat4(tempVec3, tempVec3, parent_matrix);
        _emmiter_pos.copy(tempVec3)
        if(emmit_particles_func) {
            emmit_particles_func(StringHelpers.trim(this.name, '_'), _emmiter_pos)
        } else {
            console.error('empty_emmit_particles_func')
        }
    }

}