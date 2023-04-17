import { Resources } from "./resources.js";
import * as ModelBuilder from "./modelBuilder.js";
import { Color, Helpers, IndexedColor, Vector } from "./helpers.js";
import { ChunkManager } from "./chunk_manager.js";
import { AABBDrawable, NetworkPhysicObject } from './network_physic_object.js';
import { HEAD_MAX_ROTATE_ANGLE, MOUSE, PLAYER_SKIN_TYPES, SNEAK_MINUS_Y_MUL } from "./constant.js";
import { Mesh_Object_MobFire } from "./mesh/object/mob_fire.js";
import glMatrix from "../vendors/gl-matrix-3.3.min.js"
import GeometryTerrain from "./geometry_terrain.js";
import type { Renderer } from "./render.js";
import type { SceneNode } from "./SceneNode.js";
import type { World } from "./world.js";
import type { ArmorState, TSittingState, TSleepState } from "./player.js";
import type { Mesh_Object_BBModel } from "./mesh/object/bbmodel.js";

const { quat, mat4 } = glMatrix;

const SNEAK_ANGLE                   = 28.65 * Math.PI / 180;

export class Traversable {
    [key: string]: any;

    constructor() {

        /**
         * @type {SceneNode}
         */
        this.sceneTree;

        this.material;

        this.drawPos;
    }

    isRenderable(render: Renderer) {
        return false;
    }
}

export class Animable {
    [key: string]: any;

    constructor() {
        /**
         * @type {SceneNode}
         */
        this.sceneTree;
        this.aniframe = 0;
        this.pos;
        this.parts;
        this.animationScript;

    }

}

export class TraversableRenderer {
    [key: string]: any;

    /**
     *
     * @param {SceneNode} node
     * @param {SceneNode} parent
     * @param {*} render
     * @param {Traversable} traversable
     * @returns
     */
    traverse(group, mesh, pos, render) {
        if(!this.drawGroup(group, mesh, pos, render)) {
            return false;
        }

       // for(const next of group.children.keys()) {
        //    if (!group.children || !this.traverse(group.children.get(next), mesh, pos, render))  {
               //return false
           // }
      //  }

        return true
    }

    drawTraversed(node, parent, render, traversable) {
        if('visible' in node && !node.visible) {
            return true;
        }
        if (!node.terrainGeometry) {
            return true;
        }
        if (node.material && traversable.lightTex) {
            node.material.lightTex = traversable.lightTex;
        }

        render.renderBackend.drawMesh(
            node.terrainGeometry,
            node.material || traversable.material,
            traversable.drawPos,
            node.matrixWorld
        );

        return true;
    }


    drawGroup(group, mesh, pos, render) {
        const init_matrix = mat4.create()
        if (group instanceof GeometryTerrain) {
            render.renderBackend.drawMesh(group, mesh.gl_material, pos, init_matrix)
        } else {
            const vertices = []
            group.pushVertices(vertices, Vector.ZERO, IndexedColor.WHITE, init_matrix, null)
            const gt = new GeometryTerrain(vertices)
            render.renderBackend.drawMesh(gt, mesh.gl_material, pos, init_matrix)
        }
        return true
    }

    drawLayer(render, mesh, ignore_roots = []) {
       // this.traverse(st, null, render, traversable);

        /*if (!traversable || !traversable.sceneTree) {
            return;
        }

        if (!traversable.isRenderable(render)) {
            return;
        }

        // Wait loading texture
        if(!traversable.material) {
            return;
        }

        for(let st of traversable.sceneTree) {
            if(ignore_roots && ignore_roots.indexOf(st.name) >= 0) {
                continue;
            }
            this.traverse(st, null, render, traversable);
        }
        */
    }

}

export class Animator {
    [key: string]: any;

    prepare(animable) {
    }

    update(delta, camPos, animable) {
    }

}

export class MobAnimator extends Animator {
    [key: string]: any;

