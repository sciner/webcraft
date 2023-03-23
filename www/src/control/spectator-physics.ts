"use strict";

import {PHYSICS_INTERVAL_MS, PLAYER_HEIGHT, SPECTATOR_SPEED_MUL} from "../constant.js";
import {Vector} from "../helpers.js";
import {PlayerControl} from "./player_control.js";
import type {World} from "../world.js";
import {PLAYER_CONTROL_TYPE} from "./player_control.js";
import type {PlayerTickData} from "./player_tick_data.js";

/**
 * All values are given per 100 ms. If {@link PHYSICS_INTERVAL_MS} is not 100 ms,
 * these values are automatically adjusted to make the simulation independent of the tick length.
 */
type TFreeSpeedConfig = {
    max                     : float
    acceleration            ? : float
    accelerationPercent     ? : float // fraction of the max value added to the acceleration
    exponentialSlowdown     ? : float // like deceleration, but applied during acceleration
    deceleration            ? : float
    decelerationPercent     ? : float
    exponentialDeceleration ? : float
}

/**
 * How much effect {@link SpectatorPlayerControl.speedMultiplier} has on the vertical speed.
 * 1 means it has full effect (the same as on horizontal speed).
 */
const Y_SPEED_SCALING = 1

export const SPECTATOR_SPEED_CHANGE_MULTIPLIER = 1.05
export const SPECTATOR_SPEED_CHANGE_MIN = 0.05
export const SPECTATOR_SPEED_CHANGE_MAX = 16

const SPEEDS: Dict<TFreeSpeedConfig> = {
    HORIZONTAL: {
        max                     : 1.3,
        accelerationPercent     : 0.03,
        exponentialSlowdown     : 0.95,
        deceleration            : 0.001,
        exponentialDeceleration : 0.85
    },
    UP: {
        max                     : 0.65,
        acceleration            : Infinity, // instantly to max speed
        decelerationPercent     : 0.22 // slightly less than 0.5 seconds to stop
    },
    DOWN: {
        max                     : 0.65,
        acceleration            : Infinity, // instantly to max speed
        exponentialDeceleration : 0 // stops abruptly. That's how it behaved in the old code.
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
            vel.y = this.decelerate(vel.y, vel.y > 0 ? UP : DOWN)
        } else {
            if (Math.sign(vel.y) !== forceUp) {
                vel.y *= UP.exponentialDeceleration
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
                const newVelScalar = this.decelerate(oldVelScalar, HORIZONTAL)
                vel.mulScalarSelf(newVelScalar / oldVelScalar)
            }
        } else {
            // calculate the desired speed
            const tmpVec = this.tmpVec
                .setScalar(-forceLeft, 0, forceForward)
                .normalizeSelf(HORIZONTAL.max * mul)
                .rotateYawSelf(this.player_state.yaw)
            // the difference between the desired speed and the current speed
            tmpVec.subSelf(vel)
            // acceleration in this tick, to make speed closer to desired
            let accelerationScalar = Math.min(tmpVec.horizontalLength(), HORIZONTAL.acceleration * mul)
            if (accelerationScalar) {
                tmpVec.normalizeSelf(accelerationScalar) // delta velocity vector
                vel.addSelf(tmpVec)
                vel.mulScalarSelf(HORIZONTAL.exponentialSlowdown)
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

    private decelerate(v: float, conf: TFreeSpeedConfig): float {
        v *= conf.exponentialDeceleration
        return v > 0
            ? Math.max(v - conf.deceleration, 0)
            : Math.min(v + conf.deceleration, 0)
    }
}

function to01(v?: boolean): int {
    return (v as any) * 1
}

/** Adjusts values in {@link SPEEDS} to be independent of {@link PHYSICS_INTERVAL_MS} */
function initStatics() {
    const k = PHYSICS_INTERVAL_MS / 100
    for(const conf of Object.values(SPEEDS)) {
        // add accelerationPercent to acceleration
        conf.acceleration = (conf.acceleration ?? 0) + (conf.accelerationPercent ?? 0) * conf.max
        conf.deceleration = (conf.deceleration ?? 0) + (conf.decelerationPercent ?? 0) * conf.max
        // adjust by the tick length
        conf.acceleration *= k
        conf.deceleration *= k
        conf.exponentialSlowdown    = Math.pow(conf.exponentialSlowdown ?? 1, k)
        conf.max *= k / conf.exponentialSlowdown
        conf.exponentialDeceleration = Math.pow(conf.exponentialDeceleration ?? 1, k)
    }
}

initStatics()