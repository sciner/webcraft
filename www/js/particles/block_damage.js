import {  DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from '../helpers.js';
import { CHUNK_SIZE_X } from "../chunk_const.js";
import GeometryTerrain from "../geometry_terrain.js";
import { BLOCK } from "../blocks.js";
import { ChunkManager } from '../chunk_manager.js';
import { Particles_Base } from './particles_base.js';
import { AABB } from '../core/AABB.js';
import {impl as alea} from "../../vendors/alea.js";
import { axisx_offset, axisy_offset } from './effects.js';

const Cd = 0.47; // dimensionless
const rho = 1.22; // kg / m^3 (коэфицент трения, вязкость, плотность)
const ag = 9.81;  // m / s^2

// randoms
let random_count = 8191;
let randoms = new Float32Array(random_count);
let random_index = 0;
let a = new alea('particle_randoms');
for(let i = 0; i < random_count; i++) {
    randoms[i] = a.double();
}

function randomFloat() {
    random_index = (random_index + 1) % random_count;
    return randoms[random_index];
}

//
const aabb = new AABB();
const _ppos = new Vector(0, 0, 0);
const _next_pos = new Vector(0, 0, 0);
const _block_pos = new Vector(0, 0, 0);

function push_plane(vertices, x, y, z, c, pp, xs, ys, zs, flags) {
    vertices.push(
        x, y, z,
        -xs, 0, 0,
        0, 0, -zs,
        c[0], c[1], c[2], c[3],
        pp,
        flags
    );
}

export default class Particles_Block_Damage extends Particles_Base {

    // Constructor
    constructor(render, block, pos, small, scale = 1, force = 1) {

        super();

        random_index += (Math.random() * random_count) | 0;

        const chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk      = ChunkManager.instance.getChunk(chunk_addr);
        let flags       = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA; // QUAD_FLAGS.NO_AO;
        let lm          = IndexedColor.WHITE;

        scale = scale ?? 1;
        this.pos = new Vector(pos);
        this.force = force;

        block = BLOCK.fromId(block.id);

        this.chunk      = chunk;
        this.life       = 0.5;
        this.texture    = block.texture;
        this.vertices   = [];
        this.particles  = [];

        if(!chunk) {
            this.life = 0;
            return;
        }

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
            flags       |= QUAD_FLAGS.MASK_BIOME;
        } else if(BLOCK.MASK_COLOR_BLOCKS.includes(block.id)) {
            lm          = new IndexedColor(block.mask_color.r, block.mask_color.g, block.mask_color.b);
            flags       |= QUAD_FLAGS.MASK_BIOME;
        } else if(block.tags.includes('multiply_color')) {
            lm          = new IndexedColor(block.multiply_color.r, block.multiply_color.g, block.multiply_color.b);
            flags       |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
        }

        const pp = lm.pack();

        // Texture params
        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }

        const tex = this.resource_pack.textures.get(texture_id);
        const c = BLOCK.calcTexture(this.texture, DIRECTION.DOWN, tex.tx_cnt); // полная текстура
        const count = (small ? 5 : 30); // particles count
        const max_sz = (small ? (.25 / 16) : (3 / 16));

        force *= 3;

        for(let i = 0; i < count; i++) {

            // случайный размер текстуры
            const sz = randomFloat() * max_sz + 1/16;
            const tex_sz = sz / block.tx_cnt;
            // random tex coord (случайная позиция в текстуре)
            const cx = c[0] - c[2]/2 + tex_sz/2 + randomFloat() * (c[2] - tex_sz);
            const cy = c[1] - c[3]/2 + tex_sz/2 + randomFloat() * (c[3] - tex_sz);
            // пересчет координат и размеров текстуры в атласе
            const tex = [cx, cy, tex_sz, tex_sz];

            // случайная позиция частицы (в границах блока)
            const x = (randomFloat() - randomFloat()) * (.5 * scale);
            const y = (randomFloat() - randomFloat()) * (.5 * scale);
            const z = (randomFloat() - randomFloat()) * (.5 * scale);

            push_plane(this.vertices, 0, 0, 0, tex, pp, sz * scale, sz * scale, sz * scale, flags);

            const block_pos = this.pos.clone().addScalarSelf(x, y, z).flooredSelf();

            const p = {
                pos:            new Vector(x, y, z),
                velocity:       new Vector(0, 0, 0),
                mass:           0.05 * scale, // kg
                radius:         0.0, // 1 = 1m
                restitution:    -0.17,
                life:           1 + randomFloat(),
                block_pos:      block_pos,
                block_pos_o:    block_pos.clone(),
                has_physics:    true,
                visible:        true,
                shapes:         []
            };

            this.particles.push(p);

            // random direction * force
            p.velocity.set(
                randomFloat() - randomFloat(),
                1,
                randomFloat() - randomFloat()
            );
            p.velocity.normSelf().multiplyScalar(force);

            Particles_Base.current_count++;

        }

        // we should save start values
        this.buffer = new GeometryTerrain(this.vertices);
        // geom terrain converts vertices array to float32/uint32data combo, now we can take it
        // this.vertices = this.buffer.data.slice();

    }

    // isolate draw and update
    // we can use external emitter or any animatin lib
    // because isolate view and math
    update(delta) {

        delta /= 1000;
        let alive_particles = 0;

        for (let i = 0; i < this.particles.length; i++) {

            const p = this.particles[i];
            const buffer_offset = i * GeometryTerrain.strideFloats;

            // particle life
            if(p.life <= 0) {
                continue;
            }
            p.life -= delta;
            if(p.life <= 0 && p.visible) {
                p.life = 0;
                p.visible = false;
                this.buffer.data[buffer_offset + axisx_offset + 0] = 0; 
                this.buffer.data[buffer_offset + axisy_offset + 2] = 0; 
                Particles_Base.current_count--;
            }
            alive_particles++;

            const A = Math.PI * p.radius * p.radius / (100); // m^2

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
            if(!p.has_physics) {
                p.pos.x += p.velocity.x * delta;
                p.pos.y += p.velocity.y * delta;
                p.pos.z += p.velocity.z * delta;

            } else {

                _next_pos.set(
                    p.pos.x += p.velocity.x * delta,
                    p.pos.y += p.velocity.y * delta,
                    p.pos.z += p.velocity.z * delta
                )

                _block_pos.copyFrom(this.pos).addSelf(_next_pos).flooredSelf();
                if(!p.block_pos_o.equal(_block_pos)) {
                    p.block_pos_o.copyFrom(p.block_pos);
                    p.block_pos.copyFrom(_block_pos);
                    const tblock = Qubatch.world.getBlock(p.block_pos);
                    if(tblock && tblock.id > 0) {
                        p.shapes = BLOCK.getShapes(p.block_pos, tblock, Qubatch.world, true, false);
                    } else {
                        p.shapes = [];
                    }
                }

                _ppos.copyFrom(this.pos).addSelf(_next_pos);

                for(let shape of p.shapes) {
                    aabb.fromArray(shape).translate(p.block_pos.x, p.block_pos.y, p.block_pos.z);
                    if(aabb.contains(_ppos.x, _ppos.y, _ppos.z)) {
                        const floor = aabb.y_max;
                        if(_ppos.y < floor) {
                            p.velocity.x *= Math.abs(p.restitution);
                            p.velocity.y *= p.restitution;
                            p.velocity.z *= Math.abs(p.restitution);
                            // если закомментить следующую строку, то частицы будут вести себя как жидкость
                            // прилепая к боковым сторонам
                            // а также будут стекать
                            _next_pos.y = floor - this.pos.y;
                        }
                    }
                }

                p.pos.copyFrom(_next_pos);

            }

            this.buffer.data[buffer_offset + 0] = p.pos.x + this.pos.x - this.chunk.coord.x;
            this.buffer.data[buffer_offset + 2] = p.pos.y + this.pos.y - this.chunk.coord.y;
            this.buffer.data[buffer_offset + 1] = p.pos.z + this.pos.z - this.chunk.coord.z;

        }

        if(alive_particles == 0) {
            this.life = 0;
        }

    }

}