import { BLOCK } from "../blocks.js";
import { DIRECTION, isScalar, Vector } from "../helpers.js";

const VEC_2 = new Vector(2, 2, 2);

//
export class BBModel_Parser {

    constructor(model, textures) {
        this.model = model;
        this.parts = [];
        this.textures = {
            tex_side: BLOCK.calcTexture(textures, DIRECTION.WEST)
        };
        console.log(model);
        this.elements = new Map();
    }

    getElement(key) {
        const resp = this.elements.get(key);
        if(!resp) debugger;
        return resp;
    }

    //
    parse() {
        const origin = new Vector(0, 0, 0);
        const model = this.model;
        //
        if(model.elements) {
            for(let i = 0; i < model.elements.length; i++) {
                const element = model.elements[i];
                this.elements.set(i, element);
                const uuid = element.uuid;
                if(uuid) {
                    this.elements.set(uuid, element);
                }
            }
        }
        //
        if(model.groups) {
            for(let group of model.groups) {
                if(isScalar(group)) {
                    this.addElement(origin, this.model.elements[group]);
                } else {
                    this.addGroup(origin, group);
                }
            }
        } else if(model.outliner) {
            for(let group of model.outliner) {
                this.addGroup(origin, group);
            }
        } else if(model.elements) {
            for(let element of model.elements) {
                this.addElement(origin, element);
            }
        }
        return this.parts;
    }

    //
    addGroup(pos, group) {
        const group_pos = new Vector().copy(group.origin);
        pos = pos.clone().addSelf(group_pos);
        for(let child of group.children) {
            if(isScalar(child)) {
                const el = this.getElement(child);
                if(!el) debugger
                this.addElement(pos, el);
            } else {
                this.addGroup(pos, child);
            }
        }
    }

    //
    addElement(pos, el) {
        if(el.children) {
            return this.addGroup(pos, el);
        }
        const flag = 0;
        const from = new Vector().copy(el.from);
        const to = new Vector().copy(el.to);
        const size = to.subSelf(from);
        const part = {
            size:      size,
            translate: from.addScalarSelf(8, -8, -8).addSelf(size.div(VEC_2)),
            faces:     {}
        };
        part.translate.x = 16 - part.translate.x;
        if('rotation' in el) {
            const {rot, pivot} = this.parseRot(el);
            part.rot = rot;
            part.pivot = pivot;
        }
        for(let f in el.faces) {
            const face = el.faces[f];
            part.faces[f] = {
                uv:         [8, 8],
                flag:       flag,
                texture:    this.textures.tex_side
            };
        }
        this.parts.push(part);
    }

    //
    parseRot(el) {
        /*
            rotation: {
                angle: 0
                axis: "y"
                origin: [0.5, 8, 8]
            },
            "rotation": [
                141.37231633232022,
                -46.845525107642814,
                1.2602593233651256
            ],
        */
        const resp = {};
        const rotation = el.rotation;
        if(Array.isArray(rotation)) {
            resp.rot = [
                -(Math.PI * (rotation[0] / 180)),
                (Math.PI * (rotation[1] / 180)),
                -(Math.PI * (rotation[2] / 180))
            ];
            resp.pivot = new Vector().copy(el.origin);
        } else {
            const angle = Math.PI * (rotation.angle / 180);
            resp.pivot = new Vector().copy(rotation.origin);
            switch(rotation.axis) {
                case 'x': {
                    resp.rot = [-angle, 0, 0];
                    break;
                }
                case 'y': {
                    resp.rot = [0, angle, 0];
                    break;
                }
                case 'z': {
                    resp.rot = [0, 0, angle];
                    break;
                }
            }
        }
        resp.pivot.x = 16 - resp.pivot.x;
        return resp;
    }

}