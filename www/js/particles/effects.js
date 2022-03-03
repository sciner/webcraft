import { QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const pos_offset        = 0;
const axisx_offset      = 3;
const axisy_offset      = 6;
const uv_size_offset    = 11;
const lm_offset         = 13;
const STRIDE_FLOATS     = GeometryTerrain.strideFloats;
const chunk_size        = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);
const MIN_PERCENT       = .25;

export class Particles_Effects extends Particles_Base {

    static current_count = 0;

    // Constructor
    constructor(render, chunk_addr, material_key) {

        super();

        this.scale          = new Vector(1, 1, 1);
        this.life           = 1;

        const m             = material_key.split('/');
        this.resource_pack  = Game.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        this.tx_cnt         = this.resource_pack.conf.textures[m[2]].tx_cnt;

        this.pos            = Vector.ZERO.clone();
        this.chunk_addr     = chunk_addr;
        this.chunk_coord    = chunk_addr.mul(chunk_size);

        this.max_count      = 32;
        this.add_index      = 0;
        this.vertices       = new Array(this.max_count * STRIDE_FLOATS);
        this.buffer         = new GeometryTerrain(new Float32Array(this.vertices));
        this.p_count        = 0;

    }

    // Add particle
    add(pos, params) {

        const flags     = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA;
        const {x, y, z} = pos;

        const c = [
            (params.texture[0] + 0.5) / this.tx_cnt,
            (params.texture[1] + 0.5) / this.tx_cnt,
            1 / this.tx_cnt,
            1 / this.tx_cnt
        ];
        const vertices = [
            x+.5 - this.chunk_coord.x, z+.5 - this.chunk_coord.z, y+.5 - this.chunk_coord.y,
            -1, 0, 0,
            0, 0, -1,
            ...c,
            0,
            0,
            0,
            flags
        ];

        //
        const vindex = this.add_index * STRIDE_FLOATS;
        if(this.vertices[vindex + lm_offset]) {
            Particles_Effects.current_count--;
            this.p_count--;
        }
        this.vertices.splice(vindex, STRIDE_FLOATS, ...vertices);
        for(let i = 0; i < STRIDE_FLOATS; i++) {
            this.buffer.data[vindex + i] = vertices[i];
            this.vertices[vindex + i] = vertices[i];
        }
        // this.buffer.data.splice(vindex, STRIDE_FLOATS, ...vertices);
        //
        params.min_percent = ('min_percent' in params) ? params.min_percent : MIN_PERCENT;
        params.started = performance.now();
        params.pend = params.started + 1000 * params.life;
        this.vertices[vindex + lm_offset] = params;
        Particles_Effects.current_count++;
        this.p_count++;

        if(this.p_count >= this.max_count) {
            if(this.max_count < 8193) {
                const added = new Array(this.max_count * STRIDE_FLOATS);
                // Resize buffer
                this.vertices = [...this.vertices, ...added];
                this.buffer.data = new Float32Array(this.vertices);
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
                const params = vertices[i + lm_offset];
                if(!params) {
                    continue;
                }
                // ignore this particle
                if(params.pend < pn) {
                    Particles_Effects.current_count--;
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

            const params = vertices[i + lm_offset];
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
            let addY = 0;
            if(params.speed.y != 0) {
                addY = (pn - params.started) * params.speed.y / 1000 * params.gravity;
            }

            // Change vertices data
            data[i + lm_offset] = scale; // remove params object from data and store scale in R argument
            data[ap + 2]        = vertices[ap + 2] + addY;

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