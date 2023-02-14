import { getChunkAddr, IndexedColor, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY } from "../../effect.js";
import { Mesh_Effect_Particle } from "../particle.js";

export default class emitter {
    [key: string]: any;

    static textures = [
        [0, 2], [2, 2]
    ];

    constructor(pos, args) {
        this.max_distance = 20;
        this.pp = IndexedColor.WHITE.clone().pack();
        this.pos = pos;
        this.chunk_addr = Vector.toChunkAddr(this.pos);
        this.material_key = DEFAULT_EFFECT_MATERIAL_KEY;
        const m = this.material_key.split('/');
        const resource_pack = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material = resource_pack.getMaterial(this.material_key);
        this.ticks = 0;
        this.isWater = args.isWater;
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
        if ((this.ticks++ % (100 + Math.round(Math.random() * 50))) != 0) {
            return [];
        }
        const texture = this.isWater ? emitter.textures[1] : emitter.textures[0];
        const particle = new Mesh_Effect_Particle({
            life: 2,
            texture: texture,
            size: 1 / 8,
            scale: 1,
            has_physics: false,
            smart_scale: { 0: 0.5, 1: 0.5 },
            pp: this.pp,
            material_key: this.material_key,
            material: this.material,
            velocity: new Vector(0, -2, 0),
            pos: this.pos.offset(0, -0.5, 0)
        });

        return [
            particle
        ];

    }

}