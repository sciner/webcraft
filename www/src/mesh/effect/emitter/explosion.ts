import { IndexedColor, QUAD_FLAGS, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [8, 0], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
        [0, 4], [1, 4], [2, 4], [3, 4]
    ];

    constructor(pos, params) {
        this.max_distance   = 64
        this.pos            = pos
        this.chunk_addr     = Vector.toChunkAddr(this.pos)
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY
        const m             = this.material_key.split('/')
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0])
        this.material       = resource_pack.getMaterial(this.material_key)
        this.ticks          = 0
    }

    /**
     * Return true if this emitter can be deleted
     * @returns {bool}
     */
    canDelete() {
        return this.ticks > 0
    }

    /**
     * Method return array of generated particles
     * @returns {Mesh_Effect_Particle[]}
     */
    emit() {

        if(this.ticks++ > 1) {
            return []
        }

        const count = 20
        const resp = []
        const lm = IndexedColor.WHITE.clone()
        for(let i = 0; i < count; i++) {
            const {texture, texture_index} = getEffectTexture(emitter.textures)
            if (texture_index != 0) {
                const particle = new Mesh_Effect_Particle({
                    life:           1 + Math.random() * .5,
                    texture:        texture,
                    size:           1/8,
                    scale:          1,
                    smart_scale:    {0: 1, 1: 0},
                    has_physics:    false,
                    ag:             new Vector(0, 0, 0),
                    pp:             lm.pack(),
                    material_key:   this.material_key,
                    material:       this.material,
                    velocity:       new Vector(
                        Math.random() - Math.random(),
                        Math.random() - Math.random(),
                        Math.random() - Math.random()
                    ).multiplyScalarSelf(50),
                    pos:            this.pos.clone().addScalarSelf(
                        (Math.random() - Math.random()) * .3,
                        .35 + .25 * Math.random(),
                        (Math.random() - Math.random()) * .3
                    )
                })
                resp.push(particle)
            }
        }
        lm.b = 12
        for(let i = 0; i < count; i++) {
            const particle = new Mesh_Effect_Particle({
                life:           1.37,
                texture:        emitter.textures[0],
                size:           1/8,
                flags:          QUAD_FLAGS.FLAG_ANIMATED,
                scale:          1,
                smart_scale:    {0: 1, 1: 1},
                ag:             new Vector(0, 0, 0),
                pp:             lm.pack(),
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, 0, 0),
                pos:            this.pos.clone().addScalarSelf((Math.random() - Math.random()) * 3, Math.random() * 3, (Math.random() - Math.random()) * 3)
            })
            resp.push(particle)
        }
        return resp

    }

}