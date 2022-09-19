import { BLOCK } from "../blocks.js";
import { AABB } from '../core/AABB.js';
import { Vector } from "../helpers.js";

// physics
const Cd            = 0.47; // dimensionless
const rho           = 1.22; // kg / m^3 (коэфицент трения, вязкость, плотность)
const ag            = new Vector(0, -9.81, 0);  // m / s^2

//
const aabb          = new AABB();
const _ppos         = new Vector(0, 0, 0);
const _next_pos     = new Vector(0, 0, 0);
const _block_pos    = new Vector(0, 0, 0);

//
export class Mesh_Particle {

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

        // render
        this.pp             = args.pp ?? 0;
        this.flags          = args.flags ?? 0;
        this.material_key   = args.material_key;
        this.texture        = args.texture;

        this.block_pos      = this.pos.clone()/*.addSelf(this.pos)*/.flooredSelf();
        this.block_pos_o    = this.block_pos.clone();

    }

    tick(delta) {

        delta /= 1000;

        this.life -= delta;

        if(this.freezed || !this.visible) {
            return;
        }

        const A = Math.PI * this.radius * this.radius / (100); // m^2

        // Drag force: Fd = -1/2 * Cd * A * rho * v * v
        const Fx = this.velocity.x == 0 ? 0 : -0.5 * Cd * A * rho * this.velocity.x * this.velocity.x * this.velocity.x / Math.abs(this.velocity.x);
        const Fy = this.velocity.y == 0 ? 0 : -0.5 * Cd * A * rho * this.velocity.y * this.velocity.y * this.velocity.y / Math.abs(this.velocity.y);
        const Fz = this.velocity.z == 0 ? 0 : -0.5 * Cd * A * rho * this.velocity.z * this.velocity.z * this.velocity.z / Math.abs(this.velocity.z);

        // Calculate acceleration (F = ma)
        const ax = this.ag.x + (Fx / this.mass);
        const ay = this.ag.y + (Fy / this.mass);
        const az = this.ag.z + (Fz / this.mass);

        // Integrate to get velocity
        this.velocity.x += ax * delta;
        this.velocity.y += ay * delta;
        this.velocity.z += az * delta;

        // Integrate to get position
        if(!this.has_physics) {
            this.pos.x += this.velocity.x * delta;
            this.pos.y += this.velocity.y * delta;
            this.pos.z += this.velocity.z * delta;

        } else {

            _next_pos.set(
                this.pos.x + this.velocity.x * delta,
                this.pos.y + this.velocity.y * delta,
                this.pos.z + this.velocity.z * delta
            )

            _block_pos.copyFrom(_next_pos).flooredSelf();

            if(!this.block_pos_o.equal(_block_pos)) {
                this.block_pos_o.copyFrom(this.block_pos);
                this.block_pos.copyFrom(_block_pos);
                this.shapes = [];
                const tblock = Qubatch.world.getBlock(this.block_pos);
                if(tblock && tblock.id > 0) {
                    const shapes = BLOCK.getShapes(this.block_pos, tblock, Qubatch.world, true, false);
                    for(let j = 0 ; j < shapes.length; j++) {
                        aabb.fromArray(shapes[j]).translate(this.block_pos.x, this.block_pos.y, this.block_pos.z);
                        aabb.toArray(shapes[j]);
                    }
                    this.shapes.push(...shapes);
                }
            }

            // absolute new pos
            _ppos.copyFrom(_next_pos);//.addSelf(this.pos);

            for(let j = 0 ; j < this.shapes.length; j++) {
                const shape = this.shapes[j];
                aabb.fromArray(shape);
                if(aabb.contains(_ppos.x, _ppos.y, _ppos.z)) {

                    let x = this.pos.x;
                    let y = this.pos.y;
                    let z = this.pos.z;
                    
                    if(x > aabb.x_max) {
                        _next_pos.x = aabb.x_max;
                        this.velocity.x *= this.restitution;
                    } else if(x < aabb.x_min) {
                        _next_pos.x = aabb.x_min;
                        this.velocity.x *= this.restitution;
                    } else if(z > aabb.z_max) {
                        _next_pos.z = aabb.z_max;
                        this.velocity.z *= this.restitution;
                    } else if(z < aabb.z_min) {
                        _next_pos.z = aabb.z_min;
                        this.velocity.z *= this.restitution;
                    } else {
                        const ground = aabb.y_max;
                        if(_ppos.y < ground && (this.pos_o.y > ground)) {
                            // p.velocity.x *= Math.abs(p.restitution);
                            // p.velocity.y *= p.restitution;
                            // p.velocity.z *= Math.abs(p.restitution);
                            _next_pos.y = ground + 1/500;
                            this.freezed = true;
                        }
                    }

                }
            }

            this.pos_o.copyFrom(this.pos);
            this.pos.copyFrom(_next_pos);

        }
    }

}