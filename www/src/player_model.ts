import { BLOCK } from "./blocks.js";
import { HAND_ANIMATION_SPEED, NOT_SPAWNABLE_BUT_INHAND_BLOCKS, PLAYER_HEIGHT, PLAYER_PHYSICS_HALF_WIDTH, PLAYER_ZOOM } from "./constant.js";
import { IndexedColor, QUAD_FLAGS, Vector} from './helpers.js';
import { MobModel } from "./mob_model.js";
import Mesh_Object_Block_Drop from "./mesh/object/block_drop.js";
import { Mesh_Object_Base } from "./mesh/object/base.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js"
import type { Renderer } from "./render.js";
import type { PlayerHands, TAnimState, TSittingState, TSleepState} from "./player.js";
import type { NetworkPhysicObjectState } from "./network_physic_object.js";
import type { World } from "./world.js";
import type { TMobProps } from "./mob_manager.js";
import {TerrainBaseTexture} from "./renders/TerrainBaseTexture.js";
import type {MeshBatcher} from "./mesh/mesh_batcher.js";
import type {LineGeometry} from "./geom/line_geometry.js";
import type {Camera_3d} from "./renders/camera_3d";

const { quat, mat4 } = glMatrix
const SWING_DURATION = 6

const KEY_SLOT_MAP = {
    left: 'LeftArmItemPlace',
    right: 'RightArmItemPlace'
};

export class ModelSlot {
    id: int = -1
    item?: Mesh_Object_Block_Drop
    hide = false   // true если слот скрыт из-за того, что игрок лежит или в вождении, скрывающим предметы

    constructor() {}

}

// An adapter that allows using ServerPlayer and PlayerModel in the same way
class PlayerModelSharedProps implements IPlayerSharedProps {
    p: PlayerModel;

    constructor(playerModel: PlayerModel) {
        this.p = playerModel;
    }

    // We don't know if it's alive on the client, so we assume if the model exists, than it is
    get isAlive()   : boolean   { return true; }
    get pos()       : IVector   { return this.p.pos; }
    get user_id()   : int       { return this.p.id; }
    get sitting()   : boolean   { return !!this.p.sitting; }
    get sleep()     : boolean   { return !!this.p.sleep; }
}

export class PlayerModel extends MobModel implements IPlayerOrModel {
    sharedProps:        PlayerModelSharedProps
    /**
     * Расстояние до игрока на сервере.
     * null передается когда игрок оказывается слишком далеко, после чего апдейты перестают приходить.
     * При создании игрока (и возможно в некоторых других ситуациях) - undefined.
     */
    distance:           number | null
    textCanvas:         HTMLCanvasElement
    textContext:        any
    slots:              Map<string, ModelSlot> = new Map()
    swingProgress:      float = 0
    swingProgressInt:   float = 0
    isSwingInProgress:  boolean = false
    scale:              float
    declare username:   string  // из props
    activeSlotsData
    head
    hide_nametag
    body_rotate
    swingProgressPrev
    prev_current_id
    prev_pos
    eat

    constructor(props : TMobProps, world : World) {
        super({
            type:       'player',
            skin:       null,
            animations: { reverseBack: true },
            ...props
        }, world)

        this.width              = PLAYER_PHYSICS_HALF_WIDTH * 2
        this.height             = PLAYER_HEIGHT
        this.scale              = 0.9 * PLAYER_ZOOM
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

        if (this.activeSlotsData) {
            for(const key in this.activeSlotsData) {
                this.changeSlotEntry(KEY_SLOT_MAP[key], this.activeSlotsData[key]);
            }
        }
    }

