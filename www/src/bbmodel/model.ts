import { IndexedColor, isScalar, Vector } from "../helpers.js";
import { EasingType } from "./easing_type.js";
import { BBModel_Cube } from "./cube.js";
import { BBModel_Group } from "./group.js";
import { BBModel_Locator } from "./locator.js";
import { DEFAULT_ATLAS_SIZE } from "../constant.js";
import type { Mesh_Object_BBModel } from "../mesh/object/bbmodel.js";
import type { Renderer } from "../render.js";

const VEC_2 = new Vector(2, 2, 2)
const FIX_POS = new Vector(8, -8, -8)
const EMPTY_ARGS = []

//
export class BBModel_Model {
    [key: string]: any;

    root : BBModel_Group
    bone_groups: Map<string, BBModel_Group> = new Map()
    groups: Map<string, BBModel_Group> = new Map()

    constructor(json) {
        // TODO: need to read from bbmodel texture pack options
        this.tx_size = DEFAULT_ATLAS_SIZE
        this.json = json
        this.elements = new Map()
        this._group_stack = []
        this.root = new BBModel_Group(this, '_main', new Vector(0, 0, 0), new Vector(0, 0, 0))
        this._group_stack.push(this.root)
        this.selected_texture_name = null
        this.particle_locators = []
    }

    /**
     * Select texture
     * @param group_name If empty then texture will be selected for all groups
     * @param texture_name
     */
    selectTextureFromPalette(group_name : string, texture_name : string | null) {
        if(texture_name) {
            if(!this.all_textures) {
                this.makeTexturePalette()
            }
            //
            const texture = this.all_textures.get(texture_name)
            if(!texture) {
                throw `error_invalid_palette|${texture_name}`
            }
        }
        //
        if(group_name) {
            //
            const processGroup = (group, group_path) => {
                if(group_path) {
                    group_path += '/'
                }
                group_path += group.name
                for(let item of group.children) {
                    if(item instanceof BBModel_Group) {
                        processGroup(item, group_path)
                    } else if(item instanceof BBModel_Cube) {
                        if(group_path.indexOf(group_name) == 0) {
                            item.selected_texture_name = texture_name
                        }
                    }
                }
            }
            //
            for(const group of this.groups.values()) {
                processGroup(group, '')
            }
        } else {
            this.selected_texture_name = texture_name
        }
    }

    makeTexturePalette() {
        const model_json = this.json
        this.all_textures = new Map()
        const names = []
        for(let place of model_json._properties.places) {
            const t = {
                u: place.x * 32,
                v: place.y * 32,
                w: place.tex.x_size * 32,
                h: place.tex.y_size * 32
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
                            if(face.texture_id === null) {
                                continue
                            }
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
     */
    draw(vertices: float[], pos : Vector, lm : IndexedColor, matrix : imat4, emmit_particles_func? : Function) {
        this.root.pushVertices(vertices, pos, lm, matrix, emmit_particles_func);
    }

    drawBuffered(render : Renderer, mesh: Mesh_Object_BBModel, pos : Vector, lm : IndexedColor, matrix : float[], emmit_particles_func? : Function) {
        const vertices = []
        this.root.drawBuffered(render, mesh, pos, lm, matrix, undefined, vertices, emmit_particles_func)
    }

    /**
     * Play animations
     */
    playAnimation(animation_name : string, dt : float, mesh : Mesh_Object_BBModel = null) : boolean {

        const animation = this.animations.get(animation_name)
        if(!animation) {
            return false
        }

        // reset all states
        for(const [_, animation] of this.animations.entries()) {
            for(let k in animation.animators) {
                const animator = animation.animators[k];
                const group = this.groups.get(animator.name) as BBModel_Group
                group.animations.clear()
                group.rot.copyFrom(group.rot_orig)
                group.updateLocalTransform()
            }
        }

        //
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
                    const point : Vector = current_keyframe.point || (current_keyframe.point = new Vector(0, 0, 0))

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
                        console.error(`error_not_supported_keyframe_interpolation_method|${func_name}`)
                        continue
                    }

                    const t = func(percent, args || EMPTY_ARGS)
                    point.lerpFrom(current_point, next_point, t)
                    group.animations.set(channel_name, point)

                }

            }

        }

