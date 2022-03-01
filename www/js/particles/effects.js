import { QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js";

const { mat3, mat4 } = glMatrix;

const push_plane = push_plane_style.getRegInfo().func;

const pos_offset        = 0;
const axisx_offset      = 3;
const axisy_offset      = 6;
const uv_size_offset    = 11;
const lm_offset         = 13;
const STRIDE_FLOATS     = GeometryTerrain.strideFloats;
const chunk_size        = new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z);

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

        // this.pos            = this.chunk_coord.clone();
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

        const flags     = QUAD_FLAGS.NO_AO | QUAD_FLAGS.NORMAL_UP;
        const {x, y, z} = pos;

        // const sz = 1; // размер текстуры
        // const c = BLOCK.calcTexture(params.texture, DIRECTION.UP, this.tx_cnt); // текстура
        // const lm = MULTIPLY.COLOR.WHITE.clone();
        // let vertices = [];
        // push_plane(vertices, x, y, z, c, lm, true, false, sz, sz, null, flags, true);

        const c = [
            (params.texture[0] + 0.5) / this.tx_cnt,
            (params.texture[1] + 0.5) / this.tx_cnt,
            1 / this.tx_cnt,
            1 / this.tx_cnt
        ];
        const vertices = [
            x+.5, z+.5, y+.5,
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
        for(let i = 9; i < STRIDE_FLOATS; i++) {
            this.buffer.data[vindex + i] = vertices[i];
            this.vertices[vindex + i] = vertices[i];
        }
        // this.buffer.data.splice(vindex, STRIDE_FLOATS, ...vertices);
        //
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

        // Lookat matricies
        const view = render.viewMatrix;
        mat3.fromMat4(this.lookAtMat, view);
        mat3.invert(this.lookAtMat, this.lookAtMat);
        mat4.scale(this.lookAtMat, this.lookAtMat, this.scale);

        const lookAtMat = this.lookAtMat;

        //
        const data = this.buffer.data;
        const vertices = this.vertices;

        const pn = performance.now();
        // const pp = Game.player.lerpPos;
        const MIN_PERCENT = .25;

        const chCoord  = this.chunk_coord;
        const corrX = -chCoord.x;
        const corrY = -chCoord.y;
        const corrZ = -chCoord.z;

        // Correction for light
        // const corrX = pp.x;
        // const corrY = pp.y;
        // const corrZ = pp.z;

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
            percent = Math.max(percent, ('min_percent' in params) ? params.min_percent : MIN_PERCENT);
            const scale = params.pend < pn ? 0 : percent;

            const ap = i + pos_offset;
            const ax = i + axisx_offset;
            const ay = i + axisy_offset;

            data[i + lm_offset] = 0;

            // pos
            let addY = 0;
            if(params.speed.y != 0) addY = (pn - params.started) * params.speed.y / 1000 * params.gravity;
            data[ap + 0] = vertices[ap + 0] + corrX;
            data[ap + 1] = vertices[ap + 1] + corrZ;
            data[ap + 2] = vertices[ap + 2] + corrY + addY;

            // Inline vec3.transformMat3 look at axis X
            data[ax + 0] = (vertices[ax + 0] * lookAtMat[0] + vertices[ax + 2] * lookAtMat[3] + vertices[ax + 1] * lookAtMat[6]) * scale;
            data[ax + 1] = (vertices[ax + 0] * lookAtMat[1] + vertices[ax + 2] * lookAtMat[4] + vertices[ax + 1] * lookAtMat[7]) * scale;
            data[ax + 2] = (vertices[ax + 0] * lookAtMat[2] + vertices[ax + 2] * lookAtMat[5] + vertices[ax + 1] * lookAtMat[8]) * scale;

            // Inline vec3.transformMat3 look at axis Y
            data[ay + 0] = (vertices[ay + 0] * lookAtMat[0] + vertices[ay + 2] * lookAtMat[3] + vertices[ay + 1] * lookAtMat[6]) * scale;
            data[ay + 1] = (vertices[ay + 0] * lookAtMat[1] + vertices[ay + 2] * lookAtMat[4] + vertices[ay + 1] * lookAtMat[7]) * scale;
            data[ay + 2] = (vertices[ay + 0] * lookAtMat[2] + vertices[ay + 2] * lookAtMat[5] + vertices[ay + 1] * lookAtMat[8]) * scale;

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
                const pp = this.chunk_coord; // Game.player.lerpPos.clone();
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