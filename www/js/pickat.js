import {Color, Vector} from "./helpers.js";
import {BLEND_MODES} from "./renders/BaseRenderer.js";
import GeometryTerrain from "./geometry_terrain.js";
import {Resources} from "./resources.js";
import {BLOCK} from "./blocks.js";
import { Raycaster } from "./Raycaster.js";

const {mat4} = glMatrix;

const TARGET_TEXTURES = [.5, .5, 1, 1];

const half = new Vector(0.5, 0.5, 0.5);

export class PickAt {

    constructor(world, render, onTarget) {
        this.world              = world;
        this.render             = render;
        //
        this.target_block       = {
            pos:                null,
            visible:            false,
            mesh:               null
        }
        //
        this.damage_block       = {
            pos:        null,
            mesh:       null,
            event:      null,
            frame:      0,
            number:     0,
            times:      0, // количество миллисекунд, в течение которого на блок было воздействие
            prev_time:  null, // точное время, когда в последний раз было воздействие на блок
            start:      null
        }
        this.onTarget           = onTarget; // (block, target_event, elapsed_time) => {...};
        //
        const modelMatrix = this.modelMatrix = mat4.create();
        mat4.scale(modelMatrix, modelMatrix, [1.002, 1.002, 1.002]);
        //
        this.empty_matrix = mat4.create();
        this.raycaster = new Raycaster(this.world);
    }

    get(pos, callback, pickat_distance) {
        const render = this.render;
        const m = mat4.invert(this.empty_matrix, render.viewMatrix);
        pos = new Vector(pos);
        pos.y = render.camPos.y;
        return this.raycaster.getFromView(pos, m, pickat_distance, callback);
    }

    // setEvent...
    setEvent(e) {
        e.start_time        = performance.now();
        e.destroyBlock      = e.button_id == 1;
        e.cloneBlock        = e.button_id == 2;
        e.createBlock       = e.button_id == 3;
        e.number            = 0;
        let damage_block = this.damage_block;
        damage_block.event = Object.assign(e, {number: 0});
        damage_block.start = performance.now();
        this.updateDamageBlock();
    }

    // clearEvent...
    clearEvent() {
        let damage_block = this.damage_block;
        damage_block.event = null;
        if(damage_block.mesh) {
            damage_block.mesh.destroy();
            damage_block.mesh = null;
        }
    }

