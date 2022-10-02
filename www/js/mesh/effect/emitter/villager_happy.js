import { getChunkAddr, IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {

    static textures = [
        [1, 5]
    ];

    constructor(pos, args) {
        this.max_distance   = 64;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = getChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        this.ticks          = 0;
        this.isArea         = args.area || false;
    }

    /**
     * Return true if this emitter can be deleted
     * @returns {bool}
     */
    canDelete() {
        return this.ticks > 0;
    }

    /**
     * Method return array of generated particles
     * @returns {Mesh_Effect_Particle[]}
     */
    emit() {

        if(this.ticks++ > 1) {
            return [];
        }

        const count = 20;
        const resp = [];
        const {texture, texture_index} = getEffectTexture(emitter.textures);
        for(let i = 0; i < count; i++) {
            const pos = (this.isArea) ? this.pos.offset((Math.random() - Math.random()) * 4, Math.random() * 0.5, (Math.random() - Math.random()) * 4)  : this.pos.offset(Math.random(), Math.random() * 0.5, Math.random());
            // новая частица
            const particle = new Mesh_Effect_Particle({
                life:           1,
                texture:        texture,
                size:           1/8,
                scale:          1,
                smart_scale:    {0: 1, 1: 0},
                has_physics:    false,
                ag:             new Vector(0, 0, 0),
                pp:             this.pp,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, 0.1, 0),
                pos:            pos
            });

            resp.push(particle);

        }

        return resp;

    }

}