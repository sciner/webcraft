import { Vector } from "../../helpers.js";
import { Mesh_Effect_Particle } from "../effect.js";
import { Mesh_Effect_Base } from "./base.js";

export default class effect extends Mesh_Effect_Base {

    static sdfsdf44444 = [
        [0, 1], [1, 1], [2, 1], [3, 1]
    ];

    constructor(pos, params) {
        super(pos, params);
        console.log(effect.sdfsdf44444);
        const {texture, texture_index} = this.getTexture([[0, 1], [1, 1], [2, 1], [3, 1]]);
        pos.addScalarSelf(
            (Math.random() - Math.random()) * 0.01,
            .2,
            (Math.random() - Math.random()) * 0.01
        );
        const move_up = texture_index > 1;
        return new Mesh_Effect_Particle(null, pos, texture, 1, true, 0, 0.0075, new Vector(0, move_up ? 100 : 0, 0));
    }

}