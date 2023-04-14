import { BBModel_Child } from './child.js';
import glMatrix from "../../vendors/gl-matrix-3.3.min.js"
import { IndexedColor, Vector } from '../helpers.js';
import type { Mesh_Object_BBModel } from '../mesh/object/bbmodel.js';
import GeometryTerrain from '../geometry_terrain.js';
import type { Renderer } from '../render.js';
import { BBModel_Cube } from './cube.js';
import type { BBModel_Model } from './model.js';

const {mat4} = glMatrix;

//
export class BBModel_Group extends BBModel_Child {
    [key: string]: any;

    vertices_pushed: boolean = false
    // model: BBModel_Model

    constructor(model : BBModel_Model, name : string, pivot : Vector, rot : Vector, visibility : boolean = true) {
        super();
        this.model = model;
        this.name = name;
        this.children = [];
        this.pivot = pivot;
        this.rot = rot;
        this.rot_orig = rot.clone();
        this.animations = [];
        this.visibility = !!visibility
        this.orig_visibility = !!visibility
        this.update = true
    }

    /**
     * @param {BBModel_Child} child
     */
    addChild(child) {
        this.children.push(child);
    }

    pushVertices(vertices : Float32Array, pos : Vector, lm : IndexedColor, parent_matrix, emmit_particles_func? : Function) {

        const mx = mat4.create();
        mat4.copy(mx, parent_matrix);
        this.playAnimations(mx);
        mat4.multiply(mx, mx, this.matrix);

        for(let part of this.children) {
            if(!part.visibility) {
                continue
            }
            part.pushVertices(vertices, pos, lm, mx, emmit_particles_func);
        }
    }

    drawBuffered(render : Renderer, mesh: Mesh_Object_BBModel, pos : Vector, lm : IndexedColor, parent_matrix : float[], vertices : float[], emmit_particles_func? : Function) {

        const mx = mat4.create();
        mat4.copy(mx, parent_matrix);
        this.playAnimations(mx);
        mat4.multiply(mx, mx, this.matrix);

        const im_bone = this.model.bone_groups.has(this.name)

        if(im_bone && !mesh.geometries.has(this.name)) {
            vertices = []
        }

        const vertices_pushed = mesh.vertices_pushed.has(this.name)

        for(let part of this.children) {
            if(!part.visibility) {
                continue
            }
            if(part instanceof BBModel_Group) {
                part.drawBuffered(render, mesh, pos, lm, mx, vertices, emmit_particles_func)
            } else if(!vertices_pushed && part instanceof BBModel_Cube) {
                part.pushVertices(vertices, Vector.ZERO, lm, mx, emmit_particles_func)
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

    }

    // Play animations
    playAnimations(mx) {

        if(this.animations.length == 0) {
            return false;
        }

        for(let animation of this.animations) {
            switch(animation.channel_name) {
                case 'position': {
                    mat4.translate(mx, mx, animation.point);
                    break;
                }
                case 'rotation': {
                    this.rot.copyFrom(this.rot_orig).subSelf(animation.point);
                    break;
                }
            }
        }

        // apply
        this.updateLocalTransform();

        // reset
        this.animations = [];
        this.rot.copyFrom(this.rot_orig);

    }

}