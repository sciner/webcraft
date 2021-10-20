import {Color, Vector} from "./helpers.js";
import {CHUNK_SIZE_Y_MAX} from "./chunk.js";
import {BLEND_MODES} from "./renders/BaseRenderer.js";
import {Resources} from "./resources.js";
import GeometryTerrain from "./geometry_terrain.js";

const {mat4} = glMatrix;

export const DEFAULT_PICKAT_DIST = 5;
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
        //
        this.empty_matrix = mat4.create();
    }

    //
    get(callback, pickat_distance) {
        const player = Game.world.localPlayer;
        const render = this.render;
        const pos = new Vector(player.pos);
        const m = mat4.invert(this.empty_matrix, render.viewMatrix);
        pos.y = render.camPos.y;
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
        let leftTop = new Vector(0, 0, 0);
        let check = new Vector(0, 0, 0);
        while (Math.abs(block.x - startBlock.x) < pickat_distance
            && Math.abs(block.y - startBlock.y) < pickat_distance
            && Math.abs(block.z - startBlock.z) < pickat_distance) {
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

            leftTop.x = Math.floor(block.x);
            leftTop.y = Math.floor(block.y);
            leftTop.z = Math.floor(block.z);
            let b = Game.world.chunkManager.getBlock(leftTop.x, leftTop.y, leftTop.z);

            let hitShape = b.id > BLOCK.AIR.id && b.id !== BLOCK.STILL_WATER.id;

            if (hitShape) {
                const shapes = BLOCK.getShapes(leftTop, b, Game.world, false, true);
                let flag = false;

                for (let i=0;i<shapes.length;i++) {
                    const shape = shapes[i];

                    for(let j=0;j<3;j++) {
                        const d = coord[j];
                        if(dir[d] > eps && tMin + eps > (shape[j] + leftTop[d] - pos[d]) / dir[d]) {
                            const t = (shape[j] + leftTop[d] - pos[d]) / dir[d];
                            check.x = pos.x - leftTop.x + t * dir.x;
                            check.y = pos.y - leftTop.y + t * dir.y;
                            check.z = pos.z - leftTop.z + t * dir.z;
                            if (shape[0] - eps < check.x && check.x < shape[3] + eps
                                && shape[1] - eps < check.y && check.y < shape[4] + eps
                                && shape[2] - eps < check.z && check.z < shape[5] + eps) {
                                tMin = t;
                                side.zero()[d] = 1;
                                flag = true;
                            }
                        }
                        if(dir[d] < -eps && tMin + eps > (shape[j + 3] + leftTop[d] - pos[d]) / dir[d]) {
                            const t = (shape[j + 3] + leftTop[d] - pos[d]) / dir[d];
                            check.x = pos.x - leftTop.x + t * dir.x;
                            check.y = pos.y - leftTop.y + t * dir.y;
                            check.z = pos.z - leftTop.z + t * dir.z;
                            if (shape[0] - eps < check.x && check.x < shape[3] + eps
                                && shape[1] - eps < check.y && check.y < shape[4] + eps
                                && shape[2] - eps < check.z && check.z < shape[5] + eps) {
                                tMin = t;
                                side.zero()[d] = -1;
                                flag = true;
                            }
                        }
                    }
                }

                hitShape = flag;
            }

            pos.x += dir.x * tMin;
            pos.y += dir.y * tMin;
            pos.z += dir.z * tMin;

            if (hitShape) {
                side.x = -side.x;
                side.y = -side.y;
                side.z = -side.z;
                res = {
                    x: leftTop.x,
                    y: leftTop.y,
                    z: leftTop.z,
                    n: side,
                    point: new Vector(pos.x, pos.y, pos.z).sub(leftTop)
                };
                if(res.point.y == 1) {
                    res.point.y = 0;
                }
                break;
            }

            block = block.add(side);
            if (/*block.y > CHUNK_SIZE_Y_MAX ||*/ block.y < 0) {
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
    update(pickat_distance) {
        // Get actual pick-at block
        let bPos = this.get(null, pickat_distance);
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
    createTargetBuffer(pos, c) {
        let vertices    = [];
        let ao          = [0, 0, 0, 0];
        let lm          = new Color(0, 0, 0);
        let flags       = 0, sideFlags = 0, upFlags = 0;
        let block       = Game.world.chunkManager.getBlock(pos.x, pos.y, pos.z);
        let shapes      = BLOCK.getShapes(pos, block, Game.world, false, true);
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
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | upFlags);
            // Bottom
            vertices.push(x, z, y_bottom,
                xw, 0, 0,
                0, -zw, 0,
                c[0], c[1], c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags);
            // South | Forward | z++ (XZY)
            vertices.push(x, z - zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, yw,
                c[0], c[1], c[2], -c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
            // North | Back | z--
            vertices.push(x, z + zw/2, y_bottom + yw/2,
                xw, 0, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
            // West | Left | x--
            vertices.push(x - xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, -yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
            // East | Right | x++
            vertices.push(x + xw/2, z, y_bottom + yw/2,
                0, zw, 0,
                0, 0, yw,
                c[0], c[1], -c[2], c[3],
                lm.r, lm.g, lm.b,
                ao[0], ao[1], ao[2], ao[3], flags | sideFlags);
        }
        return new GeometryTerrain(vertices);
    }

    // createDamageBuffer...
    createDamageBuffer(pos, c) {
        return this.createTargetBuffer(pos, c);
    }

}