import { QUAD_FLAGS, Vector, VectorCollector } from '../helpers.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { ChunkManager } from '../chunk_manager.js';
import { Mesh_Effect_Particle } from './effect/particle.js';

const STRIDE_FLOATS                         = GeometryTerrain.strideFloats;
const chunk_size                            = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

export const pos_offset                     = 0;
export const axisx_offset                   = 3;
export const axisy_offset                   = 6;
export const particle_offset                = 4;
export const DEFAULT_EFFECT_MATERIAL_KEY    = 'extend/transparent/terrain/effects';

//
export function getEffectTexture(textures) {
    const texture_index = Math.floor(textures.length * Math.random());
    const texture = textures[texture_index];
    return {
        texture,
        texture_index
    };
}

/**
 * A mesh that consists of particles generated by emitters
 * Меш, который состоит из сгенерированных эмиттерами частиц
 */
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
        this.tx_cnt         = this.resource_pack.conf.textures[m[3]].tx_cnt;

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
     * @param {Mesh_Effect_Particle} particle 
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
            if(!this.vertices[i + particle_offset]) {
                vindex = i;
                break;
            }
        }

        if(this.vertices[vindex + particle_offset]) {
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
        vertices[particle_offset] = particle;
        this.vertices.splice(vindex, STRIDE_FLOATS, ...vertices);
        Mesh_Effect.current_count++;
        this.p_count++;

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

        const blocks = new VectorCollector();
        const _block_pos = new Vector(0, 0, 0);

        // Reset inactive particles
        //if(!this.last_reset || (performance.now() - this.last_reset > 200)) {
            for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {
                const particle = vertices[i + particle_offset];
                if(!particle) {
                    continue;
                }
                let need_to_delete = particle.life <= 0;
                // delete if particle not in living block
                if(particle.living_blocks && !need_to_delete) {
                    const ap = i + pos_offset;
                    _block_pos
                        .copyFrom(this.chunk_coord)
                        .addScalarSelf(data[ap + 0], data[ap + 2], data[ap + 1])
                        .flooredSelf();
                    let block = blocks.get(_block_pos);
                    if(!block) {
                        block = Qubatch.world.getBlock(_block_pos);
                        blocks.set(_block_pos, block);
                    }
                    if(block && !particle.living_blocks.includes(block.id)) {
                        need_to_delete = true;
                    }
                }
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

            const particle = vertices[i + particle_offset];
            if(!particle) {
                continue;
            }

            if(!particle.tick) debugger
            particle.tick(delta);

            const ap = i + pos_offset;

            data[ap + 0] = particle.pos.x - this.chunk_coord.x;
            data[ap + 2] = particle.pos.y - this.chunk_coord.y;
            data[ap + 1] = particle.pos.z - this.chunk_coord.z;

            let scale = particle.getCurrentSmartScale();

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