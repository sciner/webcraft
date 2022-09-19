import { getChunkAddr, IndexedColor, makeChunkEffectID, QUAD_FLAGS, Vector, VectorCollector, VectorCollectorFlat } from '../helpers.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { ChunkManager } from '../chunk_manager.js';

import { default as Mesh_Effect_Block_Destroy } from "./effect/block_destroy.js";
import { default as Mesh_Effect_Campfire } from "./effect/campfire.js";
import { default as Mesh_Effect_Explosion } from "./effect/explosion.js";
import { default as Mesh_Effect_Music_Note } from "./effect/music_note.js";
import { default as Mesh_Effect_Torch_Flame } from "./effect/torch_flame.js";
import { default as Mesh_Effect_Bubble_Column } from "./effect/bubble_column.js";
import { Mesh_Particle } from './particle.js';

const pos_offset                = 0;
export const axisx_offset       = 3;
export const axisy_offset       = 6;
const uv_size_offset            = 11;
const lm_offset                 = 13;
const params_offset             = 4;
const scale_offset              = 15;
const STRIDE_FLOATS             = GeometryTerrain.strideFloats;
const chunk_size                = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const MIN_PERCENT               = .25;
const MAX_PERCENT               = 1.;

const DEFAULT_LM                = new IndexedColor(0, 0, 0);
export const DEFAULT_EFFECT_MATERIAL_KEY = 'extend/transparent/effects';

export function getEffectTexture(textures) {
    const texture_index = Math.floor(textures.length * Math.random());
    const texture = textures[texture_index];
    return {
        texture,
        texture_index
    };
}

export class Mesh_Effect_Particle {

    constructor(material_key, pos, texture, life, invert_percent, min_percent, gravity, speed, flags, lm, living_blocks, max_percent) {
        this.material_key       = material_key;
        this.pos                = pos;
        this.texture            = texture;
        this.life               = life;
        // zoom
        this.invert_percent     = invert_percent;
        this.min_percent        = min_percent;
        this.max_percent        = max_percent;
        //
        this.gravity            = gravity;
        this.speed              = speed;
        this.flags              = flags;
        this.lm                 = lm;
        this.living_blocks      = living_blocks;
    }

}

export class Mesh_Effect_Manager {

    // Init effects
    constructor(mesh_manager) {

        this.mesh_manager = mesh_manager;

        this.emitters = [];
        this.block_emitters = new VectorCollectorFlat();

        // Effect types
        this.effects = new Map();
        this.effects.set('destroy_block', Mesh_Effect_Block_Destroy);
        this.effects.set('music_note', Mesh_Effect_Music_Note);
        this.effects.set('campfire_flame', Mesh_Effect_Campfire);
        this.effects.set('torch_flame', Mesh_Effect_Torch_Flame);
        this.effects.set('explosion', Mesh_Effect_Explosion);
        this.effects.set('bubble_column', Mesh_Effect_Bubble_Column);
        for(const [k, c] of this.effects.entries()) {
            if(c.textures) {
                for(let i in c.textures) {
                    c.textures[i][0] = (c.textures[i][0] + .5) / 8;
                    c.textures[i][1] = (c.textures[i][1] + .5) / 8;
                    c.textures[i][2] = 1 / 8;
                    c.textures[i][3] = 1 / 8;
                }
            }
        }

    }

    /**
     * 
     */
    createBlockEmitter(args) {
        for(let i = 0; i < args.pos.length; i++) {
            const em = this.effects.get(args.type);
            if(!em) {
                throw 'error_invalid_particle';
            }
            const pos = new Vector(args.pos[i]);
            const emitter = new em(pos, args);
            this.block_emitters.set(args.block_pos, emitter);
        }
    }

    /**
     * 
     * @param {Vector} block_pos 
     */
    deleteBlockEmitter(block_pos) {
        this.block_emitters.delete(block_pos);
    }

    /**
     * 
     * @param {*} aabb 
     */
    destroyAllInAABB(aabb) {
        for(let [pos, _] of this.block_emitters.entries(aabb)) {
            this.block_emitters.delete(pos);
        }
    }

