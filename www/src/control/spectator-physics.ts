"use strict";

import {PHYSICS_INTERVAL_MS, PLAYER_HEIGHT, SPECTATOR_SPEED_MUL} from "../constant.js";
import {Mth, Vector} from "../helpers.js";
import {PlayerControl} from "./player_control.js";
import type {World} from "../world.js";
import {PLAYER_CONTROL_TYPE} from "./player_control.js";
import type {PlayerTickData} from "./player_tick_data.js";
import {ClientPlayerTickData} from "./player_tick_data.js";
import type {ClientPlayerControlManager} from "./player_control_manager.js";

/**
 * Описание конфига скорости для одного типа движения.
 */
type TFreeSpeedConfig = {
    /** Макс. скорость. Измеряется в блоках/секунду. */
    max                     : float
    /** Время (в миллисекундах), в течение которго линейно разгоняется от 0 до макс. скорости. */
    acceleration_time ? : float
    /**
     * Время в миллисекундах, за которое скорость экспоненциально приблизится на 50% к своему конечному значению.
     * Реализовано только для горионтального движения.
     * Например, если это значение 100, начальная скорость 0, а конечная 10, то
     * через     100 мс скорость станет равна (0 + 10) / 2 = 5,
     * еще через 100 мс скорость станет равна (5 + 10) / 2 = 7.5, и т.п.
     */
    exponential_acceleration_half_time ? : float
    /**
     * Аналогично {@link exponential_acceleration_half_time}, но может быть меньше чем это значение,
     * и служит для более быстрого изменения скорости на противоположную.
     *
     * Если разница между текущей и желаемой скоростью (дина вектора) меньше, чем {@link max},
     * то применяется {@link exponential_acceleration_half_time}.
     * Если больше, чем ({@link OPPOSITE_ACCELERATION_THRESHOLD} * {@link max}), то это время.
     * Между этими значениями, настройка линейно  нтерполируется.
     * Примеры:
     * - при разгоне с нуля, в началае скорости отличаются на 100%
     * - если на макс. скорости измененить направление на противоположное, скорости отличаются на 200%
     * - при изменении направления на 90 градусов на макс. скорости, длина вектора-разницы скоростей sqrt(2) = 141%
     * См. также
     */
    opposite_exponential_acceleration_half_time ? : float
    /** Время (в миллисекундах), в течение которго линейно тормозит от макс. скорости до 0 если отпустить клавиши. */
    deceleration_time ? : float
    /** Время в миллисекундах, за которое скорость экспоненциально снижается вдвое если отпустить клавиши. */
    exponential_deceleration_half_time ? : float,
}

/**
 * Конфиги движения.
 */
const SPEED_CONFIGS: Dict<TFreeSpeedConfig> = {
    HORIZONTAL: {
        max                                         : 11.5,
        exponential_acceleration_half_time          : 170,
        opposite_exponential_acceleration_half_time : 100,
        deceleration_time                           : 2000,
        exponential_deceleration_half_time          : 200
    },
    VERTICAL: {
        max                                         : 7.1,
        acceleration_time                           : 280,
        deceleration_time                           : 500,
        exponential_deceleration_half_time          : 200
    }
}

/**
 * Насколько сиьный эффект {@link SpectatorPlayerControl.speedMultiplier} имеет на увеличение вертикальной
 * скорости. От 0 до 1. 1 - полный эффект.
 *
 * Зачем это: чтобы при сильном увеличеснии горизонтальной скорости (много чанков в секунду) вертикальная
 * росла не так быстро, и игрок не промахивался мимо уровня земли.
 *
 * How much effect {@link SpectatorPlayerControl.speedMultiplier} has on the vertical speed.
 * 1 means it has full effect (the same as on horizontal speed).
 */
const Y_SPEED_SCALING = 0.8

/**
 * От 1 до 2. Это минимальная относительная разница в скоростях, начиная с которой
 * полностью используется {@link TFreeSpeedConfig.opposite_exponential_acceleration_half_time}
 */
const OPPOSITE_ACCELERATION_THRESHOLD = 1.35

