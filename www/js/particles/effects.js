import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { DIRECTION, MULTIPLY, QUAD_FLAGS, Vector } from '../helpers.js';
import { getChunkAddr } from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const { mat3, mat4, vec3 } = glMatrix;

const push_plane = push_plane_style.getRegInfo().func;

const pos_offset        = 0;
const axisx_offset      = 3;
const axisy_offset      = 6;
const uv_size_offset    = 11;
const lm_offset         = 13;
const STRIDE_FLOATS     = GeometryTerrain.strideFloats;

export class Particles_Effects extends Particles_Base {

    // Constructor
    constructor(render, material_key) {

        super();

        this.scale = new Vector(1, 1, 1);
        const pos = this.pos = Vector.ZERO.clone();

        const m             = material_key.split('/');
        this.resource_pack  = Game.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        this.tx_cnt         = this.resource_pack.conf.textures[m[2]].tx_cnt;

        const chunk_addr    = getChunkAddr(pos.x, pos.y, pos.z);
        this.chunk          = ChunkManager.instance.getChunk(chunk_addr);
        this.life           = 1;

        this.buffer         = new GeometryTerrain([]);
        this.max_count      = 35000;
        this.add_index      = 0;
        this.vertices       = new Array(this.max_count * STRIDE_FLOATS);

    }

    // Add particle
    add(pos, params) {
        const c         = BLOCK.calcTexture(params.texture, DIRECTION.UP, this.tx_cnt); // текстура
        const sz        = 1; // размер текстуры
        const flags     = QUAD_FLAGS.NO_AO;
        const lm        = MULTIPLY.COLOR.WHITE.clone();
        const {x, y, z} = pos;
        //
        let vertices = [];
        push_plane(vertices, x, y, z, c, lm, true, false, sz, sz, null, flags, true);
        //
        const vindex = this.add_index * STRIDE_FLOATS;
        this.vertices.splice(vindex, STRIDE_FLOATS, ...vertices);
        for(let i = 9; i < STRIDE_FLOATS; i++) {
            this.buffer.data[vindex + i] = vertices[i];
        }
        // this.buffer.data.splice(vindex, STRIDE_FLOATS, ...vertices);
        //
        params.pend = performance.now() + 1000 * params.life;
        this.vertices[vindex + lm_offset] = params;
        this.add_index = (this.add_index + 1) % this.max_count;
    }

    update(render) {

        // Lookat matricies
        const view = render.viewMatrix;
        mat3.fromMat4(this.lookAtMat, view);
        mat3.invert(this.lookAtMat, this.lookAtMat);
        mat4.scale(this.lookAtMat, this.lookAtMat, this.scale);

        //
        let data = this.buffer.data;
        const vertices = this.vertices;
        if(data.length != vertices.length) {
            data = new Float32Array(vertices);
        }

        const pn = performance.now();
        const pp = Game.player.lerpPos;
        const MIN_PERCENT = .25;

        // Correction for light
        const corrX = pp.x;
        const corrY = pp.y;
        const corrZ = pp.z;

        // Delete particles
        const clip = !this.last_clip || (performance.now() - this.last_clip > 1000);
        if(clip) {
            for(let i = 0; i < vertices.length; i += STRIDE_FLOATS) {
                const params = vertices[i + lm_offset];
                if(!params) {
                    continue;
                }
                // ignore this particle
                if(params.pend < pn) {
                    for(let j = 0; j < STRIDE_FLOATS; j++) {
                        this.vertices[i + j] = 0;
                        data[i + j] = 0;
                    }
                }
            }
            this.last_clip = performance.now();
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
            percent = Math.max(MIN_PERCENT, percent);
            const scale = params.pend < pn ? 0 : percent;

            const ap = i + pos_offset;
            const ax = i + axisx_offset;
            const ay = i + axisy_offset;

            const dp = i + pos_offset;
            const dx = i + axisx_offset;
            const dy = i + axisy_offset;

            data[i + lm_offset] = 0;

            // pos
            data[dp + 0] = vertices[ap + 0] - corrX;
            data[dp + 1] = vertices[ap + 1] - corrZ;
            let addY = 0;
            if(params.speed.y != 0) {
                addY = (pn - params.started) * params.speed.y / 1000 * params.gravity;
            }
            data[dp + 2] = vertices[ap + 2] - corrY + addY;

            // Look at axis x
            data[dx + 0] = vertices[ax + 0];
            data[dx + 1] = vertices[ax + 2];
            data[dx + 2] = vertices[ax + 1];
            let d = [data[dx + 0], data[dx + 1], data[dx + 2]];
            vec3.transformMat3(d, d, this.lookAtMat);
            data[dx + 0] = d[0] * scale;
            data[dx + 1] = d[1] * scale;
            data[dx + 2] = d[2] * scale;

            // Look at axis y
            data[dy + 0] = vertices[ay + 0];
            data[dy + 1] = vertices[ay + 2];
            data[dy + 2] = vertices[ay + 1];
            d = [data[dy + 0], data[dy + 1], data[dy + 2]];
            vec3.transformMat3(d, d, this.lookAtMat);
            data[dy + 0] = d[0] * scale;
            data[dy + 1] = d[1] * scale;
            data[dy + 2] = d[2] * scale;

        }

        this.buffer.updateInternal(data);

    }

    // Draw
    draw(render, delta) {

        const pp = Game.player.lerpPos.clone();

        // pp.y += .2;

        this.update(render);

        // this.chunk_addr = getChunkAddr(pp.x, pp.y, pp.z, this.chunk_addr);
        // let chunk = ChunkManager.instance.getChunk(this.chunk_addr);
        // const light = chunk.getLightTexture(render.renderBackend);
        // this.material.changeLighTex(light);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            pp,
            null
        );

        // this.material.lightTex = null;

    }

}