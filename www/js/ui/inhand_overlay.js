import glMatrix from "../../vendors/gl-matrix.js";
import { BLOCK } from "../blocks.js";
import { Camera } from "../camera.js";
import { RENDER_DEFAULT_ARM_HIT_PERIOD, RENDER_EAT_FOOD_DURATION } from "../constant.js";
import { Mth, Vector } from "../helpers.js";
import Mesh_Object_Block_Drop from "../mesh/object/block_drop.js";

class ItemUseAnimation {
    static NONE = 0;
    static EAT = 1;
    static DRINK = 2;
    static BLOCK = 3;
    static BOW = 4;
    static SPEAR = 5;
}

export class InteractionHand {
    static MAIN_HAND = 1;
    static OFF_HAND = 2;
}

export class HumanoidArm {
    static LEFT = new HumanoidArm("options.mainHand.left");
    static RIGHT = new HumanoidArm("options.mainHand.right");
    constructor(name) {
       this.name = name;
    }
    getOpposite() {
       return this == LEFT ? RIGHT : LEFT;
    }
 }

const {mat3, mat4, quat} = glMatrix;
const tmpMatrix = mat4.create();

export class InHandOverlay {

    constructor (skinId, render) {

        // overlay camera
        this.camera = new Camera({
            type: Camera.PERSP_CAMERA,
            renderType: render.camera.renderType,
            max: 100,
            min: 0.001,
            fov: 75,
            width: render.camera.width,
            height: render.camera.height,
        });

        /**
         * @type {Mesh_Object_Block_Drop}
         */
        this.inHandItemMesh = null;
        this.inHandItemBroken = false;
        this.inHandItemId = -1;

        this.changeAnimation = true;
        this.changAnimationTime = 0;

        this.minePeriod = 0;
        this.mineTime = 0;
    }

    reconstructInHandItem(targetId) {
        if (this.inHandItemId === targetId) {
            return;
        }

        this.inHandItemId = targetId;

        if (this.inHandItemMesh) {
            this.inHandItemMesh.destroy();
            this.inHandItemMesh = null;
        }

        if (targetId === -1) {
            return;
        }

        const block = BLOCK.BLOCK_BY_ID[targetId];

        if (!block || !block.spawnable) {
            return;
        }

        try {
            const m = mat4.create();
            if(block.inventory?.scale) {
                mat4.scale(m, m, [block.inventory?.scale, block.inventory?.scale, block.inventory?.scale]);
            }
            this.inHandItemMesh = new Mesh_Object_Block_Drop(null, null, [block], Vector.ZERO, m);
        } catch(e) {
            console.log(e);
            //
        }
    }

    bobViewItem(player, viewMatrix) {

        let frame = player.walking_frame * 2 % 1;

        //
        let speed_mul = 1.0;
        let f = (player.walkDist * speed_mul - player.walkDistO * speed_mul);
        let f1 = -(player.walkDist * speed_mul + f * frame);
        let f2 = Mth.lerp(frame, player.oBob, player.bob);

        f1 /= player.scale
        f2 /= player.scale

        let RotateAngleX = Math.sin(f1 * Math.PI) * f2 * 1.0
        let RotateAngleY = -Math.abs(Math.cos(f1 * Math.PI) * f2) * 1;

        // Движение при дыхании
        const ageInTicks = Math.sin(performance.now() / 1000) * 2;
        RotateAngleX += Math.sin(ageInTicks * 0.067) * 0.15;
        RotateAngleY += Math.cos(ageInTicks * 0.09) * 0.15 + 0.15;

        mat4.translate(viewMatrix, viewMatrix, [
            RotateAngleX,
            RotateAngleY,
            0.0,
        ]);

    }

