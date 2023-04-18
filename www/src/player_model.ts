import { BLOCK } from "./blocks.js";
import { HAND_ANIMATION_SPEED, NOT_SPAWNABLE_BUT_INHAND_BLOCKS, PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_ZOOM } from "./constant.js";
import GeometryTerrain from "./geometry_terrain.js";
import { Helpers, NORMALS, QUAD_FLAGS, Vector } from './helpers.js';
import { MobModel } from "./mob_model.js";
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { SceneNode } from "./SceneNode.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import type { Renderer } from "./render.js";
import type { PlayerHands, TSittingState, TSleepState} from "./player.js";
import type { NetworkPhysicObjectState } from "./network_physic_object.js";
import type { World } from "./world.js";

const { quat, mat4 } = glMatrix;
const SWING_DURATION = 6;

const KEY_SLOT_MAP = {
    left: 'LeftArm',
    right: 'RightArm'
};

export class ModelSlot {
    holder: SceneNode;
    id: number;
    name: string;

    constructor(name : string = '', parent = null) {

        this.holder = new SceneNode(parent);
        this.holder.position.set(parent.pivot);

        this.id = -1;

        this.name = name;

        this.holder.updateMatrix();
    }
}

// An adapter that allows using ServerPlayer and PlayerModel in the same way
class PlayerModelSharedProps implements IPlayerSharedProps {
    p: PlayerModel;

    constructor(playerModel: PlayerModel) {
        this.p = playerModel;
    }

    // We don't know if it's alive on the client, so we assume if the model exists, than it is
    get isAlive()   : boolean   { return true; }
    get pos()       : Vector    { return this.p.pos; }
    get user_id()   : int       { return this.p.id; }
    get sitting()   : boolean   { return !!this.p.sitting; }
    get sleep()     : boolean   { return !!this.p.sleep; }
}

export class PlayerModel extends MobModel implements IPlayerOrModel {
    sharedProps: PlayerModelSharedProps
    distance:    number | null

    constructor(props, world : World) {
        super({type: 'player', skin: '1', ...props}, world);

        this.height = PLAYER_HEIGHT;
        this.width = PLAYER_WIDTH;
        this.scale = 0.9 * PLAYER_ZOOM;

        /**
         * @type {HTMLCanvasElement}
         */
        this.textCanvas = null;
        this.textContext = null;
        this.username = props.username;
        this.head = null;
        this.health = props.health;
        // this.animationScript = new PlayerAnimation(this)

        /**
         * @type {Map<string, ModelSlot>}
         */
        this.slots = {};

        // for lazy state generation
        this.activeSlotsData = props.hands;

        // Arm swing
        this.swingProgress = 0;
        this.swingProgressInt = 0;
        this.isSwingInProgress = false;

        this.sharedProps = new PlayerModelSharedProps(this);
    }

    applyNetState(state: NetworkPhysicObjectState & { hands: PlayerHands }) {
        super.applyNetState(state);
        this.changeSlots(state.hands);
    }

    changeSlots(data: PlayerHands) {
        this.activeSlotsData = data;

        if (this.sceneTree && this.activeSlotsData) {
            for(const key in this.activeSlotsData) {
                this.changeSlotEntry(KEY_SLOT_MAP[key], this.activeSlotsData[key]);
            }
        }
    }

