import { IndexedColor, QUAD_FLAGS, Vector } from '../../helpers.js';
import { GeometryTerrain } from '../../geometry_terrain.js';
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import { Mesh_Object_Base } from './base.js';
import { Resources } from '../../resources.js';
import type {TParsedAnimation} from '../../bbmodel/model.js';
import {BBModel_Model} from '../../bbmodel/model.js';
import type { BaseResourcePack } from '../../base_resource_pack.js';
import { BBModel_Group } from '../../bbmodel/group.js';
import type Mesh_Object_Block_Drop from './block_drop.js';
import type { Renderer } from '../../render.js';
import { Mesh_Object_Asteroid } from './asteroid.js';
import { BLOCK, DBItemBlock } from '../../blocks.js';
import { BBModel_Cube } from '../../bbmodel/cube.js';
import { default as default_style } from '../../block_style/default.js';
import type { WebGLMaterial } from '../../renders/webgl/WebGLMaterial.js';

export class MeshObjectCustomReplace {
    buffer: GeometryTerrain
    gl_material: WebGLMaterial

    constructor(buffer : GeometryTerrain, gl_material : WebGLMaterial) {
        this.buffer = buffer
        this.gl_material = gl_material
    }

    destroy() {
        this.buffer.destroy()
    }

}

declare type IGroupModifiers = {
    append:             MeshObjectModifyAppend[],
    replace:            MeshObjectModifyReplace,
    replace_with_mesh:  MeshObjectModifyReplaceWithMesh,
    hide:               string[],
    texture_name:       string | null,
}

const {mat4} = glMatrix;
const lm        = IndexedColor.WHITE;
const vecZero   = Vector.ZERO.clone();
const DEFAULT_ANIMATION_TRANSITION_DURATION = 1.0

class MeshObjectModifyAppend {
    mesh : Mesh_Object_BBModel | Mesh_Object_Base
    display? : any

    constructor(mesh : Mesh_Object_BBModel | Mesh_Object_Base, display? : any) {
        this.mesh = mesh
        this.display = display
    }

}

class MeshObjectModifyReplaceWithMesh {
    mesh : Mesh_Object_Block_Drop | MeshObjectCustomReplace
    matrix : imat4

    constructor(mesh : Mesh_Object_Block_Drop | MeshObjectCustomReplace, matrix : imat4) {
        this.mesh = mesh
        this.matrix = matrix
    }

}

class MeshObjectModifyReplace {
    mesh : Mesh_Object_BBModel
    replacement_group : BBModel_Group
    texture_name? : string

    constructor(mesh : Mesh_Object_BBModel, replacement_group : BBModel_Group, texture_name? : string) {
        this.mesh = mesh
        this.replacement_group = replacement_group
        this.texture_name = texture_name
    }

}

class MeshObjectModifiers {
    private mesh:               Mesh_Object_BBModel
    private append_list:        Map<string, MeshObjectModifyAppend[]> = new Map()
    private replace:            Map<string, MeshObjectModifyReplace> = new Map()
    private replace_with_mesh:  Map<string, MeshObjectModifyReplaceWithMesh> = new Map()
    private hide_list:          string[] = []
    private selected_textures:  Map<string, string> = new Map()

    constructor(mesh : Mesh_Object_BBModel) {
        this.mesh = mesh
    }

    getForGroup(name : string) : IGroupModifiers {
        return {
            append:            this.append_list.get(name) || [],
            replace:           this.replace.get(name) || null,
            texture_name:      this.selected_textures.get(name) || null,
            replace_with_mesh: this.replace_with_mesh.get(name) || null,
            hide:              this.hide_list || [],
        }
    }

    appendMeshToGroup(group_name : string, mesh : Mesh_Object_Base) : MeshObjectModifyAppend {

        if(!this.mesh.model.groups.get(group_name)) {
            return null
        }

        let group = this.append_list.get(group_name)
        if(!group) {
            group = []
            this.append_list.set(group_name, group)
        }

        const modifier = new MeshObjectModifyAppend(mesh)

        group.push(modifier)

        return modifier
    }

