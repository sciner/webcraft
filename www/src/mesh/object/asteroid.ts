import {Vector} from '../../helpers.js';
import { BLOCK, FakeTBlock } from '../../blocks.js';
import { NetworkPhysicObject } from '../../network_physic_object.js';
import { MeshGroup } from '../group.js';
import glMatrix from "../../../vendors/gl-matrix-3.3.min.js"
import type { World } from '../../world.js';
import type { Renderer } from '../../render.js';

const {mat4, vec3} = glMatrix;

// Mesh_Object_Asteroid
export class Mesh_Object_Asteroid extends NetworkPhysicObject {
    [key: string]: any

    mesh_group: MeshGroup
    static neighbours = null

    // Constructor
    constructor(world : World, render : Renderer, pos : IVector, radius : int, blocks?: object) {

        super(
            world,
            new Vector(pos.x, pos.y, pos.z),
            new Vector(0, 0, 0)
        );

        this.scale          = new Vector(1, 1, 1)
        this.pn             = performance.now() + Math.random() * 2000
        this.life           = 1.0
        this.posFact        = this.pos.clone()
        this.modelMatrix    = mat4.create()
        this.chunk          = null

        // MeshGroup
        this.mesh_group = new MeshGroup()

        if(blocks) {
            for(const pos_key in blocks) {
                const block = blocks[pos_key]
                if(block.id > 0) {
                    const pos_arr = pos_key.split(',')
                    const pos = new Vector(parseFloat(pos_arr[0]), parseFloat(pos_arr[1]), parseFloat(pos_arr[2]))
                    const extra_data = block.extra_data ?? undefined
                    const rotate = block.rotate ?? undefined
                    const fb = new FakeTBlock(block.id, extra_data, undefined, rotate)
                    this.mesh_group.addBlock(pos, fb)
                }
            }

        } else {

            // 2. Add blocks
            const radius2 = Math.ceil(radius);
            if(radius2 < 1) {
                throw 'error_small_radius';
            }

            //
            const block_ids = [
                BLOCK.COBBLESTONE.id,
                BLOCK.DIORITE.id,
                BLOCK.ANDESITE.id,
                BLOCK.GRANITE.id,
                BLOCK.GRASS_BLOCK.id,
                BLOCK.STONE.id,
                BLOCK.OAK_STAIRS.id,
                BLOCK.GRAVEL.id,
                BLOCK.SAND.id,
                BLOCK.GOLD_ORE.id,
                BLOCK.IRON_ORE.id,
            ];
            let idx = 0;

            for(let x = -radius2; x < radius2; x++) {
                for(let y = -radius2; y < radius2; y++) {
                    for(let z = -radius2; z < radius2; z++) {
                        const pos = new Vector(x, y, z);
                        if(pos.distance(Vector.ZERO) < radius) {
                            const block_id = block_ids[idx++ % block_ids.length];
                            this.mesh_group.addBlock(pos, new FakeTBlock(block_id));
                        }
                    }
                }
            }
        }

        // 4. Finalize mesh group (recalculate aabb and find blocks neighbours)
        this.mesh_group.finalize()

        // 5. Find group center;
        this.mesh_group.aabb.translate(0, 0, 0).pad(.5)

        // 6. Draw all blocks
        let x = -.5
        let y = 0.
        let z = -.5
        this.mesh_group.buildVertices(x, y, z, false, undefined, undefined, world.chunkManager.grid.chunkSize.clone())

    }

    // Draw
    draw(render : Renderer, delta : float, m? : imat4) {

        this.update()

        // Calc position
        this.posFact.copyFrom(this.pos)
        // const addY = (performance.now() - this.pn) / 10
        // this.posFact.y += Math.sin(addY / 35) / Math.PI * 8

        // Calc matrices
        mat4.identity(this.modelMatrix)
        // const shift = vec3.set(vec3.create(), 0, 0, 0)
        // mat4.translate(this.modelMatrix, this.modelMatrix, shift)

        // mat4.rotate(this.modelMatrix, this.modelMatrix, addY / 60, [1, 1, 1])
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.toArray())

        if(m) {
            mat4.multiply(this.modelMatrix, this.modelMatrix, m)
        }

        // Draw mesh group
        this.mesh_group.draw(render, this.posFact, this.modelMatrix)

    }

    destroy() {
        this.mesh_group.destroy();
    }

    get isAlive() : boolean {
        return this.life > 0;
    }

}