    // Draw inhand item
    changeSlotEntry(name : string, props) {
        if (!name || !props) {
            return;
        }

        let {id} = props

        id = typeof id !== 'number' ? -1 : id;

        let slotLocation = null;
        for(let st of this.sceneTree) {
            slotLocation = st.findNode(name + 'ItemPlace');
            if(slotLocation) {
                break;
            }
        }

        if (!slotLocation) {
            return;
        }

        const slot = (this.slots[name] || (this.slots[name] = new ModelSlot(name, slotLocation)));

        if (id == slot.id && slot.holder.terrainGeometry) {
            return;
        }

        // destroy buffer
        if (slot.holder.terrainGeometry) {
            slot.holder.terrainGeometry.destroy();
            slot.holder.terrainGeometry = null;
        }

        slot.id = id;

        const arm_item_place_name = 'RightArmItemPlace'
        if(!this._mesh) {
            debugger
        }
        const mesh_modifiers = this._mesh.modifiers
        mesh_modifiers.hideGroup(arm_item_place_name)

        if (id === -1) {
            return;
        }

        const block = BLOCK.fromId(id)

        if(!block.spawnable && !NOT_SPAWNABLE_BUT_INHAND_BLOCKS.includes(block.name)) {
            return;
        }

        let item: Mesh_Object_Block_Drop = null

        try {
            item = new Mesh_Object_Block_Drop(this.world, null, null, [block], Vector.ZERO);
        } catch(e) {
            console.error(e)
            return
        }

        for(let mesh of item.mesh_group.meshes.values()) {
            slot.holder.terrainGeometry = mesh.buffer;
            slot.holder.material = mesh.material;
            break;
        }

        const is_left_arm        = name === 'LeftArm'
        const orient             = is_left_arm ? -1 : 1
        const bb_display         = block.bb?.model?.json?.display
        const bbmodel_hand       = (is_left_arm ? bb_display?.thirdperson_lefthand : bb_display?.thirdperson_righthand) ?? {}
        const orig_slot_position = slot.holder.orig_position || (slot.holder.orig_position = new Float32Array(slot.holder.position))

        const base = {
            scale:      new Float32Array([1, 1, 1]),
            // position:   new Float32Array(orig_slot_position), // внутрь туловища / от туловища; вдоль руки; над рукой
            // pivot:      new Float32Array([0, 0, -.5]),
            position:   new Float32Array([0, 0, 0]), // внутрь туловища / от туловища; вдоль руки; над рукой
            pivot:      new Float32Array([0, -.5, 0]),
            rotation:   new Float32Array([0, 0, 0]),
        }

        if(bb_display || !!block.bb) {
            // 1. position (1 = 1/16)
            // base.position[2] += .5
            if(bbmodel_hand.translation) {
                base.position[0] = bbmodel_hand.translation[0] / 16
                base.position[1] = bbmodel_hand.translation[1] / 16
                base.position[2] = bbmodel_hand.translation[2] / 16
            }
            // // 2. pivot
            // // 3. rotation (в градусах -180...180)
            if(bbmodel_hand.rotation) {
                base.rotation[0] = bbmodel_hand.rotation[0]
                base.rotation[1] = -bbmodel_hand.rotation[1]
                base.rotation[2] = -bbmodel_hand.rotation[2]
            }
            // 4. scale
            if(bbmodel_hand.scale) {
                base.scale.set(bbmodel_hand.scale)
            }
        } else {
            let { scale = 0.3 } = props
            // mc steve model
            // if (block.diagonal) {
            //     scale *= 1.2;
            //     base.rotation.set([10 * orient, -70, 90 + 10 * orient])
            // } else {
            //     base.rotation.set([20, 0, -20])
            // }
            // new model
            if (block.diagonal) {
                scale *= 1.2
                // x - вдоль
                // y - вокруг своей оси
                // z - другое
                base.rotation.set([42.5, 0, 90])
                base.pivot.set([.035, -.07, .35])
                base.position[1] += 1.5 / 16
            } else {
                base.rotation.set([0, 0, -30])
                base.pivot.set([0, 0, scale / 2])
            }
            base.scale.set([scale, scale, scale])
        }

        // apply modifies
        const matrix = mat4.create()
        const q = quat.create()
        quat.fromEuler(q, base.rotation[0], base.rotation[1], base.rotation[2], 'xyz')
        mat4.fromRotationTranslationScaleOrigin(matrix, q, base.position, base.scale, base.pivot)

        mesh_modifiers.showGroup(arm_item_place_name)
        mesh_modifiers.replaceGroupWithMesh(arm_item_place_name, item, matrix)

    }

    itsMe() : boolean {
        return this.id == Qubatch.App.session.user_id;
    }

    async loadModel(render : Renderer) {
        const img = await super.loadModel(render);
        if (this.itsMe()) {
            this.skinImage = img;
        }
    }

    postLoad(render : Renderer, tree : SceneNode) {
        super.postLoad(render, tree);

        for(let i = 0; i < tree.length; i++) {
            tree[i].scale.set([this.scale, this.scale, this.scale]);
        }

        if (this.nametag || !this.sceneTree) {
            return;
        }

        this.textCanvas                 = document.createElement('canvas');
        this.textCanvas.width           = 256;
        this.textCanvas.height          = 64;
        this.textCanvas.style.display   = 'none';
        // Create context used to draw name tags
        this.textContext                = this.textCanvas.getContext('2d');
        this.textContext.textAlign      = 'left';
        this.textContext.textBaseline   = 'top';
        this.textContext.font           = '24px Ubuntu';

        this.nametag = this.buildPlayerName(this.username, render);

        this.sceneTree[0].addChild(this.nametag);
        this.nametag.scale.set([0.005, 1, 0.005]);

        this.nametag.updateMatrix();

        this.changeSlots(this.activeSlotsData);
    }

