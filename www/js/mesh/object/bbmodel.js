import { getChunkAddr, IndexedColor, Vector } from '../../helpers.js';
import GeometryTerrain from '../../geometry_terrain.js';
import { CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z } from '../../chunk_const.js';
import { Resources } from '../../resources.js';

const {mat4}    = glMatrix;
const lm        = IndexedColor.WHITE;
const vecZero   = Vector.ZERO.clone();

// Mesh_Object_BBModel
export class Mesh_Object_BBModel {

    /**
     * 
     * @param {*} render 
     * @param {Vector} pos 
     * @param {Vector} rotate 
     * @param {BBModel_Model} model 
     * @param {string} animation_name 
     * 
     * @returns 
     */
    constructor(render, pos, rotate, model, animation_name = null) {

        this.model = model;
        if(!this.model) {
            console.error('error_model_not_found');
            return;
        }

        this.rotate         = rotate.clone();
        this.life           = 1.0;
        this.chunk          = null;
        this.apos           = pos.clone(); // absolute coord
        this.chunk_addr     = getChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(new Vector(CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z));
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        this.start_time     = performance.now();
        this.resource_pack  = Qubatch.world.block_manager.resource_pack_manager.get('bbmodel');

        this.gl_material    = this.resource_pack.getMaterial(`bbmodel/regular/terrain/${model.name}`);
        this.vertices       = [];
        this.buffer         = new GeometryTerrain(this.vertices);
        this.redraw();

        this.setAnimation(animation_name);

    }

    //
    setAnimation(name) {
        this.animation_name = name;
    }

    redraw() {
        this.vertices = [];
        const mx = mat4.create();
        mat4.rotateY(mx, mx, this.rotate.z + Math.PI);
        this.model.playAnimation(this.animation_name, (this.start_time + performance.now()) / 1000);
        this.model.draw(this.vertices, vecZero, lm, mx);
        this.buffer.updateInternal(this.vertices);
    }

    // Draw
    draw(render, delta) {

        if(!this.buffer) {
            return false;
        }

        // apply animations
        if(this.animation_name || this.animation_name_o != this.animation_name) {
            this.animation_name_o = this.animation_name;
            this.redraw();
        }

        // this.updateLightTex(render);

        // const rot = (performance.now() / 1000) % (Math.PI * 2);
        // this.matrix = mat4.create();
        // mat4.rotate(this.matrix, this.matrix, rot, [0, 0, 1]);
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