    // Draw inhand item
    changeSlotEntry(name : string, props : {id: int|null, scale: float|null}) {
        if (!name || !props || !Object.values(KEY_SLOT_MAP).includes(name)) {
            return
        }

        const hide = !!this.sleep || this.driving?.config.hideHandItem
        const block_id = props.id = typeof props.id !== 'number' ? -1 : props.id
        let slot : ModelSlot = this.slots.get(name)
        if(!slot) {
            slot = new ModelSlot()
            this.slots.set(name, slot)
        }

        if (block_id == slot.id && slot.item && slot.hide === hide) {
            return
        }

        // destroy buffer
        if (slot.item) {
            slot.item.mesh_group.destroy()
            // slot.item.destroy()
            slot.item = null
        }

        slot.id = block_id
        slot.hide = hide

        const mesh_modifiers = this._mesh.modifiers
        mesh_modifiers.hideGroup(name)

        if (block_id === -1 || hide) {
            return
        }

        const block = BLOCK.fromId(block_id)

        if(!block.spawnable && !NOT_SPAWNABLE_BUT_INHAND_BLOCKS.includes(block.name)) {
            return
        }

        slot.item = new Mesh_Object_Block_Drop(this.world, null, null, [block], Vector.ZERO)

        const is_right_arm       = name === KEY_SLOT_MAP.right
        const bb_display         = block.bb?.model?.json?.display
        const bbmodel_hand       = (is_right_arm ? bb_display?.thirdperson_righthand : bb_display?.thirdperson_lefthand) ?? {}
        // const orient             = is_right_arm ? -1 : 1

        const base = {
            scale:      new Float32Array([1, 1, 1]),
            position:   new Float32Array([0, 0, 0]),
            pivot:      new Float32Array([0, -.5, 0]),
            rotation:   new Float32Array([0, 0, 0]),
        }

        if(bb_display || block.bb) {
            // 1. position (1 = 1/16)
            if(bbmodel_hand.translation) {
                base.position[0] = bbmodel_hand.translation[0] / 16
                base.position[1] = bbmodel_hand.translation[1] / 16
                base.position[2] = -bbmodel_hand.translation[2] / 16
            }
            // 2. rotation (в градусах -180...180)
            if(bbmodel_hand.rotation) {
                base.rotation[0] = -bbmodel_hand.rotation[0]
                base.rotation[1] = -bbmodel_hand.rotation[1]
                base.rotation[2] = -bbmodel_hand.rotation[2]
            }
            // 3. scale
            if(bbmodel_hand.scale) {
                base.scale.set(bbmodel_hand.scale)
            }
        } else {
            let { scale = 0.3 } = props
            // new model
            if (block.diagonal) {
                scale *= 1.2
                base.rotation.set([42.5, 90, 0])
                base.position[1] += 1.5 / 16
                base.position[2] -= 3 / 16
            } else {
                base.rotation.set([0, -30, 0])
            }
            base.scale.set([scale, scale, scale])
        }

        // apply modifies
        const matrix = mat4.create()
        const q = quat.create()
        quat.fromEuler(q, base.rotation[0], base.rotation[1], base.rotation[2], 'xyz')
        mat4.fromRotationTranslationScaleOrigin(matrix, q, base.position, base.scale, base.pivot)

        mesh_modifiers.showGroup(name)
        mesh_modifiers.replaceGroupWithMesh(name, slot.item, matrix)

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

    update(meshBatcher: MeshBatcher, camPos : Vector, delta : float) {
        super.update(meshBatcher, camPos, delta)

        this.updateArmSwingProgress(delta)

        const nametag = this.nametag

        if(!this.isRenderable(meshBatcher)) {
            return
        }

        nametag.visible = !this.sneak && !this.hide_nametag

        if(!nametag.visible) {
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
        const texture = new TerrainBaseTexture({
            source: canvas,
        })

        //TODO: text should be rendered by special renderer in special layer
        // Create model
        const mesh = new Mesh_Object_Base()
        mesh.flags = QUAD_FLAGS.FLAG_NO_CAN_TAKE_LIGHT | QUAD_FLAGS.FLAG_NO_AO
            | QUAD_FLAGS.FLAG_NO_FOG | QUAD_FLAGS.FLAG_LOOK_AT_CAMERA;
        mesh.setVertices([
            0, 0, 0,
            w, 0, 0,
            0, 0, h,
            w/256 / 2, h/64 / 2, w/256, -h/64,
            IndexedColor.packArg(1, 1, 1), 0 //lm flags
        ])
        mesh.setGLMaterial(render.defaultShader.materials.label.getSubMat(texture))
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
    // setBodyRotate(value) {
    //     this.body_rotate = value;
    // }

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

    setProps(pos: IVector | null, rotate: IVector | null, sneak: boolean, running: boolean,
        hands: PlayerHands, sitting: false | TSittingState,
        sleep: false | TSleepState, anim : false | TAnimState, attack: false | TAnimState, fire: boolean, health?: number,
        on_ground: boolean = true, submergedPercent: float = 0,
    ): void {
        if (pos) {
            this.pos = pos
        }
        if (rotate) {
            this.yaw = rotate.z; // around
            this.pitch = rotate.x; // head rotate
        }
        const prevSleep = this.sleep // для проверки: если изменился sleep - скрыть/пказать предмет
        this.sneak = sneak;
        //this.moving = moving;
        this.running = running;
        this.sitting = sitting;
        this.anim = anim
        this.attack = attack
        this.fire = fire
        this.sleep = sleep
        this.ground = on_ground
        this.submergedPercent = submergedPercent
        this.health = health
        //
        const current_right_hand_id = hands.right?.id;
        if(this.prev_current_id != current_right_hand_id || prevSleep != sleep) {
            this.prev_current_id = current_right_hand_id;
            this.activeSlotsData.right.id = current_right_hand_id;
            this.changeSlots(this.activeSlotsData);
        }
    }

    draw(meshBatcher: MeshBatcher, camPos : Vector, delta : float, draw_debug_grid : boolean = false) : boolean {
        if(this.isAlive == false) {
            return false
        }
        if(!this.prev_pos) {
            this.prev_pos = this.pos.clone();
            return false
        }
        // speed = Helpers.calcSpeed(this.prev_pos, this.pos, delta / 1000);
        this.prev_pos.copyFrom(this.pos);
        super.draw(meshBatcher, camPos, delta, draw_debug_grid)
        return true
    }

    drawFishing(line_geom: LineGeometry, hook: MobModel, first_person_camera: Camera_3d)
    {
            //TODO: make multiplayer version!
            // if (item.id == bm.FISHING_ROD.id) {
        const slot = this.slots.get(KEY_SLOT_MAP.right);
        if (slot?.id !== this.world.block_manager.FISHING_ROD.id || !slot.item) {
            return;
        }
        let pos = new Vector();

        if (first_person_camera) {
            first_person_camera.calcNearPlanePosition(1.27, -0.3, pos);
            pos.addSelf(line_geom.pos);
        } else {
            // pos.copyFrom(slot.item.pos);
            if (!this._mesh) {
                pos.copyFrom(this.pos).addSelf(new Vector(0, 1.5, 0));
            } else {
                this.toGlobal(new Vector(0.33, 0.85, 0.65), pos);
            }
        }

        line_geom.addFishString(hook.pos, pos, { lineWidth: 0.13, colorABGR: 0xff000000 });
    }

    get isAlive() : boolean {
        return super.isAlive
    }

}
