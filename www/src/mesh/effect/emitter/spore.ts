import { IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import type { MeshManager } from "../../manager.js";
import { Mesh_Effect_Particle } from "../particle.js";
import { BaseEmitter } from "./base.js";

export default class emitter extends BaseEmitter {
    [key: string]: any;

    static textures = [
        [2, 5]
    ];

    constructor(mesh_manager : MeshManager, pos, args) {

        super(mesh_manager, pos, args)

        this.max_distance   = 5;
        this.pp             = IndexedColor.WHITE.clone().pack();
        this.chunk_addr     = mesh_manager.world.chunkManager.grid.toChunkAddr(this.pos);
        this.material_key   = DEFAULT_EFFECT_MATERIAL_KEY;
        const m             = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = resource_pack.getMaterial(this.material_key);
        this.ticks          = 0;
        this.next           = 0
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
    
        if (this.ticks++ < this.next) {
            return []
        }
        this.next = this.ticks + 100 + Math.round(Math.random() * 50)

        const {texture, texture_index} = getEffectTexture(emitter.textures)

        const particle = new Mesh_Effect_Particle({
            life: 5 + Math.random() * 5,
            texture: texture,
            size: 1 / 8,
            scale: 1,
            has_physics: true,
            smart_scale: { 0: .4, 1: .4 },
            pp: this.pp,
            material_key: this.material_key,
            material: this.material,
            velocity: new Vector(0, -.3, 0),
            ag: new Vector(0, 0, 0),
            pos: this.pos.offset(Math.random(), .5, Math.random())
        })

        return [
            particle
        ]

    }

}