    appendToGroup(group_name : string, model_name : string, display_name? : string) : MeshObjectModifyAppend {

        if(!this.mesh.model.groups.get(group_name)) {
            return null
        }

        let group = this.append_list.get(group_name)
        if(!group) {
            group = []
            this.append_list.set(group_name, group)
        }

        const render = this.mesh.render
        const bbmodel = Resources._bbmodels.get(model_name)
        const mesh = new Mesh_Object_BBModel(render, Vector.ZERO, Vector.ZERO, bbmodel, null, true)
        const displays = mesh.model.json?.display
        const display = display_name && displays ? displays[display_name] : null
        const modifier = new MeshObjectModifyAppend(mesh, display)

        group.push(modifier)

        return modifier

    }

    replaceGroupWithMesh(group_name : string, mesh : Mesh_Object_Block_Drop | MeshObjectCustomReplace, matrix : imat4) {

        if(!this.mesh.model.groups.get(group_name)) {
            return null
        }

        const group = this.replace_with_mesh.get(group_name)
        if(group) {
            group.mesh.destroy()
        }

        const modifier = new MeshObjectModifyReplaceWithMesh(mesh, matrix)

        this.replace_with_mesh.set(group_name, modifier)

        return modifier

    }

    replaceGroup(group_name : string, model_name : string, texture_name? : string) : MeshObjectModifyReplace | null {

        if(!this.mesh.model.groups.get(group_name)) {
            return null
        }

        const group = this.replace.get(group_name)
        if(group) {
            group.mesh.destroy()
        }

        const render = this.mesh.render
        const bbmodel = Resources._bbmodels.get(model_name)
        const replacement_group = bbmodel?.groups?.get(group_name)
        if(!replacement_group) {
            console.error('error_replacement_group_not_found')
            return null
        }
        const mesh = new Mesh_Object_BBModel(render, Vector.ZERO, Vector.ZERO, bbmodel, null, true)
        const modifier = new MeshObjectModifyReplace(mesh, replacement_group, texture_name)

        this.replace.set(group_name, modifier)

        return modifier

    }

    private _destroyParentGroupGeom(group_name : string) {
        const mesh = this.mesh
        let group : any = mesh.model.groups.get(group_name)
        if(group && !group.isBone()) {
            mesh.vertices_pushed.delete(group.path)
            while(true) {
                group = group.parent
                if(group) {
                    mesh.vertices_pushed.delete(group.path)
                    if(group.isBone()) {
                        mesh.deleteGeometry(group.name)
                        break
                    }
                }
            }
        }
    }

    hideGroup(group_name : string) : boolean {
        if(this.hide_list.includes(group_name)) {
            return false
        }
        this._destroyParentGroupGeom(group_name)
        this.hide_list.push(group_name)
        this.mesh.hide_groups.push(group_name)
        return true
    }

    hideGroups(hide_groups: string[]) {
        for(let name of hide_groups) {
            this.hideGroup(name)
        }
    }

    showGroup(group_name : string) : void {
        for(let list of [this.hide_list, this.mesh.hide_groups]) {
            const index = list.indexOf(group_name)
            if(index >= 0) {
                list.splice(index, 1)
            }
        }
        this._destroyParentGroupGeom(group_name)
    }

    selectTextureFromPalette(group_name : string, texture_name : string) {
        this.selected_textures.set(group_name, texture_name)
    }

    getSelectedTextures() : Map<string, string> {
        return this.selected_textures
    }

    destroy() {
        // append
        for(let list of this.append_list.values()) {
            for(let modifier of list) {
                modifier.mesh.destroy()
            }
        }
        this.append_list.clear()
        // replace
        for(let modifier of this.replace.values()) {
            modifier.mesh.destroy()
        }
        this.replace.clear()
        //
        this.selected_textures.clear()
        // hide
        this.hide_list.length = 0
    }

}