export const SPECTATOR_SPEED_CHANGE_MULTIPLIER = 1.05
export const SPECTATOR_SPEED_CHANGE_MIN = 0.05
export const SPECTATOR_SPEED_CHANGE_MAX = 16

const MAX_DELTA_TIME = 500

type TFreeSpeed = {
    max                             : float
    acceleration                    : float
    exponential_acceleration_half_time  : float
    opposite_exponential_acceleration_half_time : float
    deceleration                    : float
    exponentialDeceleration         : float
}

const SPEEDS: Dict<TFreeSpeed> = {}

export class SpectatorPlayerControl extends PlayerControl {

    world: World
    speedMultiplier = 1
    /** Accumulated difference between player_state.pos and the position in the current tick */
    private accumulatedDeltaPos = new Vector()
    private currentVelocity = new Vector()
    private prevTickVelocity = new Vector()

    private tmpDesiredVel = new Vector()
    private backupVel = new Vector()
    private prevTime: number
    private tmpTickData = new ClientPlayerTickData()

    constructor(world: World, start_position: Vector) {
        super()
        this.world = world
        this.player_state = {
            yaw: 0,
            vel: new Vector(0, 0, 0),
            pos: start_position.clone(),
            onGround: true,
            flying: true,
            isInWater: false
        }
    }

    getCurrentPos(dst: Vector): void {
        dst.copyFrom(this.player_state.pos).addSelf(this.accumulatedDeltaPos)
    }

    get type()                  { return PLAYER_CONTROL_TYPE.SPECTATOR }
    get requiresChunk(): boolean { return false }
    get sneak(): boolean        { return false }
    get playerHeight(): float   { return PLAYER_HEIGHT }

    resetState(): void {
        super.resetState()
        this.speedMultiplier = 1
        this.accumulatedDeltaPos.zero()
        this.prevTickVelocity.zero()
        this.currentVelocity.zero()
        this.prevTime = performance.now()
    }

    updateFrame(controlManager: ClientPlayerControlManager) {
        const now = performance.now()
        const deltaSeconds = 0.001 * Math.min(now - this.prevTime, MAX_DELTA_TIME)
        this.prevTime = now

        // copy player's input to this control
        this.tmpTickData.initInputFrom(controlManager, 1, 1)
        this.tmpTickData.applyInputTo(controlManager, this)

        const VERTICAL      = SPEEDS.VERTICAL
        const HORIZONTAL    = SPEEDS.HORIZONTAL
        const controls      = this.controls
        const vel           = this.currentVelocity
        const mul           = this.speedMultiplier * (this.controls.sprint ? 1.5 : 1) * SPECTATOR_SPEED_MUL

        const forceUp       = to01(controls.jump)       - to01(controls.sneak)
        const forceForward  = to01(controls.forward)    - to01(controls.back)
        const forceLeft     = to01(controls.left)       - to01(controls.right)

        // change Y velocity
        if (forceUp === 0) {
            vel.y = this.decelerate(vel.y, VERTICAL, mul, deltaSeconds)
        } else {
            if (Math.sign(vel.y) !== forceUp) { // reverse direction without inertia
                vel.y = 0
            }
            const mulY = mul > 1
                ? 1 + (mul - 1) * Y_SPEED_SCALING
                : mul
            vel.y = Mth.clampModule(
                vel.y + forceUp * VERTICAL.acceleration * mulY * deltaSeconds,
                VERTICAL.max * mulY
            )
        }

        // change XZ speed
        if (!(forceLeft || forceForward)) {
            // decelerate
            const oldVelScalar = vel.horizontalLength()
            if (oldVelScalar) {
                const newVelScalar = this.decelerate(oldVelScalar, HORIZONTAL, mul, deltaSeconds)
                vel.x *= newVelScalar / oldVelScalar
                vel.z *= newVelScalar / oldVelScalar
            }
        } else {
            const max = HORIZONTAL.max * mul
            // calculate the desired speed
            const desiredVel = this.tmpDesiredVel
                .setScalar(-forceLeft, 0, forceForward)
                .normalizeSelf(max)
                .rotateYawSelf(this.player_state.yaw)

            // make big changes (e.g. reverse direction) with higher acceleration
            const exponentialAccelerationHalfTime = Mth.lerpAny(
                desiredVel.distance(vel) / max,
                1,
                HORIZONTAL.exponential_acceleration_half_time,
                OPPOSITE_ACCELERATION_THRESHOLD,
                HORIZONTAL.opposite_exponential_acceleration_half_time
            )

            // exponentially approach the desired velocity
            const k = Math.pow(0.5, 1000 / exponentialAccelerationHalfTime * deltaSeconds)
            vel.x = Mth.lerp(k, desiredVel.x, vel.x)
            vel.z = Mth.lerp(k, desiredVel.z, vel.z)
        }

        // change the position
        const deltaTicks = deltaSeconds * 1000 / PHYSICS_INTERVAL_MS
        this.accumulatedDeltaPos.addScalarSelf(vel.x * deltaTicks, vel.y * deltaTicks, vel.z * deltaTicks)
    }

