import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import { Resources } from "./resources.js";
import { Color, Helpers, Vector } from "./helpers.js";
import { ChunkManager } from "./chunk_manager.js";
import { AABBDrawable, NetworkPhysicObject } from './network_physic_object.js';
import { MOB_TYPE } from "./constant.js";
import { Mesh_Object_MobFire } from "./mesh/object/mob_fire.js";
import type { Renderer } from "./render.js";
import type { World } from "./world.js";
import type { ArmorState, TAnimState, TSittingState, TSleepState } from "./player.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import type {TMobAnimations, TMobProps} from "./mob_manager.js";
import type { Mesh_Object_Base } from "./mesh/object/base.js";
import type {ClientDriving} from "./control/driving.js";
import { CD_ROT } from "./core/CubeSym.js";
import type {MeshBatcher} from "./mesh/mesh_batcher.js";

const MAX_CHESTPLATE_COUNT = 6
const MAX_LEG_COUNT = 10
const MAX_BOOTS_COUNT = 10

const {mat4, vec3} = glMatrix

const color_trnsparent = new Color(0, 0, 0, 0)

// Анимация повороа говоры отдельно от тела, нужно перенести в bbmodel
// head({part, index, delta, animable, camPos}) {
//     let {
//         yaw, pos, targetLook = 0
//     } = animable;
//     // Head to camera rotation
//     let angToCam = 0;
//     if (Helpers.distance(pos, camPos) < 5) {
//         angToCam = yaw  -Math.PI/2  + Math.atan2(camPos.z - pos.z, camPos.x - pos.x);
//         while(angToCam > Math.PI) angToCam -= Math.PI * 2;
//         while(angToCam < -Math.PI) angToCam += Math.PI * 2;
//         if (Math.abs(angToCam) >= Math.PI / 4) {
//             angToCam = 0;
//         }
//     }
//     if (Math.abs(angToCam - targetLook) > 0.05) {
//         targetLook += Math.sign(angToCam - targetLook) * 0.05;
//     }
//     quat.fromEuler(part.quat, 0, 0, 180 * targetLook / Math.PI);
//     if (animable.sleep) {
//         quat.rotateX(part.quat, part.quat, -Math.PI / 2)
//     }
//     part.updateMatrix();
//     animable.targetLook = targetLook;
// }

export class MobModel extends NetworkPhysicObject {
    id:                 int
	texture :           any = null
	material :          any = null
	raycasted :         boolean = false
	moving_timeout :    any = false
	nametag:            Mesh_Object_Base | null
	aniframe :          int = 0
	width :             int = 0
	height :            int = 0
	//on_ground :         boolean = true
	type :              string
	skin :              any
	targetLook :        float = 0
	currentChunk :      any = null
	lightTex :          any = null
	armor :             ArmorState = null
	// sneak:              boolean = false
	// body_rotate:        int = 0
	// models:             Map<string, any> = new Map()
	// fix_z_fighting:     float = Math.random() / 100
	// drawPos:            Vector = new Vector(0, 0, 0)
	// posDirty:           boolean = true
	prev :              any = {
                            head: null,
                            body: null,
                            leg: null,
                            boot: null,
                            skin: null,
                            backpack: null
                        }
    slots:              any
    tmpDrawPos?:        Vector
    drawPos?:           Vector
    draw_yaw?:          float
    sleep?:             false | TSleepState = false
    sitting?:           false | TSittingState = false
    aabb:               AABBDrawable = null
    _mesh:              Mesh_Object_BBModel
    _fire_mesh:         any
    anim?:              false | TAnimState = false
    fire?:              boolean = false
    attack?:            false | TAnimState = false
    ground:             boolean = true
    submergedPercent:   float = 0   // на какую долю погруен в жидкость, от 0 до 1. Это значение неточное, на основе другого AABB! (как в физике)
    running:            boolean = false
    driving?:           ClientDriving | null
    hasUse?:            boolean     // см. TMobConfig.hasUse
    supportsDriving?:   boolean
    animations?:        TMobAnimations
    textures :          Map<string, any> = new Map()