    update(render : Renderer, camPos : Vector, delta : float, speed : float) {
        super.update(render, camPos, delta, speed)

        const angleToYaw = (angle) => {
            if (angle == 0) {
                return Math.PI
            }
            if (angle == 0.25) {
                return Math.PI / 2
            }
            if (angle == 0.5) {
                return 0
            }
            if (angle == 0.75) {
                return 3 * Math.PI / 2
            }
        }

        this.updateArmSwingProgress(delta);
        if (!this.isRenderable(render)) {
            return;
        }

        if (!this.nametag) {
            return;
        }

        this.nametag.visible = !this.sneak && !this.hide_nametag

        if (!this.nametag.visible || this.distance == null) {
            return;
        }

        const head_y =  (this.sceneTree[0].findNode('Head') || this.sceneTree[0].findNode('head')).pivot[2];
        if (this.sleep) {
            // Еесли игрок лежит подвинем ник игрока
            this.nametag.position[1] = 0.2
            this.nametag.position[2] = head_y + 0.4
        } else {
            this.nametag.position[2] = head_y + ((!this.armor.head) ? 0.6 : 0.8);
            this.nametag.position[1] = 0
        }

        const d = camPos.distance(this.pos);
        const dx = camPos.x - this.pos.x - this.nametag.position[1];
        const dy = camPos.y - this.pos.y - this.nametag.position[2];
        const dz = camPos.z - this.pos.z - this.nametag.position[0];
        const d2 = Math.hypot(dz, dx)
        const pitch = Math.PI / 2 - Math.atan2(d2, dy);
        const yaw = (this.sleep ? angleToYaw(this.sleep.rotate.z) : this.yaw) + Math.PI/2 + Math.atan2(dz, dx);

        const zoom = 0.005 * (d / 6);

        this.nametag.scale.set([zoom, 1, zoom]);

        quat.identity(this.nametag.quat);

        quat.rotateZ(this.nametag.quat,this.nametag.quat, yaw)
        quat.rotateX(this.nametag.quat,this.nametag.quat, pitch)

        this.nametag.updateMatrix();
    }

    /**
     * Returns the texture and vertex buffer for drawing the name
     * tag of the specified player over head.
     */
    buildPlayerName(username : string, render : Renderer) : SceneNode {
        username        = username.replace( /&lt;/g, "<" ).replace( /&gt;/g, ">" ).replace( /&quot;/, "\"" );

        let canvas      = this.textCanvas;
        let ctx         = this.textContext;
        let w           = ctx.measureText(username).width + 16;
        let h           = 45;
        // Draw text box
        ctx.fillStyle   = '#00000055';
        ctx.fillRect(0, 0, w, 45);
        ctx.fillStyle   = '#fff';
        ctx.font        = '24px Ubuntu';
        ctx.fillText(username, 10, 12);

        // abstraction
        const texture = render.renderBackend.createTexture({
            source: canvas,
        });

        // Create model
        const vertices = GeometryTerrain.convertFrom12([
            -w/2, 0, h / 2, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, h / 2, 0, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, -h / 2, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2, 0, -h / 2, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, -h / 2, w/256, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2, 0, h / 2, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
        ]);

        const node = new SceneNode();
        node.name = 'name_tag';
        node.terrainGeometry = new GeometryTerrain(vertices);
        node.terrainGeometry.changeFlags(QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.NO_AO | QUAD_FLAGS.NO_FOG);
        node.material = render.defaultShader.materials.label.getSubMat(texture);

        return node;
    }

    getArmSwingAnimationEnd() {
        return SWING_DURATION;
    }

    stopArmSwingProgress() {
        this.swingProgressInt = 0;
        this.isSwingInProgress = false;
    }

    startArmSwingProgress() {
        this.stopArmSwingProgress();
        this.isSwingInProgress = true;
    }

    // value: -1 ... 0 ... 1
    setBodyRotate(value) {
        this.body_rotate = value;
    }

    updateArmSwingProgress(delta) {
        const asa = this.getArmSwingAnimationEnd();
        // this.swingProgressPrev = this.animationScript.swingProgress;
        this.swingProgressPrev = this.swingProgress;
        if(this.isSwingInProgress) {
            this.swingProgressInt += HAND_ANIMATION_SPEED * delta / 1000;
            if (this.swingProgressInt >= asa) {
                this.swingProgressInt = 0;
                this.isSwingInProgress = false;
            }
        } else {
            this.swingProgressInt = 0;
        }
        // attackAnim
        // this.animationScript.isSwingInProgress = this.isSwingInProgress;
        this.swingProgress = this.swingProgressInt / asa;
        // this.animationScript.swingProgress = this.swingProgress;
    }

    setProps(pos: Vector, rotate: Vector, sneak: boolean, moving: boolean, running: boolean,
        hands: PlayerHands, lies: boolean, sitting: false | TSittingState,
        sleep: false | TSleepState, health?: number, on_ground: boolean = true): void {
        this.pos.copyFrom(pos);
        this.yaw = rotate.z; // around
        this.pitch = rotate.x; // head rotate
        this.sneak = sneak;
        this.moving = moving;
        this.running = running;
        this.lies = lies;
        this.sitting = sitting;
        this.sleep = sleep
        this.on_ground = on_ground
        //
        const current_right_hand_id = hands.right?.id;
        if(this.prev_current_id != current_right_hand_id) {
            this.prev_current_id = current_right_hand_id;
            this.activeSlotsData.right.id = current_right_hand_id;
            this.changeSlots(this.activeSlotsData);
        }
    }

    draw(render : Renderer, camPos : Vector, delta : float) {
        if(this.isAlive == false) {
            return;
        }
        if(!this.prev_pos) {
            this.prev_pos = this.pos.clone();
            return false;
        }
        const speed = Helpers.calcSpeed(this.prev_pos, this.pos, delta / 1000);
        this.prev_pos.copyFrom(this.pos);
        super.draw(render, camPos, delta, speed);
    }

    get isAlive() : boolean {
        return this.health > 0;
    }

}
