import { BLOCK } from "./blocks.js";
import { HAND_ANIMATION_SPEED, HEAD_MAX_ROTATE_ANGLE, NOT_SPAWNABLE_BUT_INHAND_BLOCKS, PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_ZOOM } from "./constant.js";
import GeometryTerrain from "./geometry_terrain.js";
import { Helpers, NORMALS, QUAD_FLAGS, Vector } from './helpers.js';
import { MobAnimation, MobModel } from "./mob_model.js";
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { SceneNode } from "./SceneNode.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import type { Renderer } from "./render.js";
import type { ArmorState, PlayerHands, PlayerStateUpdate } from "./player.js";
import type { NetworkPhysicObjectState } from "./network_physic_object.js";

const { quat } = glMatrix;
const SWING_DURATION = 6;

const KEY_SLOT_MAP = {
    left: 'LeftArm',
    right: 'RightArm'
};

const setFromUnitVectors = (q, vFrom, vTo ) => {

    // assumes direction vectors vFrom and vTo are normalized
    vFrom = vFrom.normalize();
    vTo = vTo.normalize();

    let r = vFrom.dot( vTo ) + 1;

    if ( r < Number.EPSILON ) {

        // vFrom and vTo point in opposite directions

        r = 0;

        if ( Math.abs( vFrom.x ) > Math.abs( vFrom.z ) ) {

            q[0] = - vFrom.y;
            q[1] = vFrom.x;
            q[2] = 0;
            q[3] = r;

        } else {

            q[0] = 0;
            q[1] = - vFrom.z;
            q[2] = vFrom.y;
            q[3] = r;

        }

    } else {

        q[0] = vFrom.y * vTo.z - vFrom.z * vTo.y;
        q[1] = vFrom.z * vTo.x - vFrom.x * vTo.z;
        q[2] = vFrom.x * vTo.y - vFrom.y * vTo.x;
        q[3] = r;

    }

    quat.normalize(q, q);

    return q;
}

export class ModelSlot {
    [key: string]: any;
    constructor(name = '', parent = null) {
        /**
         * @type { SceneNode }
         */
        this.holder = new SceneNode(parent);
        this.holder.position.set(parent.pivot);

        this.id = -1;

        this.name = name;

        this.holder.updateMatrix();
    }
}

export class PlayerAnimation extends MobAnimation {
    [key: string]: any;

    head({
        part, animable
    }) {
        let pitch = animable.pitch;

        if(pitch < -0.5) {
            pitch = -0.5;
        }

        if(pitch > 0.5) {
            pitch = 0.5;
        }

        const yaw = animable.body_rotate * HEAD_MAX_ROTATE_ANGLE;

        quat.fromEuler(part.quat, -pitch * 90, 0, yaw);

        part.updateMatrix();
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
    get sitting()   : boolean   { return this.p.sitting; }
}

export class PlayerModel extends MobModel implements IPlayerOrModel {
    [key: string]: any;

    sharedProps: PlayerModelSharedProps
    armor: ArmorState
    height: number

    constructor(props) {
        super({type: 'player', skin: '1', ...props});

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

        this.animationScript = new PlayerAnimation();

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

    changeSlotEntry(name, props) {
        if (!name || !props) {
            return;
        }

        let {
            id, scale = 0.3
        } = props;

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

        if (slot.holder.terrainGeometry) {
            slot.holder.terrainGeometry.destroy();
            slot.holder.terrainGeometry = null;
        }

        slot.id = id;

        if (id === -1) {
            return;
        }

        const block = BLOCK.fromId(id);

        if(!block.spawnable && !NOT_SPAWNABLE_BUT_INHAND_BLOCKS.includes(block.name)) {
            return;
        }

        let item;

        try {
            item = new Mesh_Object_Block_Drop(null, null, [block], Vector.ZERO);
        } catch(e) {
            console.error(e)
        }

        if (!item) {
            return;
        }

        // slot.holder.terrainGeometry = item.buffer;
        // slot.holder.material = item.material;
        for(let mesh of item.mesh_group.meshes.values()) {
            slot.holder.terrainGeometry = mesh.buffer;
            slot.holder.material = mesh.material;
            break;
        }

        const orient = name === 'LeftArm' ? -1 : 1;

        if (block.diagonal) {
            scale *= 1.2;

            quat.fromEuler(slot.holder.quat, 10 * orient, -70, 90 + 10 * orient);

        } else {
            quat.fromEuler(slot.holder.quat, 20, 0, -20);
        }

        slot.holder.scale.set([scale, scale, scale]);
        slot.holder.pivot.set([0, 0, scale / 2]);
        slot.holder.updateMatrix();
    }

    itsMe() {
        return this.id == Qubatch.App.session.user_id;
    }

    async loadModel(render) {
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
        // console.log(this.armor.head)
    }

    update(render, camPos, delta, speed) {
        super.update(render, camPos, delta, speed);

        this.updateArmSwingProgress(delta);
        if (!this.isRenderable) {
            return;
        }

        if (!this.nametag) {
            return;
        }

        this.nametag.visible = !this.sneak && !this.hide_nametag;
        const head_y =  (this.sceneTree[0].findNode('Head') || this.sceneTree[0].findNode('head')).pivot[2];
        this.nametag.position[2] =  head_y + ((!this.armor.head) ? 0.6 : 0.8);

        if (!this.nametag.visible) {
            return;
        }

        const d = camPos.distance(this.pos);
        const dx = camPos.x - this.pos.x;
        const dy = camPos.y - this.pos.y - this.nametag.position[2];
        const dz = camPos.z - this.pos.z;
        const d2 = Math.hypot(dz, dx)
        const pitch = Math.PI / 2 - Math.atan2(d2, dy);
        const yaw = this.yaw + Math.PI/2 + Math.atan2(dz, dx);

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
     * @param {string} username
     * @param render
     * @return {{texture: BaseTexture, model: GeometryTerrain}}
     */
    buildPlayerName(username, render) {
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
        this.swingProgressPrev = this.animationScript.swingProgress;
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
        this.animationScript.isSwingInProgress = this.isSwingInProgress;
        this.swingProgress = this.swingProgressInt / asa;
        this.animationScript.swingProgress = this.swingProgress;
    }

    setProps(pos: Vector, rotate: Vector, sneak: boolean, moving: boolean, running: boolean,
        hands: PlayerHands, lies: boolean, sitting: boolean, health?: number): void {
        this.pos.copyFrom(pos);
        this.yaw = rotate.z; // around
        this.pitch = rotate.x; // head rotate
        this.sneak = sneak;
        this.moving = moving;
        this.running = running;
        this.lies = lies;
        this.sitting = sitting;
        //
        const current_right_hand_id = hands.right?.id;
        if(this.prev_current_id != current_right_hand_id) {
            this.prev_current_id = current_right_hand_id;
            this.activeSlotsData.right.id = current_right_hand_id;
            this.changeSlots(this.activeSlotsData);
        }
    }

    draw(render, camPos, delta) {
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