    update(render, delta) {

        const {
            player, renderBackend, camera
        } = render;

        this.camera.width = camera.width;
        this.camera.height = camera.height;

        // const itsme = Qubatch.player.getModel()
        // this.mineTime = itsme.swingProgress;
        if (!player.inMiningProcess && !player.inItemUseProcess) {
            this.mineTime = 0;
        }
        
        if (player.inMiningProcess || player.inItemUseProcess || this.mineTime > (delta * 2) / RENDER_DEFAULT_ARM_HIT_PERIOD) {
            this.mineTime += delta / player.inhand_animation_duration;
            if (this.mineTime >= 1) {
                this.mineTime = 0;
            }
        } else {
            this.mineTime = 0;
        }

        const id = player.currentInventoryItem ? player.currentInventoryItem.id : -1;

        if (id !== this.inHandItemId && !this.changeAnimation) {
            this.changAnimationTime = 0;
            this.changeAnimation = true;
        }

        if (this.changeAnimation) {
            this.changAnimationTime += 0.05 * delta;

            if (this.changAnimationTime > 0.5) {
                this.reconstructInHandItem(id);
            }

            if (this.changAnimationTime >= 1) {
                this.changAnimationTime = 1;
                this.changeAnimation = false;
            }
        }
    }

    //
    draw(render, delta) {
        const {
            player, globalUniforms, renderBackend
        } = render;

        const {
            camera, inHandItemMesh
        } = this;

        this.update(render, delta);

        mat4.identity(camera.bobPrependMatrix);
        this.bobViewItem(player, camera.bobPrependMatrix);

        const animFrame = Math.cos(this.changAnimationTime * Math.PI * 2);

        camera.pos.set(
            -157.48671900056806/100,
            218.10827698032705/100
            -57.69201067788088/100,
        );

        // camera.pos.set(0, 0.5, -1.5 * animFrame);
        camera.set(camera.pos, Vector.ZERO, camera.bobPrependMatrix);

        // change GU for valid in hand block drawings
        camera.use(globalUniforms, false);
        globalUniforms.brightness = Math.max(0.4, render.env.fullBrightness);
        globalUniforms.update();

        renderBackend.beginPass({clearDepth: true, clearColor: false});
        
        const pSwingProgress = this.mineTime;
        
        if(inHandItemMesh) {

            const {
                modelMatrix, block_material: matInHand, pos
            } = inHandItemMesh;

            mat4.identity(modelMatrix);
            pos.set(0, 0, 0);

            // @param {float}
            let pPartialTicks;
            // @param {float}
            let pPitch; // = Mth.lerp(pPartialTicks, pPlayerEntity.xRotO, pPlayerEntity.getXRot());
            // @param {InteractionHand}
            let hand = InteractionHand.MAIN_HAND;
            // @param {float}
            // p_109376_ ... pSwingProgress
            // @param {MultiBufferSource}
            let pBuffer;
            // @param {int}
            let pCombinedLight;

            // @param {float}
            // this.mainHandHeight = Math.clamp(this.mainHandHeight - 0.4, 0.0, 1.0);
            let pEquippedProgress = 0; // 1.0 - Mth.lerp(pPartialTicks, this.oMainHandHeight, this.mainHandHeight);

            //
            let matInHandExt = {...matInHand};
            matInHandExt.isEmpty = function() {
                return this.id == 0;
            };
            matInHandExt.is = function(block) {
                return this.id == block.id;
            };
            matInHandExt.getUseAnimation = function() {
                return ItemUseAnimation.NONE;
            };

            this.renderArmWithItem(
                player,
                pPartialTicks,
                pPitch,
                hand,
                pSwingProgress,
                matInHandExt,
                pEquippedProgress,
                modelMatrix,
                pBuffer,
                pCombinedLight
            );

            inHandItemMesh.drawDirectly(render, modelMatrix);
        }
        renderBackend.endPass();
    }

