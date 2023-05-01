import { Resources } from "./resources.js";
import { Color, Vector } from "./helpers.js";
import { ChunkManager } from "./chunk_manager.js";
import { AABBDrawable, NetworkPhysicObject } from './network_physic_object.js';
import { MOB_TYPE, MOUSE } from "./constant.js";
import { Mesh_Object_MobFire } from "./mesh/object/mob_fire.js";
import type { Renderer } from "./render.js";
import type { World } from "./world.js";
import type { ArmorState, TAnimState, TSittingState, TSleepState } from "./player.js";
import { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";
import type { TMobProps } from "./mob_manager.js";
import type { Mesh_Object_Base } from "./mesh/object/base.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"

const {mat4} = glMatrix

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
                            skin: null
                        }
    extra_data:         any
    slots:              any
    tmpDrawPos:         any
    yaw:                float
    draw_yaw?:          float
    sleep?:             false | TSleepState
    sitting?:           false | TSittingState
    aabb:               AABBDrawable = null
    _mesh:              Mesh_Object_BBModel
    _fire_mesh:         any
    anim?:              false | TAnimState 
    ground:             boolean = true
    running:            boolean = false
    textures :          Map<string, any> = new Map()

    is_sheared:         boolean = false
    gui_matrix:         float[]

    #health: number = 100
    #timer_demage: number

    constructor(props : TMobProps, world : World) {

        super(world, new Vector(0, 0, 0), new Vector(0, 0, 0))

        Object.assign(this, props)

        this.type = props.skin.model_name
        this.skin = props.skin

        // load mesh
        const render = Qubatch.render as Renderer
        const model = Resources._bbmodels.get(this.skin.model_name)
        if(!model) {
            console.error(`error_model_not_found|${this.skin.model_name}`, props)
            debugger
        }
        this._mesh = new Mesh_Object_BBModel(render, new Vector(0, 0, 0), new Vector(0, 0, -Math.PI/2), model, undefined, true)
        if(this.skin.texture_name) {
            this._mesh.modifiers.selectTextureFromPalette('', this.skin.texture_name)
        }

    }

    set health(val: number) {
        if (this.#health - val > 0) {
            this.#timer_demage = performance.now() + 200
        }
        this.#health = val
    }

    isRenderable(render: Renderer) : boolean {
        return (
             !this.currentChunk ||
             (this.currentChunk.cullID === render.cullID)
         )
    }

    get isAlive() : boolean {
        return this.#health > 0
    }

    computeLocalPosAndLight(render : Renderer, delta : float) {

        const newChunk = ChunkManager.instance?.getChunk(this.chunk_addr);

        this.lightTex = newChunk && newChunk.getLightTexture(render.renderBackend)

        const mesh = this._mesh
        if(mesh && this.lightTex) {
            // mesh.gl_material.changeLighTex(this.lightTex)
            // mesh.gl_material.lightTex = this.lightTex
            if (this.#timer_demage > performance.now()) {
                mesh.gl_material.tintColor = new Color(1, 0, 0, .3) 
            } else {
                mesh.gl_material.tintColor = new Color(0, 0, 0, 0)
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
        if(typeof this.draw_yaw == 'undefined') {
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

    update(render? : Renderer, camPos? : Vector, delta? : float, speed? : float) {
        super.update()
        this.computeLocalPosAndLight(render, delta)
    }

    isDetonationStarted() : boolean {
        return this.extra_data?.detonation_started || false
    }

    /**
     * Draw mob model
     */
    draw(render : Renderer, camPos : Vector, delta : float, speed? : float, draw_debug_grid : boolean = false) {
        if(!this.isAlive) {
            return false
        }
        
        this.update(render, camPos, delta, speed);

        // TODO: need to migrate to bbmodels
        // // ignore_roots
        // const ignore_roots = [];
        // if(this.type == MOB_TYPE.SHEEP && this.extra_data?.is_sheared) {
        //     ignore_roots.push('geometry.sheep.v1.8:geometry.sheep.sheared.v1.8');
        // }

        // Draw in fire
        if(this.extra_data?.in_fire) {
            this.drawInFire(render, delta);
        }

        // Draw AABB wireframe
        if(this.aabb && draw_debug_grid) {
            this.aabb.draw(render, this.tPos, delta, true /*this.raycasted*/ );
        }

        const mesh = this._mesh

        if(mesh) {
            this.doAnims();
            if(!mesh.apos) {
                debugger
            }
            mesh.apos.copyFrom(this._pos)
            mesh.drawBuffered(render, delta)
        }
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
        if (this.sleep) {
            const rot = this.sleep.rotate.z * 2 * Math.PI
            mesh.rotation[2] = rot % Math.PI ? rot : rot + Math.PI
            mesh.setAnimation('sleep')
        } else {
            mesh.rotation[2] = this.draw_yaw ? this.draw_yaw : 0
            if (this.sitting) {
                mesh.setAnimation('sitting')
            } else if (!this.ground) {
                mesh.setAnimation('jump')
            } else if (this.moving) {
                if (this.sneak) {
                    mesh.setAnimation('sneak')
                } else if (!this.running) {
                    mesh.setAnimation('walk')
                } else {
                    mesh.setAnimation('run')
                }
            } else if (this.sneak) {
                mesh.setAnimation('sneak_idle')
            } else if (this.anim) {
                mesh.setAnimation(this.anim.title)
            } else {
                mesh.setAnimation('idle')
            }
        }
    }
    
    updateArmor() {
        Qubatch.player.updateArmor()
    }

    drawInGui(render : Renderer, delta : float) {
        this.update(render, new Vector(), delta, 0);
        const mesh = this._mesh;
        if (mesh) {
            this.doAnims();
            mesh.apos.copyFrom(Vector.ZERO);
            mesh.rotation[2] = (this.sleep ? 0 : 15) / 180 * -Math.PI
            mesh.drawBuffered(render, delta)
        }
    }

    drawInFire(render : Renderer, delta : float) {
        if(this._fire_mesh) {
            this._fire_mesh.yaw = Math.PI - this.angleTo(this.pos, render.camPos);
            this._fire_mesh.apos.copyFrom(this.pos);
            this._fire_mesh.draw(render, delta);
        } else {
            this._fire_mesh = new Mesh_Object_MobFire(this, this.world)
        }
    }

    angleTo(pos : Vector, target : Vector) {
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle - 2 * Math.PI;
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

        if (armor.body != this.prev.body) {
            if (armor.body) {
                const item = block.fromId(armor.body)
                for (let i = 0; i < 6; i++) {
                    this._mesh.modifiers.replaceGroup('chestplate' + i, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup('chestplate' + i)
                }
            } else {
                for (let i = 0; i < 6; i++) {
                    this._mesh.modifiers.hideGroup('chestplate' + i)
                }
            }
            this.prev.body = armor.body
        }

        if (armor.leg != this.prev.leg) {
            if (armor.leg) {
                const item = block.fromId(armor.leg)
                for (let i = 0; i < 10; i++) {
                    this._mesh.modifiers.replaceGroup('pants' + i, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup('pants' + i)
                }
            } else {
                for (let i = 0; i < 10; i++) {
                    this._mesh.modifiers.hideGroup('pants' + i)
                }
            }
            this.prev.leg = armor.leg
        }

        if (armor.boot != this.prev.boot) {
            if (armor.boot) {
                const item = block.fromId(armor.boot)
                for (let i = 0; i < 10; i++) {
                    this._mesh.modifiers.replaceGroup('boots' + i, item.model.name, item.model.texture)
                    this._mesh.modifiers.showGroup('boots' + i)
                }
            } else {
                for (let i = 0; i < 10; i++) {
                    this._mesh.modifiers.hideGroup('boots' + i)
                }
            }
            this.prev.boot = armor.boot
        }

    }

    postLoad(render : Renderer) {}

}