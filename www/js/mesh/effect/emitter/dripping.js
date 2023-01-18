import { getChunkAddr, IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {

    static textures = [
        [0, 2]
    ];

    constructor(pos, args) {
        this.max_distance   = 50;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = getChunkAddr(this.pos);
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

        if(Math.random() > .02) {
            return [];
        }
        
        const resp = [];
        const {texture, texture_index} = getEffectTexture(emitter.textures);
        ///for(let i = 0; i < 10; i++) {
            // новая частица
            const particle = new Mesh_Effect_Particle({
                life:           2,
                texture:        texture,
                size:           1/8,
                scale:          1,
                has_physics:    true,
                smart_scale:    {0: 0.2, 1: 0.2},
                pp:             this.pp,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, -2, 0),
                pos:            this.pos.offset( 0, 0, 0)
            });

           // resp.push(particle);

        //}

        return [
            particle
        ];

    }

}