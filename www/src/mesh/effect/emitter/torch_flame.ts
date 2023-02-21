import { IndexedColor, QUAD_FLAGS, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [0, 1], [1, 1], [2, 1], [3, 1]
    ];

    constructor(pos, args) {
        this.max_distance   = 16;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = Vector.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        this.ticks          = 0;
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

        if(Math.random() > .03) {
            return [];
        }

        if(this.ticks++ > 0) {
            return [];
        }

        const {texture, texture_index} = getEffectTexture(emitter.textures);

        // новая частица
        const particle = new Mesh_Effect_Particle({
            // old
            // life:           1 + Math.random(),
            // velocity:       new Vector(0, texture_index > 1 ? .5 : 0, 0),
            // flags:          QUAD_FLAGS.NO_CAN_TAKE_LIGHT,
            // new
            life:           1000000,
            velocity:       new Vector(0, 0, 0),
            flags:          0,
            force_flags:    QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_TORCH_FLAME | QUAD_FLAGS.LOOK_AT_CAMERA_HOR | QUAD_FLAGS.NORMAL_UP,
            //
            has_physics:    false,
            texture:        texture,
            size:           1/8,
            scale:          1,
            smart_scale:    {0: 1, 1: 1},
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            pos:            this.pos.clone().addScalarSelf(
                (Math.random() - Math.random()) * 0.01,
                .2 + .25,
                (Math.random() - Math.random()) * 0.01
            ),
            material:       this.material
        });

        return [
            particle
        ];

    }

}