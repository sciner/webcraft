import { IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import type { MeshManager } from "../../manager.js";
import { Mesh_Effect_Particle } from "../particle.js";
import { BaseEmitter } from "./base.js";

export default class emitter extends BaseEmitter {
    [key: string]: any;

    static textures = [
        [0, 1], [1, 1], [2, 1], [3, 1]
    ];

    constructor(mesh_manager : MeshManager, pos, args) {

        super(mesh_manager, pos, args)

        this.max_distance   = 16;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.chunk_addr     = mesh_manager.world.chunkManager.grid.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
    }

    /**
     * Return true if this emitter can be deleted
     */
    canDelete() : boolean {
        return false;
    }

    /**
     * Method return array of generated particles
     */
    emit() : Mesh_Effect_Particle[] {

        if(Math.random() > .03) {
            return [];
        }

        const {texture, texture_index} = getEffectTexture(emitter.textures);

        // новая частица
        const particle = new Mesh_Effect_Particle({
            life:           1 + Math.random(),
            texture:        texture,
            has_physics:    false,
            size:           1/8,
            scale:          1,
            velocity:       new Vector(0, texture_index > 1 ? .5 : 0, 0),
            ag:             new Vector(0, 0, 0),
            pp:             this.pp,
            material_key:   this.material_key,
            pos:            this.pos.clone().addScalarSelf(
                (Math.random() - Math.random()) * 0.01,
                .2,
                (Math.random() - Math.random()) * 0.01
            ),
            material:       this.material
        });

        return [
            particle
        ];

    }

}
