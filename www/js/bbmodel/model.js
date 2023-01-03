import { IndexedColor, isScalar, Vector } from "../helpers.js";
import { BBModel_Box } from "./box.js";
import { BBModel_Child } from "./child.js";
import { BBModel_Group } from "./group.js";
import { EasingType } from "./easing_type.js";

const VEC_2 = new Vector(2, 2, 2);
const FIX_POS = new Vector(8, -8, -8);

//
export class BBModel_Model {

    constructor(model) {
        this.model = model;
        this.elements = new Map();
        this.groups = new Map();
        this._group_stack = [];
        this.root = new BBModel_Group('_main', new Vector(0, 0, 0), new Vector(0, 0, 0));
        this._group_stack.push(this.root);
        this.selected_texture_name = null
    }

    /**
     * @param {string} texture_name 
     */
    selectTextureFromPalette(texture_name) {
        if(!this.all_textures) {
            this.makeTexturePalette()
        }
        const texture = this.all_textures.get(texture_name)
        if(texture) {
            this.selected_texture_name = texture_name
        } else {
            throw 'error_invalid_palette'
        }
    }

    makeTexturePalette() {
        const model = this.model
        this.all_textures = new Map()
        const w = model.resolution.width
        const h = model.resolution.height
        const names = []
        for(let place of model._properties.places) {
            const t = {
                u: place.x * w,
                v: place.y * h,
                w: place.tex.x_size * w,
                h: place.tex.y_size * h
            }
            names.push(place.tex.name)
            this.all_textures.set(place.tex.name, t)
            this.all_textures.set(place.tex.id + '', t)
        }
        //
        const makeElementPelette = (group) => {
            for(const child of group.children) {
                if(child instanceof BBModel_Group) {
                    makeElementPelette(child)
                } else if(!child.faces_palette) {
                    child.faces_palette = new Map()
                    for(let palette_name of names) {
                        const faces = {}
                        const palette_item = this.all_textures.get(palette_name)
                        for(let fk in child.faces) {
                            const face = child.faces[fk]
                            const t = this.all_textures.get(face.texture_id + '')
                            if(!t) {
                                debugger
                                throw 'error_invalid_texture'
                            }
                            faces[fk] = {
                                ...face,
                                uv: [
                                    face.uv[0] - t.u + palette_item.u,
                                    face.uv[1] - t.v + palette_item.v,
                                    face.uv[2],
                                    face.uv[3]
                                ]
                            }
                        }
                        child.faces_palette.set(palette_name, faces)
                    }
                }
            }
        }
        makeElementPelette(this.root)
    }

    /**
     * Draw
     * @param {float[]} vertices 
     * @param {Vector} pos 
     * @param {IndexedColor} lm 
     * @param {float[]} matrix 
     */
    draw(vertices, pos, lm, matrix) {
        this.root.pushVertices(vertices, pos, lm, matrix);
    }