    /**
     * @param {Player} player
     * @param {float} pPartialTicks
     * @param {float} pPitch
     * @param {InteractionHand} hand
     * @param {float} pSwingProgress
     * @param {ItemStack} matInHand
     * @param {float} pEquippedProgress
     * @param {PoseStack} modelMatrix
     * @param {MultiBufferSource} p_109380_
     * @param {int} pCombinedLight
     */
    renderArmWithItem(player, pPartialTicks, pPitch, hand, pSwingProgress, matInHand, pEquippedProgress, modelMatrix, p_109380_, pCombinedLight) {

        /*
        let animation_name = 'hit';
        if (matInHand?.item?.name == 'food' && player.inItemUseProcess) {
            animation_name = 'food';
        } else if(matInHand.diagonal) {
            animation_name = 'diagonal';
        }
        
        switch(animation_name) {
            case 'hit': {
                const fast = Math.abs(Math.sin(pSwingProgress * Math.PI * 4));
                mat4.translate(modelMatrix, modelMatrix, [1.8 - fast * 1.8, fast * 2, fast * 0.6 - 0.6]);
                mat4.rotateY(modelMatrix, modelMatrix, -Math.PI / 14);
                mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 4 - fast * Math.PI / 4);
                break;
            }
            case 'food': {
                const fast = Math.abs(Math.sin(pSwingProgress * Math.PI * 6 * (RENDER_EAT_FOOD_DURATION / 1000)));
                const trig = 1 - Math.pow(1 - pSwingProgress, 10);
                mat4.translate(modelMatrix, modelMatrix, [1.8 - trig * 1.8, 0, fast * 0.2 - 0.6]);
                mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 4 + trig * Math.PI / 4);
                break;
            }
            case 'diagonal': {
                const fast = Math.abs(Math.sin(pSwingProgress * Math.PI * 4));
                mat4.translate(modelMatrix, modelMatrix, [1.1 - fast * 1.1, 0.8, -0.4]);
                mat4.rotateX(modelMatrix, modelMatrix, -Math.PI / 10 - Math.PI * fast / 4);
                mat4.rotateY(modelMatrix, modelMatrix, -Math.PI * fast / 4);
                mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 6);
                break;
            }
        }

        return;
        */

        // не смотрит в подзорную трубу
        if (!player.isScoping()) {
            // главная рука
            let flag = hand == InteractionHand.MAIN_HAND;
            // @param {HumanoidArm}
            let humanoidarm = flag ? player.getMainArm() : player.getMainArm().getOpposite();
            // хз что такое
            // modelMatrix.pushPose();
            if (matInHand.isEmpty()) {
                console.log('empty', matInHand)
                // в руке ничего нет
                if (flag && !player.isInvisible()) {
                    this.renderPlayerArm(modelMatrix, p_109380_, pCombinedLight, pEquippedProgress, pSwingProgress, humanoidarm);
                }
            /*
            } else if (matInHand.is(BLOCK.FILLED_MAP)) {
                // ЗАПОЛНЕННАЯ КАРТА
                if (flag && this.offHandItem.isEmpty()) {
                    this.renderTwoHandedMap(modelMatrix, p_109380_, pCombinedLight, pPitch, pEquippedProgress, pSwingProgress);
                } else {
                    this.renderOneHandedMap(modelMatrix, p_109380_, pCombinedLight, pEquippedProgress, humanoidarm, pSwingProgress, matInHand);
                }
            } else if (matInHand.is(BLOCK.CROSSBOW)) {
                // арбалет
                let flag1 = CrossbowItem.isCharged(matInHand);
                let flag2 = humanoidarm == HumanoidArm.RIGHT;
                let i = flag2 ? 1 : -1;
                if (player.isUsingItem() && player.getUseItemRemainingTicks() > 0 && player.getUsedItemHand() == hand) {
                    this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                    modelMatrix.translate((i * -0.4785682), -0.094387, 0.05731531);
                    modelMatrix.mulPose(Vector.XP.rotationDegrees(-11.935));
                    modelMatrix.mulPose(Vector.YP.rotationDegrees(i * 65.3));
                    modelMatrix.mulPose(Vector.ZP.rotationDegrees(i * -9.785));
                    let f9 = matInHand.getUseDuration() - (this.minecraft.player.getUseItemRemainingTicks() - pPartialTicks + 1.0);
                    let f13 = f9 / CrossbowItem.getChargeDuration(matInHand);
                    if (f13 > 1.0) {
                        f13 = 1.0;
                    }
    
                    if (f13 > 0.1) {
                        let f16 = Math.sin((f9 - 0.1) * 1.3);
                        let f3 = f13 - 0.1;
                        let f4 = f16 * f3;
                        modelMatrix.translate((f4 * 0.0), (f4 * 0.004), (f4 * 0.0));
                    }
    
                    modelMatrix.translate((f13 * 0.0), (f13 * 0.0), (f13 * 0.04));
                    modelMatrix.scale(1.0, 1.0, 1.0 + f13 * 0.2);
                    modelMatrix.mulPose(Vector.YN.rotationDegrees(i * 45.0));
                } else {
                    let f = -0.4 * Math.sin(Math.sqrt(pSwingProgress) * Math.PI);
                    let f1 = 0.2 * Math.sin(Math.sqrt(pSwingProgress) * (Math.PI * 2));
                    let f2 = -0.2 * Math.sin(pSwingProgress * Math.PI);
                    modelMatrix.translate((i * f), f1, f2);
                    this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                    this.applyItemArmAttackTransform(modelMatrix, humanoidarm, pSwingProgress);
                    if (flag1 && pSwingProgress < 0.001 && flag) {
                        modelMatrix.translate((i * -0.641864), 0.0, 0.0);
                        modelMatrix.mulPose(Vector.YP.rotationDegrees(i * 10.0));
                    }
                }
    
                this.renderItem(player, matInHand, flag2 ? ItemTransforms.TransformType.FIRST_PERSON_RIGHT_HAND : ItemTransforms.TransformType.FIRST_PERSON_LEFT_HAND, !flag2, modelMatrix, p_109380_, pCombinedLight);
            */
            } else {
                let flag3 = humanoidarm == HumanoidArm.RIGHT;
                if (player.isUsingItem() && player.getUseItemRemainingTicks() > 0 && player.getUsedItemHand() == hand) {
                    let k = flag3 ? 1 : -1;
                    switch(matInHand.getUseAnimation()) {
                        case ItemUseAnimation.NONE: {
                            this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                            break;
                        }
                        case ItemUseAnimation.EAT:
                        case ItemUseAnimation.DRINK: {
                            this.applyEatTransform(modelMatrix, pPartialTicks, humanoidarm, matInHand);
                            this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                            break;
                        }
                        case ItemUseAnimation.BLOCK: {
                            this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                            break;
                        }
                        /*case ItemUseAnimation.BOW: {
                            // лук
                            this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                            modelMatrix.translate((k * -0.2785682), 0.18344387, 0.15731531);
                            modelMatrix.mulPose(Vector.XP.rotationDegrees(-13.935));
                            modelMatrix.mulPose(Vector.YP.rotationDegrees(k * 35.3));
                            modelMatrix.mulPose(Vector.ZP.rotationDegrees(k * -9.785));
                            let f8 = matInHand.getUseDuration() - (this.minecraft.player.getUseItemRemainingTicks() - pPartialTicks + 1.0);
                            let f12 = f8 / 20.0;
                            f12 = (f12 * f12 + f12 * 2.0) / 3.0;
                            if (f12 > 1.0) {
                                f12 = 1.0;
                            }
    
                            if (f12 > 0.1) {
                                let f15 = Math.sin((f8 - 0.1) * 1.3);
                                let f18 = f12 - 0.1;
                                let f20 = f15 * f18;
                                modelMatrix.translate((f20 * 0.0), (f20 * 0.004), (f20 * 0.0));
                            }
    
                            modelMatrix.translate((f12 * 0.0), (f12 * 0.0), (f12 * 0.04));
                            modelMatrix.scale(1.0, 1.0, 1.0 + f12 * 0.2);
                            modelMatrix.mulPose(Vector.YN.rotationDegrees(k * 45.0));
                            break;
                        }
                        case ItemUseAnimation.SPEAR: {
                            // копье
                            this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                            modelMatrix.translate((k * -0.5), 0.7, 0.1);
                            modelMatrix.mulPose(Vector.XP.rotationDegrees(-55.0));
                            modelMatrix.mulPose(Vector.YP.rotationDegrees(k * 35.3));
                            modelMatrix.mulPose(Vector.ZP.rotationDegrees(k * -9.785));
                            let f7 = matInHand.getUseDuration() - (this.minecraft.player.getUseItemRemainingTicks() - pPartialTicks + 1.0);
                            let f11 = f7 / 10.0;
                            if (f11 > 1.0) {
                                f11 = 1.0;
                            }
    
                            if (f11 > 0.1) {
                                let f14 = Math.sin((f7 - 0.1) * 1.3);
                                let f17 = f11 - 0.1;
                                let f19 = f14 * f17;
                                modelMatrix.translate((f19 * 0.0), (f19 * 0.004), (f19 * 0.0));
                            }
    
                            modelMatrix.translate(0.0, 0.0, (f11 * 0.2));
                            modelMatrix.scale(1.0, 1.0, 1.0 + f11 * 0.2);
                            modelMatrix.mulPose(Vector.YN.rotationDegrees(k * 45.0));
                        }
                        */
                    }
                } else if (player.isAutoSpinAttack()) {
                    this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                    let j = flag3 ? 1 : -1;
                    modelMatrix.translate((j * -0.4), 0.8, 0.3);
                    modelMatrix.mulPose(Vector.YP.rotationDegrees(j * 65.0));
                    modelMatrix.mulPose(Vector.ZP.rotationDegrees(j * -85.0));
                } else {

                    // Java
                    //float f5 = -0.4F * Mth.sin(Mth.sqrt(p_109376_) * (float)Math.PI);
                    //float f6 = 0.2F * Mth.sin(Mth.sqrt(p_109376_) * ((float)Math.PI * 2F));
                    //float f10 = -0.2F * Mth.sin(p_109376_ * (float)Math.PI);
                    //int l = flag3 ? 1 : -1;
                    //modelMatrix.translate((double)((float)l * f5), (double)f6, (double)f10);
                    //this.applyItemArmTransform(modelMatrix, humanoidarm, p_109378_);
                    //this.applyItemArmAttackTransform(modelMatrix, humanoidarm, p_109376_);

                    /*
                    modelMatrix[0] = 0.9999999;
                    modelMatrix[1] = 0.0;
                    modelMatrix[2] = -5.267266E-4;
                    modelMatrix[3] = 0.0;
                    modelMatrix[4] = -5.022468E-7;
                    modelMatrix[5] = 0.9999995;
                    modelMatrix[6] = -9.5352455E-4;
                    modelMatrix[7] = 0.0;
                    modelMatrix[8] = 5.2672636E-4;
                    modelMatrix[9] = 9.5352466E-4;
                    modelMatrix[10] = 0.9999994;
                    modelMatrix[11] = 0.0;
                    modelMatrix[12] = 0.0;
                    modelMatrix[13] = 0.0;
                    modelMatrix[14] = 0.0;
                    modelMatrix[15] = 1.0;
                    */

                    let f5 = -0.4 * Math.sin(Math.sqrt(pSwingProgress) * Math.PI);
                    let f6 = 0.2 * Math.sin(Math.sqrt(pSwingProgress) * (Math.PI * 2));
                    let f10 = -0.2 * Math.sin(pSwingProgress * Math.PI);
                    let l = flag3 ? 1 : -1;
                    // modelMatrix.translate((l * f5), f6, f10);
                    mat4.translate(modelMatrix, modelMatrix, [l * f5, f10, f6]);
  
                    this.applyItemArmTransform(modelMatrix, humanoidarm, pEquippedProgress);
                    this.applyItemArmAttackTransform(modelMatrix, humanoidarm, pSwingProgress);

                }
    
                // this.renderItem(player, matInHand, flag3 ? ItemTransforms.TransformType.FIRST_PERSON_RIGHT_HAND : ItemTransforms.TransformType.FIRST_PERSON_LEFT_HAND, !flag3, modelMatrix, p_109380_, pCombinedLight);
            }
    
            // TODO: у нас нет стека матриц =(
            // modelMatrix.popPose();
        }
    }