    is_sheared:         boolean = false
    gui_matrix:         float[]
    renderLast:         boolean
    hasSwimAnim:        boolean
    hasFastSwimAnim:    boolean
    hasIdleSwim:        boolean
    opacity:            float = 1

    #health: number = 100
    #timer_demage: number

    constructor(props : TMobProps, world : World) {

        super(world, new Vector(props.pos), new Vector(props.rotate))

        Object.assign(this, props)
        this.updateAABB()   // у моба, который не движется, может долго автоматически не обновляться AABB

        this.type = props.skin.model_name
        this.skin = props.skin

        this.renderLast = (this.type === MOB_TYPE.BOAT) // рисовать лодку после всех для спец. реима воды

        // load mesh
        const model = Resources._bbmodels.get(this.skin.model_name)
        if(!model) {
            console.error(`error_model_not_found|${this.skin.model_name}`, props)
            debugger
        }
        this._mesh = new Mesh_Object_BBModel(this.world, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model, undefined, true, true)
        if(this.skin.texture_name) {
            this._mesh.modifiers.selectTextureFromPalette('', this.skin.texture_name)
        }

        this.hasSwimAnim        = this._mesh.model.animations.has('swim')
        this.hasFastSwimAnim    = this._mesh.model.animations.has('fast_swim')
        this.hasIdleSwim        = this._mesh.model.animations.has('idle_swim')
    }

    /** Мы не можем использовать в этом файле instanceof PlayerModel, т.к. не можем его испортировать из-за циклической зависимости*/
    get isPlayer(): boolean { return (this as any).username != null }

    /**
     * Семантика переопредленного метода:
     * 1. Если нет вождения, или в нем не хвататет главного участника, то просто вызывается родительский метод.
     * 2. Иначе:
     * 2.1 Если эта модель задает позиции другим, то вызвать родительский метод и обновить другие модели на основе этой этой
     * 2.2 Если есть кто-то другой главный в вождении (другая модель или свой игрок), то ничего не происходит
     */
    processNetState(): void {
        const driving = this.driving
        const positionProvider = driving?.providesPosition()
        if (positionProvider) {
            if (positionProvider === this) {
                // обработать новую позицию, и применить ее ко всем участникам движения
                super.processNetState()
                driving.updateInterpolatedStateFromVehicle(this)
                driving.applyInterpolatedStateToDependentParticipants()
                return
            } else if (positionProvider) {
                // есть кто-то другой, кто задает позицию этой модели; обработать только extra_data, если оно есть
                this.forceLocalUpdate(null, null)
                return
            }
            // нет никого другого, кто задает позицию этой модели; обработать ее как обычно
        }
        super.processNetState()
    }

    set health(val: number) {
        if (this.#health - val > 0) {
            this.#timer_demage = performance.now() + 200
        }
        this.#health = val
    }

    isRenderable(meshBatcher: MeshBatcher) : boolean {
        return (
             !this.currentChunk ||
             (this.currentChunk.cullID === meshBatcher.render.cullID)
         )
    }

    get isAlive() : boolean {
        return this.#health > 0
    }

