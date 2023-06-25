import {Camera_3d} from "./renders/camera_3d.js";
import {PLAYER_ZOOM, THIRD_PERSON_CAMERA_DISTANCE} from "./constant.js";
import type {Player} from "./player.js";
import {Vector} from "./helpers/vector.js";
import {CAMERA_MODE} from "./helpers/helper_const.js";
import {Mth} from "./helpers/mth.js";
import {BlockAccessor} from "./block_accessor.js";
import {AABB} from "./core/AABB.js";
import glMatrix from "@vendors/gl-matrix-3.3.min.js";
import {FrustumProxy} from "./frustum.js";
const {mat4} = glMatrix;

export const DEFAULT_FOV_NORMAL = 70;
export const ZOOM_FACTOR        = 0.25;
const FOV_CHANGE_SPEED          = 75;
const FOV_FLYING_CHANGE_SPEED   = 35;
const FOV_FLYING_FACTOR         = 1.075;
const FOV_WIDE_FACTOR           = 1.15;
const FOV_ZOOM                  = DEFAULT_FOV_NORMAL * ZOOM_FACTOR;
const NEAR_DISTANCE             = (1 / 24) * PLAYER_ZOOM; // было (2 / 16) * PLAYER_ZOOM. Уменьшено чтобы не заглядывать в препятствия и внутрь головы
const RENDER_DISTANCE           = 800;
// Shake camera on damage
const DAMAGE_TIME               = 250;
const DAMAGE_CAMERA_SHAKE_VALUE = 0.2;
// авто-камера в режиме 3-го лица
const CAMERA_3P_MARGIN_HEIGHT   = 0.04 // насколько широко расставлять 4 луча для поиска препятствия (по вертикали), при FOV 70 градусов
const BOB_VIEW_SAFE_DISTANCE    = 0.5   // если камера ближе этого расстояния до блока, амплитуда bobView уменьшается

const tmpVec                    = new Vector()
const tmpOrthoVec1              = new Vector()
const tmpOrthoVec2              = new Vector()
const tmpShiftedEyePos          = new Vector()
const tmpAABB                   = new AABB()

export class GameCamera extends Camera_3d {
    settings_fov = 0;
    options_fov: any;
    private blockAccessor?: BlockAccessor = null;
    frustum = new FrustumProxy()
    mode: CAMERA_MODE = CAMERA_MODE.SHOOTER

    constructor(options) {
        super({
            ...options,
            type: Camera_3d.PERSP_CAMERA,
            fov: DEFAULT_FOV_NORMAL,
            min: NEAR_DISTANCE,
            max: RENDER_DISTANCE,
            scale: 0.05
        });
        this.settings_fov = this.fov;
        this.options_fov = {
            FOV_WIDE_FACTOR, FOV_ZOOM, ZOOM_FACTOR, FOV_CHANGE_SPEED, NEAR_DISTANCE,
            RENDER_DISTANCE, FOV_FLYING_FACTOR, FOV_FLYING_CHANGE_SPEED
        };

    }

    updateFOV(delta: number, zoom: boolean, running: boolean, flying: boolean) {
        const {
            FOV_WIDE_FACTOR,
            FOV_ZOOM,
            FOV_CHANGE_SPEED,
            NEAR_DISTANCE,
            RENDER_DISTANCE,
            FOV_FLYING_FACTOR,
            FOV_FLYING_CHANGE_SPEED
        } = this.options_fov;
        let target_fov = this.settings_fov;
        let new_fov = null;
        if (zoom) {
            target_fov = FOV_ZOOM;
        } else {
            if (running) {
                target_fov += (target_fov + DEFAULT_FOV_NORMAL) / 2 * (FOV_WIDE_FACTOR - 1);
            } else if (flying) {
                target_fov += (target_fov + DEFAULT_FOV_NORMAL) / 2 * (FOV_FLYING_FACTOR - 1);
            }
        }
        if (this.fov < target_fov) {
            new_fov = Math.min(this.fov + FOV_CHANGE_SPEED * delta, target_fov);
        }
        if (this.fov > target_fov) {
            new_fov = Math.max(this.fov - FOV_CHANGE_SPEED * delta, target_fov);
        }
        if (new_fov !== null) {
            this.setPerspective(new_fov, NEAR_DISTANCE, RENDER_DISTANCE);
        }
    }

