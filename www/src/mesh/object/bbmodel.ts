import { IndexedColor, Vector } from '../../helpers.js';
import GeometryTerrain from '../../geometry_terrain.js';
import type { Renderer } from '../../render.js';
import glMatrix from "../../../vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from '../../bbmodel/model.js';
import type { BBModel_Group } from '../../bbmodel/group.js';

const {mat4, quat} = glMatrix;
const lm        = IndexedColor.WHITE;
const vecZero   = Vector.ZERO.clone();

// Mesh_Object_BBModel
export class Mesh_Object_BBModel {
    [key: string]: any

    model : BBModel_Model
    geometries: Map<string, GeometryTerrain> = new Map()
    vertices_pushed: Map<string, boolean> = new Map()

    constructor(render : Renderer, pos : Vector, rotate : Vector, model : BBModel_Model, animation_name : string = null, doubleface : boolean = false) {

        this.model = model;
        if(!this.model) {
            console.error('error_model_not_found');
            return;
        }

        this.rotate         = new Vector(rotate)
        this.life           = 1.0;
        this.chunk          = null;
        this.apos           = new Vector(pos) // absolute coord
        const grid          = render.world.chunkManager.grid;
        this.chunk_addr     = grid.toChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(grid.chunkSize);
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        this.start_time     = performance.now();
        this.resource_pack  = render.world.block_manager.resource_pack_manager.get('bbmodel');

        this.gl_material    = this.resource_pack.getMaterial(`bbmodel/${doubleface ? 'doubleface' : 'regular'}/terrain/${model.json._properties.texture_id}`);
        this.vertices       = [];
        this.buffer         = new GeometryTerrain(this.vertices);
        this.redraw(0.);

        this.setAnimation(animation_name);

    }

    //
    setAnimation(name : string) {
        this.animation_name = name;
    }

    redraw(delta: float) {
        this.vertices = [];
        const mx = mat4.create();
        mat4.rotateY(mx, mx, this.rotate.z + Math.PI);
        this.model.playAnimation(this.animation_name, (this.start_time + performance.now()) / 1000);
        this.model.draw(this.vertices, vecZero, lm, mx);
        this.buffer.updateInternal(this.vertices);
    }

    // Draw
    draw(render : Renderer, delta : float) {

        // throw 'error_deprecated'

        if(!this.buffer) {
            return false;
        }

        // apply animations
        if(this.animation_name || this.animation_name_o != this.animation_name) {
            this.animation_name_o = this.animation_name;
            this.redraw(delta);
        }

        // this.updateLightTex(render);

        // const rot = (performance.now() / 1000) % (Math.PI * 2);
        // this.matrix = mat4.create();
        // mat4.rotate(this.matrix, this.matrix, rot, [0, 0, 1]);
        // mat4.scale(this.matrix, this.matrix, this.scale.toArray());

        render.renderBackend.drawMesh(this.buffer, this.gl_material, this.apos, this.matrix);

    }

    normalizeAngle(angle) {
        let normalizedAngle = ((angle % 360) + 360) % 360;
        return normalizedAngle > 180 ? normalizedAngle - 360 : normalizedAngle;
    }

    drawBuffered(render : Renderer, delta : float) {
        const m = mat4.create()
        mat4.copy(m, this.matrix)
        // mat4.rotateZ(m, m, -this.rotate.z)
        mat4.rotateY(m, m, this.rotate.z +  Math.PI)

        // mat4.identity(m)
        // mat4.rotate(m,m, 0, [0, 1, 0])
        // mat4.rotate(m,m, 0, [1, 0, 0])
        // mat4.rotate(m,m, Math.PI, [0, 0, 1])

        // let q = quat.create()
        // quat.rotateZ(q, q, this.rotate.z)
        // quat.fromEuler(q, 0, 0, this.normalizeAngle(-this.rotate.z / Math.PI * 180) / Math.PI, 'xyz')
        // mat4.fromRotationTranslationScaleOrigin(m, q, [0, 0, 0], [1, 1, 1], [0, 0, 0])

        this.model.playAnimation(this.animation_name, (this.start_time + performance.now()) / 1000)
        this.model.drawBuffered(render, this, this.apos, lm, m)
    }

    applyRotate() {
        this.matrix = mat4.create()
        const z = this.rotate.z
        mat4.rotateZ(this.matrix, this.matrix, z)
    }

    destroy() {
        this.buffer.destroy();
        this.buffer = null;
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