    /**
    * @param {PoseStack} modelMatrix
    * @param {HumanoidArm} hand
    * @param {float} pEquippedProgress
    */
    applyItemArmTransform(modelMatrix, hand, pEquippedProgress) {

        // let i = p_109384_ == HumanoidArm.RIGHT ? 1 : -1;
        // modelMatrix.translate(i * 0.56, -0.52 + pEquippedProgress * -0.6, -0.72);

        let i = hand == HumanoidArm.RIGHT ? 1 : -1;
        const x = i * 0.56;
        const y = -0.52 + pEquippedProgress * -0.6;
        const z = -0.72
        mat4.translate(modelMatrix, modelMatrix, [x, z, y]);

    }

    /**
    * @param {PoseStack} modelMatrix
    * @param {HumanoidArm} hand
    * @param {float} pSwingProgress
    */
    applyItemArmAttackTransform(modelMatrix, hand, pSwingProgress) {

        // Java
        // let i = hand == HumanoidArm.RIGHT ? 1 : -1;
        // let f = Math.sin(p_109338_ * p_109338_ * Math.PI);
        // modelMatrix.mulPose(Vector.YP.rotationDegrees(i * (45.0 + f * -20.0)));

        // let f1 = Math.sin(Math.sqrt(p_109338_) * Math.PI);
        // modelMatrix.mulPose(Vector.ZP.rotationDegrees(i * f1 * -20.0));
        // modelMatrix.mulPose(Vector.XP.rotationDegrees(f1 * -80.0));
        // modelMatrix.mulPose(Vector.YP.rotationDegrees(i * -45.0));

        const i = hand == HumanoidArm.RIGHT ? 1 : -1;
        const f = Math.sin(pSwingProgress * pSwingProgress * Math.PI);

        const m = mat4.create();
        const q = quat.create();
        const deg2Rad = (i) => {
            return i;// (Math.PI / 180) * i;
        }

        mat4.multiply(modelMatrix, modelMatrix, mat4.fromQuat(modelMatrix, quat.setAxisAngle(q, Vector.ZP, deg2Rad(i * (45.0 + f * -20.0)))));

        const f1 = Math.sin(Math.sqrt(pSwingProgress) * Math.PI);
        mat4.multiply(modelMatrix, modelMatrix, mat4.fromQuat(modelMatrix, quat.setAxisAngle(q, Vector.YP, deg2Rad(i * f1 * -20.0))));
        mat4.multiply(modelMatrix, modelMatrix, mat4.fromQuat(modelMatrix, quat.setAxisAngle(q, Vector.XP, deg2Rad(f1 * -80.0))));
        mat4.multiply(modelMatrix, modelMatrix, mat4.fromQuat(modelMatrix, quat.setAxisAngle(q, Vector.ZP, deg2Rad(i * -45.0))));

    }
    