    prepare(animable) {
        const { sceneTree: trees, parts = {} } = animable;

        for(const p of ['head', 'arm', 'leg', 'wing', 'body']) {
            parts[p] = [];
        }

        const legs = [];
        const heads = [];
        const arms = [];
        const wings = [];

        this.aniangle = 0;

        for(const tree of trees) {
            let leg;
            let arm;
            let head;
            let wing;

            head = tree.findNode('Head');
            head && heads.push(head);

            head = tree.findNode('head');
            head && heads.push(head);

            for(let i = 0; i < 8; i ++) {
                leg = tree.findNode('leg' + i);
                leg && legs.push(leg);

                arm = tree.findNode('arm' + i);
                arm && arms.push(arm);

                wing = tree.findNode('wing' + i);
                wing && wings.push(wing);
            }

            leg = tree.findNode('LeftLeg');
            leg && legs.push(leg);

            leg = tree.findNode('RightLeg');
            leg && legs.push(leg);

            arm = tree.findNode('RightArm');
            arm && arms.push(arm);

            arm = tree.findNode('LeftArm');
            arm && arms.push(arm);

            parts['head'].push(...heads);
            parts['arm'].push(...arms);
            parts['leg'].push(...legs);
            parts['wing'].push(...wings);
            parts['body'].push(...[tree.findNode('Body')]);
        }

        animable.parts = parts;
    }

    update(delta, camPos, animable, speed?) {

        if (!animable) {
            return;
        }

        if (!animable.parts) {
            this.prepare(animable);
        }

        if (!animable.parts) {
            return;
        }

        // Mob legs animation
        const speed_mul      = animable.running ? 1.5 : (animable.sneak ? .5 : 1); // speed / 15.5;
        const anim_speed      = 122.5;
        const max_anim_angle  = Math.PI / 4 * speed_mul;
        const speed_delta     = typeof speed === 'undefined' ? delta : delta * speed_mul;

        if(animable.moving) {
            // @IMPORTANT minus to make the character start walking on the right foot
            animable.aniframe -= speed_delta / anim_speed;
            this.aniangle = max_anim_angle * Math.sin(animable.aniframe);
        } else if(this.aniangle != 0) {
            if(this.aniangle < 0) {
                this.aniangle += delta / anim_speed;
                this.aniangle = Math.min(this.aniangle, 0);
            } else {
                this.aniangle -= delta / anim_speed;
                this.aniangle = Math.max(this.aniangle, 0);
            }
            if(this.aniangle == 0) {
                animable.aniframe = 0;
            }
        }

        this.applyAnimation(delta, animable.aniframe, this.aniangle, camPos, animable);

    }

    applyAnimation(delta, aniframe, aniangle, camPos, animable) {

        const {
            animationScript, parts
        } = animable;

        if (!animationScript) {
            return;
        }

        for(const partKey in parts) {
            if (!animationScript[partKey]) {
                continue;
            }

            for(let i = 0; i < parts[partKey].length; i ++) {
                animationScript[partKey]({
                    part: parts[partKey][i],
                    index: i % 4,
                    delta,
                    aniframe,
                    aniangle,
                    animable,
                    camPos
                });
            }
        }
    }
}

export class MobAnimation {
    [key: string]: any;

    model : MobModel

    constructor(model : MobModel) {
        this.model = model
    }

    head({
        part, index, delta, animable, camPos
    }) {
        let {
            yaw, pos, targetLook = 0
        } = animable;

        // Head to camera rotation
        let angToCam = 0;

        if (Helpers.distance(pos, camPos) < 5) {
            angToCam = yaw  -Math.PI/2  + Math.atan2(camPos.z - pos.z, camPos.x - pos.x);

            while(angToCam > Math.PI) angToCam -= Math.PI * 2;
            while(angToCam < -Math.PI) angToCam += Math.PI * 2;

            if (Math.abs(angToCam) >= Math.PI / 4) {
                angToCam = 0;
            }
        }

        if (Math.abs(angToCam - targetLook) > 0.05) {
            targetLook += Math.sign(angToCam - targetLook) * 0.05;
        }

        quat.fromEuler(part.quat, 0, 0, 180 * targetLook / Math.PI);
        if (animable.sleep) {
            quat.rotateX(part.quat, part.quat, -Math.PI / 2)
        }
        part.updateMatrix();

        animable.targetLook = targetLook;
    }

