import { BLOCK } from "../blocks.js";
import { DIRECTION, isScalar, Vector } from "../helpers.js";
import { BBModel_Box } from "./box.js";
import { BBModel_Child } from "./child.js";
import { BBModel_Group } from "./group.js";

const VEC_2 = new Vector(2, 2, 2);

//
export class BBModel_Parser {

    constructor(model, textures) {
        this.model = model;
        this.textures = {
            tex_side: BLOCK.calcTexture(textures, DIRECTION.WEST)
        };
        this.elements = new Map();
        this.groups = new Map();
        this._group_stack = [];
        this.root = new BBModel_Group('_main', new Vector(0, 0, 0), new Vector(0, 0, 0));
        this._group_stack.push(this.root);
    }

    playAnimation(current_animation_name) {

        const animations = this.model.animations;

        for(let ak in animations) {
            const animation = animations[ak];
            /**
             * .length: 1.2
             * .loop: 'loop'
             * .loop_delay: ''
             * .start_delay: ''
             * .animators
             */
            if(animation.name == current_animation_name) {
                const time = (performance.now() / 1000) % animation.length;
                for(let k in animation.animators) {

                    const animator = animation.animators[k];
                    if(animator.name != 'body') {
                        // continue;
                    }

                    const group = this.groups.get(animator.name);
                    if(group) {

                        const channels = new Map();
                        for(let keyframe of animator.keyframes) {
                            let channel = channels.get(keyframe.channel);
                            if(!channel) {
                                channel = [];
                                channels.set(keyframe.channel, channel);
                            }
                            channel.push(keyframe);
                            /**
                             * .channel: "rotation|position"
                             * .data_points[][0, 0, 0]
                             * .time: 0 ... 1.2
                             * interpolation: "linear"
                             */
                        }

                        //
                        for(const [channel_name, keyframes] of channels) {

                            keyframes.sort((a, b) => a.time - b.time);
                            let begin_keyframe_index = null;
                            for(let i = 0; i < keyframes.length; i++) {
                                const keyframe = keyframes[i];
                                if(time >= keyframe.time) {
                                    begin_keyframe_index = i;
                                }
                            }

                            const current_keyframe = keyframes[begin_keyframe_index];
                            const next_keyframe = keyframes[begin_keyframe_index + 1];
                            if(!next_keyframe || !current_keyframe) {
                                continue;
                            }

                            const diff = next_keyframe.time - current_keyframe.time;
                            let percent = (time - current_keyframe.time) / diff;
                            
                            const current_data_points = new Vector(current_keyframe.data_points[0]);
                            const next_data_points = new Vector(next_keyframe.data_points[0]);

                            const point = new Vector(0, 0, 0).lerpFrom(current_data_points, next_data_points, percent);

                            if(channel_name == 'position') {
                                point.divScalar(16);
                            }

                            group.animations.push({channel_name, point})

                        }
                    }

                }
            }
        }

    }

    /**
     * @param {string} key
     * @returns
     */
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
        return this;
    }

    /**
     * Add new group into parent group
     * @param {BBModel_Child} child
     */
    addChildToCurrentGroup(child) {
        if(this._group_stack.length > 0) {
            const parent = this._group_stack[this._group_stack.length - 1];
            parent.addChild(child);
            child.parent = parent;
        }
    }

    /**
     * @param {Vector} pos
     * @param {object} group
     * @returns
     */
    addGroup(pos, group) {

        // create new group and add to other groups list
        const {rot, pivot} = this.parsePivotAndRot(group, true);

        const bbGroup = new BBModel_Group(group.name, pivot, rot);
        bbGroup.updateLocalTransform();
        this.groups.set(group.name, bbGroup);

        // add new group into parent group
        this.addChildToCurrentGroup(bbGroup);

        // add new group to stack
        this._group_stack.push(bbGroup);

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

        // remove current group from stack
        return this._group_stack.pop();

    }

    /**
     * @param {Vector} pos
     * @param {object} el
     * @returns
     */
    addElement(pos, el) {

        if(el.children) {
            return this.addGroup(pos, el);
        }

        const flag  = 0;
        const from  = new Vector().copy(el.from);
        const to    = new Vector().copy(el.to);
        const size  = to.subSelf(from);
        const box   = new BBModel_Box(size, from.addScalarSelf(8, -8, -8).addSelf(size.div(VEC_2)));

        //
        this.addChildToCurrentGroup(box);

        box.translate.x = 16 - box.translate.x;
        if('rotation' in el) {
            const {rot, pivot} = this.parsePivotAndRot(el);
            box.rot = rot;
            box.pivot = pivot;
        }

        for(let f in el.faces) {
            const face = el.faces[f];
            box.faces[f] = {
                uv:         [8, 8],
                flag:       flag,
                texture:    this.textures.tex_side
            };
        }

        box.updateLocalTransform();
    }

    /**
     * @param {object} obj
     * @returns
     */
    parsePivot(obj) {
        const pivot = new Vector().copy(obj.origin);
        return pivot;
    }

    //
    parsePivotAndRot(el, isGroup) {
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
        const resp = {
            pivot: new Vector(0, 0, 0),
            rot: new Vector(0, 0, 0)
        };

        // pivot
        const origin = el.rotation?.origin ?? el.origin;
        if(origin) {
            resp.pivot.copy(origin);
            if (isGroup) {
                resp.pivot.x = 16 - resp.pivot.x;
            } else {
                resp.pivot.x = 16 - resp.pivot.x;
            }
        }

        // rotation
        const rotation = el.rotation;
        if(Array.isArray(rotation)) {
            resp.rot.set(
                rotation[0],
                -rotation[1],
                -rotation[2]
            );
        } else if(rotation && 'angle' in rotation) {

            const angle = rotation.angle;

            switch(rotation.axis) {
                case 'x': {
                    resp.rot.x = angle;
                    break;
                }
                case 'y': {
                    resp.rot.y = -angle;
                    break;
                }
                case 'z': {
                    resp.rot.z = -angle;
                    break;
                }
            }

        }

        return resp;

    }

}