        if(mesh.lerp_animations) {
            const diff = performance.now() / 1000 - mesh.lerp_animations.start
            // const current_point = new Vector(0, 0, 0)
            const next_point = new Vector(0, 0, 0)
            // const func = EasingType.get('linear')
            if(diff < mesh.lerp_animations.duration) {
                const percent = diff / mesh.lerp_animations.duration
                const t = percent // func(percent, EMPTY_ARGS)
                for(const item of mesh.lerp_animations.all.values()) {
                    const {group, list} = item
                    for(const [channel_name, current_point] of list.entries()) {
                        const exist_point = group.animations.get(channel_name)
                        if(exist_point) {
                            next_point.copyFrom(exist_point)
                        } else {
                            next_point.copyFrom(group.rot_orig)
                        }
                        current_point.lerpFrom(current_point, next_point, t)
                        group.animations.set(channel_name, exist_point ? exist_point.copyFrom(current_point) : current_point.clone())
                    }
                }
            } else {
                mesh.lerp_animations = null
            }
        }

        return true

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
        const model_json = this.json;
        //
        if(model_json.elements) {
            for(let i = 0; i < model_json.elements.length; i++) {
                const element = model_json.elements[i];
                this.elements.set(i, element);
                const uuid = element.uuid;
                if(uuid) {
                    this.elements.set(uuid, element);
                }
            }
        }
        //
        if(model_json.groups) {
            for(let group of model_json.groups) {
                if(isScalar(group)) {
                    this.addElement(origin, this.getElement(group));
                } else {
                    this.addGroup(origin, group);
                }
            }
        } else if(model_json.outliner) {
            for(let group of model_json.outliner) {
                if(isScalar(group)) {
                    this.addElement(origin, this.getElement(group));
                } else {
                    this.addGroup(origin, group);
                }
            }
        } else if(model_json.elements) {
            for(let element of model_json.elements) {
                this.addElement(origin, element);
            }
        }

        // parse animations
        this.parseAnimations();

        // parse bone groups
        for(const [_, anim] of this.animations.entries()) {
            for(let [_, animator] of Object.entries(anim.animators)) {
                const name = (animator as any).name
                if(!this.bone_groups.has(name)) {
                    const group = this.groups.get(name)
                    if(!group) {
                        throw 'error_bone_group_not_found'
                    }
                    this.bone_groups.set(name, group)
                }
            }
        }

        this.bone_groups.set(this.root.name, this.root)

        return this
    }

    // Parse animations
    parseAnimations() {

        this.animations = new Map();

        const animations = JSON.parse(JSON.stringify(this.json.animations ?? {}));

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
                            dp.divScalarSelf(16);
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

        const bbGroup = new BBModel_Group(this, group.name, pivot, rot, group.visibility);
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

        const from  = new Vector().copy(el.from)
        const to    = new Vector().copy(el.to)

        //
        const shift = this.json._properties?.shift
        if(shift) {
            from.addSelf(shift)
            to.addSelf(shift)
        }

        const size = to.subSelf(from);
        const translate = from.addSelf(FIX_POS).addSelf(size.div(VEC_2))
        translate.x = 16 - translate.x

        let child

        switch(el.type) {
            case 'cube': {
                child = new BBModel_Cube(this, el, size, translate)
                break
            }
            case 'locator': {
                child = new BBModel_Locator(this, el, size, translate)
                this.addParticleLocator(child)
                break
            }
            default: {
                throw `error_invalid_bbmodel_element_type|${el.type}`
            }
        }

        // Add rotation
        if('rotation' in el) {
            const {rot, pivot} = this.parsePivotAndRot(el)
            child.rot = rot
            child.pivot = pivot
        }

        //
        this.addChildToCurrentGroup(child)
        child.updateLocalTransform()

    }

    /**
     * @param {BBModel_Locator} element
     */
    addParticleLocator(element) {
        this.particle_locators.push(element)
    }

    //
    parsePivotAndRot(el, isGroup : boolean = false) {
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
            const shift = this.json._properties?.shift
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