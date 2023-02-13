import { getChunkAddr, IndexedColor, Vector, Mth } from "../../../helpers.js";
import { getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

const MATERIAL_KEY = 'extend/regular/terrain/effects';
const living_blocks = [88, 415]; // [BLOCK.SOUL_SAND.id, BLOCK.BUBBLE_COLUMN.id]
const CHANCE = 0.03;

export default class emitter {
    [key: string]: any;

    static textures = [
        [0, 5]
    ];

    constructor(pos, args) {
        this.max_distance   = 24;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.pos            = pos;
        this.chunk_addr     = getChunkAddr(this.pos);
        this.material_key   = MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        // To make the same bubble density everywhere, at the bottom we generate 
        // more bubbles, but their life is already partially depleted.
        this.isBottom       = args.isBottom;
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

        var chance = CHANCE;
        if (this.isBottom) {
            chance *= 3;
        }
        if (Math.random() > chance) {
            return null;
        }

        const {texture, texture_index} = getEffectTexture(emitter.textures);

        const max_life = 1 + Math.random() * 5;
        const scaleK = 0.5 + Math.random() * 0.5; // some of them are smaller
        // новая частица
        const particle = new Mesh_Effect_Particle({
            life:           max_life,
            initial_life:   this.isBottom ? max_life * (0.5 + 0.5 * Math.random()) : null,
            texture:        texture,
            size:           1/8,
            scale:          1,
            smart_scale:    [0,0.1,  0.3,0.5 * scaleK, 0.5,0.65 * scaleK,
                            1,0.65 * scaleK * (0.4 + 0.4 * Math.random())],
            velocity:       new Vector(0, 1 + 0.2 * Math.random(), 0),
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            living_blocks:  living_blocks,
            pos:            this.pos.clone().addScalarSelf(
                Mth.toNarrowDistribution(Math.random(), 0.5, 6, 0.1),
                .35 + .25 * Math.random(),
                Mth.toNarrowDistribution(Math.random(), 0.5, 6, 0.1)
            ),
            material:       this.material
        });

        return [
            particle
        ];

    }

}