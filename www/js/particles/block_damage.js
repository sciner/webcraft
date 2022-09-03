import {  DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const push_plane = push_plane_style.getRegInfo().func;

export default class Particles_Block_Damage extends Particles_Base {

    // Constructor
    constructor(render, block, pos, small, scale) {

        super();

        const chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk      = ChunkManager.instance.getChunk(chunk_addr);
        
        scale = scale ?? 1;
        this.pos = new Vector(pos);
        this.user_scale = scale;

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
        const max_sz = small ? .25 / 16 : 3 / 16;

        for(let i = 0; i < count; i++) {

            const sz        = Math.random() * max_sz + 1 / 16; // случайный размер текстуры
            const half      = sz / block.tx_cnt;

            // random tex coord (случайная позиция в текстуре)
            const cx        = c[0] + Math.random() * (half * 3);
            const cy        = c[1] + Math.random() * (half * 3);
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
                sx:             x,
                sy:             y,
                sz:             z,

                dx:             0,
                dz:             0,
                dy:             0,
                vertices_count: 1,
                gravity:        .06 * scale,
                speed:          .00375,
            };

            this.particles.push(p);

            // random direction
            p.dx = Math.random() - Math.random();
            p.dz = Math.random() - Math.random();
            const l = Math.sqrt(p.dx * p.dx + p.dz * p.dz);
            p.dx = p.dx / l * p.speed;
            p.dz = p.dz / l * p.speed;

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
        delta *= 75 * this.user_scale;
        this.life -= delta / 100000;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.dx * delta * p.speed;
            p.y += p.dy * delta * p.speed + (delta / 1000) * p.gravity;
            p.z += p.dz * delta * p.speed;
            p.gravity -= delta / 250000;
        }

    }

}