// Mesh_Object_BBModel
export class Mesh_Object_BBModel extends Mesh_Object_Base {
    model:              BBModel_Model
    geometries:         Map<string, GeometryTerrain> = new Map()
    vertices_pushed:    Map<string, boolean> = new Map()
    resource_pack:      BaseResourcePack
    modifiers:          MeshObjectModifiers
    hide_groups:        string[]
    render:             Renderer
    /** Время в секундах, когда измеился тип анимации. Не учитывает изменения скорости и направления. */
    animation_changed:  float | null = null
    animations:         Map<string, any> = new Map()
    prev_animations:    Map<string, any> = new Map()
    trans_animations:   {start : float, duration : float, all: Map<string, {group: BBModel_Group, list: Map<string, Vector>}>} | null = null
    start_time:         float
    chunk:              any
    item_block?:        DBItemBlock
    apos:               Vector
    chunk_addr:         Vector
    chunk_coord:        Vector
    parsed_animation?:  TParsedAnimation | null
    animation_name_o?:  string | null

    private rotation_matrix?: imat4
    private _block_drawer: Mesh_Object_Asteroid

    constructor(render : Renderer, pos : Vector, rotate : Vector, model : BBModel_Model, animation_name : string = null, doubleface : boolean = false, transparent : boolean = false, rotation_matrix?: imat4, hide_groups?: string[], item_block? : DBItemBlock) {
        super(undefined)

        this.model = model
        if(!this.model) {
            console.error('error_model_not_found')
            return
        }

        const grid = render.world.chunkManager.grid

        for(const group_name of model.groups.keys()) {
            this.animations.set(group_name, new Map())
        }

        this.rotation.set(rotate.toArray())
        if(rotation_matrix) {
            this.rotation_matrix = rotation_matrix
            // } else {
            // const mx = mat4.create();
            // mat4.rotateY(mx, mx, this.rotation[2])
            // this.rotation_matrix = mx
        }

        const kmat = transparent ? (doubleface ? 'doubleface_transparent' : 'transparent') : (doubleface ? 'doubleface' : 'regular')

        this.render         = render
        this.life           = 1.0;
        this.chunk          = null
        this.apos           = new Vector(pos) // absolute coord
        this.chunk_addr     = grid.toChunkAddr(this.apos);
        this.chunk_coord    = this.chunk_addr.mul(grid.chunkSize);
        this.pos            = this.apos.sub(this.chunk_coord); // pos inside chunk
        this.matrix         = mat4.create();
        this.start_time     = performance.now();
        this.resource_pack  = render.world.block_manager.resource_pack_manager.get('bbmodel');
        this.gl_material    = this.resource_pack.getMaterial(`bbmodel/${kmat}/terrain/${model.json._properties.texture_id}`);
        this.buffer         = new GeometryTerrain(this.vertices)
        this.modifiers      = new MeshObjectModifiers(this)
        this.hide_groups    = hide_groups ?? []
        this.item_block     = item_block

        this.redraw(0.)
        this.setAnimation(animation_name)

    }

    /** @returns полное имя анимации (с параметрами) */
    get animation_name(): string | null | undefined {
        return this.parsed_animation?.full_name
    }

    //
    setAnimation(animation_name : string) {
        if (this.parsed_animation?.full_name == animation_name) { // если вообще ничего не изменилось - не парсить
            return
        }
        const oldShortName = this.parsed_animation?.name
        this.parsed_animation = animation_name && BBModel_Model.parseAnimationName(animation_name)
        // прверить, изменился ли тип анимации
        this.animation_changed = (oldShortName && oldShortName != this.parsed_animation.name) ? (performance.now() / 1000) : null
    }

    redraw(delta: float) {
        this.vertices = []
        let mx = this.rotation_matrix
        if(!mx) {
            mx = mat4.create();
            mat4.rotateY(mx, mx, this.rotation[2])
        }
        //
        this.model.resetBehaviorChanges()
        this.modifiers.hideGroups(this.hide_groups)
        this.model.playAnimation(this.parsed_animation, (this.start_time + performance.now()) / 1000, this)
        this.model.draw(this.vertices, vecZero, lm, mx);
        this.buffer.updateInternal(this.vertices);
    }

