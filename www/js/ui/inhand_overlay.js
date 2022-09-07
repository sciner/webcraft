import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { BLOCK } from "../blocks.js";
import { Camera } from "../camera.js";
import { RENDER_DEFAULT_ARM_HIT_PERIOD } from "../constant.js";
import { Mth, Vector } from "../helpers.js";
import Particles_Block_Drop from "../particles/block_drop.js";
import { Particle_Hand } from "../particles/block_hand.js";

const {mat4} = glMatrix;
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
         * @type {Particles_Block_Drop}
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
            this.inHandItemMesh = new Particles_Block_Drop(null, null, [block], Vector.ZERO, m);
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
        if (!player.inMiningProcess) {
            this.mineTime = 0;
        }
        
        if (player.inMiningProcess || this.mineTime > (delta * 10) / RENDER_DEFAULT_ARM_HIT_PERIOD) {
            this.mineTime += delta / (5 * RENDER_DEFAULT_ARM_HIT_PERIOD);
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

    draw(render, dt) {
        const {
            player, globalUniforms, renderBackend
        } = render;

        const {
            camera, inHandItemMesh
        } = this;

        this.update(render, dt);

        mat4.identity(camera.bobPrependMatrix);
        this.bobViewItem(player, camera.bobPrependMatrix);

        const animFrame = Math.cos(this.changAnimationTime * Math.PI * 2);

        camera.pos.set(
            0,
            0.5,
            -1.5 * animFrame
        );
        camera.set(
            camera.pos,
            Vector.ZERO,
            camera.bobPrependMatrix
        );

        // change GU for valid in hand block drawings
        camera.use(globalUniforms, false);
        globalUniforms.brightness = Math.max(0.4, render.env.fullBrightness);
        globalUniforms.update();

        renderBackend.beginPass({
            clearDepth: true,
            clearColor: false
        });
        
        const phasedTime = this.mineTime;
        
        if (inHandItemMesh) {
            const {
                modelMatrix, block_material, pos
            } = inHandItemMesh;
            
            mat4.identity(modelMatrix);
            pos.set(0, 0, 0);
            
            // for axe and sticks
            if (block_material.diagonal) {
                const fast = Math.abs(Math.sin(phasedTime * Math.PI * 4));
                mat4.translate(modelMatrix, modelMatrix, [1.1 - fast * 1.1, 0.8, -0.4]);
                mat4.rotateX(modelMatrix, modelMatrix, -Math.PI / 10 - Math.PI * fast / 4);
                mat4.rotateY(modelMatrix, modelMatrix, -Math.PI * fast / 4);
                mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 6);
            } else {
                if (block_material?.item?.name == 'food') {
                    const fast = Math.abs(Math.sin(phasedTime * Math.PI * 6));
                    const trig = 1 - Math.pow(1 - phasedTime, 10);
                    mat4.translate(modelMatrix, modelMatrix, [1.8 - trig * 1.8, 0, fast * 0.2 - 0.6]);
                    mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 4 + trig * Math.PI / 4);
                } else {
                    const fast = Math.abs(Math.sin(phasedTime * Math.PI * 4));
                    mat4.translate(modelMatrix, modelMatrix, [1.8 - fast * 1.8, fast * 2, fast * 0.6 - 0.6]);
                    mat4.rotateX(modelMatrix, modelMatrix, -Math.PI / 14);
                    mat4.rotateZ(modelMatrix, modelMatrix, Math.PI / 4 - fast * Math.PI / 4);
                }
            }
            inHandItemMesh.drawDirectly(render, modelMatrix);
        }
        renderBackend.endPass();
    }
}