    setSettingsFov(settings_fov) {
        this.settings_fov = settings_fov;
    }


    /**
     * Moves the camera to the specified orientation.
      */
    setForPlayer(player : Player, pos : Vector, rotate : Vector, force : boolean = false) {
        const { world } = player;
        const tmp = mat4.create();
        const hotbar = Qubatch.hotbar;

        // Shake camera on damage
        if(hotbar.last_damage_time && performance.now() - hotbar.last_damage_time < DAMAGE_TIME) {
            const percent = (performance.now() - hotbar.last_damage_time) / DAMAGE_TIME;
            let value = 0;

            if(percent < .25) {
                value = -DAMAGE_CAMERA_SHAKE_VALUE * (percent / .25);
            } else {
                value = -DAMAGE_CAMERA_SHAKE_VALUE + DAMAGE_CAMERA_SHAKE_VALUE * ((percent - .25) / .75);
            }
            rotate.y = value;
        } else {
            rotate.y = 0;
        }

        let cam_pos = pos;
        let cam_rotate = rotate;

        if(!force) {

            let bobViewAmplitude = 1
            Qubatch.hud.underlay.crosshairOn = (this.mode === CAMERA_MODE.SHOOTER); // && !player.game_mode.isSpectator();

            if(this.mode === CAMERA_MODE.SHOOTER) {
                // do nothing
            } else {
                cam_rotate = rotate.clone();
                // back
                if(this.mode == CAMERA_MODE.THIRD_PERSON_FRONT) {
                    // front
                    cam_rotate.z = rotate.z + Math.PI;
                    cam_rotate.x *= -1;
                }
                const view_vector = player.forward.clone();
                view_vector.multiplyScalarSelf(this.mode == CAMERA_MODE.THIRD_PERSON ? -1 : 1)
                //
                let distToCamera = THIRD_PERSON_CAMERA_DISTANCE; // - 1/4 + Math.sin(performance.now() / 5000) * 1/4;
                if(!player.game_mode.isSpectator() && !player.controlManager.isFreeCam) {
                    // Выпускаем 4 параллельные луча от глаз в обратную сторону к камере
                    const raycaster = player.pickAt.raycaster
                    const myPlayerModel = world.players.getMyself()
                    const height = (this.fov ?? 70) / 70 * CAMERA_3P_MARGIN_HEIGHT // FOV задан по вертикали
                    const width = height * Math.min( 2, this.width / this.height)
                    const orthoVec1 = tmpOrthoVec1.zero().movePolarSelf(width, 0, cam_rotate.z + Mth.PI_DIV2)
                    const orthoVec2 = tmpOrthoVec2.zero().movePolarSelf(height, cam_rotate.x + Mth.PI_DIV2, cam_rotate.z)
                    const posFloored = pos.floored()
                    for(let [sign1, sign2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                        tmpShiftedEyePos.set(
                            pos.x + sign1 * orthoVec1.x + sign2 * orthoVec2.x,
                            pos.y + sign1 * orthoVec1.y + sign2 * orthoVec2.y,
                            pos.z + sign1 * orthoVec1.z + sign2 * orthoVec2.z
                        )
                        const bPos = raycaster.get(tmpShiftedEyePos, view_vector, THIRD_PERSON_CAMERA_DISTANCE + 1, null, true, false, myPlayerModel, false)
                        if(bPos?.point && !posFloored.equal(tmpVec.copyFrom(bPos).flooredSelf())) {
                            this.obstacle_pos.copyFrom(bPos).addSelf(bPos.point)
                            const dist = tmpShiftedEyePos.distance(this.obstacle_pos)
                            distToCamera = Math.max(Math.min(distToCamera, dist), 0)
                        }
                    }
                }
                cam_pos = pos.clone().movePolarSelf(-distToCamera, cam_rotate.x, cam_rotate.z);
                const model = this.player.getModel()
                if(model) {
                    model.opacity = distToCamera < .75 ? Math.pow(distToCamera / .75, 4) : 1
                }

                // найти расстояние до ближайшего блока и уменьшить ампилтуду bobView
                if (player.hasBobView()) {
                    const camBlockPos = cam_pos.floored()
                    const acc = this.blockAccessor ??= new BlockAccessor(world)
                    acc.reset(camBlockPos)
                    let minDist = Infinity
                    for(let dx = -1; dx <= 1; dx++) {
                        for(let dy = -1; dy <= 1; dy++) {
                            for(let dz = -1; dz <= 1; dz++) {
                                tmpVec.set(camBlockPos.x + dx, camBlockPos.y + dy, camBlockPos.z + dz)
                                const block = acc.set(tmpVec).block
                                const material = block.material
                                if (material.id > 0 && !material.invisible_for_cam) {
                                    const shapes = world.block_manager.getShapes(block, world, false, true)
                                    for(const shape of shapes) {
                                        const dist = tmpAABB.setArray(shape).translateByVec(tmpVec).distance(cam_pos)
                                        minDist = Math.min(minDist, dist)
                                    }
                                }
                            }
                        }
                    }
                    bobViewAmplitude = Mth.lerpAny(minDist, 0, 0, BOB_VIEW_SAFE_DISTANCE, 1)
                }
            }

            if (player.hasBobView()) {
                this.bobView(player, tmp, false, bobViewAmplitude);
            }
        }

        this.set(cam_pos, cam_rotate, tmp);
        this.frustum.setFromProjectionMatrix(this.viewProjMatrix, this.pos);
    }


    // Original bobView
    bobView(player: Player, viewMatrix, forDrop = false, amplitude: float = 1) {

        let p_109140_ = (player.walking_frame * 2) % 1;

        //
        let speed_mul = 1.0 / player.scale;
        let f = (player.walkDist * speed_mul - player.walkDistO * speed_mul);
        let f1 = -(player.walkDist * speed_mul + f * p_109140_);
        let f2 = Mth.lerp(p_109140_, player.oBob, player.bob);

        //
        let zmul = (Mth.sin(f1 * Math.PI) * f2 * 3.0) / player.scale;
        let xmul = Math.abs(Mth.cos(f1 * Math.PI - 0.2) * f2) / player.scale;
        let m = Math.PI / 180;

        //
        //
        if(forDrop) {
            mat4.translate(viewMatrix, viewMatrix, [
                Mth.sin(f1 * Math.PI) * f2 * 0.25,
                -Math.abs(Mth.cos(f1 * Math.PI) * f2) * 1,
                0.0,
            ]);
        } else {
            mat4.multiply(viewMatrix, viewMatrix, mat4.fromZRotation([], zmul * m)); // амплитуда не влияет, т.к. этот поворот не позволяет заглядывать за стенки
            mat4.multiply(viewMatrix, viewMatrix, mat4.fromXRotation([], xmul * m * amplitude));
            mat4.translate(viewMatrix, viewMatrix, [
                Mth.sin(f1 * Math.PI) * f2 * 0.5 * amplitude,
                0.0,
                -Math.abs(Mth.cos(f1 * Math.PI) * f2) * amplitude,
            ]);
        }
        if(Math.sign(viewMatrix[1]) != Math.sign(this.step_side)) {
            this.step_side = viewMatrix[1];
            //player.triggerEvent('step', {step_side: this.step_side});
        }
    }
}