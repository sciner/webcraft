import { getChunkAddr, IndexedColor, Vector } from "../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../effect.js";
import { Mesh_Particle } from "../particle.js";

export default class effect {

    static textures = [
        [0, 1], [1, 1], [2, 1], [3, 1]
    ];

    constructor(pos, args) {
        this.pp = IndexedColor.WHITE.clone().pack();
        this.pos = pos.addScalarSelf(
            (Math.random() - Math.random()) * 0.01,
            .2,
            (Math.random() - Math.random()) * 0.01
        );
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
            life:           1 + Math.random(),
            texture:        texture,
            size:           1/8,
            scale:          1,
            velocity:       new Vector(0, texture_index > 1 ? .5 : 0, 0),
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            pos:            this.pos.clone(),
            material:       this.material
        });

        return [
            particle
        ];

    }

}