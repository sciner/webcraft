import { Vector } from "../../helpers.js";
import { getEffectTexture, Mesh_Effect_Particle } from "../effect.js";

export default class effect {

    static textures = [
        [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
        [0, 4], [1, 4], [2, 4], [3, 4]
    ];

    constructor(pos, params) {
        const {texture, texture_index} = getEffectTexture(effect.textures);
        const speed = new Vector(
            (Math.random() - .5) * 2,
            (Math.random() - .5) * 2,
            (Math.random() - .5) * 2
        ).normalize().multiplyScalar(700);
        return new Mesh_Effect_Particle(null, pos, texture, .5, false, 0, 0.0075 + (0.0075 * Math.random()), speed);
    }

}