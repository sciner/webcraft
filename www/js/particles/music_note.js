import { DIRECTION, MULTIPLY, QUAD_FLAGS, Vector } from '../helpers.js';
import { getChunkAddr } from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const push_plane = push_plane_style.getRegInfo().func;

const textures = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0]
];

export class Particles_Music_Note extends Particles_Base {

    // Constructor
    constructor(render, pos, material_key) {

        super();

        const m             = material_key.split('/');
        this.resource_pack  = Game.block_manager.resource_pack_manager.get(m[0]);
        this.material       = this.resource_pack.getMaterial(material_key);
        const tx_cnt        = this.resource_pack.conf.textures[m[2]].tx_cnt;

        const chunk_addr    = getChunkAddr(pos.x, pos.y, pos.z);
        this.chunk          = ChunkManager.instance.getChunk(chunk_addr);
        this.life           = 1.5;
        let flags           = QUAD_FLAGS.NO_AO;
        let lm              = MULTIPLY.COLOR.WHITE;

        this.texture        = textures[Math.floor(textures.length * Math.random())];

        const c = BLOCK.calcTexture(this.texture, DIRECTION.UP, tx_cnt);

        this.pos = new Vector(pos.x + .5, pos.y + 0, pos.z + .5);
        this.vertices = [];
        this.particles = [];

        // размер текстуры
        const sz = 1;

        // случайная позиция частицы (в границах блока)нет
        const x = 0.;
        const y = 0.;
        const z = 0.;

        push_plane(this.vertices, x, y, z, c, lm, true, false, sz, sz, null, flags);

        const p = {
            x:              x,
            y:              y,
            z:              z,
            sx:             .5, // x,
            sy:             -.5, // y,
            sz:             .5, // z,

            dx:             0,
            dz:             0,
            dy:             0,
            vertices_count: 12,
            gravity:        0.015,
            speed:          .0001375
        };

        this.particles.push(p);

        this.vertices = new Float32Array(this.vertices);

        // we should save start values
        this.buffer = new GeometryTerrain(this.vertices.slice());

    }

    // isolate draw and update
    // we can use external emitter or any animation lib
    // because isolate view and math
    update(delta) {

        const elapsed = (performance.now() - this.pn) / 1000;

        if(elapsed > this.life) {
            this.life = 0;
            return;
        }

        const percent = 1 - elapsed / this.life;

        this.scale.set(percent, percent, percent);

        for(let p of this.particles) {
            // p.x += p.dx * delta * p.speed;
            p.y += p.dy * delta * p.speed + (delta / 1000) * p.gravity;
            // p.z += p.dz * delta * p.speed;
            // p.gravity -= delta / 250000;
        }

    }

}