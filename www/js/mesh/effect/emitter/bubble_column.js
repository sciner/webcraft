import { getChunkAddr, IndexedColor, Vector, toNarrowDistribution } from "../../../helpers.js";
import { getEffectTexture } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

const MATERIAL_KEY = 'extend/regular/terrain/effects';
const living_blocks = [88, 415]; // [BLOCK.SOUL_SAND.id, BLOCK.BUBBLE_COLUMN.id]
const CHANCE = 0.1;
const NARROWNESS = 5;

export default class emitter {

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

        if (Math.random() > CHANCE) {
            return null;
        }

        const {texture, texture_index} = getEffectTexture(emitter.textures);

        // новая частица
        const particle = new Mesh_Effect_Particle({
            life:           1 + Math.random() * 5,
            texture:        texture,
            size:           1/8,
            scale:          1,
            smart_scale:    {0: .65, 1: 0},
            velocity:       new Vector(0, 1, 0),
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            living_blocks:  living_blocks,
            pos:            this.pos.clone().addScalarSelf(
                toNarrowDistribution(Math.random(), 0.5, NARROWNESS),
                .35 + .25 * Math.random(),
                toNarrowDistribution(Math.random(), 0.5, NARROWNESS)
            ),
            material:       this.material
        });

        return [
            particle
        ];

    }

}