    // Draw
    draw(render : Renderer, delta : float) {

        if(!this.buffer || !this.visible) {
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

        if(!this.visible) {
            return
        }

        if(!m) {
            m = mat4.create()
            mat4.copy(m, this.matrix)
            if(this.rotation_matrix) {
                mat4.mul(m, m, this.rotation_matrix)
            } else {
                mat4.rotateY(m, m, this.rotation[2])
            }
        }

        if(pos) {
            this.apos.copyFrom(pos)
        }

        if(this._block_drawer) {
            this._block_drawer.pos.copyFrom(this.apos)
            this._block_drawer.draw(render, delta, m)
            return
        }

        if(!this.animation_changed) {
            this.prev_animations.clear()
        } else {
            this.trans_animations = {
                all: this.prev_animations,
                duration: DEFAULT_ANIMATION_TRANSITION_DURATION,
                start: this.animation_changed
            }
            this.prev_animations = new Map()
            this.animation_changed = null
            this.start_time = performance.now()
            // if(this.model.name == 'mob/humanoid') {
            //     console.log('anim changed', this.animation_name)
            // }
        }

        if(this.item_block) {
            const mesh = this
            const {item_block, model} = this
            const material = BLOCK.BLOCK_BY_ID[item_block.id]
            if(material.bb.behavior == 'billboard' && item_block.extra_data.texture) {
                for(const cube of model.displays) {
                    // create callback for cube
                    cube.callback = (part) : boolean => {
                        const extra_data = item_block.extra_data ?? {}
                        if(extra_data.texture?.url) {
                            if(extra_data.texture?.uv) {
                                const verts = []
                                const {material_key, uv, tx_size} = extra_data.texture
                                for(const fk in part.faces) {
                                    const face = part.faces[fk]
                                    face.tx_size = tx_size
                                    face.uv = [...uv]
                                }
                                default_style.pushPART(verts, part, Vector.ZERO)
                                const buffer = new GeometryTerrain(verts)
                                const gl_material = material.resource_pack.getMaterial(material_key)
                                const replace_mesh = new MeshObjectCustomReplace(buffer, gl_material)
                                const group = cube.parent
                                mesh.modifiers.replaceGroupWithMesh(group.name, replace_mesh as any, mat4.create())
                                return true
                            }
                        }
                        return false
                    }
                }
            }
        }

        this.model.playAnimation(this.animation_name, (performance.now() - this.start_time) / 1000, this)
        this.model.drawBuffered(render, this, this.apos, lm, m)

    }

    // applyRotate() {
    //     this.matrix = mat4.create()
    //     const z = this.rotation[2]
    //     mat4.rotateZ(this.matrix, this.matrix, z)
    // }

    destroy() {
        this.buffer.destroy()
        this.buffer = null
        for(const geom of this.geometries.values()) {
            geom.destroy()
        }
        this.geometries.clear()
        this.modifiers.destroy()
    }

    deleteGeometry(group_name: string) {
        const geom = this.geometries.get(group_name)
        if(geom) {
            geom.destroy()
            this.geometries.delete(group_name)
        }
        const group = this.model.groups.get(group_name)
        if(group) {
            const recvDeleteVertices = (group : BBModel_Group) => {
                for(const g of group.children) {
                    if(g instanceof BBModel_Group) {
                        if(g.isBone()) {
                            return
                        }
                        recvDeleteVertices(g)
                    }
                    this.vertices_pushed.delete(g.path)
                }
            }
            recvDeleteVertices(group)
        }
    }

    get isAlive() : boolean {
        return this.life > 0;
    }

    setupBlockDrawer(blocks: object) {
        if(!this._block_drawer) {
            this._block_drawer = new Mesh_Object_Asteroid(this.render.world, this.render, this.pos, undefined, blocks)
        }
    }

    destroyBlockDrawer() {
        if(this._block_drawer) {
            this._block_drawer.destroy()
            this._block_drawer = null
        }
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