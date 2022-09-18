import { Vector } from "../../helpers.js";
import { Mesh_Effect_Particle } from "../effect.js";
import { Mesh_Effect_Base } from "./base.js";

export default class effect extends Mesh_Effect_Base {

    static textures = [
        [0, 5]
    ];

    constructor(pos, params) {
        super(pos, params);
        console.log(777)
        const {texture, texture_index} = this.getTexture(effect.textures);
        pos.addScalarSelf(
            (Math.random() - Math.random()) * .3,
            .35 + .25 * Math.random(),
            (Math.random() - Math.random()) * .3
        );
        //
        const gravity = 0.0075 + (0.0075 * Math.random());
        const min_percent = 0;
        return new Mesh_Effect_Particle(null, pos, texture, 30, false, min_percent, gravity, new Vector(0, 100, 0));
    }

}