    leg({
        part, index, aniangle, animable, isArm = 0
    }) {
        // если лег поспать, то не двигаемся
        if (animable.sleep) {
            quat.identity(part.quat);
            quat.rotateX(part.quat, part.quat, 0)
            quat.rotateY(part.quat, part.quat, 0)
            quat.rotateZ(part.quat, part.quat, 0)
            part.updateMatrix();
            return
        }
        const x             = index % 2;
        const y             = index / 2 | 0;
        let sign            = isArm ? (index == 0 || index == 2) ? -1 : 1 : x ^ y ? -1 : 1;
        const ageInTicks    = performance.now() / 50;
        const isLeftArm     = isArm && index % 2 != 0;
        const isLeftLeg     = !isArm && index % 2 == 0;
        const isZombie      = animable.type == 'zombie';
        const rotate        = new Vector(0, 0, 0);
        const isSitting     = animable.sitting; // isHumanoid;

        if(isZombie && isArm) {
           aniangle /= 16;
        }

        if(!animable.type.startsWith('player:')) {
            aniangle /= 2
        }

        if(isArm) {
            sign *= -1
        }

        if(isSitting) {
            if(isArm) {
                rotate.x -= .8;
            } else {
                rotate.x -= 1.55;
                rotate.y += 0.4 * (isLeftLeg ? -1 : 1);
            }
        } else {
            // размахивание конечностями
            // mc steve model
            // rotate.x = aniangle * sign - (animable.sneak || 0) * SNEAK_ANGLE * (1 - 0.5 * (isArm | 0));
            // new model
            rotate.x = aniangle * sign - ((isArm && animable.sneak) || 0) * SNEAK_ANGLE * (1 - 0.5 * (isArm | 0));
        }

        // shake arms
        if(isArm) {
            if(!isLeftArm && this.isSwingInProgress) {
                // атака правой руки
                this.setupArmOnAttackAnimation(rotate);
            } else if(!isSitting) {
                // движение рук от дыхания
                this.setupArmOnBreathAnimation(rotate, ageInTicks + 1500 * index, isLeftArm);
            }
            // hands up if zombie
            if(isZombie) {
                rotate.x -= 1.7;
            }
        }

        // apply animation
        quat.identity(part.quat);
        quat.rotateX(part.quat, part.quat, rotate.x);
        quat.rotateY(part.quat, part.quat, rotate.y);
        quat.rotateZ(part.quat, part.quat, rotate.z);
        part.updateMatrix();

    }

    // анимация от третьего лица
    setupArmOnAttackAnimation(vec) {
        let inv = Math.sin(this.swingProgress * Math.PI);
        let sp = inv * inv;
        let s1 = Math.sin(sp);
        let s2 = Math.sin(inv);
        vec.x -= (s1 * .8 + s2 * .5);
        vec.y = Math.sin(Math.sqrt(this.swingProgress) * Math.PI) * .4;
        vec.z = s2 * -.4;
    }

    // анимация установки блока от первого лица
    setupArmOnPlaceAnimation(vec) {
        const attackTime = this.swingProgress;
        const body = {yRot: 0};
        const head = {xRot: 0};
        let f = attackTime;
        f = 1.0 - attackTime;
        f *= f;
        f *= f;
        f = 1.0 - f;
        const f1 = Math.sin(f * Math.PI);
        const f2 = Math.sin(attackTime * Math.PI) * -(head.xRot - 0.7) * 0.75;
        vec.x -= f1 * 1.2 + f2;
        vec.y += body.yRot * 2.0;
        vec.z += Math.sin(attackTime * Math.PI) * -0.4;
    }

    // движение рук от дыхания
    setupArmOnBreathAnimation(vec, ageInTicks, isLeftArm) {
        vec.x += Math.sin(ageInTicks * 0.067) * 0.05;
        vec.y += .05 * (isLeftArm ? - 1 : 1) + Math.sin(ageInTicks * 0.1) * 0.05; // Руки в сторону
        vec.z = Math.cos(ageInTicks * 0.09) * 0.05 + 0.05;
    }

