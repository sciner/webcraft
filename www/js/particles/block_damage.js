import {  DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const push_plane = push_plane_style.getRegInfo().func;

const Cd = 0.47; // dimensionless
const rho = 1.22; // kg / m^3 (коэфицент трения, вязкость)
const ag = 9.81;  // m / s^2

export default class Particles_Block_Damage extends Particles_Base {

    // Constructor
    constructor(render, block, pos, small, scale = 1, force = 1) {

        super();

        const chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk      = ChunkManager.instance.getChunk(chunk_addr);

        scale = scale ?? 1;
        this.pos = new Vector(pos);
        this.force = force;

        block = BLOCK.fromId(block.id);

        this.chunk      = chunk;
        this.life       = .5;
        this.texture    = block.texture;
        this.vertices   = [];
        this.particles  = [];

        if(!chunk) {
            this.life = 0;
            return;
        }

        let flags       = QUAD_FLAGS.NORMAL_UP; // QUAD_FLAGS.NO_AO;
        let lm          = IndexedColor.WHITE;

        if(typeof this.texture != 'function' && typeof this.texture != 'object' && !(this.texture instanceof Array)) {
            this.life = 0;
            return;
        }

        this.resource_pack = block.resource_pack;
        this.material = this.resource_pack.getMaterial(block.material_key);

        if(!chunk.dirt_colors) {
            this.life = 0;
            return
        }

        // color masks
        if(BLOCK.MASK_BIOME_BLOCKS.includes(block.id)) {
            const pos_floored = pos.clone().flooredSelf();
            const index = ((pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (pos_floored.x - chunk.coord.x)) * 2;
            lm          = new IndexedColor(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0);
            flags       = flags | QUAD_FLAGS.MASK_BIOME;
        } else if(BLOCK.MASK_COLOR_BLOCKS.includes(block.id)) {
            lm          = block.mask_color;
            flags       = flags | QUAD_FLAGS.MASK_BIOME;
        }

        // Texture params
        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }

        const tex = this.resource_pack.textures.get(texture_id);
        const c = BLOCK.calcTexture(this.texture, DIRECTION.DOWN, tex.tx_cnt); // полная текстура
        const count = (small ? 5 : 30) * 2; // particles count
        const max_sz = small ? (.25 / 16) : (3 / 16);

        force *= 3;

        for(let i = 0; i < count; i++) {

            const sz        = Math.random() * max_sz + 1 / 16; // случайный размер текстуры
            const half      = sz / block.tx_cnt;

            // random tex coord (случайная позиция в текстуре)
            const cx        = c[0] + Math.random() * ((1 - half) / block.tx_cnt);
            const cy        = c[1] + Math.random() * ((1 - half) / block.tx_cnt);

            const c_half    = [
                cx - c[2] / 2 + half / 2,
                cy - c[3] / 2 + half / 2,
                half,
                half
            ];

            // случайная позиция частицы (в границах блока)
            const x = (Math.random() - Math.random()) * (.5 * scale);
            const y = (Math.random() - Math.random()) * (.5 * scale);
            const z = (Math.random() - Math.random()) * (.5 * scale);

            push_plane(this.vertices, x, y, z, c_half, lm, true, false, sz * scale, sz * scale, sz * scale, flags);

            const p = {
                x:              x,
                y:              y,
                z:              z,
                //
                sx:             x,
                sy:             y,
                sz:             z,
                //
                vertices_count: 1,
                //
                velocity:       new Vector(0, 0, 0),
                mass:           0.05 * scale, // kg
                // const
                radius:         10 * scale // 1 = 1cm
            };

            this.particles.push(p);

            // random direction * force
            p.velocity.set(
                Math.random() - Math.random(),
                1,
                Math.random() - Math.random()
            );
            p.velocity.normSelf().multiplyScalar(force)

        }

        // we should save start values
        this.buffer = new GeometryTerrain(this.vertices);
        // geom terrain converts vertices array to float32/uint32data combo, now we can take it
        this.vertices = this.buffer.data.slice();

    }

    // isolate draw and update
    // we can use external emitter or any animatin lib
    // because isolate view and math
    update (delta) {

        delta /= 1000;
        // this.life -= delta / 100000;

        for (let i = 0; i < this.particles.length; i++) {

            const p = this.particles[i];
            const A = Math.PI * p.radius * p.radius / (10000); // m^2

            // Drag force: Fd = -1/2 * Cd * A * rho * v * v
            const Fx = -0.5 * Cd * A * rho * p.velocity.x * p.velocity.x * p.velocity.x / Math.abs(p.velocity.x);
            const Fy = -0.5 * Cd * A * rho * p.velocity.y * p.velocity.y * p.velocity.y / Math.abs(p.velocity.y);
            const Fz = -0.5 * Cd * A * rho * p.velocity.z * p.velocity.z * p.velocity.z / Math.abs(p.velocity.z);

            // Calculate acceleration (F = ma)
            const ax = Fx / p.mass;
            const ay = (ag + (Fy / p.mass)) * -1;
            const az = Fz / p.mass;
            
            // Integrate to get velocity
            p.velocity.x += ax * delta;
            p.velocity.y += ay * delta;
            p.velocity.z += az * delta;
            
            // Integrate to get position
            p.x += p.velocity.x * delta;
            p.y += p.velocity.y * delta;
            p.z += p.velocity.z * delta;

        }

    }

}