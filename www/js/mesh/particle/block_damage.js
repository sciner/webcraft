import {  DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from '../../helpers.js';
import { CHUNK_SIZE_X } from "../../chunk_const.js";
import GeometryTerrain from "../../geometry_terrain.js";
import { BLOCK } from "../../blocks.js";
import { ChunkManager } from '../../chunk_manager.js';
import { Mesh_Particle_Base } from '../particle.js';
import { AABB } from '../../core/AABB.js';
import { axisx_offset, axisy_offset } from '../effect.js';

// physics
const Cd            = 0.47; // dimensionless
const rho           = 1.22; // kg / m^3 (коэфицент трения, вязкость, плотность)
const ag            = new Vector(0, -9.81, 0);  // m / s^2

//
const aabb          = new AABB();
const _ppos         = new Vector(0, 0, 0);
const _next_pos     = new Vector(0, 0, 0);
const _block_pos    = new Vector(0, 0, 0);
const _pos_floored   = new Vector(0, 0, 0);

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

//
export class Mesh_Particle_Block_Base {

    constructor(args) {

        this.radius         = 0.0; // 1 = 1m
        this.restitution    = -0.17;

        this.visible        = true;
        this.freezed        = false;
        this.shapes         = [];

        this.has_physics    = args.has_physics ?? true;
        this.ag             = args.ag ?? ag;
        this.size           = args.size,
        this.mass           = args.mass ?? (0.05 * args.scale); // kg
        this.life           = args.life ?? (1 + Math.random());
        this.pos            = args.pos;
        this.pos_o          = args.pos.clone();
        this.velocity       = args.velocity;

    }

}

//
export default class Mesh_Particle_Block_Damage extends Mesh_Particle_Base {

    // Constructor
    constructor(block, pos, particles) {

        super();

        const chunk_addr = getChunkAddr(pos.x, pos.y, pos.z);
        const chunk = ChunkManager.instance.getChunk(chunk_addr);
        if(!chunk || !chunk.dirt_colors) {
            this.life = 0;
            return;
        }

        const mat           = BLOCK.fromId(block.id);
        const {pp, flags}   = this.calcPPAndFlags(pos, mat, chunk);
        const {material, c} = this.calcMaterialAndTexture(mat);

        this.chunk          = chunk;
        this.material       = material;
        this.pos            = pos;
        this.vertices       = [];
        this.particles      = [];
        this.life           = 1.0;

        //
        for(let i = 0; i < particles.length; i++) {

            const p = particles[i];
            p.block_pos = this.pos.clone().addSelf(p.pos).flooredSelf();
            p.block_pos_o = p.block_pos.clone();

            const tex_sz = p.size / mat.tx_cnt;

            // random tex coord (случайная позиция в текстуре)
            const cx = c[0] - c[2]/2 + tex_sz/2 + Math.random() * (c[2] - tex_sz);
            const cy = c[1] - c[3]/2 + tex_sz/2 + Math.random() * (c[3] - tex_sz);
            // пересчет координат и размеров текстуры в атласе
            const tex = [cx, cy, tex_sz, tex_sz];

            push_plane(this.vertices, 0, 0, 0, tex, pp, p.size, p.size, p.size, flags);

            this.particles.push(p);
            Mesh_Particle_Base.current_count++;

        }

        this.buffer = new GeometryTerrain(this.vertices);

    }

    // Texture params
    calcMaterialAndTexture(block) {
        const texture        = block.texture;
        const resource_pack  = block.resource_pack;
        const material       = resource_pack.getMaterial(block.material_key);
        if(typeof texture != 'function' && typeof texture != 'object' && !(texture instanceof Array)) {
            this.life = 0;
            return;
        }
        let texture_id = 'default';
        if(typeof block.texture == 'object' && 'id' in block.texture) {
            texture_id = block.texture.id;
        }
        const tex = resource_pack.textures.get(texture_id);
        const c = BLOCK.calcTexture(texture, DIRECTION.DOWN, tex.tx_cnt); // полная текстура
        return {material, c};
    }

    //
    calcPPAndFlags(pos, block, chunk) {
        // Color masks
        let flags = QUAD_FLAGS.NORMAL_UP | QUAD_FLAGS.LOOK_AT_CAMERA; // QUAD_FLAGS.NO_AO;
        let lm = IndexedColor.WHITE;
        if(block) {
            if(BLOCK.MASK_BIOME_BLOCKS.includes(block.id)) {
                _pos_floored.copyFrom(pos).flooredSelf();
                const index = ((_pos_floored.z - chunk.coord.z) * CHUNK_SIZE_X + (_pos_floored.x - chunk.coord.x)) * 2;
                lm = new IndexedColor(chunk.dirt_colors[index], chunk.dirt_colors[index + 1], 0);
                flags |= QUAD_FLAGS.MASK_BIOME;
            } else if(BLOCK.MASK_COLOR_BLOCKS.includes(block.id)) {
                lm = new IndexedColor(block.mask_color.r, block.mask_color.g, block.mask_color.b);
                flags |= QUAD_FLAGS.MASK_BIOME;
            } else if(block.tags.includes('multiply_color')) {
                lm = new IndexedColor(block.multiply_color.r, block.multiply_color.g, block.multiply_color.b);
                flags |= QUAD_FLAGS.FLAG_MULTIPLY_COLOR;
            }
        }
        return {
            pp: lm.pack(),
            flags
        };
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
                Mesh_Particle_Base.current_count--;
            }
            alive_particles++;

            if(p.freezed) {
                continue;
            }

            const A = Math.PI * p.radius * p.radius / (100); // m^2

            // Drag force: Fd = -1/2 * Cd * A * rho * v * v
            const Fx = -0.5 * Cd * A * rho * p.velocity.x * p.velocity.x * p.velocity.x / Math.abs(p.velocity.x);
            const Fy = -0.5 * Cd * A * rho * p.velocity.y * p.velocity.y * p.velocity.y / Math.abs(p.velocity.y);
            const Fz = -0.5 * Cd * A * rho * p.velocity.z * p.velocity.z * p.velocity.z / Math.abs(p.velocity.z);

            // Calculate acceleration (F = ma)
            const ax = p.ag.x + (Fx / p.mass);
            const ay = p.ag.y + (Fy / p.mass);
            const az = p.ag.z + (Fz / p.mass);

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
                    p.pos.x + p.velocity.x * delta,
                    p.pos.y + p.velocity.y * delta,
                    p.pos.z + p.velocity.z * delta
                )

                _block_pos.copyFrom(this.pos).addSelf(_next_pos).flooredSelf();

                if(!p.block_pos_o.equal(_block_pos)) {
                    p.block_pos_o.copyFrom(p.block_pos);
                    p.block_pos.copyFrom(_block_pos);
                    p.shapes = [];
                    const tblock = Qubatch.world.getBlock(p.block_pos);
                    if(tblock && tblock.id > 0) {
                        const shapes = BLOCK.getShapes(p.block_pos, tblock, Qubatch.world, true, false);
                        for(let j = 0 ; j < shapes.length; j++) {
                            aabb.fromArray(shapes[j]).translate(p.block_pos.x, p.block_pos.y, p.block_pos.z);
                            aabb.toArray(shapes[j]);
                        }
                        p.shapes.push(...shapes);
                    }
                }

                // absolute new pos
                _ppos.copyFrom(_next_pos).addSelf(this.pos);

                for(let j = 0 ; j < p.shapes.length; j++) {
                    const shape = p.shapes[j];
                    aabb.fromArray(shape);
                    if(aabb.contains(_ppos.x, _ppos.y, _ppos.z)) {

                        let x = p.pos.x + this.pos.x;
                        let y = p.pos.y + this.pos.y;
                        let z = p.pos.z + this.pos.z;
                        
                        if(x > aabb.x_max) {
                            _next_pos.x = aabb.x_max - this.pos.x;
                            p.velocity.x *= p.restitution;
                        } else if(x < aabb.x_min) {
                            _next_pos.x = aabb.x_min - this.pos.x;
                            p.velocity.x *= p.restitution;
                        } else if(z > aabb.z_max) {
                            _next_pos.z = aabb.z_max - this.pos.z;
                            p.velocity.z *= p.restitution;
                        } else if(z < aabb.z_min) {
                            _next_pos.z = aabb.z_min - this.pos.z;
                            p.velocity.z *= p.restitution;
                        } else {
                            const ground = aabb.y_max;
                            if(_ppos.y < ground && (p.pos_o.y + this.pos.y > ground)) {
                                //p.velocity.x *= Math.abs(p.restitution);
                                //p.velocity.y *= p.restitution;
                                //p.velocity.z *= Math.abs(p.restitution);
                                _next_pos.y = ground - this.pos.y + 1/500;
                                p.freezed = true;
                            }
                        }

                    }
                }

                p.pos_o.copyFrom(p.pos);
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