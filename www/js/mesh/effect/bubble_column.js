import { QUAD_FLAGS, Vector } from "../../helpers.js";
import { getEffectTexture, Mesh_Effect_Particle } from "../effect.js";

const MATERIAL_KEY = 'extend/regular/effects';
const living_blocks = [88, 415]; // [BLOCK.BUBBLE_COLUMN.id]

export default class effect {

    static textures = [
        [0, 5]
    ];

    constructor(pos, params) {
        const {texture, texture_index} = getEffectTexture(effect.textures);
        pos.addScalarSelf(
            (Math.random() - Math.random()) * .4,
            .35 + .25 * Math.random(),
            (Math.random() - Math.random()) * .4
        );
        //
        const gravity = 0.004;
        const max_percent = Math.max(Math.random() * .1 * 3, .1);
        const min_percent = max_percent;
        const flags = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        return new Mesh_Effect_Particle(MATERIAL_KEY, pos, texture, 3, false, min_percent, gravity, new Vector(0, 100, 0), flags, null, living_blocks, max_percent);
    }

}