    /**
    * @param {PoseStack} modelMatrix
    * @param {float} pPartialTicks
    * @param {HumanoidArm} hand
    * @param {ItemStack} matInHand
    */
    applyEatTransform(modelMatrix, pPartialTicks, hand, matInHand) {
        let f = this.minecraft.player.getUseItemRemainingTicks() - pPartialTicks + 1.0;
        let f1 = f / matInHand.getUseDuration();
        if (f1 < 0.8) {
            let f2 = Math.abs(Math.cos(f / 4.0 * Math.PI) * 0.1);
            modelMatrix.translate(0.0, f2, 0.0);
        }
    
        let f3 = 1.0 - Math.pow(f1, 27.0);
        let i = hand == HumanoidArm.RIGHT ? 1 : -1;
        modelMatrix.translate((f3 * 0.6 * i), (f3 * -0.5), (f3 * 0.0));
        modelMatrix.mulPose(Vector.YP.rotationDegrees(i * f3 * 90.0));
        modelMatrix.mulPose(Vector.XP.rotationDegrees(f3 * 10.0));
        modelMatrix.mulPose(Vector.ZP.rotationDegrees(i * f3 * 30.0));
    }
    
    /**
    * @param {LivingEntity} player
    * @param {ItemStack} matInHand
    * @param {ItemTransforms.TransformType} p_109325_
    * @param {boolean} p_109326_
    * @param {PoseStack} modelMatrix
    * @param {MultiBufferSource} p_109328_
    * @param {int} p_109329_
    */
    renderItem(player, matInHand, p_109325_, p_109326_, modelMatrix, p_109328_, p_109329_) {
        if (!matInHand.isEmpty()) {
            this.itemRenderer.renderStatic(player, matInHand, p_109325_, p_109326_, modelMatrix, p_109328_, player.level, p_109329_, OverlayTexture.NO_OVERLAY, player.getId() + p_109325_.ordinal());
        }
    }
    
