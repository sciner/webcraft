import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { IndexedColor, Vector } from '../helpers.js';
import GeometryTerrain from '../geometry_terrain.js';
import { BBModel_Cube } from './cube.js';
import type { Renderer } from '../render.js';
import type { BBModel_Model } from './model.js';
import type { Mesh_Object_BBModel } from '../mesh/object/bbmodel.js';

const {mat4} = glMatrix;

const accessory_matrix = mat4.create()

//
export class BBModel_Group extends BBModel_Child {
    vertices_pushed:    boolean = false
    _mx:                imat4 = mat4.create()
    update:             boolean = true
    children:           any[] = []
    animations:         any[] = []
    name:               string
    rot_orig:           Vector
    axe:                Mesh_Object_BBModel

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

    drawBuffered(render : Renderer, mesh: Mesh_Object_BBModel, pos : Vector, lm : IndexedColor, parent_matrix : imat4, bone_matrix: float[] = null, vertices : float[], emmit_particles_func? : Function, replace : boolean = false) {

        // Hide some groups
        if(mesh.hide_groups.includes(this.name)) {
            return
        }

        const group_modifiers = mesh.modifiers.getForGroup(this.name)

        const mx = this._mx
        mat4.identity(mx)

        if (parent_matrix) {
            mat4.copy(mx, parent_matrix)
        }
        this.playAnimations(mx)
        mat4.multiply(mx, mx, this.matrix)

        const im_bone = this.model.bone_groups.has(this.name) || replace
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
        if(group_modifiers.replace.length > 0) {
            for(const modifier of group_modifiers.replace) {
                const repl_group = modifier.mesh.model.groups.get(this.name)
                if(repl_group) {
                    const repl_vertices = []
                    // replace specific texture
                    if(modifier.texture_name) {
                        modifier.mesh.model.selectTextureFromPalette(this.name, modifier.texture_name)
                    }
                    repl_group.drawBuffered(render, modifier.mesh, pos, lm, mx, bone_matrix, repl_vertices, undefined, true)
                    // restore specific texture
                    if(modifier.texture_name) {
                        modifier.mesh.model.selectTextureFromPalette(this.name, null)
                    }
                }
            }
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
            mat4.translate(accessory_matrix, accessory_matrix, [this.pivot.x/16, this.pivot.y/16, this.pivot.z/16])
            // 2. move by display from model
            if(modifier.display) {
                const display = modifier.display
                if(display.translation) {
                    const t = display.translation
                    mat4.translate(accessory_matrix, accessory_matrix, [t[0] / 16, t[1] / 16, t[2] / 16])
                }    
            }
            modifier.mesh.drawBuffered(render, 0, accessory_matrix, pos)
        }

    }

    // Play animations
    playAnimations(mx : imat4) {

        if(this.animations.length == 0) {
            return false;
        }

        for(let i = 0; i < this.animations.length; i += 2) {
            const channel_name = this.animations[i]
            const point = this.animations[i + 1]
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

        // reset
        this.animations.length = 0
        this.rot.copyFrom(this.rot_orig)

    }

}