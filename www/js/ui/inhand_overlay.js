import glMatrix from "../../vendors/gl-matrix-3.3.min.js";
import { BLOCK } from "../blocks.js";
import { Camera } from "../camera.js";
import { Mth, Vector } from "../helpers.js";
import Particles_Block_Drop from "../particles/block_drop.js";
import { Particle_Hand } from "../particles/block_hand.js";

const {mat4} = glMatrix;

const MINE_PERIOD = 20;
const MINE_TIME_SCALE = Math.PI * 2;

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

        this.handMesh = new Particle_Hand(skinId, render);

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

        const block = BLOCK.BLOCK_BY_ID.get(targetId);

        if (!block.spawnable) {
            return;
        }

        try {
            this.inHandItemMesh = new Particles_Block_Drop(/*null*/ null, block, Vector.ZERO);
        } catch(e) {
            console.log(e);
            //
        }
    }

    bobViewItem(player, viewMatrix) {
        if(!player || !player.walking  || player.getFlying()  || player.in_water ) {
            return;
        }

        let p_109140_ = player.walking_frame * 2 % 1;
        //
        let speed_mul = 1.0;
        let f = player.walkDist * speed_mul - player.walkDistO * speed_mul;
        let f1 = -(player.walkDist * speed_mul + f * p_109140_);
        let f2 = Mth.lerp(p_109140_, player.oBob, player.bob);
    
        mat4.translate(viewMatrix, viewMatrix, [
            Math.sin(f1 * Math.PI) * f2 * 0.25,
            -Math.abs(Math.cos(f1 * Math.PI) * f2) * 1,
            0.0,
        ]);
    
    }

    update (render, dt) {
        dt /= 1000;

        const {
            player, renderBackend, camera
        } = render;

        this.camera.width = camera.width;
        this.camera.height = camera.height;

        if (player.inMiningProcess || this.mineTime > dt * 2 / MINE_PERIOD) {
            this.mineTime += dt / MINE_PERIOD;

            if (this.mineTime >= 1) {
                this.mineTime = 0;
            }

            console.log(this.mineTime)
        } else {
            this.mineTime = 0;
        }

        const id = player.buildMaterial ? player.buildMaterial.id : -1;

        if (id !== this.inHandItemId && !this.changeAnimation) {
            this.changAnimationTime = 0;
            this.changeAnimation = true;
        }

        if (this.changeAnimation) {
            this.changAnimationTime += 0.05;
            
            if (this.changAnimationTime > 0.5) {
                this.reconstructInHandItem(id);
            }

            if (this.changAnimationTime >= 1) {
                this.changAnimationTime = 1;
                this.changeAnimation = false;
            }
        }
    }

    draw (render, dt) {
        const {
            player, globalUniforms, renderBackend
        } = render;

        const {
            camera, handMesh, inHandItemMesh
        } = this;

        this.update(render, dt);

        mat4.identity(camera.bobPrependMatrix);
        this.bobViewItem(player, camera.bobPrependMatrix);

        const animFrame = Math.cos(this.changAnimationTime * Math.PI * 2);

        camera.pos.set(
            -1,
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
        globalUniforms.brightness = Math.max(0.4, render.brightness);
        globalUniforms.update();

        renderBackend.clear({
            depth: true,
            color: false
        });

        const animMatrix = mat4.create();
        
        let animY = Math.cos(this.mineTime * MINE_TIME_SCALE);
        if(animY < 0) animY *= 0.5;

        mat4.translate(animMatrix, animMatrix, [
            0,
            Math.sin(this.mineTime * MINE_TIME_SCALE) * 1.2,
            -0.5 * (1 - animY),
        ])
        
        mat4.rotateX(animMatrix, animMatrix, -Math.sin(this.mineTime * MINE_TIME_SCALE) * Math.PI / 4)

        mat4.identity(handMesh.modelMatrix);
        mat4.scale(handMesh.modelMatrix, handMesh.modelMatrix, [1.5, 1.5, 1.5]);
        mat4.multiply(handMesh.modelMatrix, animMatrix, handMesh.modelMatrix);

        handMesh.drawDirectly(render);

        if (inHandItemMesh) {
            const {
                modelMatrix, block_material, pos
            } = inHandItemMesh;

            mat4.identity(modelMatrix);
            pos.set(0,0,0);

            // for axe and sticks
            if (block_material.diagonal) {                
                mat4.scale(modelMatrix, modelMatrix, [0.8, 0.8, 0.8]);
                mat4.rotateZ(modelMatrix, modelMatrix, - 2 * Math.PI / 5);
                mat4.rotateY(modelMatrix, modelMatrix, -Math.PI / 4);
                pos.set(0,0.2,0);

            } else {
                mat4.scale(modelMatrix, modelMatrix, [0.5, 0.5, 0.5]);
                mat4.rotateZ(modelMatrix, modelMatrix, -Math.PI / 4 + Math.PI);
            }

            mat4.multiply(modelMatrix, animMatrix, modelMatrix);

            inHandItemMesh.drawDirectly(render);
        }
    }
}