    /**
    * @param {PoseStack} modelMatrix
    * @param {MultiBufferSource} p_109348_
    * @param {int} pCombinedLight
    * @param {float} pEquippedProgress
    * @param {float} p_109349_
    * @param {pSwingProgress}
    * @param {*} humanoidarm
    */
    renderPlayerArm(modelMatrix, p_109348_, pCombinedLight, pEquippedProgress, pSwingProgress, humanoidarm) {
        /*
        let flag = humanoidarm != HumanoidArm.LEFT;
        let f = flag ? 1.0F : -1.0;
        let f1 = Math.sqrt(pSwingProgress);
        let f2 = -0.3 * Math.sin(f1 * Math.PI);
        let f3 = 0.4 * Math.sin(f1 * (Math.PI * 2));
        let f4 = -0.4 * Math.sin(pSwingProgress * Math.PI);
        modelMatrix.translate((f * (f2 + 0.64000005)), (f3 + -0.6 + pEquippedProgress * -0.6), (f4 + -0.71999997));
        modelMatrix.mulPose(Vector.YP.rotationDegrees(f * 45.0));
        let f5 = Math.sin(pSwingProgress * pSwingProgress * Math.PI);
        let f6 = Math.sin(f1 * Math.PI);
        modelMatrix.mulPose(Vector.YP.rotationDegrees(f * f6 * 70.0));
        modelMatrix.mulPose(Vector.ZP.rotationDegrees(f * f5 * -20.0));
        AbstractClientPlayer abstractclientplayer = this.minecraft.player;
        RenderSystem.setShaderTexture(0, abstractclientplayer.getSkinTextureLocation());
        modelMatrix.translate((f * -1.0), 3.6, 3.5);
        modelMatrix.mulPose(Vector.ZP.rotationDegrees(f * 120.0));
        modelMatrix.mulPose(Vector.XP.rotationDegrees(200.0));
        modelMatrix.mulPose(Vector.YP.rotationDegrees(f * -135.0));
        modelMatrix.translate((f * 5.6), 0.0, 0.0);
        */
        /*
        PlayerRenderer playerrenderer = (PlayerRenderer)this.entityRenderDispatcher.<AbstractClientPlayer>getRenderer(abstractclientplayer);
        if (flag) {
            playerrenderer.renderRightHand(modelMatrix, p_109348_, pCombinedLight, abstractclientplayer);
        } else {
            playerrenderer.renderLeftHand(modelMatrix, p_109348_, pCombinedLight, abstractclientplayer);
        }
        */
    }

}