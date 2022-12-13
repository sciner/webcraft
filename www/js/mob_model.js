import { Resources } from "./resources.js";
import { SceneNode } from "./SceneNode.js";
import * as ModelBuilder from "./modelBuilder.js";
import { Color, Helpers, Vector } from "./helpers.js";
import { ChunkManager } from "./chunk_manager.js";
import { NetworkPhysicObject } from './network_physic_object.js';
import { HEAD_MAX_ROTATE_ANGLE, MOUSE, PLAYER_SKIN_TYPES, SNEAK_MINUS_Y_MUL } from "./constant.js";
import { Mesh_Object_MobFire } from "./mesh/object/mob_fire.js";
import { Renderer } from "./render.js";
import { CLIENT_SKIN_ROOT } from "./constant.js";

const {mat4, vec3, quat} = glMatrix;

const SNEAK_ANGLE                   = 28.65 * Math.PI / 180;
const MAX_DETONATION_TIME           = 2000; // ms

export class Traversable {

    constructor() {

        /**
         * @type {SceneNode}
         */
        this.sceneTree;

        /**
         * @type {boolean}
         */
        this.isRenderable;

        this.material;

        this.drawPos;
    }

}

export class Animable {

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

    /**
     *
     * @param {SceneNode} node
     * @param {SceneNode} parent
     * @param {*} render
     * @param {Traversable} traversable
     * @returns
     */
    traverse(node, parent = null, render, traversable) {
        if(!this.drawTraversed(node, parent, render, traversable)) {
            return false;
        }

        for(let next of node.children) {
            if (!this.traverse(next, node, render, traversable)) return false;
        }

        return true;
    }

    drawTraversed(node, parent, render, traversable) {

        if('visible' in node && !node.visible) {
            return;
        }

        if (!node.terrainGeometry) {
            return true;
        }

        render.renderBackend.drawMesh(
            node.terrainGeometry,
            node.material || traversable.material,
            traversable.drawPos,
            node.matrixWorld
        );

        return true;
    }

    /**
     * @param {} render
     * @param {Traversable} traversable
     * @returns
     */
    drawLayer(render, traversable, ignore_roots = []) {
        if (!traversable || !traversable.sceneTree) {
            return;
        }

        if (!traversable.isRenderable) {
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

    }

}

export class Animator {

    prepare(animable) {
    }

    update(delta, camPos, animable) {
    }

}

export class MobAnimator extends Animator {

    prepare(animable) {

        const {
            sceneTree: trees,
            parts = {}
        } = animable;

        for(let p of ['head', 'arm', 'leg', 'wing', 'body']) {
            parts[p] = [];
        }

        const legs = [];
        const heads = [];
        const arms = [];
        const wings = [];

        this.aniangle = 0;

        for(let tree of trees) {

            let leg;
            let arm;
            let head;
            let wing;

            for(let i = 0; i < 8; i ++) {
                leg = tree.findNode('leg' + i);
                leg && legs.push(leg);

                arm = tree.findNode('arm' + i);
                arm && arms.push(arm);

                wing = tree.findNode('wing' + i);
                wing && wings.push(wing);
            }

            // humanoid case
            leg = tree.findNode('LeftLeg');
            leg && legs.push(leg);

            // humanoid case
            leg = tree.findNode('RightLeg');
            leg && legs.push(leg);

            // humanoid case
            arm = tree.findNode('LeftArm');
            arm && arms.push(arm);

            // humanoid case
            arm = tree.findNode('RightArm');
            arm && arms.push(arm);

            head = tree.findNode('head') || tree.findNode('Head');

            parts['head'].push(...head ? [head] : []);
            parts['arm'].push(...arms);
            parts['leg'].push(...legs);
            parts['wing'].push(...wings);
            parts['body'].push(...[tree.findNode('Body')].filter(Boolean));
        }

        animable.parts = parts;
    }

    update(delta, camPos, animable, speed) {

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
        part.updateMatrix();

        animable.targetLook = targetLook;
    }

