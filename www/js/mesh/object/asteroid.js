import {Vector} from '../../helpers.js';
import { BLOCK, FakeTBlock } from '../../blocks.js';
import { NetworkPhysicObject } from '../../network_physic_object.js';
import { MeshGroup } from '../group.js';

const {mat4} = glMatrix;

// Mesh_Object_Asteroid
export class Mesh_Object_Asteroid extends NetworkPhysicObject {

    static neighbours = null;

    // Constructor
    constructor(render, pos, radius) {

        super(
            new Vector(pos.x, pos.y, pos.z),
            new Vector(0, 0, 0)
        );

        this.radius         = radius;
        this.scale          = new Vector(1, 1, 1);
        this.pn             = performance.now() + Math.random() * 2000;
        this.life           = 1.0;
        this.posFact        = this.pos.clone();
        this.modelMatrix    = mat4.create();
        this.lightTex       = null;
        this.chunk          = null;

        // MeshGroup
        this.mesh_group = new MeshGroup();

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
            // BLOCK.GRASS.id,
            // BLOCK.TORCH.id,
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

        // 4. Finalize mesh group (recalculate aabb and find blocks neighbours)
        this.mesh_group.finalize();

        // 5. Find group center;
        this.mesh_group.aabb.translate(0, 0, 0).pad(.5);

        // 6. Draw all blocks
        let x = 0;
        let y = 0;
        let z = 0;
        this.mesh_group.buildVertices(x, y, z, false);

    }

    // Update light texture from chunk
    updateLightTex(render) {
        const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
        if (!chunk) {
            return;
        }
        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
    }

    // Draw
    draw(render, delta) {

        this.update();
        this.updateLightTex(render);

        if(!this.chunk) {
            return;
        }

        // Calc position
        const addY = (performance.now() - this.pn) / 10;
        this.posFact.set(this.pos.x, this.pos.y, this.pos.z);
        this.posFact.y += Math.sin(addY / 35) / Math.PI * 8;

        // Calc matrices
        mat4.identity(this.modelMatrix);
        mat4.translate(this.modelMatrix, this.modelMatrix, 
            [
                (this.posFact.x - this.chunk.coord.x),
                (this.posFact.z - this.chunk.coord.z),
                (this.posFact.y - this.chunk.coord.y)
            ]
        );
        mat4.rotate(this.modelMatrix, this.modelMatrix, addY / 60, [1, 1, 1]);
        mat4.scale(this.modelMatrix, this.modelMatrix, this.scale.toArray());

        // Draw mesh group
        this.mesh_group.draw(render, this.chunk.coord, this.modelMatrix, this.lightTex);

    }

    destroy() {
        this.mesh_group.destroy();
    }

    isAlive() {
        return this.life > 0;
    }

}