    computeLocalPosAndLight(delta : float) {

        const newChunk = this.world.chunkManager.getChunk(this.chunk_addr);
        const mesh = this._mesh
        if(mesh) {
            // mesh.gl_material.changeLighTex(this.lightTex)
            // mesh.gl_material.lightTex = this.lightTex
            if (this.#timer_demage > performance.now()) {
                mesh.gl_material.tintColor = new Color(1, 0, 0, .3)
            } else {
                // Negative alpha is specially processed in the shader
                // It is used to set the opacity for the material
                mesh.gl_material.tintColor = this.opacity ? new Color(0, 0, 0, -this.opacity) : color_trnsparent
            }

        }

        // if (this.material) {
        //     this.material.lightTex = this.lightTex;
        //     this.material.tintColor = this.tintColor;
        //     // TODO: refactor this!
        //     if (this.slots && this.slots.RightArm && this.slots.RightArm.holder
        //         && this.slots.RightArm.holder.material) {
        //         this.slots.RightArm.holder.material.lightTex = this.lightTex;
        //     }
        // }

        if (newChunk) {
            this.currentChunk = newChunk;
            this.drawPos = newChunk.coord;
        } else {
            this.tmpDrawPos = this.tmpDrawPos ?? new Vector();
            this.drawPos = this.tmpDrawPos;
            this.world.chunkManager.grid.chunkAddrToCoord(this.chunk_addr, this.drawPos);
        }

        const yaw = this.yaw;
        if(typeof this.draw_yaw == 'undefined' || this.driving?.isModelDependent(this)) {
            // если эта модель зависит от вождения, то использовать ее yaw без дополнительных изменений, чтобы не отличался от связанных моделей
            this.draw_yaw = yaw
        } else {
            this.draw_yaw %= Math.PI * 2;
            while (this.draw_yaw > yaw + Math.PI) {
                this.draw_yaw -= 2 * Math.PI;
            }
            while (this.draw_yaw < yaw - Math.PI) {
                this.draw_yaw += 2 * Math.PI;
            }
            //TODO : move this to exp interpolation function
            this.draw_yaw = yaw + (this.draw_yaw - yaw) * Math.exp(delta / 16 * Math.log(1 - 0.2));
            if (Math.abs(this.draw_yaw - yaw) < 0.05) {
                this.draw_yaw = yaw;
            }
        }

    }

    update(_meshBatcher?: MeshBatcher, camPos? : Vector, delta? : float) {
        super.update()
        this.computeLocalPosAndLight(delta)
    }

    isDetonationStarted() : boolean {
        return this.extra_data?.detonation_started || false
    }

    /**
     * Draw mob model
     */
    draw(meshBatcher: MeshBatcher, camPos : Vector, delta : float, draw_debug_grid : boolean = false) : boolean {
        if(!this.isAlive) {
            return false
        }

        this.update(meshBatcher, camPos, delta);

        // TODO: need to migrate to bbmodels
        // // ignore_roots
        // const ignore_roots = [];
        // if(this.type == MOB_TYPE.SHEEP && this.extra_data?.is_sheared) {
        //     ignore_roots.push('geometry.sheep.v1.8:geometry.sheep.sheared.v1.8');
        // }

        let mx = null
        const mesh = this._mesh

        // hide invisible mobs
        if(this.extra_data && 'invisible' in this.extra_data) {
            if(this.extra_data.invisible) {
                mesh.destroyBlockDrawer()
                return false
            } else {
                if(this.extra_data.blocks) {
                    mesh.setupBlockDrawer(this.extra_data.blocks)
                    let rotate = this.extra_data.rotate
                    if(rotate) {
                        rotate = new Vector().copyFrom(rotate)
                        mx = mat4.create()
                        switch(rotate.x) {
                            case CD_ROT.EAST:
                            case CD_ROT.WEST: {
                                mat4.rotateX(mx, mx, mesh.rotation[2])
                                break
                            }
                            case CD_ROT.SOUTH:
                            case CD_ROT.NORTH: {
                                mat4.rotateZ(mx, mx, mesh.rotation[2])
                                break
                            }
                            default: {
                                mat4.rotateY(mx, mx, mesh.rotation[2])
                                break
                            }
                        }
                        // хак со сдвигом матрицы в центр блока
                        const v = vec3.create()
                        v[1] = 0.5
                        vec3.transformMat4(v, v, mx)
                        mx[12] += - v[0]
                        mx[13] += 0.5 - v[1]
                        mx[14] += - v[2]
                    }
                }
            }
        }

        // Draw in fire
        if (this.fire || this.extra_data?.in_fire) {
            this.drawInFire(meshBatcher, delta);
        }

        // Draw AABB wireframe
        if(this.aabb && draw_debug_grid) {
            this.aabb.draw(meshBatcher, this.pos, delta, true /*this.raycasted*/ );
        }

        if(mesh) {
            this.doAnims();
            if(!mesh.apos) {
                debugger
            }
            mesh.apos.copyFrom(this.pos)
            mesh.drawBuffered(meshBatcher, delta, mx)
            if(mesh.gl_material.tintColor) {
                mesh.gl_material.tintColor.set(0, 0, 0, 0)
                mesh.gl_material.tintColor = mesh.gl_material.tintColor
            }
        }

        return true
    }

