import { getChunkAddr, IndexedColor, Vector } from "../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../effect.js";
import { Mesh_Particle } from "../particle.js";

export default class effect {

    static textures = [
        [0, 0], [1, 0], [2, 0], [3, 0]
    ];

    constructor(pos, args) {
        this.pp = IndexedColor.WHITE.clone().pack();
        this.pos = pos;
        this.chunk_addr = getChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
    }

    emit() {

        if(Math.random() > .03) {
            return [];
        }

        const {texture, texture_index} = getEffectTexture(effect.textures);

        // новая частица
        const particle = new Mesh_Particle({
            life:           1 + Math.random() * 5,
            texture:        texture,
            size:           1/8,
            scale:          1,
            velocity:       new Vector(0, 1, 0),
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            pos:            this.pos.clone().addScalarSelf(
                (Math.random() - Math.random()) * .3,
                .35 + .25 * Math.random(),
                (Math.random() - Math.random()) * .3
            ),
            material:       this.material
        });

        return [
            particle
        ];

    }

}