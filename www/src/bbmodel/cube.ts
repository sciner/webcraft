import { default as default_style, QuadPart } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";
import { IndexedColor, QUAD_FLAGS, Vector } from "../helpers.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from './model.js';
import type { Mesh_Object_BBModel } from 'mesh/object/bbmodel.js';

const {mat4} = glMatrix;
const tempMat = mat4.create();
const zeroVec = new Vector();

//
export class BBModel_Cube extends BBModel_Child {
    selected_texture_name: any;
    size: Vector;
    translate: Vector;
    faces: {};
    flag: int = 0
    faces_palette: any;
    inflate: float = 0
    callback: (callback : QuadPart) => boolean

    constructor(model : BBModel_Model, json : any, size : Vector, translate : Vector) {
        super(model, json)
        if('inflate' in json && json.inflate != 0) {
            this.inflate = json.inflate
        }
        this.size = size
        this.translate = translate
        this.setFaces(json.faces)
    }

    private setFaces(faces) {
        let flag = 0
        this.faces = {}
        if(faces) {
            const name_lower = this.json.name.toLowerCase()
            if(['dandelion', 'poppy'].includes(this.model.json.name)) {
                flag |= QUAD_FLAGS.FLAG_NO_AO | QUAD_FLAGS.FLAG_LEAVES // | QUAD_FLAGS.FLAG_NORMAL_UP;
            }
            // another flags
            if(name_lower.includes('#flag_')) {
                const temp = name_lower.split('#flag_')
                for(let flag_name of temp) {
                    if(flag_name.length == 0) continue
                    let i = flag_name.indexOf('#')
                    if(i >= 0) {
                        flag_name = flag_name.substring(0, i)
                    }
                    flag_name = `FLAG_${flag_name.toUpperCase()}`
                    const f = QUAD_FLAGS[flag_name]
                    switch(f as any) {
                        case QUAD_FLAGS.FLAG_TORCH_FLAME: {
                            flag |= QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_LOOK_AT_CAMERA_HOR | QUAD_FLAGS.FLAG_NORMAL_UP
                            flag |= QUAD_FLAGS.FLAG_TORCH_FLAME
                            break
                        }
                        case QUAD_FLAGS.FLAG_FLUID_ERASE: {
                            flag |= QUAD_FLAGS.FLAG_FLUID_ERASE | QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT
                            break
                        }
                    }
                    if(f != undefined) {
                        flag |= parseInt(f)
                        if(flag_name == 'FLAG_LIGHT_GRID') {
                            console.log(this.json.name, f, parseInt(f), flag)
                        }
                    }
                }
            }
            for(let f in faces) {
                // remove empty faces
                const face = faces[f]
                if(!face.texture) {
                    continue
                }
                this.faces[f] = {
                    tx_cnt:     1,
                    tx_size:    this.model.tx_size,
                    autoUV:     false,
                    texture_id: face.texture,
                    uv:         face.uv,
                    flag:       flag,
                    texture:    [.5, .5, 1, 1]
                }
            }
        }
    }

    pushVertices(vertices : float[], pos : Vector, lm : IndexedColor, parent_matrix : imat4, emmit_particles_func? : Function, mesh?: Mesh_Object_BBModel) {
        const worldMatrix = mat4.multiply(tempMat, parent_matrix, this.matrix);
        const model = this.model
        const force_texture_name = this.selected_texture_name ?? model.selected_texture_name
        const faces = force_texture_name ? this.faces_palette?.get(force_texture_name) : this.faces
        if(!faces) {
            console.log(force_texture_name, JSON.stringify(this.faces))
            debugger
            throw 'error_bbcube_no_faces'
        }
        const part = {
            faces:      faces,
            size:       this.size,
            flag:       this.flag,
            translate:  this.translate,
            lm:         lm,
            pos:        pos,
            inflate:    this.inflate,
            matrix:     worldMatrix
        }
        const callback = this.callback
        if(callback) {
            this.callback = undefined
            if(callback(part)) {
                return
            }
        }
        default_style.pushPART(vertices, part, zeroVec);
    }

}