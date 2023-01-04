import { BBModel_Child } from "./child.js";
import { StringHelpers, Vector } from "../helpers.js";

const _emmiter_pos = new Vector(0, 0, 0)

//
export class BBModel_Locator extends BBModel_Child {

    /**
     * @param {Vector} size
     * @param {Vector} translate
     */
    constructor(model, json, size, translate) {
        super(model, json)
        this.size = size
        this.translate = translate
        this.element = json
        this.name = json.name
    }

    /**
     * @param {Float32Array} vertices
     * @param {Vector} pos
     * @param {IndexedColor} lm
     * @param {*} parent_matrix
     * @param {*} emmit_particles_func
     */
    pushVertices(vertices, pos, lm, parent_matrix, emmit_particles_func) {
        _emmiter_pos.copy(this.json.position).divScalar(16)
        _emmiter_pos.z = -_emmiter_pos.z
        emmit_particles_func(StringHelpers.trim(this.name, '_'), _emmiter_pos)
    }

}