import { IndexedColor, Vector } from '../../helpers.js';
import GeometryTerrain from '../../geometry_terrain.js';
import type { Renderer } from '../../render.js';
import glMatrix from "../../../vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from '../../bbmodel/model.js';
import type { BaseResourcePack } from '../../base_resource_pack.js';
import type { WebGLMaterial } from '../../renders/webgl/WebGLMaterial.js';
import { Resources } from '../../resources.js';

const {mat4, quat} = glMatrix;
const lm        = IndexedColor.WHITE;
const vecZero   = Vector.ZERO.clone();

class MeshObjectAccessory {
    mesh : Mesh_Object_BBModel
    display? : any

    constructor(mesh : Mesh_Object_BBModel, display : any) {
        this.mesh = mesh
        this.display = display
    }

}

class MeshObjectAccessories {

    mesh : Mesh_Object_BBModel
    list : Map<string, MeshObjectAccessory[]> = new Map()

    constructor(mesh : Mesh_Object_BBModel) {
        this.mesh = mesh
    }

    getForGroup(name : string) : MeshObjectAccessory[] {
        return this.list.get(name) || []
    }

    addForGroup(group_name : string, model_name : string, display_name? : string) {

        let group = this.list.get(group_name)
        if(!group) {
            group = []
            this.list.set(group_name, group)
        }

        const render = this.mesh.render
        const bbmodel = Resources._bbmodels.get(model_name)
        const mesh = new Mesh_Object_BBModel(render, Vector.ZERO, Vector.ZERO, bbmodel, null, false)
        const displays = mesh.model.json?.display
        const display = display_name && displays ? displays[display_name] : null

        group.push(new MeshObjectAccessory(mesh, display))

    }

}

// Mesh_Object_BBModel
export class Mesh_Object_BBModel {
    [key: string]: any

    model : BBModel_Model
    geometries: Map<string, GeometryTerrain> = new Map()
    vertices_pushed: Map<string, boolean> = new Map()
    resource_pack : BaseResourcePack
    gl_material: WebGLMaterial
    accessories: MeshObjectAccessories
    hide_groups: string[] = []

    constructor(render : Renderer, pos : Vector, rotate : Vector, model : BBModel_Model, animation_name : string = null, doubleface : boolean = false) {

        this.model = model;
        if(!this.model) {
            console.error('error_model_not_found');
            return;
        }

        const grid          = render.world.chunkManager.grid

        this.rotate         = new Vector(rotate)
        this.render         = render
        this.life           = 1.0;
        this.chunk          = null;
        this.apos           = new Vector(pos) // absolute coord
        this.chunk_addr     = grid.toChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(grid.chunkSize);
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        this.start_time     = performance.now();
        this.resource_pack  = render.world.block_manager.resource_pack_manager.get('bbmodel');
        this.gl_material    = this.resource_pack.getMaterial(`bbmodel/${doubleface ? 'doubleface' : 'regular'}/terrain/${model.json._properties.texture_id}`);
        this.vertices       = [];
        this.buffer         = new GeometryTerrain(this.vertices)
        this.accessories    = new MeshObjectAccessories(this)
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

    drawBuffered(render : Renderer, delta : float, m? : float[], pos?: Vector) {
        if(!m) {
            m = mat4.create()
            mat4.copy(m, this.matrix)
            mat4.rotateY(m, m, this.rotate.z +  Math.PI)
        }

        if(pos) {
            this.apos.copyFrom(pos)
        }

        this.model.playAnimation(this.animation_name, (this.start_time + performance.now()) / 1000)
        this.model.drawBuffered(render, this, this.apos, lm, m)
    }

    applyRotate() {
        this.matrix = mat4.create()
        const z = this.rotate.z
        mat4.rotateZ(this.matrix, this.matrix, z)
    }

    destroy() {
        this.buffer.destroy()
        this.buffer = null
        for(const geom of this.geometries.values()) {
            geom.destroy()
        }
        this.geometries.clear()
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