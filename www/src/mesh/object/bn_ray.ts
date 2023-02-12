import { DIRECTION, getChunkAddr, IndexedColor, QUAD_FLAGS, Vector } from '../../helpers.js';
import { BLOCK } from '../../blocks.js';
import GeometryTerrain from '../../geometry_terrain.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { AABB, AABBSideParams, pushAABB } from '../../core/AABB.js';

const {mat4} = glMatrix;

// Mesh_Object_BeaconRay
export class Mesh_Object_BeaconRay {

    // Constructor
    constructor(args) {

        this.apos           = args.pos.clone().addScalarSelf(.5, .5, .5); // absolute coord
        this.life           = 1.0;
        this.chunk          = null;
        this.chunk_addr     = getChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        // this.lightTex       = null;

        const material      = BLOCK.fromName('BEACON');
        const texture       = material.texture;
        const beacon_beam   = BLOCK.calcTexture(texture, DIRECTION.EAST);
        const flags         = QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.NO_FOG;
        const lm            = IndexedColor.WHITE;

        this.gl_material = material.resource_pack.getMaterial(material.material_key);

        const aabb = new AABB();
        aabb.set(0, 0, 0, .2, 1000, .2);
        aabb.translate(-.1, 0, -.1);

        // Push vertices
        this.vertices = [];
        pushAABB(
            this.vertices,
            aabb,
            new Vector(0, 0, 0),
            this.matrix,
            {
                south:  new AABBSideParams(beacon_beam, flags, 0, lm, null, false),
                north:  new AABBSideParams(beacon_beam, flags, 0, lm, null, false),
                west:   new AABBSideParams(beacon_beam, flags, 0, lm, null, false),
                east:   new AABBSideParams(beacon_beam, flags, 0, lm, null, false),
            },
            this.pos
        );

        this.buffer = new GeometryTerrain(this.vertices);

    }

    // Draw
    draw(render, delta) {

        if(!this.buffer) {
            return false;
        }

        // this.updateLightTex(render);

        const rot = (performance.now() / 1000) % (Math.PI * 2);

        this.matrix = mat4.create();
        mat4.rotate(this.matrix, this.matrix, rot, [0, 0, 1]);
        // mat4.scale(this.matrix, this.matrix, this.scale.toArray());

        delta *= 25;
        delta /= 1000;
        render.renderBackend.drawMesh(this.buffer, this.gl_material, this.apos, this.matrix);

    }

    destroy() {
        this.buffer.destroy();
        this.buffer = null;
    }

    isAlive() {
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