    simulatePhysicsTick(): void {
        const ps = this.player_state
        ps.pos.addSelf(this.accumulatedDeltaPos)
        this.accumulatedDeltaPos.zero()

        const deltaVel = this.currentVelocity.subSelf(this.prevTickVelocity)
        ps.vel.addSelf(deltaVel)
        this.prevTickVelocity.copyFrom(ps.vel)
        this.currentVelocity.copyFrom(ps.vel)
    }

    backupPartialState(): void {
        this.backupVel.copyFrom(this.player_state.vel)
    }

    restorePartialState(pos: Vector): void {
        this.player_state.pos.copyFrom(pos)
        this.player_state.vel.copyFrom(this.backupVel)
    }

    validateWithoutSimulation(prevData: PlayerTickData | null, data: PlayerTickData): boolean {
        return true
    }

    private decelerate(v: float, conf: TFreeSpeed, mul: float, deltaSeconds: float): float {
        v *= Math.pow(conf.exponentialDeceleration, deltaSeconds)
        return v > 0
            ? Math.max(v - conf.deceleration * mul * deltaSeconds, 0)
            : Math.min(v + conf.deceleration * mul * deltaSeconds, 0)
    }
}

function to01(v?: boolean): int {
    return (v as any) * 1
}

function initStatics() {
    if (SPEED_CONFIGS.VERTICAL.exponential_acceleration_half_time || SPEED_CONFIGS.VERTICAL.opposite_exponential_acceleration_half_time) {
        throw "SPEED_CONFIGS.VERTICAL.exponential_acceleration_half_time and opposite_exponential_acceleration_half_time are not implemented, use acceleration_time instead"
    }
    if (SPEED_CONFIGS.HORIZONTAL.acceleration_time) {
        throw "SPEED_CONFIGS.HORIZONTAL.acceleration_time is not implemented, use exponential_acceleration_half_time instead"
    }
    for(const key in SPEED_CONFIGS) {
        const conf = SPEED_CONFIGS[key]
        const value: TFreeSpeed = SPEEDS[key] = {} as any
        value.exponential_acceleration_half_time = conf.exponential_acceleration_half_time
        value.opposite_exponential_acceleration_half_time = conf.opposite_exponential_acceleration_half_time
            ?? conf.exponential_acceleration_half_time
        value.exponentialDeceleration = conf.exponential_deceleration_half_time
            ? Math.pow(0.5, 1000 / conf.exponential_deceleration_half_time)
            : 1
        value.max = conf.max * PHYSICS_INTERVAL_MS / 1000 // from blocks per second to blocks per PHYSICS_INTERVAL_MS ms
        // adjust by the tick length (.max in acceleration/deceleration is multiplied by k twice - it's correct)
        value.acceleration = conf.acceleration_time
            ? 1000 / conf.acceleration_time * value.max
            : 0
        value.deceleration = conf.deceleration_time
            ? 1000 / conf.deceleration_time * value.max
            : 0
    }
}

initStatics()