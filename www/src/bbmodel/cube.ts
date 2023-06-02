import { default as default_style } from '../block_style/default.js';
import { BBModel_Child } from "./child.js";
import { IndexedColor, QUAD_FLAGS, Vector } from "../helpers.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { BBModel_Model } from './model.js';

const {mat4} = glMatrix;
const tempMat = mat4.create();
const zeroVec = new Vector();

//
export class BBModel_Cube extends BBModel_Child {
    selected_texture_name: any;
    size: Vector;
    translate: Vector;
    faces: {};
    faces_palette: any;
    inflate: float = 0

    constructor(model : BBModel_Model, json : any, size : Vector, translate : Vector) {
        super(model, json)
        if('inflate' in json && json.inflate != 0) {
            this.inflate = json.inflate
        }
        this.size = size
        this.translate = translate
        this.setFaces(json.faces)
    }

    setFaces(faces) {
        let flag = 0
        this.faces = {}
        if(faces) {
            const name = this.json.name
            if(name.includes('#flag_torch_flame')) {
                flag |= QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_LOOK_AT_CAMERA_HOR | QUAD_FLAGS.FLAG_NORMAL_UP
                flag |= QUAD_FLAGS.FLAG_TORCH_FLAME
            } else if(name.includes('#flag_fluid_erase')) {
                flag |= QUAD_FLAGS.FLAG_FLUID_ERASE | QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT
            } else {
                if(['dandelion', 'poppy'].includes(this.model.json.name)) {
                    flag |= QUAD_FLAGS.FLAG_NO_AO | QUAD_FLAGS.FLAG_LEAVES // | QUAD_FLAGS.FLAG_NORMAL_UP;
                }
                // another flags
                if(name.includes('#flag_')) {
                    const temp = name.split('#flag_')
                    for(let flag_name of temp) {
                        if(flag_name.length == 0) continue
                        let i = flag_name.indexOf('#')
                        if(i >= 0) {
                            flag_name = flag_name.substring(0, i)
                        }
                        flag_name = `FLAG_${flag_name.toUpperCase()}`
                        const f = QUAD_FLAGS[flag_name]
                        if(f != undefined) {
                            flag |= parseInt(f)
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

    pushVertices(vertices : float[], pos : Vector, lm : IndexedColor, parentMatrix : imat4, emmit_particles_func? : Function) {
        const worldMatrix = mat4.multiply(tempMat, parentMatrix, this.matrix);
        const model = this.model
        const force_texture_name = this.selected_texture_name ?? model.selected_texture_name
        const faces = force_texture_name ? this.faces_palette?.get(force_texture_name) : this.faces
        if(!faces) {
            console.log(force_texture_name, JSON.stringify(this.faces))
            debugger
            throw 'error_bbcube_no_faces'
        }
        default_style.pushPART(vertices, {
            faces:      faces,
            size:       this.size,
            translate:  this.translate,
            lm:         lm,
            pos:        pos,
            inflate:    this.inflate,
            matrix:     worldMatrix
        }, zeroVec);
    }

}