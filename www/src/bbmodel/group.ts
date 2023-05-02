import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { IndexedColor, Vector } from '../helpers.js';
import GeometryTerrain from '../geometry_terrain.js';
import { BBModel_Cube } from './cube.js';
import type { Renderer } from '../render.js';
import type { BBModel_Model } from './model.js';
import { Mesh_Object_BBModel } from '../mesh/object/bbmodel.js';
import { Mesh_Object_Base } from '../mesh/object/base.js';

const {mat4, vec3} = glMatrix;

const accessory_matrix = mat4.create()
const tempVec3 = vec3.create();
//
export class BBModel_Group extends BBModel_Child {
    vertices_pushed:    boolean = false
    _mx:                imat4 = mat4.create()
    update:             boolean = true
    children:           any[] = []
    name:               string
    rot_orig:           Vector
    axe:                Mesh_Object_BBModel
    animation_changed: boolean;

    constructor(model : BBModel_Model, name : string, pivot : Vector, rot : Vector, visibility : boolean = true) {
        super()
        this.model = model
        this.name = name
        this.pivot = pivot
        this.rot = rot
        this.rot_orig = rot.clone()
        this.visibility = !!visibility
        this.orig_visibility = this.visibility
    }

    addChild(child : BBModel_Child) {
        this.children.push(child)
    }

    pushVertices(vertices : float[], pos : Vector, lm : IndexedColor, parent_matrix, emmit_particles_func? : Function) {

        const mx = this._mx
        mat4.identity(mx)

        mat4.copy(mx, parent_matrix)
        this.playAnimations(mx)
        mat4.multiply(mx, mx, this.matrix)

        for(let part of this.children) {
            if(!part.visibility) {
                continue
            }
            part.pushVertices(vertices, pos, lm, mx, emmit_particles_func)
        }
    }

    isBone() : boolean {
        return this.model.bone_groups.has(this.name)
    }

    drawBuffered(render : Renderer, mesh: Mesh_Object_BBModel, pos : Vector, lm : IndexedColor, parent_matrix : imat4, bone_matrix: float[] = null, vertices : float[], emmit_particles_func? : Function, replace : boolean = false) {

        // Hide some groups
        if(mesh.hide_groups.includes(this.name)) {
            return
        }

        const group_modifiers = mesh.modifiers.getForGroup(this.name)

        if(this.name == '_main') {
            const replaceTextures = mesh.modifiers.getSelectedTextures()
            if(replaceTextures.size > 0) {
                for(const [group_name, texture_name] of replaceTextures.entries()) {
                    this.model.selectTextureFromPalette(group_name, texture_name)
                }
            }
        }

        const mx = this._mx
        mat4.identity(mx)

        if (parent_matrix) {
            mat4.copy(mx, parent_matrix)
        }
        this.playAnimations(mx, mesh)
        mat4.multiply(mx, mx, this.matrix)

        const im_bone = this.isBone() || replace
        if(bone_matrix) {
            if (im_bone) {
                bone_matrix = mat4.create()
            } else {
                this.updateLocalTransform()
                bone_matrix = mat4.multiply(mat4.create(), bone_matrix, this.matrix)
            }
        }
        if(im_bone && !mesh.geometries.has(this.name)) {
            vertices = []
            bone_matrix = mat4.create();
        }

        // Replace group
        const replace_modifier = group_modifiers.replace
        if(replace_modifier) {
            if(replace_modifier.replacement_group) {
                // replace specific texture
                if(replace_modifier.texture_name) {
                    replace_modifier.mesh.model.selectTextureFromPalette(this.name, replace_modifier.texture_name)
                }
                // draw another mesh
                replace_modifier.replacement_group.drawBuffered(render, replace_modifier.mesh, pos, lm, mx, bone_matrix, [], undefined, true)
                // restore specific texture
                if(replace_modifier.texture_name) {
                    replace_modifier.mesh.model.selectTextureFromPalette(this.name, null)
                }
            }
            return
        }

        // Replace with mesh
        if(group_modifiers.replace_with_mesh) {
            const {mesh, matrix} = group_modifiers.replace_with_mesh
            mat4.translate(mx, mx, vec3.set(tempVec3, this.pivot.x/16, this.pivot.y/16 + .5, this.pivot.z/16))
            mat4.multiply(mx, mx, matrix);
            mesh.drawBuffer(render, pos, mx)
            return
        }

        const vertices_pushed = mesh.vertices_pushed.has(this.name)

        for(let part of this.children) {
            if(!part.visibility) {
                continue
            }
            if(part instanceof BBModel_Group) {
                part.drawBuffered(render, mesh, pos, lm, mx, bone_matrix, vertices, emmit_particles_func)
            } else if(!vertices_pushed && part instanceof BBModel_Cube) {
                part.pushVertices(vertices, Vector.ZERO, lm, bone_matrix, emmit_particles_func)
            }
        }

        if(!vertices_pushed) {
            mesh.vertices_pushed.set(this.name, true)
        }

        if(im_bone) {
            let geom = mesh.geometries.get(this.name)
            if(!geom) {
                // TODO: кешировать геомы с учетом использованных текстур (в т.ч. у вложенных групп) в bbmodel, а не в mesh_object
                geom = new GeometryTerrain(vertices)
                mesh.geometries.set(this.name, geom)
            }
            render.renderBackend.drawMesh(geom, mesh.gl_material, pos, mx)
        }

        // Draw appended groups
        for(const modifier of group_modifiers.append) {
            mat4.identity(accessory_matrix)
            mat4.copy(accessory_matrix, mx)
            // 1. move to anchor
            mat4.translate(accessory_matrix, accessory_matrix,
                vec3.set(tempVec3, this.pivot.x/16, this.pivot.y/16, this.pivot.z/16))
            // 2. move by display from model
            if(modifier.display) {
                const display = modifier.display
                if(display.translation) {
                    const t = display.translation
                    mat4.translate(accessory_matrix, accessory_matrix,
                        vec3.set(tempVec3, t[0] / 16, t[1] / 16, t[2] / 16))
                }
            }
            if(modifier.mesh instanceof Mesh_Object_BBModel) {
                modifier.mesh.drawBuffered(render, 0, accessory_matrix, pos)
            } else if(modifier.mesh instanceof Mesh_Object_Base) {
                modifier.mesh.drawBuffer(render, pos, accessory_matrix)
            }
        }

    }

    // Play animations
    playAnimations(mx : imat4, mesh?: Mesh_Object_BBModel) {

        // const group_animations = this.animations
        if(!mesh) return
        const group_animations = mesh.animations.get(this.name)

        if(!group_animations || group_animations.size == 0) {
            return false
        }

        for(const [channel_name, point] of group_animations.entries()) {
            switch(channel_name) {
                case 'position': {
                    mat4.translate(mx, mx, point);
                    break;
                }
                case 'rotation': {
                    this.rot.copyFrom(this.rot_orig).subSelf(point);
                    break;
                }
            }
        }

        // apply
        this.updateLocalTransform()

        mesh.prev_animations.set(this.name, {
            group: this,
            list: group_animations
        })

        // reset
        // TODO: Need to optimize!
        mesh.animations.set(this.name, new Map())
        this.rot.copyFrom(this.rot_orig)

    }

}