    doAnims() {
        const mesh = this._mesh;
        if(this.type == MOB_TYPE.SHEEP) {
            if (this.extra_data?.is_sheared) {
                mesh.modifiers.hideGroup('wool')
            } else {
                mesh.modifiers.showGroup('wool')
            }
        }
        this.setArmor()
        const attack = this?.extra_data?.attack ? this.extra_data.attack : this.attack
        if (this.sleep) {
            const rot = this.sleep.rotate.z * 2 * Math.PI
            mesh.rotation[2] = rot % Math.PI ? rot : rot + Math.PI
            mesh.setAnimation('sleep')
        } else {
            mesh.rotation[2] = this.draw_yaw ?? 0
            const animations = this.animations
            const driving = this.driving
            const vehicleModel = driving?.getVehicleModel()
            const vehicleAnimation = driving?.config.vehicleAnimation
            let anim: string | null = null
            if (driving && this !== vehicleModel) { // если водитель
                const srcModel = vehicleModel ?? this   // модель от которой берется moving и rotationSign
                const driverAnimation = driving.config.driverAnimation
                if (srcModel.moving) {
                    if (srcModel.moving === -1) {
                        anim = driverAnimation?.walkBack
                    }
                    anim ??= driverAnimation?.walk
                } else if (srcModel.rotationSign === -1) {
                    anim = driverAnimation?.rotateLeft
                } else if (srcModel.rotationSign === 1) {
                    anim = driverAnimation?.rotateRight
                } else {
                    anim = driverAnimation?.idle
                }
                mesh.setAnimation(anim ?? 'sitting')
            } else if (this.sitting) {
                mesh.setAnimation('sitting')
            } else if (this?.extra_data?.attack || this.attack) {
                mesh.setAnimation('attack')
            } else if (!this.ground && this.submergedPercent === 1 && this.hasSwimAnim) { // плавание (если есть такая анимация)
                if (this.running) {
                    anim = this.hasFastSwimAnim ? 'fast_swim' : 'swim*1.5'
                } else if (this.moving || this.movingY === 1) {
                    anim = 'swim'
                } else if (this.hasIdleSwim) {
                    anim = 'idle_swim'
                }
                mesh.setAnimation(anim ?? 'jump')
            } else if (!this.ground && !animations?.noAirborne) { // прыжок или полет (в том числе в жидкости)
                if (animations?.fly) {
                    if (!this.moving) {     // более медленные анимации если полет вниз или на месте
                        switch (this.movingY) {
                            case -1: anim = animations.flyDown;    break
                            case 0:  anim = animations.flyIdle;    break
                        }
                    }
                    anim ??= this.animations.fly
                }
                mesh.setAnimation(anim ?? 'jump')
            } else if (this.moving) {
                const reverse = this.moving === -1 && this.animations?.reverseBack
                if (this.sneak) {
                    anim = reverse ? '-sneak' : 'sneak'
                } else if (!this.running) {
                    if (this === vehicleModel) {
                        if (this.moving === -1) {
                            anim = vehicleAnimation?.walkBack
                        }
                        anim ??= vehicleAnimation?.walk
                    }
                    anim ??= reverse ? '-walk' : 'walk'
                } else {
                    anim = reverse ? '-run' : 'run'
                }
                mesh.setAnimation(anim)
            } else if (this.sneak) {
                mesh.setAnimation('sneak_idle')
            } else  if (this.anim) {
                mesh.setAnimation(this.anim.title)
            } else { // idle
                if (this === vehicleModel) {
                    if (this.rotationSign === -1) {
                        anim = vehicleAnimation?.rotateLeft
                    } else if (this.rotationSign === 1) {
                        anim = vehicleAnimation?.rotateRight
                    }
                    if (driving.hasDriverOrPassenger()) {
                        anim ??= vehicleAnimation?.idleNotEmpty
                    }
                }
                mesh.setAnimation(anim ?? 'idle')
            }
        }
    }