    leg({
        part, index, aniangle, animable, isArm = 0
    }) {

        const x             = index % 2;
        const y             = index / 2 | 0;
        const sign          = x ^ y ? 1 : -1;
        const ageInTicks    = performance.now() / 50;
        const isLeftArm     = isArm && index % 2 == 0;
        const isLeftLeg     = !isArm && index % 2 == 0;
        const itemInArm     = isArm && !!part?.children[0]?.children[0]?.terrainGeometry;
        const isZombie      = animable.type == 'zombie';
        const isHumanoid    = animable.type.indexOf('player:') >= 0;
        const rotate        = new Vector(0, 0, 0);
        const isSitting     = animable.sitting; // isHumanoid;

        if(isZombie && isArm) {
            aniangle /= 16;
        }

        if(itemInArm) {
            aniangle = aniangle * .4 + Math.PI / 8;
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
            rotate.x = aniangle * sign - (animable.sneak || 0) * SNEAK_ANGLE * (1 - 0.5 * (isArm | 0));
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
        }
        part.updateMatrix();
    }

    arm(opts) {
        opts.index += 2;
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

        quat.fromEuler(
            part.quat,
            0,
            -anim * (Math.sin(p * Math.PI * 2 / 8) * 30 + 90),
            0,
        );

        part.updateMatrix();
    }

}

export class MobModel extends NetworkPhysicObject {

    constructor(props) {

        super(
            new Vector(0, 0, 0),
            new Vector(0, 0, 0)
        );

        this.fix_z_fighting             = Math.random() / 100;
        this.sceneTree                  = null;
        this.texture                    = null;
        this.material                   = null;
        this.raycasted                  = false;

        this.moving_timeout             = null;
        this.texture                    = null;
        this.nametag                    = null;
        this.aniframe                   = 0;
        this.width                      = 0;
        this.height                     = 0;
        this.sneak                      = 0;
        this.body_rotate                = 0;

        Object.assign(this, props);

        this.type = props.type;
        this.skin = props.skin_id || props.skin;

        /**
         * @type {SceneNode[]}
         */
        this.legs = [];

        /**
         * @type {SceneNode}
         */
        this.head = null;

        this.initialised = false;

        this.targetLook = 0;

        this.drawPos = {x: 0, y: 0, z: 0};

        this.lightTex = null;
        this.tintColor = new Color(0, 0, 0, 0);

        this.posDirty = true;

        this.currentChunk = null;

        this.renderer = new TraversableRenderer();

        this.animator = new MobAnimator();

        this.animationScript = new MobAnimation();

    }

    get isRenderable() {
        return this.sceneTree && (
             this.currentChunk &&
             this.currentChunk.in_frustum ||
             !this.currentChunk);
    }

    isAlive() {
        return this.extra_data?.is_alive;
    }

    // ударить кулаком
    punch(e) {
        if(!this.isAlive()) {
            return false;
        }
        if(e.button_id == MOUSE.BUTTON_LEFT) {
            // play punch
            Qubatch.sounds.play('madcraft:block.player', 'strong_atack');
            // play mob cry
            let tag = `madcraft:block.${this.type}`;
            if(Qubatch.sounds.tags.hasOwnProperty(tag)) {
                Qubatch.sounds.play(tag, 'hurt');
            }
            // make red
            this.tintColor.set(1, 0, 0, .3);
            setTimeout(() => {
                this.tintColor.set(0, 0, 0, 0);
            }, 700);
            // add velocity
            // let velocity = new Vector(0, 0.5, 0);
            // mob.addVelocity(velocity);
        }
    }

    lazyInit(render) {
        if (this.initialised) {
            return;
        }

        return this
            .loadModel(render)
            .then(()=>{
                this.initialised = true;
                this.postLoad(render, this.sceneTree);
            });
    }

