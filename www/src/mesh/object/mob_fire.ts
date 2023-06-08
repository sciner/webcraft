import { DIRECTION, IndexedColor, QUAD_FLAGS, Vector } from '../../helpers.js';
import { BLOCK } from '../../blocks.js';
import { GeometryTerrain } from '../../geometry_terrain.js';
import { AABB, AABBSideParams, pushAABB } from '../../core/AABB.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { MobModel } from '../../mob_model.js';
import type { World } from '../../world.js';

const {mat4} = glMatrix;

// MobFire mesh
export class Mesh_Object_MobFire {
    [key: string]: any;

    constructor(mob : MobModel, world : World) {

        this.apos           = mob.pos.clone().addScalarSelf(.5, .5, .5); // absolute coord
        this.life           = 1.0;
        this.chunk          = null;
        this.chunk_addr     = world.chunkManager.grid.toChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(world.chunkManager.grid.chunkSize);
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        this.yaw            = 0;
        // this.lightTex       = null;

        const material      = BLOCK.fromName('FIRE');
        const texture       = material.texture;
        const c_fire        = BLOCK.calcTexture(texture, DIRECTION.EAST);
        const flags         = QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_NO_FOG | QUAD_FLAGS.FLAG_ANIMATED; // | QUAD_FLAGS.FLAG_LOOK_AT_CAMERA_HOR;
        const lm = IndexedColor.WHITE.clone();
        lm.b = BLOCK.getAnimations(material, "west");

        this.gl_material = material.resource_pack.getMaterial(material.material_key);

        // Push vertices
        this.vertices = [];

        for(let i = 0; i < 5; i++) {
            const w = mob.width - i/10;
            const h = mob.height * .3;
            const d = .5;
            const aabb = new AABB();
            aabb.set(0, 0, 0, w, h * 1 * 1.5, d);
            aabb.translate(-w/2, i * h, -d/2 + i / 50);
            pushAABB(
                this.vertices,
                aabb,
                new Vector(0, 0, 0),
                this.matrix,
                {
                    south:  new AABBSideParams(c_fire, flags, 0, lm, null, false)
                },
                this.pos
            );
        }

        this.buffer = new GeometryTerrain(this.vertices);

    }

    // Draw
    draw(render, delta) {

        if(!this.buffer) {
            return false;
        }

        // this.updateLightTex(render);

        this.matrix = mat4.create();
        mat4.rotate(this.matrix, this.matrix, -this.yaw, [0, 1, 0]);

        // const rot = ((performance.now() * 5) / 1000) % (Math.PI * 2);
        // this.matrix = mat4.create();
        // mat4.rotate(this.matrix, this.matrix, rot, [0, 0, 1]);
        // mat4.scale(this.matrix, this.matrix, this.scale.toArray());

        render.renderBackend.drawMesh(this.buffer, this.gl_material, this.apos, this.matrix);

    }

    destroy() {
        if(this.buffer) {
            this.buffer.destroy();
            this.buffer = null;
        }
    }

    get isAlive() : boolean {
        return this.life > 0;
    }

    /*
    // Update light texture from chunk
    updateLightTex(render) {
        const chunk = render.world.chunkManager.getChunk(this.chunk_addr);
        if (!chunk) {
            return;
        }
        this.chunk = chunk;
        this.lightTex = chunk.getLightTexture(render.renderBackend);
    }*/

}