    /**
     * Create particle emitter
     * @param {string} name 
     * @param {Vector} pos 
     * @param {*} params 
     * @returns 
     */
    createEmitter(name, pos, params) {
        const em = this.effects.get(name);
        if(!em) {
            throw 'error_invalid_particle';
        }
        const emitter = new em(pos.clone(), params);
        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * 
     * @param {Vector} chunk_addr 
     * @param {string} material_key 
     * @returns {Mesh_Effect}
     */
    getChunkEffectMesh(chunk_addr, material_key) {
        // const material_key = particle.material_key ?? 'extend/transparent/effects';
        const PARTICLE_EFFECTS_ID = makeChunkEffectID(chunk_addr, material_key);
        let effect_mesh = this.mesh_manager.get(PARTICLE_EFFECTS_ID);
        if(!effect_mesh) {
            effect_mesh = new Mesh_Effect(this, chunk_addr, material_key);
            this.mesh_manager.add(effect_mesh, PARTICLE_EFFECTS_ID);
        }
        return effect_mesh;
    }

    tick(delta, player_pos) {

        //
        for(let emitter of this.emitters) {
            const particles = emitter.emit();
            for(let particle of particles) {
                const mesh = this.getChunkEffectMesh(emitter.chunk_addr, particle.material_key);
                mesh.add(particle);
            }
        }

        //
        const type_distance = {
            torch_flame: 12,
            bubble_column: 24,
            campfire_flame: 96
        };
        const max_distance = 24; // type_distance[item.type]
        for(let emitter of this.block_emitters) {
            if(player_pos.distance(emitter.pos) < max_distance) {
                const particles = emitter.emit();
                for(let particle of particles) {
                    const mesh = this.getChunkEffectMesh(emitter.chunk_addr, particle.material_key);
                    mesh.add(particle);
                }
            }
        }

    }

}

// Mesh effect
export class Mesh_Effect {

    static current_count = 0;

    // Constructor
    constructor(render, chunk_addr, material_key) {

        this.pn = performance.now();

        this.scale          = new Vector(1, 1, 1);
        this.life           = 1;

        const m             = material_key.split('/');
        this.resource_pack  = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        this.tx_cnt         = this.resource_pack.conf.textures[m[2]].tx_cnt;

        this.pos            = Vector.ZERO.clone();
        this.chunk_addr     = chunk_addr.clone();
        this.chunk_coord    = chunk_addr.mul(chunk_size);

        this.max_count      = 8192;
        this.add_index      = 0;
        this.vertices       = new Array(this.max_count * STRIDE_FLOATS);
        this.buffer         = new GeometryTerrain(new Float32Array(this.vertices));
        this.p_count        = 0;

    }

    /**
     * Add particle
     * @param {Mesh_Particle} particle 
     */
    add(particle) {

        const flags = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA | (particle.flags || 0);
        const pp = particle.pp;
        const {x, y, z} = particle.pos;

        const c = particle.texture;

        const size_x = c[2] * this.tx_cnt;
        const size_z = c[3] * this.tx_cnt;

        //
        let vindex = 0;
        for(let i = 0; i < this.vertices.length; i += STRIDE_FLOATS) {
            if(!this.vertices[i + params_offset]) {
                vindex = i;
                break;
            }
        }

        if(this.vertices[vindex + params_offset]) {
            Mesh_Effect.current_count--;
            this.p_count--;
        }

        if(c.length != 4) {
            throw 'error_invalid_texture';
        }

        const vertices = [
            // x, z, y
            x+.5 - this.chunk_coord.x, z+.5 - this.chunk_coord.z, y+.5 - this.chunk_coord.y,
            -size_x, 0, 0,
            0, 0, -size_z,
            ...c,
            pp,
            flags
        ];

        this.buffer.changeQuad(vindex, vertices);
        vertices[params_offset] = particle;
        this.vertices.splice(vindex, STRIDE_FLOATS, ...vertices);
        Mesh_Effect.current_count++;
        this.p_count++;

        //for (let i = 0; i < STRIDE_FLOATS; i++) {
        //    this.vertices[vindex + i] = vertices[i];
        //}

        /*
        //
        particle.min_percent = particle.min_percent ?? MIN_PERCENT;
        particle.max_percent = particle.max_percent ?? MAX_PERCENT;
        particle.started = performance.now();
        particle.pend = particle.started + 1000 * particle.life;
        */

        /*
        if(this.p_count >= this.max_count) {
            if(this.max_count < 8193) {
                const added = new Array(this.max_count * STRIDE_FLOATS);
                // Resize buffer
                this.vertices = [...this.vertices, ...added];
                this.buffer.setVertices(this.vertices);
                this.max_count = this.vertices.length / STRIDE_FLOATS;
            }
        }
        */

        // this.add_index = (this.add_index + 1) % this.max_count;

    }