    computeLocalPosAndLight(render, delta) {
        if (!this.initialised) {
            return;
        }

        if (!this.sceneTree) {
            return;
        }

        const newChunk = ChunkManager.instance.getChunk(this.chunk_addr);

        this.lightTex = newChunk && newChunk.getLightTexture(render.renderBackend);

        if (this.material) {
            this.material.lightTex = this.lightTex;
            this.material.tintColor = this.tintColor;

            //TODO: refactor this!
            if (this.slots && this.slots.RightArm && this.slots.RightArm.holder
                && this.slots.RightArm.holder.material) {
                this.slots.RightArm.holder.material.lightTex = this.lightTex;
            }
        }

        // invalid state, chunk always should be presented
        if (!newChunk) {
            return;
        }

        this.currentChunk = newChunk;
        this.drawPos = newChunk.coord;

        let yaw = this.yaw;
        if(!('draw_yaw' in this)) {
            this.draw_yaw = yaw;
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
        for(let st of this.sceneTree) {

            let draw_yaw = this.draw_yaw;
            const add_angle = this.body_rotate * Math.PI * (HEAD_MAX_ROTATE_ANGLE / 180);
            quat.fromEuler(st.quat, 0, 0, 180 * (Math.PI - (draw_yaw + add_angle)) / Math.PI);

            //
            let subY = 0;
            if(this.sitting) {
                subY = this.height * 1/3
            } else if(this.sneak) {
                subY = SNEAK_MINUS_Y_MUL;
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

    update(render, camPos, delta, speed) {
        super.update();

        this.computeLocalPosAndLight(render, delta);

        if (!this.isRenderable) {
            return;
        }

        this.animator.update(delta, camPos, this, speed);
    }

    isDetonationStarted() {
        return this.extra_data?.detonation_started || false;
    }

    /**
     * Draw mob model
     * @param {Renderer} render 
     * @param {Vector} camPos 
     * @param {float} delta 
     * @param {float} speed 
     * @param {boolean} draw_debug_grid
     * @returns 
     */
    draw(render, camPos, delta, speed, draw_debug_grid = false) {

        this.lazyInit(render);
        this.update(render, camPos, delta, speed);

        if (!this.sceneTree) {
            return null;
        }

        // If mob die
        if(this.isAlive() === false) {
            // first enter to this code
            if(!this.die_info) {
                this.yaw_before_die = this.yaw;
                this.die_info = {
                    time: performance.now(),
                    scale: Array.from(this.sceneTree[0].scale)
                };
                this.sneak = 1;
            }
            const elapsed = performance.now() - this.die_info.time;
            const max_die_animation_time = 1000;
            let elapsed_percent = elapsed / max_die_animation_time;
            if(elapsed_percent < 1) {
                if(this.netBuffer.length > 0) {
                    const state = this.netBuffer[0];
                    state.rotate.z = this.yaw_before_die + elapsed / 100;
                    if(!this.extra_data.play_death_animation) {
                        elapsed_percent = 1;
                    }
                    for(let st of this.sceneTree) {
                        st.scale[0] = this.die_info.scale[0] * (1 - elapsed_percent);
                        st.scale[1] = this.die_info.scale[1] * (1 - elapsed_percent);
                        st.scale[2] = this.die_info.scale[2] * (1 - elapsed_percent);
                    }
                }
                this.tintColor.set(1, 1, 1, .3);
            } else {
                return false;
            }
        } else if(this.isDetonationStarted()) {
            if(!this.detonation_started_info) {
                this.detonation_started_info = {
                    time: performance.now(),
                    scale: Array.from(this.sceneTree[0].scale)
                }
            }
            const info = this.detonation_started_info;
            const elapsed = performance.now() - info.time;
            const elapsed_percent = Math.min(elapsed / MAX_DETONATION_TIME, 1);
            const is_tinted = Math.round(elapsed / 150) % 2 == 0;
            if(elapsed_percent == 1 || is_tinted) {
                this.tintColor.set(1, 1, 1, .5);
            } else {
                this.tintColor.set(0, 0, 0, 0);
            }
            const CREEPER_MAX_DETONATION_SCALE = 1.35;
            const new_creeper_scale = info.scale[0] * (1 + elapsed_percent * (CREEPER_MAX_DETONATION_SCALE - 1));
            for(let st of this.sceneTree) {
                st.scale[0] = new_creeper_scale;
                st.scale[1] = new_creeper_scale;
                st.scale[2] = new_creeper_scale;
            }
        } else if(this.detonation_started_info) {
            this.tintColor.set(0, 0, 0, 0);
            for(let st of this.sceneTree) {
                st.scale = this.detonation_started_info.scale;
            }
            this.detonation_started_info = null;
        }

        // Draw in fire
        if((this.extra_data?.time_fire ?? 0) > 0) {
            this.drawInFire(render, delta);
        }

        // ignore_roots
        const ignore_roots = [];
        if(this.type == 'sheep' && this.extra_data?.is_shaered) {
            ignore_roots.push('geometry.sheep.v1.8:geometry.sheep.sheared.v1.8');
        }

        // run render
        this.renderer.drawLayer(render, this, ignore_roots);

        // Draw AABB wireframe
        if(this.aabb && draw_debug_grid) {
            this.aabb.draw(render, this.tPos, delta, true /*this.raycasted*/ );
        }

    }

    /**
     * @param {Renderer} render 
     */
    drawInFire(render, delta) {
        if(this.fire_mesh) {
            this.fire_mesh.yaw = Math.PI - this.angleTo(this.pos, render.camPos);
            this.fire_mesh.apos.copyFrom(this.pos);
            this.fire_mesh.draw(render, delta);
        } else {
            this.fire_mesh = new Mesh_Object_MobFire(this);
            // render.meshes.add(this.fire_mesh);
        }
    }

    angleTo(pos, target) {
        const angle = Math.atan2(target.x - pos.x, target.z - pos.z);
        return (angle > 0) ? angle : angle - 2 * Math.PI;
    }

    /**
     *
     * @param {Renderer} render
     * @param {ImageBitmap | Image} image
     */
    loadTextures(render, image) {
        if (this.texture) {
            return;
        }

        this.texture = render.renderBackend.createTexture({
            source: image,
            minFilter: 'nearest',
            magFilter: 'nearest',
            shared: true
        });

        this.material =  render.defaultShader.materials.doubleface_transparent.getSubMat(this.texture)
    }

    // Loads the player head model into a vertex buffer for rendering.
    /**
     *
     * @param {Renderer} render
     */
    async loadModel(render) {
        if (this.sceneTree) {
            return;
        }

        if (this.type.startsWith('player')) {
            return this.loadPlayerModel(render);
        }

        const asset = await Resources.getModelAsset(this.type);

        if (!asset) {
            console.log("Can't locate model for:", this.type);
            return null;
        }

        this.sceneTree = ModelBuilder.loadModel(asset);

        if (!this.sceneTree) {
            return null;
        }

        this.skin = this.skin || asset.baseSkin;

        if(!(this.skin in asset.skins)) {
            console.warn("Can't locate skin: ", asset, this.skin)
            this.skin = asset.baseSkin;
        }

        const image = await asset.getSkin(this.skin);

        this.loadTextures(render, image);
    }


    async loadPlayerModel(render) {
        if (this.sceneTree) {
            return;
        }

        if (!this.skin.file.startsWith(CLIENT_SKIN_ROOT)) {
            this.skin.file = CLIENT_SKIN_ROOT + this.skin.file + '.png';
        }
        this.type = PLAYER_SKIN_TYPES[this.skin.type];

        const asset = await Resources.getModelAsset(this.type);
        if (!asset) {
            console.log("Can't locate model for:", this.type);
            return null;
        }

        this.sceneTree = ModelBuilder.loadModel(asset);
        if (!this.sceneTree) {
            return null;
        }

        const image = await asset.getPlayerSkin(this.skin.file);
        this.loadTextures(render, image);
    }

    /**
     * @param {Renderer} render
     * @param {SceneNode} tree
     */
    postLoad(render, tree) {
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

}