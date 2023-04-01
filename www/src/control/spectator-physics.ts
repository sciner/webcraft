"use strict";

import {PHYSICS_INTERVAL_MS, PLAYER_HEIGHT, SPECTATOR_SPEED_MUL} from "../constant.js";
import {Mth, Vector} from "../helpers.js";
import {PlayerControl} from "./player_control.js";
import type {World} from "../world.js";
import {PLAYER_CONTROL_TYPE} from "./player_control.js";
import type {PlayerTickData} from "./player_tick_data.js";

/**
 * Конфиг скорости для одного типа движения.
 * Все значения даны за 1 секунду, но препроцессинг конфига автоматически пересчитывает их в
 * значения за {@link PHYSICS_INTERVAL_MS}.
 */
type TFreeSpeedConfig = {
    /** Макс. скорость. Измеряется в блоках/секунду. */
    max                     : float
    /**
     * Линейное ускорение.
     * Измеряется в (доля макс. скорости)/секунду.
     * Например, acceleration = 2 означает: к скорости добавляется 2 макс. скорости в секунду,
     * в результате чего разгон от 0 до (макс. скорость) займет 0.5 секунды.
     */
    acceleration            ? : float
    /**
     * Задает начиная с какой скорости включается эффект снижения ускорения при приближении
     * к максимальной скорости. Чем ближе к макс. скорости, тем меньше ускорение
     * Такое поведение было в старом коде, и эта настройка достигает похожего (хотя не строго таких же значений).
     * Значение от 0 до 1 - в долях от максимальной скорости.
     * 1 - выключено (т.е. эффект включается не раньше чем достигнута макс. скорость)
     * 0.5 - начиная с достижения половины макс. скорости
     * 0 - с начала движения
     *
     * Используется только для горизонтального движения (так было в старом коде).
     */
    diminishingAccelerationThreshold ? : float
    /**
     * Минимальное значение ускорения при приближении у макс. скорости.
     * Используется только если задано {@link diminishingAccelerationThreshold}
     * В тех же единицах, что и {@link acceleration}
     */
    diminishingAcceleration          ? : float
    /**
     * Линейное ускорение торможения. Применяется когда игрок отпустил кнопки.
     * В тех же единицах, что и {@link acceleration}
     */
    deceleration            ? : float
    /**
     * Экспоненциальное торможение. Применяется когда игрок отпустил кнопки.
     * В каждый равный промежуток времени скорость уменьшается в одно и то же число раз.
     * Значение 0 до 1. Это значение задается в конфиге за 1 секунду.
     * Например, 0.25 означает что через скунду останется 0.25 первоначальной скорости
     * (а за 0.5 секунды останется sqrt(0.25) = 0.5 первоначальной скорости)
     */
    exponentialDeceleration ? : float
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
const Y_SPEED_SCALING = 1

export const SPECTATOR_SPEED_CHANGE_MULTIPLIER = 1.05
export const SPECTATOR_SPEED_CHANGE_MIN = 0.05
export const SPECTATOR_SPEED_CHANGE_MAX = 16

const SPEEDS: Dict<TFreeSpeedConfig> = {
    HORIZONTAL: {
        max                     : 11.5,
        acceleration            : 4.0,
        deceleration            : 2.0,
        exponentialDeceleration : 0.035
    },
    UP: {
        max                     : 5.7,
        acceleration            : 4.0,
        deceleration            : 2.0,
        exponentialDeceleration : 0.035
    },
    DOWN: {
        max                     : 5.7,
        acceleration            : 4.0,
        deceleration            : 2.0,
        exponentialDeceleration : 0.035
    }
}

export class SpectatorPlayerControl extends PlayerControl {

    world: World
    speedMultiplier = 1

    private tmpVec = new Vector()
    private backupVel = new Vector()

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

    get type()                  { return PLAYER_CONTROL_TYPE.SPECTATOR }
    get requiresChunk(): boolean { return false }
    get sneak(): boolean        { return false }
    get playerHeight(): float   { return PLAYER_HEIGHT }

    resetState(): void {
        super.resetState()
        this.speedMultiplier = 1
    }

    simulatePhysicsTick(): void {
        const UP            = SPEEDS.UP
        const DOWN          = SPEEDS.DOWN
        const HORIZONTAL    = SPEEDS.HORIZONTAL
        const controls      = this.controls
        const vel           = this.player_state.vel
        const mul           = this.speedMultiplier * (this.controls.sprint ? 1.5 : 1) * SPECTATOR_SPEED_MUL

        const forceUp       = to01(controls.jump)       - to01(controls.sneak)
        const forceForward  = to01(controls.forward)    - to01(controls.back)
        const forceLeft     = to01(controls.left)       - to01(controls.right)

        // change Y velocity
        if (forceUp === 0) {
            vel.y = this.decelerate(vel.y, vel.y > 0 ? UP : DOWN, mul)
        } else {
            if (Math.sign(vel.y) !== forceUp) {
                vel.y = 0
            }
            const mulY = mul > 1
                ? 1 + (mul - 1) * Y_SPEED_SCALING
                : mul
            vel.y = forceUp > 0
                ? Math.min(vel.y + UP.acceleration * mulY, UP.max * mulY)
                : Math.max(vel.y - DOWN.acceleration * mulY, -DOWN.max * mulY)
        }

        // change XZ speed
        if (!(forceLeft || forceForward)) {
            // decelerate
            const oldVelScalar = vel.horizontalLength()
            if (oldVelScalar) {
                const newVelScalar = this.decelerate(oldVelScalar, HORIZONTAL, mul)
                vel.mulScalarSelf(newVelScalar / oldVelScalar)
            }
        } else {
            const conf = HORIZONTAL
            const max = conf.max * mul

            // calculate the desired speed
            const tmpVec = this.tmpVec
                .setScalar(-forceLeft, 0, forceForward)
                .normalizeSelf(max)
                .rotateYawSelf(this.player_state.yaw)
            // the difference between the desired speed and the current speed
            tmpVec.subSelf(vel)
            const deltaVelScalar = tmpVec.horizontalLength()
            // when the speed is closing to the desired, acceleration is reduced
            const diminishedAcceleration = Mth.lerpAny(deltaVelScalar,
                0, conf.diminishingAcceleration,
                max * (1 - conf.diminishingAccelerationThreshold), conf.acceleration
            )
            // acceleration in this tick, to make speed closer to desired
            let accelerationScalar = Math.min(deltaVelScalar, diminishedAcceleration * mul)
            if (accelerationScalar) {
                tmpVec.normalizeSelf(accelerationScalar) // delta velocity vector
                vel.addSelf(tmpVec)
            }
        }

        // change the position
        this.player_state.pos.addScalarSelf(vel.x, vel.y, vel.z)
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

    private decelerate(v: float, conf: TFreeSpeedConfig, mul: float): float {
        v *= conf.exponentialDeceleration
        return v > 0
            ? Math.max(v - conf.deceleration * mul, 0)
            : Math.min(v + conf.deceleration * mul, 0)
    }
}

function to01(v?: boolean): int {
    return (v as any) * 1
}

/** Adjusts values in {@link SPEEDS} to be independent of {@link PHYSICS_INTERVAL_MS} */
function initStatics() {
    const k = PHYSICS_INTERVAL_MS / 1000
    for(const conf of Object.values(SPEEDS)) {
        conf.diminishingAccelerationThreshold ??= 1
        conf.exponentialDeceleration = Math.pow(conf.exponentialDeceleration ?? 1, k)
        conf.max *= k // from blocks per second to blocks per 100 ms; adjust by the tick length
        // adjust by the tick length (.max in acceleration/deceleration is multiplied by k twice - it's correct)
        conf.acceleration = (conf.acceleration ?? 0) * conf.max * k
        conf.deceleration = (conf.deceleration ?? 0) * conf.max * k
        conf.diminishingAcceleration = (conf.diminishingAcceleration ?? 0) * conf.max * k
    }
}

initStatics()