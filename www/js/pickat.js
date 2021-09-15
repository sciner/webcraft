import {Color, Vector} from "./helpers.js";
import {BLOCK, CHUNK_SIZE_Y_MAX} from "./blocks.js";
import {BLEND_MODES} from "./renders/BaseRenderer.js";
import {Resources} from "./resources.js";
import GeometryTerrain from "./geometry_terrain.js";

const {mat4} = glMatrix;

const PICKAT_DIST = 5;
const TARGET_TEXTURES = [.5, .5, 1, 1];

const half = new Vector(0.5, 0.5, 0.5);

export class PickAt {

    constructor(render, onTarget) {
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
        // Material (damage)
        this.material_damage = render.renderBackend.createMaterial({
            cullFace: true,
            opaque: false,
            blendMode: BLEND_MODES.NORMAL,
            shader: render.shader
        });
        // Material (target)
        this.material_target = this.material_damage.getSubMat(render.renderBackend.createTexture({
            source: render.resources.pickat.target,
            minFilter: 'nearest',
            magFilter: 'nearest'
        }));
        //
        const modelMatrix = this.modelMatrix = mat4.create();
        mat4.scale(modelMatrix, modelMatrix, [1.002, 1.002, 1.002]);
    }

    //
    get(callback) {
        const player = Game.world.localPlayer;
        const render = this.render;
        const pos = new Vector(player.pos);
        const m = mat4.invert(mat4.create(), render.viewMatrix);
        pos.y = m[14];
        const startBlock = new Vector(Math.floor(pos.x) + 0.5, Math.floor(pos.y) + 0.5, Math.floor(pos.z) + 0.5);
        let dir = new Vector(-m[8], -m[10], -m[9]);
        if(dir.length() < 0.01) {
            if(callback) {
                callback(false);
            }
            return false;
        }
        dir = dir.normal();
        let block = new Vector(startBlock);
        let res = false;
        let side = new Vector(0, 0, 0);
        const INF = 100000.0;
        const eps = 1e-3;
        const coord = ['x', 'y', 'z'];
        let PICKAT_DISTANCE = PICKAT_DIST;
        if(Game.world.game_mode.isCreative()) {
            PICKAT_DISTANCE = PICKAT_DISTANCE * 2 | 0;
        }
        while (Math.abs(block.x - startBlock.x) < PICKAT_DISTANCE
            && Math.abs(block.y - startBlock.y) < PICKAT_DISTANCE
            && Math.abs(block.z - startBlock.z) < PICKAT_DISTANCE) {
            let tMin = INF;
            for(let d of coord) {
                if(dir[d] > eps && tMin > (block[d] + 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] + 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = 1;
                }
                if(dir[d] < -eps && tMin > (block[d] - 0.5 - pos[d]) / dir[d]) {
                    tMin = (block[d] - 0.5 - pos[d]) / dir[d];
                    side.zero()[d] = -1;
                }
            }
            if (tMin >= INF) {
                break;
            }
            pos.x += dir.x * tMin;
            pos.y += dir.y * tMin;
            pos.z += dir.z * tMin;
            block = block.add(side);
            if (/*block.y > CHUNK_SIZE_Y_MAX ||*/ block.y < 0) {
                break;
            }
            const ix = block.x | 0, iy = block.y | 0, iz = block.z | 0;
            let b = Game.world.chunkManager.getBlock(ix, iy, iz);
            if(b.id !== BLOCK.AIR.id && b.id !== BLOCK.STILL_WATER.id) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = {
                    x: ix,
                    y: iy,
                    z: iz,
                    n: side,
                    point: new Vector(pos.x, pos.y, pos.z).sub(new Vector(ix, iy, iz))
                };
                if(res.point.y == 1) {
                    res.point.y = 0;
                }
                break;
            }
        }
        if(callback) {
            callback(res);
        }
        return res;
    }

    // setEvent...
    setEvent(e) {
        e.start_time        = performance.now();
        e.destroyBlock      = e.button_id == 1;
        e.cloneBlock        = e.button_id == 2; // && this.world.game_mode.isCreative();
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
    setDamagePercent(percent) {
        let damage_block = this.damage_block;
        let new_frame = Math.round(percent * 9);
        if(damage_block.frame != new_frame) {
            damage_block.frame = new_frame;
            if(damage_block.mesh) {
                damage_block.mesh.destroy();
                damage_block.mesh = this.createTargetBuffer(BLOCK.calcTexture([new_frame, 15]));
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
            damage_block.mesh       = this.createTargetBuffer(BLOCK.calcTexture([damage_block.frame, 15]));
        }
    }

    // Сбросить текущий прогресс разрушения
    resetProgress() {
        let damage_block = this.damage_block;
        if(damage_block) {
            damage_block.times = 0;
        }
    }

    /**
     * update...
     */
    update() {
        // Get actual pick-at block
        let bPos = this.get();
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        target_block.visible = !!bPos;
        if(bPos) {
            // Check if pick-at block changed
            let tbp = target_block.pos;
            if(!tbp || (tbp.x != bPos.x || tbp.y != bPos.y || tbp.z != bPos.z /*|| tbp.n.x != bPos.n.x || tbp.n.y != bPos.n.y || tbp.n.z != bPos.n.z*/)) {
                // 1. Target block
                if(target_block.mesh) {
                    target_block.mesh.destroy();
                    target_block.mesh = null;
                }
                target_block.pos = bPos;
                target_block.mesh = this.createTargetBuffer(TARGET_TEXTURES);
                // 2. Damage block
                if(damage_block.event) {
                    damage_block.pos = bPos;
                    this.updateDamageBlock();
                }
            }
        } else {
            damage_block.prev_time = null;
        }
        this.calcDamage();
        // draw
        this.draw();
    }

    // calcDamage...
    calcDamage() {
        let target_block = this.target_block;
        let damage_block = this.damage_block;
        if(!target_block.visible) {
            return false;
        }
        if(!damage_block.event || !damage_block.mesh) {
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
            if(this.onTarget({...damage_block.pos}, {...damage_block.event}, damage_block.times / 1000, damage_block.number)) {
                // damage_block.event = false;
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
    createTargetBuffer(c) {
        let vertices    = [];
        let ao          = [0, 0, 0, 0];
        // let c           = BLOCK.calcTexture(textures);
        let lm          = new Color(0, 0, 0);
        let flags       = 0, sideFlags = 0, upFlags = 0;
        let bH          = 1;
        let width       = 1;
        let height      = 1;
        // Up;
        vertices.push(0, 0, bH - 1.5 + height,
            1, 0, 0,
            0, 1, 0,
            c[0], c[1], c[2], c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags | upFlags);
        // Bottom
        vertices.push(0, 0, -0.5,
            1, 0, 0,
            0, -1, 0,
            c[0], c[1], c[2], c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags);
        // Forward
        vertices.push(0, -width / 2, bH / 2 - 0.5,
            1, 0, 0,
            0, 0, bH,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        // Back
        vertices.push(0, +width / 2, bH / 2 - 0.5,
            1, 0, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        // Left
        vertices.push(- width / 2, 0, bH / 2 - 0.5,
            0, 1, 0,
            0, 0, -bH,
            c[0], c[1], -c[2], c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        // Right
        vertices.push(+ width / 2, 0, bH / 2 - 0.5,
            0, 1, 0,
            0, 0, bH,
            c[0], c[1], c[2], -c[3],
            lm.r, lm.g, lm.b,
            ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        return new GeometryTerrain(vertices);
    }

}