    updateArmor() {
        Qubatch.player.updateArmor()
    }

    drawInGui(meshBatcher: MeshBatcher, delta : float) {
        this.update(meshBatcher, new Vector(), delta);
        const mesh = this._mesh;
        if (mesh) {
            this.doAnims();
            mesh.apos.copyFrom(Vector.ZERO);
            mesh.rotation[2] = (this.sleep ? 0 : 15) / 180 * -Math.PI
            mesh.drawBuffered(meshBatcher, delta)
        }
    }

    drawInFire(meshBatcher: MeshBatcher, delta : float) {
        if(this._fire_mesh) {
            this._fire_mesh.yaw = Math.PI - Helpers.angleTo(this.pos, meshBatcher.render.camPos);
            this._fire_mesh.apos.copyFrom(this.pos);
            this._fire_mesh.draw(meshBatcher, delta);
        } else {
            this._fire_mesh = new Mesh_Object_MobFire(this, this.world)
        }
    }

    onUnload() {
        if(this._fire_mesh) {
            this._fire_mesh.destroy();
        }
    }

    // установка армора
    setArmor() {

        const armor = (this.extra_data?.armor) ? this.extra_data.armor : this.armor
        if (!armor) {
            return
        }

        const block = Qubatch.world.block_manager

        // helmet
        if (armor.head != this.prev.head) {
            if (armor.head) {
                const item = block.fromId(armor.head)
                this._mesh.modifiers.replaceGroup('helmet', item.model.name, item.model.texture)
                this._mesh.modifiers.showGroup('helmet')
            } else {
                this._mesh.modifiers.hideGroup('helmet')
            }
            this.prev.head = armor.head
        }

        // chestplates
        if (armor.body != this.prev.body) {
            if (armor.body) {
                const item = block.fromId(armor.body)
                for (let i = 0; i < MAX_CHESTPLATE_COUNT; i++) {
                    this._mesh.modifiers.replaceGroup(`chestplate${i}`, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup(`chestplate${i}`)
                }
            } else {
                for (let i = 0; i < MAX_CHESTPLATE_COUNT; i++) {
                    this._mesh.modifiers.hideGroup(`chestplate${i}`)
                }
            }
            this.prev.body = armor.body
        }

        // pants
        if (armor.leg != this.prev.leg) {
            if (armor.leg) {
                const item = block.fromId(armor.leg)
                for (let i = 0; i < MAX_LEG_COUNT; i++) {
                    this._mesh.modifiers.replaceGroup(`pants${i}`, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup(`pants${i}`)
                }
            } else {
                for (let i = 0; i < MAX_LEG_COUNT; i++) {
                    this._mesh.modifiers.hideGroup(`pants${i}`)
                }
            }
            this.prev.leg = armor.leg
        }

        // boots
        if (armor.boot != this.prev.boot) {
            if (armor.boot) {
                const item = block.fromId(armor.boot)
                for (let i = 0; i < MAX_BOOTS_COUNT; i++) {
                    this._mesh.modifiers.replaceGroup(`boots${i}`, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup(`boots${i}`)
                }
            } else {
                for (let i = 0; i < MAX_BOOTS_COUNT; i++) {
                    this._mesh.modifiers.hideGroup(`boots${i}`)
                }
            }
            this.prev.boot = armor.boot
        }

        // backpack
        if (armor.backpack != this.prev.backpack) {
            if (armor.backpack) {
                const item = block.fromId(armor.backpack)
                this._mesh.modifiers.replaceGroup('backpack', item.model.name, item.model.texture)
                this._mesh.modifiers.showGroup('backpack')
            } else {
                this._mesh.modifiers.hideGroup('backpack')
            }
            this.prev.backpack = armor.backpack
        }

    }

    postLoad(render : Renderer) {}

}