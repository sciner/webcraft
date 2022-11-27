import { getChunkAddr, IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";
import { FLUID_TYPE_MASK, FLUID_LAVA_ID, FLUID_WATER_ID } from "../../../fluid/FluidConst.js";

export default class emitter {

    static textures = [
        [2, 6]
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
        this.world          = Qubatch.world;
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
        const rnd = (Math.random() * 5) | 0;
        if(this.ticks++ > 1 || rnd != 0) {
            return [];
        }
        const pos = this.pos.offset(10 * (Math.random() - Math.random()), 10 * Math.random(), 10 * (Math.random() - Math.random()));
        const block = this.world.getBlock(pos.floored());
        if (block.id != 0 || (block.fluid & FLUID_TYPE_MASK) != FLUID_WATER_ID) {
            return [];
        }
        const {texture, texture_index} = getEffectTexture(emitter.textures);
        const particle = new Mesh_Effect_Particle({
                life:           10,
                texture:        texture,
                scale:          10,
                size:           10,
                has_physics:    false,
                ag:             new Vector(0, 0, 0),
                pp:             this.pp,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       new Vector(0, -0.001, 0),
                pos:            pos
            });

            return [particle];
    }

}