    /*
    setupAttackAnimation(T p_102858_, float p_102859_) {
        if (!(this.attackTime <= 0.0F)) {
           HumanoidArm humanoidarm = this.getAttackArm(p_102858_);
           ModelPart modelpart = this.getArm(humanoidarm);
           float f = this.attackTime;
           this.body.yRot = Mth.sin(Mth.sqrt(f) * ((float)Math.PI * 2F)) * 0.2F;
           if (humanoidarm == HumanoidArm.LEFT) {
              this.body.yRot *= -1.0F;
           }

           this.rightArm.z = Mth.sin(this.body.yRot) * 5.0F;
           this.rightArm.x = -Mth.cos(this.body.yRot) * 5.0F;
           this.leftArm.z = -Mth.sin(this.body.yRot) * 5.0F;
           this.leftArm.x = Mth.cos(this.body.yRot) * 5.0F;
           this.rightArm.yRot += this.body.yRot;
           this.leftArm.yRot += this.body.yRot;
           this.leftArm.xRot += this.body.yRot;
           f = 1.0F - this.attackTime;
           f *= f;
           f *= f;
           f = 1.0F - f;
           float f1 = Mth.sin(f * (float)Math.PI);
           float f2 = Mth.sin(this.attackTime * (float)Math.PI) * -(this.head.xRot - 0.7F) * 0.75F;
           modelpart.xRot -= f1 * 1.2F + f2;
           modelpart.yRot += this.body.yRot * 2.0F;
           modelpart.zRot += Mth.sin(this.attackTime * (float)Math.PI) * -0.4F;
        }
    }*/

    body({
        part, index, aniangle, animable
    }) {
        quat.identity(part.quat);
        if(animable.sneak && !animable.lies && !animable.sitting) {
            quat.rotateX(part.quat, part.quat, animable.sneak * SNEAK_ANGLE);
        } else if (animable.sleep) {
            quat.rotateX(part.quat, part.quat, -Math.PI / 2)
        }
        part.updateMatrix();
    }

    arm(opts) {
        opts.isArm = 1;
        return this.leg(opts);
    }

    wing({
        part, index, animable, delta
    }) {

        const deltaY = animable._prevPos.y - animable._pos.y;
        // 16 - because we base that reference FPS is 60, this means that time should be 16.6
        let p = part.frame = part.frame === undefined ? 0 : (part.frame + delta / 16.6);

        const x = index % 2;
        const y = index / 2 | 0;
        const sign = (x ^ y ? 1 : -1);
        const isJump = +(Math.abs(deltaY) > 0.01);

        let anim = 0;

        if (isJump) {
            part.endFrame = part.frame + 30;
            anim = sign;
        }

        if (part.frame < part.endFrame) {
            anim = sign;
        }

        const add_wing_angle = ['bee'].includes(this.model.type) ? 0 : 90

        const wing_angle = -anim * (Math.sin(p * Math.PI * 2 / 8) * 60 + add_wing_angle)

        if(['bee'].includes(this.model.type)) {
            quat.fromEuler(part.quat, wing_angle, 0, 0)
        } else {
            quat.fromEuler(part.quat, 0, wing_angle, 0)
        }

        part.updateMatrix()

    }

}

export class MobModel extends NetworkPhysicObject {
    legs :              SceneNode[] = []
    head :              SceneNode[] = []
    sceneTree :         any = null
    texture :           any = null
    material :          any = null
    raycasted :         boolean = false
    moving_timeout :    any = false
    nametag :           any = false
    aniframe :          int = 0
    width :             int = 0
    height :            int = 0
    sneak :             boolean = false
    body_rotate :       int = 0
    tintColor :         Color = new Color(0, 0, 0, 0)
    textures :          Map<string, any> = new Map()
    models :            Map<string, any> = new Map()
    fix_z_fighting :    float = Math.random() / 100
    loaded:             boolean = false
    type :              string
    skin :              any
    initialised :       boolean = false
    targetLook :        float = 0
    drawPos :           Vector = new Vector(0, 0, 0)
    posDirty :          boolean = true
    currentChunk :      any = null
    lightTex :          any = null
    armor :             ArmorState = null
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
    fire_mesh:          any
    animationScript:    MobAnimation
    renderer:           TraversableRenderer = null
    animator:           MobAnimator = null

    constructor(props, world : World) {

        super(world, new Vector(0, 0, 0), new Vector(0, 0, 0))

        Object.assign(this, props)

        this.type = props.type
        this.skin = props.skin_id || props.skin
        this.renderer = new TraversableRenderer()
        this.animator = new MobAnimator()
        this.animationScript = new MobAnimation(this)

    }

    isRenderable(render: Renderer) : boolean {
        return this.sceneTree && (
             !this.currentChunk ||
             (this.currentChunk.cullID === render.cullID)
         )
    }

    get isAlive() : boolean {
        return this.extra_data?.is_alive;
    }

