import { Color, DIRECTION, MULTIPLY, QUAD_FLAGS, TX_CNT, Vector } from '../helpers.js';
import { CHUNK_SIZE_X, getChunkAddr } from "../chunk.js";
import GeometryTerrain from "../geometry_terrain.js";
import { default as push_plane_style } from '../block_style/plane.js';
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';

const push_plane = push_plane_style.getRegInfo().func;

export default class Particles_Block_Destroy extends Particles_Base {

    // Constructor
    constructor(render, block, pos, small) {

        super();

        const chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk      = ChunkManager.instance.getChunk(chunk_addr);

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

        let flags       = QUAD_FLAGS.NO_AO;
        let lm          = MULTIPLY.COLOR.WHITE;

        if(typeof this.texture != 'function' && typeof this.texture != 'object' && !(this.texture instanceof Array)) {
            this.life = 0;
            return;
        }

        this.resource_pack = block.resource_pack;
        this.material = this.resource_pack.getMaterial(block.material_key);

        if(BLOCK.MASK_BIOME_BLOCKS.indexOf(block.id) >= 0) {
            const pos_floored = pos.clone().flooredSelf();
            const index = ((pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (pos_floored.x - chunk.coord.x)) * 2;
            lm          = new Color(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0, 0);
            flags       = flags | QUAD_FLAGS.MASK_BIOME;
        } else if(BLOCK.MASK_COLOR_BLOCKS.indexOf(block.id) >= 0) {
            lm          = block.mask_color;
            flags       = flags | QUAD_FLAGS.MASK_BIOME;
        }

        // Texture params
        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }
        let tex = this.resource_pack.textures.get(texture_id);
        const c = BLOCK.calcTexture(this.texture, DIRECTION.DOWN, tex.tx_cnt); // полная текстура

        // particles count
        const count     = small ? 5 : 30;

        this.pos = new Vector(
            pos.x + .5,
            pos.y + .5,
            pos.z
        );

        for(let i = 0; i < count; i++) {
            const max_sz    = small ? .25 / 16 : 3 / 16;
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
            const x = (Math.random() - Math.random()) * .5;
            const y = (Math.random() - Math.random()) * .5;
            const z = (Math.random() - Math.random()) * .5;

            push_plane(this.vertices, x, y, z, c_half, lm, true, false, sz, sz, null, flags);

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
                vertices_count: 12,
                gravity:        .06,
                speed:          .00375
            };

            this.particles.push(p);

            const d = Math.sqrt(p.x * p.x + p.z * p.z);
            p.dx = p.x / d * p.speed;
            p.dz = p.z / d * p.speed;
        }

        this.vertices = new Float32Array(this.vertices);

        // we should save start values
        this.buffer = new GeometryTerrain(this.vertices.slice());

    }

    // isolate draw and update
    // we can use external emitter or any animatin lib
    // because isolate view and math
    update (delta) {
        delta *= 75;
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