    // setDamagePercent...
    setDamagePercent(pos, percent) {
        let damage_block = this.damage_block;
        let new_frame = Math.round(percent * 9);
        if(damage_block.frame != new_frame) {
            damage_block.frame = new_frame;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
                damage_block.mesh = this.createDamageBuffer(pos, BLOCK.calcTexture([new_frame, 15]));
            }
        }
    }

    // updateDamageBlock...
    updateDamageBlock() {
        let target_block = this.target_block;
        if(target_block.visible) {
            let damage_block = this.damage_block;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
            }
            damage_block.pos        = target_block.pos;
            damage_block.number     = 0;
            damage_block.frame      = 0;
            damage_block.times      = 0;
            damage_block.prev_time  = null;
            damage_block.mesh       = this.createDamageBuffer(damage_block.pos, BLOCK.calcTexture([damage_block.frame, 15]));
        }
    }

    // Сбросить текущий прогресс разрушения
    resetProgress() {
        let damage_block = this.damage_block;
        if(damage_block) {
            damage_block.times = 0;
        }
    }

    // update...
    update(pos, pickat_distance) {
        // Get actual pick-at block
        let bPos = this.get(pos, null, pickat_distance);
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        target_block.visible = !!bPos;
        if(bPos) {
            damage_block.pos = bPos;
            // Check if pick-at block changed
            let tbp = target_block.pos;
            if(!tbp || (tbp.x != bPos.x || tbp.y != bPos.y || tbp.z != bPos.z)) {
                // 1. Target block
                if(target_block.mesh) {
                    target_block.mesh.destroy();
                    target_block.mesh = null;
                }
                target_block.pos = bPos;
                target_block.mesh = this.createTargetBuffer(bPos, TARGET_TEXTURES);
                // 2. Damage block
                if(damage_block.event) {
                    damage_block.pos = bPos;
                    this.updateDamageBlock();
                }
            }
        } else {
            damage_block.prev_time = null;
        }
        this.checkTargets();
    }

    // checkTargets...
    async checkTargets() {
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        if(!target_block.visible) {
            return false;
        }
        if(!damage_block.event) {
            return false;
        }
        damage_block.number++;
        damage_block.event.number++;
        let pn = performance.now();
        if(damage_block.prev_time) {
            damage_block.times += pn - damage_block.prev_time;
        }
        damage_block.prev_time = pn;
        if(this.onTarget instanceof Function) {
            // полное копирование, во избежания модификации
            let event = {...damage_block.event};
            event.id = ~~(Date.now() / 1000);
            event.pos = {...damage_block.pos};
            event.pos.n = event.pos.n.clone();
            event.pos.point = event.pos.point.clone();
            if(await this.onTarget(event, damage_block.times / 1000, damage_block.number)) {
                this.updateDamageBlock();
                if(damage_block.mesh) {
                    damage_block.mesh.destroy();
                    damage_block.mesh = null;
                }
            }
        }
        return false;
    }

    // Draw meshes
    draw() {
        if(!this.material_target) {
            this.initMaterials();
        }
        let render = this.render;
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        // 1. Target block
        if(target_block.mesh && target_block.visible) {
            const a_pos = half.add(this.target_block.pos);
            render.renderBackend.drawMesh(target_block.mesh, this.material_target, a_pos, this.modelMatrix);
        }
        // 2. Damage block
        if(damage_block.mesh && damage_block.event && damage_block.event.destroyBlock && damage_block.frame > 0) {
            const a_pos = half.add(this.damage_block.pos);
            render.renderBackend.drawMesh(damage_block.mesh, this.material_damage, a_pos, this.modelMatrix);
        }
    }

    // createTargetBuffer...
    createTargetBuffer(pos, c) {
        let vertices    = [];
        let lm          = new Color(0, 0, 0);
        let flags       = 0, sideFlags = 0, upFlags = 0;
        let block       = this.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        let shapes      = BLOCK.getShapes(pos, block, this.world, false, true);
        for(let shape of shapes) {
            let x1 = shape[0];
            let x2 = shape[3];
            let y1 = shape[1];
            let y2 = shape[4];
            let z1 = shape[2];
            let z2 = shape[5];
            let xw = x2 - x1; // ширина по оси X
            let yw = y2 - y1; // ширина по оси Y
            let zw = z2 - z1; // ширина по оси Z
            let x = -.5 + x1 + xw/2;
            let y_top = -.5 + y2;
            let y_bottom = -.5 + y1;
            let z = -.5 + z1 + zw/2;
            // Up; X,Z,Y
            vertices.push(x, z, y_top,
                xw, 0, 0,
                0, zw, 0,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags | upFlags);
            // Bottom
            vertices.push(x, z, y_bottom,
                xw, 0, 0,
                0, -zw, 0,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b, flags);
            // South | Forward | z++ (XZY)
            vertices.push(x, z - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
            // North | Back | z--
            vertices.push(x, z + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
            // West | Left | x--
            vertices.push(x - xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
            // East | Right | x++
            vertices.push(x + xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b, flags | sideFlags);
        }
        return new GeometryTerrain(vertices);
    }

    // createDamageBuffer...
    createDamageBuffer(pos, c) {
        return this.createTargetBuffer(pos, c);
    }

    // initMaterials
    initMaterials() {
        // Material (damage)
        this.material_damage = this.render.renderBackend.createMaterial({
            cullFace: true,
            opaque: false,
            blendMode: BLEND_MODES.NORMAL,
            shader: this.render.defaultShader,
        });
        // Material (target)
        this.material_target = this.material_damage.getSubMat(this.render.renderBackend.createTexture({
            source: Resources.pickat.target,
            minFilter: 'nearest',
            magFilter: 'nearest'
        }));
    }

    // resetTargetPos...
    resetTargetPos() {
        this.target_block.pos = new Vector(0, -Number.MAX_SAFE_INTEGER, 0);
    }

}
