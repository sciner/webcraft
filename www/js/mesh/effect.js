import { getChunkAddr, IndexedColor, makeChunkEffectID, QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { ChunkManager } from '../chunk_manager.js';
import { Mesh_Particle_Base } from './particle.js';

import { default as Mesh_Effect_Block_Damage } from "./effect/block_damage.js";
import { default as Mesh_Effect_Campfire } from "./effect/campfire.js";
import { default as Mesh_Effect_Explosion } from "./effect/explosion.js";
import { default as Mesh_Effect_Music_Note } from "./effect/music_note.js";
import { default as Mesh_Effect_Torch_Flame } from "./effect/torch_flame.js";

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

const DEFAULT_LM                = new IndexedColor(0, 0, 0);

export class Mesh_Effect_Particle {

    constructor(material_key, pos, texture, life, invert_percent, min_percent, gravity, speed, flags, lm) {
        this.material_key       = material_key;
        this.pos                = pos;
        this.texture            = texture;
        this.life               = life;
        // zoom
        this.invert_percent     = invert_percent;
        this.min_percent        = min_percent;
        //
        this.gravity            = gravity;
        this.speed              = speed;
        this.flags              = flags;
        this.lm                 = lm;
    }

}

export class Mesh_Effect_Manager {

    // Init effects
    constructor(mesh_manager) {

        this.mesh_manager = mesh_manager;

        this.effects = new Map();

        this.effects.set('music_note', Mesh_Effect_Music_Note);
        this.effects.set('campfire_flame', Mesh_Effect_Campfire);
        this.effects.set('torch_flame', Mesh_Effect_Torch_Flame);
        this.effects.set('explosion', Mesh_Effect_Explosion);
        this.effects.set('destroy_block', Mesh_Effect_Block_Damage);

        for(const [k, c] of this.effects.entries()) {
            if(c.textures) {
                for(let i in c.textures) {
                    c.textures[i][0] += .5;
                    c.textures[i][1] += .5;
                }
            }
        }

    }

    //
    add(name, pos, params) {

        const effect = this.effects.get(name);
        if(!effect) {
            throw 'error_invalid_particle';
        }

        const particle = new effect(new Vector(pos), params);

        //
        const material_key = particle.material_key ?? 'extend/transparent/terrain/effects';
        this._chunk_addr = getChunkAddr(particle.pos.x, particle.pos.y, particle.pos.z, this._chunk_addr);
        const PARTICLE_EFFECTS_ID = makeChunkEffectID(this._chunk_addr, material_key);
        let effects = this.mesh_manager.get(PARTICLE_EFFECTS_ID);
        if(!effects) {
            effects = new Mesh_Effect(this, this._chunk_addr, material_key);
            this.mesh_manager.add(effects, PARTICLE_EFFECTS_ID);
        }
        effects.add(particle);

    }

}

// Mesh effect
export class Mesh_Effect extends Mesh_Particle_Base {

    // Constructor
    constructor(render, chunk_addr, material_key) {

        super();

        this.scale          = new Vector(1, 1, 1);
        this.life           = 1;

        const m             = material_key.split('/');
        this.resource_pack  = Qubatch.world.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        this.tx_cnt         = this.resource_pack.conf.textures[m[3]].tx_cnt;

        this.pos            = Vector.ZERO.clone();
        this.chunk_addr     = chunk_addr.clone();
        this.chunk_coord    = chunk_addr.mul(chunk_size);

        this.max_count      = 32;
        this.add_index      = 0;
        this.vertices       = new Array(this.max_count * STRIDE_FLOATS);
        this.buffer         = new GeometryTerrain(new Float32Array(this.vertices));
        this.p_count        = 0;

    }

    // Add particle
    add(particle) {

        const flags = /*QUAD_FLAGS.NO_AO |*/ QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA | (particle.flags || 0);
        const {x, y, z} = particle.pos;

        const lm = particle.lm || DEFAULT_LM;

        const c = [
            particle.texture[0] / this.tx_cnt,
            particle.texture[1] / this.tx_cnt,
            (particle.texture[2] || 1) / this.tx_cnt,
            (particle.texture[3] || 1) / this.tx_cnt
        ];

        const size_x = particle.texture[2] || 1;
        const size_z = particle.texture[3] || 1;

        const vertices = [
            x+.5 - this.chunk_coord.x, z+.5 - this.chunk_coord.z, y+.5 - this.chunk_coord.y,
            -size_x, 0, 0,
            0, 0, -size_z,
            ...c,
            lm.pack(),
            flags
        ];

        //
        const vindex = this.add_index * STRIDE_FLOATS;
        if(this.vertices[vindex + params_offset]) {
            Mesh_Particle_Base.current_count--;
            this.p_count--;
        }
        this.vertices.splice(vindex, STRIDE_FLOATS, ...vertices);
        this.buffer.changeQuad(vindex, vertices);
        for (let i = 0; i < STRIDE_FLOATS; i++) {
            this.vertices[vindex + i] = vertices[i];
        }
        //
        particle.min_percent = ('min_percent' in particle) ? particle.min_percent : MIN_PERCENT;
        particle.started = performance.now();
        particle.pend = particle.started + 1000 * particle.life;
        this.vertices[vindex + params_offset] = particle;
        Mesh_Particle_Base.current_count++;
        this.p_count++;

        if(this.p_count >= this.max_count) {
            if(this.max_count < 8193) {
                const added = new Array(this.max_count * STRIDE_FLOATS);
                // Resize buffer
                this.vertices = [...this.vertices, ...added];
                this.buffer.setVertices(this.vertices);
                this.max_count = this.vertices.length / STRIDE_FLOATS;
            }
        }

        this.add_index = (this.add_index + 1) % this.max_count;

    }

    update(render) {

        //
        const data = this.buffer.data;
        const vertices = this.vertices;

        const pn = performance.now();

        // Reset inactive particles
        if(!this.last_reset || (performance.now() - this.last_reset > 1000)) {
            for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {
                const params = vertices[i + params_offset];
                if(!params) {
                    continue;
                }
                // ignore this particle
                if(params.pend < pn) {
                    Mesh_Particle_Base.current_count--;
                    this.p_count--;
                    for(let j = 0; j < STRIDE_FLOATS; j++) {
                        this.vertices[i + j] = 0;
                        data[i + j] = 0;
                    }
                }
            }
            this.last_reset = performance.now();
        }

        //
        for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {

            const params = vertices[i + params_offset];
            if(!params) {
                continue;
            }

            const elapsed = (pn - params.started) / 1000;
            let percent = elapsed / params.life;
            if(params.invert_percent) {
                percent = 1 - percent;
            }
            percent = Math.max(percent, params.min_percent);

            const scale = params.pend < pn ? 0 : percent;
            const ap = i + pos_offset;

            // Change position
            let addX = 0;
            let addY = 0;
            let addZ = 0;
            if(params.speed.x != 0) {
                addX = (pn - params.started) * params.speed.x / 1000 * params.gravity;
            }
            if(params.speed.y != 0) {
                addY = (pn - params.started) * params.speed.y / 1000 * params.gravity;
            }
            if(params.speed.z != 0) {
                addZ = (pn - params.started) * params.speed.z / 1000 * params.gravity;
            }

            data[i + 3] = this.vertices[i + 3] * scale;
            data[i + 8] = this.vertices[i + 8] * scale;

            if(addX != 0) {
                data[ap + 0] = vertices[ap + 0] + addX;
            }
            if(addZ != 0) {
                data[ap + 1] = vertices[ap + 1] + addZ;
            }
            if(addY != 0) {
                data[ap + 2] = vertices[ap + 2] + addY;
            }

        }

        this.buffer.updateInternal(data);

    }

    // Draw
    draw(render, delta) {

        if(this.p_count < 0) {
            return false;
        }

        this.update(render);

        if(!this.chunk) {
            this.chunk = ChunkManager.instance.getChunk(this.chunk_addr);
        }

        if(this.chunk) {
            const light = this.chunk.getLightTexture(render.renderBackend);
            if(light) {
                const pp = this.chunk_coord;
                this.material.changeLighTex(light);
                render.renderBackend.drawMesh(
                    this.buffer,
                    this.material,
                    pp,
                    null
                );
                this.material.lightTex = null;
            }
        }

    }

}