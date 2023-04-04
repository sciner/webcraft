import { IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [0, 0], [1, 0], [2, 0], [3, 0]
    ];

    constructor(pos, args) {
        this.max_distance   = 96;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = Vector.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
    }

    /**
     * Return true if this emitter can be deleted
     * @returns {bool}
     */
    canDelete() {
        return false;
    }

    /**
     * Method return array of generated particles
     * @returns {Mesh_Effect_Particle[]}
     */
    emit() {

        if(Math.random() > .01) {
            return [];
        }

        const {texture, texture_index} = getEffectTexture(emitter.textures);

        // новая частица
        const particle = new Mesh_Effect_Particle({
            life:           1 + Math.random() * 3.5,
            texture:        texture,
            size:           1/8,
            scale:          1,
            velocity:       new Vector(0, .7, 0),
            ag:             new Vector(0, 0, 0),
            has_physics:    false,
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