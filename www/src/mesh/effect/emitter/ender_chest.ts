import { IndexedColor, QUAD_FLAGS, Vector } from "../../../helpers.js";
import { DEFAULT_EFFECT_MATERIAL_KEY, getEffectTexture } from "../../effect.js";
import type { MeshManager } from "../../manager.js";
import { Mesh_Effect_Particle } from "../particle.js";
import { BaseEmitter } from "./base.js";

class EnderChest_Particle extends Mesh_Effect_Particle {
    [key: string]: any;

    constructor(start_pos, args) {
        super(args);
        this.start_pos = start_pos;
    }

    tick(delta) {
        super.tick(delta);
        if(this.pos.distance(this.start_pos) < .4) {
            this.life = 0;
        } else {
            this.velocity.multiplyScalarSelf(1.01);
        }
    }

}

export default class emitter extends BaseEmitter {
    [key: string]: any;

    static textures = [
        [0, 6], [1, 6], [2, 6]
    ];

    constructor(mesh_manager : MeshManager, pos, args) {

        super(mesh_manager, pos, args)

        this.max_distance   = 64;
        this.pp             = new IndexedColor(20, 540, 0).pack();
        this.chunk_addr     = mesh_manager.world.chunkManager.grid.toChunkAddr(this.pos);
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

        if(this.ticks++ % (20 + Math.round(Math.random() * 10)) != 0) {
            return [];
        }

        const count = 5;
        const resp = [];

        for(let i = 0; i < count; i++) {

            const {texture, texture_index} = getEffectTexture(emitter.textures);

            const particle_pos = this.pos.clone().addScalarSelf(
                (Math.random() - Math.random()) * 1.25,
                (Math.random() - Math.random()) * 1.25,
                (Math.random() - Math.random()) * 1.25
            );

            // новая частица
            const particle = new EnderChest_Particle(this.pos.clone(), {
                life:           3, //  + Math.random() * 10,
                texture:        texture,
                size:           1/8,
                scale:          1,
                smart_scale:    {0: .0, 1: .3},
                has_physics:    false,
                ag:             new Vector(0, 0, 0),
                pp:             this.pp,
                flags:          QUAD_FLAGS.FLAG_MULTIPLY_COLOR | QUAD_FLAGS.NO_CAN_TAKE_LIGHT,
                material_key:   this.material_key,
                material:       this.material,
                velocity:       particle_pos.sub(this.pos).normal().multiplyScalarSelf(-.1),
                pos:            particle_pos
            });

            resp.push(particle);

        }

        return resp;

    }

}