    /**
     * Play animations
     * 
     * @param {string} animation_name 
     * @param {float} dt
     * 
     * @return {boolean}
     */
    playAnimation(animation_name, dt) {

        // reset all states
        for(const [name, animation] of this.animations.entries()) {
            for(let k in animation.animators) {
                const animator = animation.animators[k];
                const group = this.groups.get(animator.name);
                group.animations = [];
                group.rot.copyFrom(group.rot_orig)
                group.updateLocalTransform()
            }
        }

        //
        const animation = this.animations.get(animation_name);

        if(!animation) {
            return false;
        }

        const time = dt % animation.length;
        const loop_mode = animation.loop;
        const loop_delay = animation.loop_delay;

        //
        const calcKeyFrame = (keyframes, time) => {
            let begin_keyframe_index = null;
            for(let i = 0; i < keyframes.length; i++) {
                const keyframe = keyframes[i];
                if(time >= keyframe.time) {
                    begin_keyframe_index = i;
                }
            }
            if(begin_keyframe_index === null) {
                begin_keyframe_index = keyframes.length - 1
            }
            const current_keyframe  = keyframes[begin_keyframe_index];
            const next_keyframe     = keyframes[(begin_keyframe_index + 1) % keyframes.length];
            const diff              = next_keyframe.time - current_keyframe.time;
            const percent           = diff == 0 ? diff : (time - current_keyframe.time) / diff;
            return {current_keyframe, next_keyframe, percent}
        }

        for(let k in animation.animators) {

            const animator = animation.animators[k];
            const group = this.groups.get(animator.name);

            if(group) {

                const channels = animator.channels;

                //
                for(const [channel_name, keyframes] of channels) {

                    if(keyframes.length == 0) continue;

                    const {current_keyframe, next_keyframe, percent} = calcKeyFrame(keyframes, time)

                    if(!current_keyframe || !next_keyframe) continue
                    const current_point = current_keyframe.data_points[0];
                    const next_point = next_keyframe.data_points[0];
                    const point = new Vector(0, 0, 0);

                    let args;
                    let func_name;

                    if(next_keyframe.easing) {
                        args = next_keyframe.easingArgs;
                        func_name = next_keyframe.easing
                    } else {
                        func_name = next_keyframe.interpolation
                    }

                    const func = EasingType.get(func_name)
                    if(!func) {
                        throw `error_not_supported_keyframe_interpolation_method|${next_keyframe.easing}`
                    }

                    const t = func(percent, args || [])
                    point.lerpFrom(current_point, next_point, t)
                    group.animations.push({channel_name, point})

                }

            }

        }

        return true;

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
                    this.addElement(origin, this.getElement(group));
                } else {
                    this.addGroup(origin, group);
                }
            }
        } else if(model.outliner) {
            for(let group of model.outliner) {
                if(isScalar(group)) {
                    this.addElement(origin, this.getElement(group));
                } else {
                    this.addGroup(origin, group);
                }
            }
        } else if(model.elements) {
            for(let element of model.elements) {
                this.addElement(origin, element);
            }
        }
        // parse animations
        this.parseAnimations();
        return this;
    }

    // Parse animations
    parseAnimations() {

        this.animations = new Map();

        const animations = JSON.parse(JSON.stringify(this.model.animations ?? {}));

        for(let ak in animations) {

            const animation = animations[ak];

            /**
             * .length: 1.2
             * .loop: 'loop'
             * .loop_delay: ''
             * .start_delay: ''
             * .animators
             */
            
            for(let k in animation.animators) {

                const animator = animation.animators[k];

                // Prepare channels
                const channels = new Map();
                for(let keyframe of animator.keyframes) {
                    /**
                     * keyframe:
                     * ---------
                     * .channel: "rotation|position"
                     * .data_points[][0, 0, 0]
                     * .time: 0 ... 1.2
                     * interpolation: "linear"
                     */
                    let channel = channels.get(keyframe.channel);
                    if(!channel) {
                        channel = [];
                        channels.set(keyframe.channel, channel);
                    }
                    // pase data points
                    for(let i = 0; i < keyframe.data_points.length; i++) {
                        const dp = keyframe.data_points[i] =
                            new Vector(
                                +keyframe.data_points[i].x,
                                +keyframe.data_points[i].y,
                                +keyframe.data_points[i].z,
                            );
                        if(keyframe.channel === 'position') {
                            dp.divScalar(16);
                        } else if (keyframe.channel === 'rotation') {
                            dp.y = -dp.y;
                            //dp.z = -dp.z;
                        }
                    }
                    channel.push(keyframe);
                }

                //
                for(const [channel_name, keyframes] of channels) {
                    keyframes.sort((a, b) => a.time - b.time);
                }

                animator.channels = channels;

            }

            this.animations.set(animation.name, animation);

        }

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

        if(group.name == 'hitbox') {
            return false;
        }

        // create new group and add to other groups list
        const {rot, pivot} = this.parsePivotAndRot(group, true);

        const bbGroup = new BBModel_Group(group.name, pivot, rot, group.visibility);
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

        if('visibility' in el && !el.visibility) {
            return false;
        }

        const flag  = 0
        const from  = new Vector().copy(el.from)
        const to    = new Vector().copy(el.to)

        //
        const shift = this.model._properties?.shift
        if(shift) {
            from.addSelf(shift)
            to.addSelf(shift)
        }

        const size  = to.subSelf(from);
        const box   = new BBModel_Box(size, from.addSelf(FIX_POS).addSelf(size.div(VEC_2)));

        box.model = this

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
                tx_cnt:     1,
                tx_size:    1024,
                autoUV:     false,
                texture_id: face.texture,
                uv:         face.uv,
                flag:       flag,
                texture:    [.5, .5, 1, 1]
            };
        }

        box.updateLocalTransform();

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
            resp.pivot.copy(origin)
            const shift = this.model._properties?.shift
            if(shift) {
                resp.pivot.addSelf(shift)
            }
            if (isGroup) {
                resp.pivot.x = 16 - resp.pivot.x;
            } else {
                resp.pivot.x = 16 - resp.pivot.x;
            }
        }

        // rotation
        const rotation = el.rotation;
        if (rotation) {
            if (Array.isArray(rotation)) {
                resp.rot.set(
                    rotation[0],
                    rotation[1],
                    rotation[2]
                );
            } else if ('angle' in rotation) {

                const angle = rotation.angle;

                switch (rotation.axis) {
                    case 'x': {
                        resp.rot.x = angle;
                        break;
                    }
                    case 'y': {
                        resp.rot.y = angle;
                        break;
                    }
                    case 'z': {
                        resp.rot.z = angle;
                        break;
                    }
                }

            }
            resp.rot.y *= -1;
            resp.rot.z *= -1;
        }

        return resp;

    }

    /**
     * @param {string[]} name 
     */
    hideGroups(names) {
        for(let group of this.root.children) {
            if(names.includes(group.name)) {
                group.visibility = false
            }
        }
    }

    resetBehaviorChanges() {
        // 1. reset state name
        this.state = null
        // 2. reset visibility
        for(let group of this.root.children) {
            group.visibility = group.orig_visibility
        }
        // 3.
        this.selected_texture_name = null
    }

    /**
     * @param {string} name 
     */
    setState(name) {
        this.state = name
    }

    /**
     * @param {string[]} except_list 
     */
    hideAllExcept(except_list) {
        for(let group of this.root.children) {
            group.visibility = except_list.includes(group.name)
        }
    }

}