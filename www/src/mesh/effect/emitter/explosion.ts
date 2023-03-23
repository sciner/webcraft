import { getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [8, 0]
        // [0, 7], [1, 7], [2, 7], [3, 7], [4, 7]
    ];

    constructor(pos, params) {
        const lm = IndexedColor.WHITE.clone()
        this.max_distance   = 64;
        this.pp             = lm.pack();
        this.pos            = pos;
        this.flags          = 0
        this.chunk_addr     = Vector.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        this.ticks          = 0;
        // animations
        lm.b = 12
        this.pp = lm.pack()
        this.flags = QUAD_FLAGS.FLAG_ANIMATED
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

        const count = 1;
        const resp = [];

       // for(let i = 0; i < count; i++) {

            const {texture, texture_index} = getEffectTexture(emitter.textures);
            console.log(texture_index)

            // новая частица
            const particle = new Mesh_Effect_Particle({
                life:           1,
                texture:        texture,
                size:           1/8,
                flags:          this.flags,
                scale:          1,
                smart_scale:    {0: 1, 1: 1},
                ag:             new Vector(0, 0, 0),
                pp:             this.pp,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, 0, 0),
                pos:            this.pos.clone().addScalarSelf(
                    (Math.random() - Math.random()) * .3,
                    .35 + .25 * Math.random(),
                    (Math.random() - Math.random()) * .3
                )
            });

            resp.push(particle);

       // }

        return resp;

    }

}