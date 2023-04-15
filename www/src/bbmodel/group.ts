import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { IndexedColor, Vector } from '../helpers.js';
import { Mesh_Object_BBModel } from '../mesh/object/bbmodel.js';
import GeometryTerrain from '../geometry_terrain.js';
import type { Renderer } from '../render.js';
import { BBModel_Cube } from './cube.js';
import type { BBModel_Model } from './model.js';
import { Resources } from '../resources.js';

const {mat4} = glMatrix;

let IDENTITY = mat4.create();
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

    drawBuffered(render : Renderer, mesh: Mesh_Object_BBModel, pos : Vector, lm : IndexedColor, parent_matrix : imat4, bone_matrix: float[] = null, vertices : float[], emmit_particles_func? : Function) {

        const mx = this._mx
        mat4.identity(mx)

        if (parent_matrix) {
            mat4.copy(mx, parent_matrix);
        }
        this.playAnimations(mx);
        mat4.multiply(mx, mx, this.matrix);

        const im_bone = this.model.bone_groups.has(this.name)
        if (bone_matrix) {
            if (im_bone) {
                bone_matrix = mat4.create();
            } else {
                this.updateLocalTransform();
                bone_matrix = mat4.multiply(mat4.create(), bone_matrix, this.matrix);
            }
        }
        if(im_bone && !mesh.geometries.has(this.name)) {
            vertices = []
            bone_matrix = mat4.create();
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

        if (this.name == 'head') {
            if(!mesh.helmet) {
                const helmet_model = Resources._bbmodels.get('tool/sunglasses')
                mesh.helmet = new Mesh_Object_BBModel(render, Vector.ZERO, Vector.ZERO, helmet_model, null, false)
                console.log(mesh.helmet)
            }
            mesh.helmet.drawBuffered(render, 0, mx, pos)
        }

        if(this.name == 'RightArmItemPlace') {
            
            if(!mesh.axe) {
                const axe_model = Resources._bbmodels.get('tool/primitive_axe')
                mesh.axe = new Mesh_Object_BBModel(render, Vector.ZERO, Vector.ZERO, axe_model, null, false)
            }
            // 1. move to anchor
            mat4.translate(mx, mx, [this.pivot.x/16, this.pivot.y/16, this.pivot.z/16])
            // 2. move by display from model
            const axe_display = mesh.axe.model.json?.display?.thirdperson_righthand
            if(axe_display?.translation) {
                const t = axe_display?.translation
                mat4.translate(mx, mx, [t[0] / 16, t[1] / 16, t[2] / 16])
            }
            mesh.axe.drawBuffered(render, 0, mx, pos)
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