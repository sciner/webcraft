import { getChunkAddr, IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [0, 5]
    ];

    constructor(pos, args) {
        this.max_distance   = 64;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = Vector.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        this.ticks          = 0;
        console.log(args)
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

        const resp = [];
        const {texture, texture_index} = getEffectTexture(emitter.textures);
        for(let i = 0; i < 10; i++) {
            // новая частица
            const particle = new Mesh_Effect_Particle({
                life:           1,
                texture:        texture,
                size:           1/8,
                scale:          1,
                has_physics:    false,
                ag:             new Vector(0, 0, 0),
                pp:             this.pp,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, 0.05, 0),
                pos:            this.pos.offset(Math.random() - Math.random(), -Math.random(), Math.random() - Math.random())
            });

            resp.push(particle);

        }

        return resp;

    }

}