    // ударить кулаком
    punch(e) {
        if(!this.isAlive) {
            return false;
        }
        if(e.button_id == MOUSE.BUTTON_LEFT) {
            // play punch
            Qubatch.sounds.play('madcraft:block.player', 'strong_atack');
            // play mob cry
            //let tag = `madcraft:block.${this.type}`;
            //if(Qubatch.sounds.tags.hasOwnProperty(tag)) {
            //    Qubatch.sounds.play(tag, 'hurt');
            //}
            // make red
            this.tintColor.set(1, 0, 0, .3);
            setTimeout(() => {
                this.tintColor.set(0, 0, 0, 0);
            }, 200);
            // add velocity
            // let velocity = new Vector(0, 0.5, 0);
            // mob.addVelocity(velocity);
        }
    }

    lazyInit(render : Renderer) {
        if (this.initialised) {
            return;
        }
        return this.loadModel(render).then(()=>{
                this.initialised = true;
                this.postLoad(render, this.sceneTree);
        });
    }

    computeLocalPosAndLight(render : Renderer, delta : float) {
        if (!this.initialised) {
            return;
        }

        if (!this.sceneTree) {
            return;
        }

        const newChunk = ChunkManager.instance?.getChunk(this.chunk_addr);

        this.lightTex = newChunk && newChunk.getLightTexture(render.renderBackend);

        if (this.material) {
            this.material.lightTex = this.lightTex;
            this.material.tintColor = this.tintColor;

            // //TODO: refactor this!
            // if (this.slots && this.slots.RightArm && this.slots.RightArm.holder
            //     && this.slots.RightArm.holder.material) {
            //     this.slots.RightArm.holder.material.lightTex = this.lightTex;
            // }
        }

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

        // root rotation
        for(const st of this.sceneTree) {

            const draw_yaw = this.draw_yaw;
            const add_angle = this.body_rotate * Math.PI * (HEAD_MAX_ROTATE_ANGLE / 180);
            quat.fromEuler(st.quat, 0, 0, (this.sleep) ? 360 * this.sleep.rotate.z : 180 * (Math.PI - (draw_yaw + add_angle)) / Math.PI);

            //
            let subY = 0;
            if(this.sitting) {
                subY = this.height * 1/3
            } else if(this.sleep) {
                subY = this.height * 5/6
            } else if(this.sneak) {
                subY = SNEAK_MINUS_Y_MUL
            }

            // TODO
            let levitation = .2 + Math.sin(performance.now() / 1000) * .1;
            levitation = 0;

            st.position.set([
                this.pos.x - this.drawPos.x,
                this.pos.z - this.drawPos.z,
                this.pos.y - this.drawPos.y - subY + this.fix_z_fighting + levitation,
            ]);

            st.updateMatrix();
        }

    }

    update(render? : Renderer, camPos? : Vector, delta? : float, speed? : float) {
        super.update();
        this.computeLocalPosAndLight(render, delta);
        if (!this.isRenderable(render)) {
            return;
        }
       this.animator.update(delta, camPos, this, speed);
    }

    isDetonationStarted() : boolean {
        return this.extra_data?.detonation_started || false
    }

    /**
     * Draw mob model
     */
    draw(render : Renderer, camPos : Vector, delta : float, speed? : float, draw_debug_grid : boolean = false) {

        this.lazyInit(render);
        this.update(render, camPos, delta, speed);

        if (!this.sceneTree) {
            return null;
        }

        // ignore_roots
        const ignore_roots = [];
        if(this.type == 'sheep' && this.extra_data?.is_sheared) {
            ignore_roots.push('geometry.sheep.v1.8:geometry.sheep.sheared.v1.8');
        }

        // Draw in fire
        if(this.extra_data?.in_fire) {
            this.drawInFire(render, delta);
        }

        // Draw AABB wireframe
        if(this.aabb && draw_debug_grid) {
            this.aabb.draw(render, this.tPos, delta, true /*this.raycasted*/ );
        }

        //
        let type = this.type
        if(type == 'player:steve') {
            type = 'humanoid'
        }
        let mesh : Mesh_Object_BBModel = this._mesh
        if(!mesh) {
            mesh = this._mesh = render.world.mobs.models.get(type)
        }

        if(mesh) {
            this.setArmor()
            if (this.sleep) {
                const rot = this.sleep.rotate.z * 2 * Math.PI
                mesh.rotate.z = rot % Math.PI ? rot : rot + Math.PI
                mesh.setAnimation('sleep')
            } else {
                mesh.rotate.z = this.draw_yaw ? this.draw_yaw : 0
                if (this.sitting) {
                    mesh.setAnimation('sitting')
                } else if (this.moving) {
                    if (this.sneak) {
                        mesh.setAnimation('crouch')
                    } else if (!this.running) {
                        mesh.setAnimation('walk')
                    } else {
                        mesh.setAnimation('run')
                    }
                }  else if (this.sneak) {
                    mesh.setAnimation('crouch_idle')
                } else if (this.eat) {
                    mesh.setAnimation('eat')
                } else {
                    mesh.setAnimation('idle')
                }
            }
            mesh.apos.copyFrom(this._pos)
            mesh.drawBuffered(render, delta)
        }
    }