    update(render, delta) {

        //
        const data = this.buffer.data;
        const vertices = this.vertices;

        // const pn = performance.now();
        // const blocks = new VectorCollector();
        // const _block_pos = new Vector(0, 0, 0);

        // Reset inactive particles
        //if(!this.last_reset || (performance.now() - this.last_reset > 200)) {
            for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {
                const particle = vertices[i + params_offset];
                if(!particle) {
                    continue;
                }
                let need_to_delete = particle.life <= 0;
                // let need_to_delete = params.pend < pn;
                // // delete if particle not in living block
                // if(params.living_blocks && !need_to_delete) {
                //     const ap = i + pos_offset;
                //     _block_pos
                //         .copyFrom(this.chunk_coord)
                //         .addScalarSelf(data[ap + 0], data[ap + 2], data[ap + 1])
                //         .flooredSelf();
                //     let block = blocks.get(_block_pos);
                //     if(!block) {
                //         block = Qubatch.world.getBlock(_block_pos);
                //         blocks.set(_block_pos, block);
                //     }
                //     if(block && !params.living_blocks.includes(block.id)) {
                //         need_to_delete = true;
                //     }
                // }
                // delete this particle
                if(need_to_delete) {
                    Mesh_Effect.current_count--;
                    this.p_count--;
                    for(let j = 0; j < STRIDE_FLOATS; j++) {
                        this.vertices[i + j] = 0;
                        data[i + j] = 0;
                    }
                }
            }
        //    this.last_reset = performance.now();
        //}

        //
        for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {

            const particle = vertices[i + params_offset];
            if(!particle) {
                continue;
            }

            if(!particle.tick) debugger
            particle.tick(delta);

            const ap = i + pos_offset;

            data[ap + 0] = particle.pos.x - this.chunk_coord.x;
            data[ap + 2] = particle.pos.y - this.chunk_coord.y;
            data[ap + 1] = particle.pos.z - this.chunk_coord.z;

            let scale = .6;

            // scale
            // data[i + 3] = this.vertices[i + 3];
            // data[i + 8] = this.vertices[i + 8];
            data[i + 3] = this.vertices[i + 3] * scale;
            data[i + 8] = this.vertices[i + 8] * scale;

        }

        this.buffer.updateInternal(data);

    }

    // Draw
    draw(render, delta) {

        if(this.p_count < 0) {
            return false;
        }

        this.update(render, delta);

        if(!this.chunk) {
            this.chunk = ChunkManager.instance.getChunk(this.chunk_addr);
        }

        if(this.chunk) {
            const light = this.chunk.getLightTexture(render.renderBackend);
            if(light) {
                this.material.changeLighTex(light);
                render.renderBackend.drawMesh(
                    this.buffer,
                    this.material,
                    this.chunk_coord,
                    null
                );
                this.material.lightTex = null;
            }
        }

    }

    destroy(render) {
        this.life = 0;
        if (this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
        this.vertices = null;
        this.particles = null;
    }

    isAlive() {
        return this.life > 0;
    }

}