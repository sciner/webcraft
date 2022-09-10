import { Vector } from "../../helpers.js";
import { Mesh_Effect_Particle } from "../effect.js";
import { Mesh_Effect_Base } from "./base.js";

export default class effect extends Mesh_Effect_Base {

    constructor(pos, params) {
        super(pos, params);
        const {block, small, block_manager} = params;
        const mat = block_manager.fromId(block.id);
        const tex = block_manager.calcMaterialTexture(mat, DIRECTION.DOWN);
        tex[0] *= mat.tx_cnt;
        tex[1] *= mat.tx_cnt;
        tex[2] *= mat.tx_cnt;
        tex[3] *= mat.tx_cnt;
        const material_key = mat.material_key;
        const count = small ? 5 : 30;
        const ppos = pos.clone();
        //
        let lm = null;
        let flags = 0;
        if(block_manager.MASK_BIOME_BLOCKS.indexOf(mat.id) >= 0) {
            // const pos_floored = pos.clone().flooredSelf();
            // const index = ((pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (pos_floored.x - chunk.coord.x)) * 2;
            // lm          = new Color(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0, 0);
            // flags       = flags | QUAD_FLAGS.MASK_BIOME;
        } else if(block_manager.MASK_COLOR_BLOCKS.indexOf(mat.id) >= 0) {
            lm = mat.mask_color;
            flags = QUAD_FLAGS.MASK_BIOME;
        }
        //
        for(let i = 0; i < count; i++) {
            const tex2 = [...tex];
            const max_sz = (small ? .25 : 3) / 16;
            // случайный размер текстуры
            const size_x = Math.random() * max_sz + 1 / 16;
            const size_z = Math.random() * max_sz + 1 / 16;
            tex2[2] = size_x;
            tex2[3] = size_z;
            //
            const speed = new Vector(
                (Math.random() - .5) * 2,
                (Math.random() - .5) * 2,
                (Math.random() - .5) * 2
            ).normalize().multiplyScalar(100);
            return new Mesh_Effect_Particle(material_key, ppos, tex2, .5, true, 1, 0.0075 + (0.0075 * Math.random()), speed, flags, lm);
        }
    }

}