    drawInFire(render : Renderer, delta : float) {
        if(this.fire_mesh) {
            this.fire_mesh.yaw = Math.PI - this.angleTo(this.pos, render.camPos);
            this.fire_mesh.apos.copyFrom(this.pos);
            this.fire_mesh.draw(render, delta);
        } else {
            this.fire_mesh = new Mesh_Object_MobFire(this, this.world)
        }
    }

    angleTo(pos : Vector, target : Vector) {
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle - 2 * Math.PI;
    }

    getTexture(render : Renderer, image : ImageBitmap) {
        const texture = render.renderBackend.createTexture({
            source: image,
            minFilter: 'nearest',
            magFilter: 'nearest',
            shared: true
        });
        return render.defaultShader.materials.doubleface_transparent.getSubMat(texture);
    }

    /**
     * Loads the player head model into a vertex buffer for rendering.
     */
    async loadModel(render : Renderer) {
        if (this.sceneTree) {
            return;
        }

        if (this.type.startsWith('player')) {
            this.type = PLAYER_SKIN_TYPES[this.skin.type];
        }

        // загружеам ресурсы
        const asset = await Resources.getModelAsset(this.type);
        if (!asset) {
            console.error("Can't locate model for loadModel:", this.type);
            return null;
        }
        this.sceneTree = ModelBuilder.loadModel(asset);
        if (!this.sceneTree) {
            return null;
        }
        let image;
        if (this.type.startsWith('player')) {
            image = await asset.getPlayerSkin(this.skin.file);
            this.material = this.getTexture(render, image);
        } else {
            // получаем все скины моба
            for (const title in asset.skins) {
                image = await asset.getSkin(title);
                const texture = this.getTexture(render, image);
                this.textures.set(title, texture);
            }
            // загружем скин для моба
            this.prev.skin = this.skin = this.skin || asset.baseSkin;
            this.material = this.textures.get(this.skin.toString());
        }
        // если игрок зомби или скелет, загружаем броню для них
        if (this.type.startsWith('player') || this.type == 'zombie' || this.type == 'skeleton') {
            for (const name of ['armor', 'scrap']) {
                const model = await Resources.getModelAsset(name);
                if (!model) {
                    console.log("Can't locate " + name + " model")
                    return null
                }
                for (const skin in model.skins) {
                    const image = await model.getSkin(skin)
                    const texture = this.getTexture(render, image)
                    this.textures.set(name + '_' + skin, texture)
                }
                this.models.set(name, ModelBuilder.loadModel(model)[0])
            }
        }
        this.loaded = true
        this.animator.prepare(this)
    }

    postLoad(render : Renderer, tree : SceneNode) {
        if (!tree) {
            return;
        }
        this.animator.prepare(this);
    }

    onUnload() {
        if(this.fire_mesh) {
            this.fire_mesh.destroy();
        }
    }

    setSkin() {
        if (this?.extra_data?.skin && this.extra_data.skin != this.prev.skin) {
            if (this.textures.has(this.extra_data.skin)) {
                this.material = this.textures.get(this.extra_data.skin);
            }
            this.prev.skin = this.extra_data.skin;
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
                this._mesh.modifiers.replaceGroup('helmet', item.model.name, item.model.texture + '.png')
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
                    this._mesh.modifiers.replaceGroup('chestplate' + i, item.model.name, item.model.texture + '.png')
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
                    this._mesh.modifiers.replaceGroup('pants' + i, item.model.name, item.model.texture + '.png')
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
                    this._mesh.modifiers.replaceGroup('boots' + i, item.model.name, item.model.texture + '.png')
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


}