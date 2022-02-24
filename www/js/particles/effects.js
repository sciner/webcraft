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

const flame_textures = [
    [0, 3],
    [1, 3],
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 3],
    [7, 3],
    [0, 4],
    [1, 4],
    [2, 4],
    [3, 4]
];

export class Particles_Effects extends Particles_Base {

    // Constructor
    constructor(render, pos, material_key) {

        super();

        const m             = material_key.split('/');
        this.resource_pack  = Game.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        const tx_cnt        = this.resource_pack.conf.textures[m[2]].tx_cnt;

        const chunk_addr    = getChunkAddr(pos.x, pos.y, pos.z);
        this.chunk          = ChunkManager.instance.getChunk(chunk_addr);
        this.life           = 5;
        let flags           = QUAD_FLAGS.NO_AO;
        let lm              = MULTIPLY.COLOR.WHITE;

        this.move_up        = true;

        this.pos = new Vector(
            pos.x + .5 + (Math.random() - Math.random()) * .3,
            pos.y + 0,
            pos.z + .5 + (Math.random() - Math.random()) * .3
        );
        this.vertices = [];
        this.particles = [];

        // размер текстуры
        const sz = 1;

        // случайная позиция частицы (в границах блока)нет
        const x = 0.;
        const y = 0.;
        const z = 0.;

        for(let i = 0; i < 3000; i++) {
            //
            let texture_index = Math.floor(flame_textures.length * Math.random());
            this.texture = flame_textures[texture_index];
            const c = BLOCK.calcTexture(this.texture, DIRECTION.UP, tx_cnt);
            //
            const rx = (Math.random() - Math.random()) * 5;
            const ry = Math.random() * 5;
            const rz = (Math.random() - Math.random()) * 5;
            push_plane(this.vertices, x+rx, y+ry, z+rz, c, lm, true, false, sz, sz, null, flags, true);
        }

        this.vertices = new Float32Array(this.vertices);

        // we should save start values
        this.buffer = new GeometryTerrain(this.vertices.slice());

    }

    update(delta) {
        return;
    }

    draw(render, delta) {

        const light    = this.chunk.getLightTexture(render.renderBackend);
        const chCoord  = this.chunk.coord;
        const pos      = this.pos;

        const view = render.viewMatrix;
        mat3.fromMat4(this.lookAtMat, view);
        mat3.invert(this.lookAtMat, this.lookAtMat);
        mat4.scale(this.lookAtMat, this.lookAtMat, this.scale);

        //
        const data = this.buffer.data;
        const vertices = this.vertices;

        // correction for light
        const corrX = pos.x - chCoord.x;
        const corrY = pos.y - chCoord.y + Math.cos(performance.now() / 1000) * 2;
        const corrZ = pos.z - chCoord.z;

        const pos_offset = 0;
        const axisx_offset = 3;
        const axisy_offset = 6;

        for(let i = 0; i < vertices.length; i += GeometryTerrain.strideFloats) {

            const ap = i + pos_offset;
            const ax = i + axisx_offset;
            const ay = i + axisy_offset;

            // pos
            data[ap + 0] = vertices[ap + 0] + vertices[ap + 0] + corrX;
            data[ap + 1] = vertices[ap + 1] + vertices[ap + 1] + corrZ;
            data[ap + 2] = vertices[ap + 2] + vertices[ap + 2] + corrY;

            // Look at axis x
            data[ax + 0] = vertices[ax + 0];
            data[ax + 1] = vertices[ax + 2];
            data[ax + 2] = vertices[ax + 1];
            let d = [data[ax + 0], data[ax + 1], data[ax + 2]];
            vec3.transformMat3(d, d, this.lookAtMat);
            data[ax + 0] = d[0];
            data[ax + 1] = d[1];
            data[ax + 2] = d[2];

            // Look at axis y
            data[ay + 0] = vertices[ay + 0];
            data[ay + 1] = vertices[ay + 2];
            data[ay + 2] = vertices[ay + 1];
            d = [data[ay + 0], data[ay + 1], data[ay + 2]];
            vec3.transformMat3(d, d, this.lookAtMat);
            data[ay + 0] = d[0];
            data[ay + 1] = d[1];
            data[ay + 2] = d[2];

        }

        this.buffer.updateInternal();
        this.material.changeLighTex(light);

        render.renderBackend.drawMesh(
            this.buffer,
            this.material,
            this.chunk.coord
        );

        this.material.lightTex = null;

    }

}