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
import type { TMobProps } from "./mob_manager.js";
import { Mesh_Object_Base } from "./mesh/object/base.js";

const { quat, mat4 } = glMatrix
const SWING_DURATION = 6
const RIGHT_ARM_ITEM_PLACE_NAME = 'RightArmItemPlace'

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
    sharedProps:        PlayerModelSharedProps
    distance:           number | null
    textCanvas:         HTMLCanvasElement
    textContext:        any
    slots:              Dict<any> = {}
    swingProgress:      float = 0
    swingProgressInt:   float = 0
    isSwingInProgress:  boolean = false

    constructor(props : TMobProps, world : World) {
        super({type: 'player', skin: null, ...props}, world);

        this.height             = PLAYER_HEIGHT
        this.width              = PLAYER_WIDTH
        this.scale              = 0.9 * PLAYER_ZOOM
        this.username           = props.username
        this.health             = props.health
        this.activeSlotsData    = props.hands
        this.head               = null
        this.sharedProps        = new PlayerModelSharedProps(this)

        const render = Qubatch.render as Renderer
        this.postLoad(render)

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

        const mesh_modifiers = this._mesh.modifiers
        mesh_modifiers.hideGroup(RIGHT_ARM_ITEM_PLACE_NAME)

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

        mesh_modifiers.showGroup(RIGHT_ARM_ITEM_PLACE_NAME)
        mesh_modifiers.replaceGroupWithMesh(RIGHT_ARM_ITEM_PLACE_NAME, item, matrix)

    }

    itsMe() : boolean {
        return this.id == Qubatch.App.session.user_id;
    }

    postLoad(render : Renderer) {
        // TODO: need to call super?
        // super.postLoad(render)

        if (this.nametag) {
            return;
        }

        this.textCanvas                 = document.createElement('canvas');
        this.textCanvas.width           = 256;
        this.textCanvas.height          = 64;
        this.textCanvas.style.display   = 'none';
        this.textContext                = this.textCanvas.getContext('2d');
        this.textContext.textAlign      = 'left';
        this.textContext.textBaseline   = 'top';
        this.textContext.font           = '24px Ubuntu';

        this.nametag = this.buildPlayerName(this.username, render)
        const mesh_modifiers = this._mesh.modifiers
        mesh_modifiers.appendMeshToGroup('nameTagPlace', this.nametag)

        this.changeSlots(this.activeSlotsData)

    }

    update(render : Renderer, camPos : Vector, delta : float, speed : float) {
        super.update(render, camPos, delta, speed)

        this.updateArmSwingProgress(delta)

        const nametag = this.nametag

        if(!this.isRenderable(render)) {
            return
        }

        nametag.visible = !this.sneak && !this.hide_nametag

        if(!nametag.visible || this.distance == null) {
            return
        }

        // WARNING: Do not remove this code!
        // rotation
        // const angleToYaw = (angle) => {
        //     if (angle == 0) {
        //         return Math.PI
        //     } else if (angle == 0.25) {
        //         return Math.PI / 2
        //     } else if (angle == 0.5) {
        //         return 0
        //     } else if (angle == 0.75) {
        //         return 3 * Math.PI / 2
        //     }
        // }
        // const dx = camPos.x - this.pos.x - nametag.position[0]
        // const dy = camPos.y - this.pos.y - nametag.position[1]
        // const dz = camPos.z - this.pos.z - nametag.position[2]
        // const d2 = Math.hypot(dz, dx)
        // const pitch = (-Math.atan2(dy, d2)) / Math.PI * 180
        // const yaw = ((this.sleep ? angleToYaw(this.sleep.rotate.z) : this.yaw) + Math.atan2(dx, dz)) / Math.PI * 180 + 180
        // nametag.rotation.set([pitch, yaw, 0])

        // scale
        const scale = 0.005 * (camPos.distance(this.pos) / 6)
        nametag.scale.set([scale, scale, scale])

        // apply
        nametag.updateMatrix()

    }

    /**
     * Returns the texture and vertex buffer for drawing the name
     * tag of the specified player over head.
     */
    buildPlayerName(username : string, render : Renderer) : Mesh_Object_Base {

        username        = username.replace( /&lt;/g, "<" ).replace( /&gt;/g, ">" ).replace( /&quot;/, "\"" );

        const canvas    = this.textCanvas
        const ctx       = this.textContext
        const w         = ctx.measureText(username).width + 16
        const h         = 45

        // Draw text box
        ctx.fillStyle   = '#00000055'
        ctx.fillRect(0, 0, w, 45)
        ctx.fillStyle   = '#fff'
        ctx.font        = '24px Ubuntu'
        ctx.fillText(username, 10, 12)

        // abstraction
        const texture = render.renderBackend.createTexture({
            source: canvas,
        })

        // Create model
        const vertices = GeometryTerrain.convertFrom12([
            -w/2 * -1, 0, h / 2, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2 * -1, 0, h / 2, 0, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2 * -1, 0, -h / 2, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            w/2 * -1, 0, -h / 2, 0, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2 * -1, 0, -h / 2, w/256, h/64, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
            -w/2 * -1, 0, h / 2, w/256, 0, 1, 1, 1, 0.7, NORMALS.UP.x, NORMALS.UP.y, NORMALS.UP.z,
        ])

        const mesh = new Mesh_Object_Base()
        mesh.changeFlags(QUAD_FLAGS.NO_CAN_TAKE_LIGHT | QUAD_FLAGS.NO_AO | QUAD_FLAGS.NO_FOG | QUAD_FLAGS.LOOK_AT_CAMERA)
        mesh.setGLMaterial(render.defaultShader.materials.label.getSubMat(texture))
        mesh.setVertices(vertices as any)
        mesh.ignoreParentRotation = true

        return mesh

    }

    getArmSwingAnimationEnd() {
        return SWING_DURATION;
    }

    stopArmSwingProgress() {
        this.swingProgressInt = 0
        this.isSwingInProgress = false
    }

    startArmSwingProgress() {
        this.stopArmSwingProgress()
        this.isSwingInProgress = true
    }

    // value: -1 ... 0 ... 1
    setBodyRotate(value) {
        this.body_rotate = value;
    }

    updateArmSwingProgress(delta) {
        const asa = this.getArmSwingAnimationEnd();
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
        this.swingProgress = this.swingProgressInt / asa;
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
