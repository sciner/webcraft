import { Vector } from "../../helpers.js";
import { Mesh_Effect_Particle } from "../effect.js";
import { Mesh_Effect_Base } from "./base.js";

export default class effect extends Mesh_Effect_Base {

    static textures = [
        [0, 0], [1, 0], [2, 0], [3, 0]
    ];

    constructor(pos, params) {
        super(pos, params);
        const {texture, texture_index} = this.getTexture(effect.textures);
        pos.addScalarSelf(
            0,
            0,
            (Math.random() - Math.random()) * .3
        );
        return new Mesh_Effect_Particle(null, pos, texture, 2, true, 0, 0.0075 + (0.0075 * Math.random()), new Vector(0, 100, 0));
    }

}