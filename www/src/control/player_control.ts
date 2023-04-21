"use strict";

import type {Vector} from "../helpers/vector.js";
import type {PlayerTickData} from "./player_tick_data.js";
import {PHYSICS_POS_DECIMALS, PHYSICS_VELOCITY_DECIMALS} from "../constant.js";
import type {Driving} from "./driving.js";

export enum PLAYER_CONTROL_TYPE {
    PRISMARINE,
    SPECTATOR
}

/** Fields used to update both controls and state by mobs. */
export type MobControlParams = {
    yaw         : float
    forward     : boolean
    jump        : boolean
    sneak ?     : boolean
    pitch ?     : boolean
}

/** A common interface for {@link PlayerControl.player_state} for all subclasses of {@link PlayerControl} */
export interface IPlayerControlState {
    yaw         : float
    vel         : Vector
    pos         : Vector
    onGround    : boolean
    flying      : boolean
    isInWater   : boolean
    isOnLadder? : boolean
}

/**
 * Common fields that represent player input. Implemented by:
 * - actual player controls {@link PlayerControls} used by the player
 * - {@link PlayerControl.controls} in all subclasses of {@link PlayerControl}. These values are copied
 *  from the player controls, or are left unused (e.g., for drop items).
 */
export interface IPlayerControls {
    forward ?   : boolean
    back ?      : boolean
    left ?      : boolean
    right ?     : boolean
    jump ?      : boolean
    sprint ?    : boolean
    sneak ?     : boolean
    pitch ?     : boolean   // only for mob
}

/** It stores and processes player's input on the client. */
export class PlayerControls implements IPlayerControls {
    forward: boolean
    back: boolean
    left: boolean
    right: boolean
    jump: boolean
    sprint: boolean
    sneak: boolean

    mouseX: number
    mouseY: number
    mouse_sensitivity: number
    inited: boolean
    enabled: boolean

    constructor(options) {
        this.mouseX             = 0;
        this.mouseY             = 0;
        this.mouse_sensitivity  = (options.mouse_sensitivity ?? 100.0) / 100;
        this.inited             = false;
        this.enabled            = false;
        this.reset();
    }

    // reset controls
    reset(): void {
        this.setState(false, false, false, false, false, false, false);
    }

    setState(forward: boolean, back: boolean, left: boolean, right: boolean, jump: boolean, sneak: boolean, sprint: boolean): void {
        this.forward            = forward;
        this.back               = back;
        this.left               = left;
        this.right              = right;
        this.jump               = jump;
        this.sneak              = sneak;
        this.sprint             = sprint;
    }
}

/**
 * A base class for all player controllers.
 * It implements physics, movement and reactions to the player's input.
 */
export abstract class PlayerControl {
    controls    : IPlayerControls       // Input
    player_state: IPlayerControlState   // Input-output

    protected constructor() {
        this.controls = {
            forward: false,
            back: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            sneak: false
        }
    }

    abstract get type(): PLAYER_CONTROL_TYPE
    abstract get requiresChunk(): boolean
    abstract get sneak(): boolean
    abstract get playerHeight(): float

    /**
     * The result is read-only. It's valid only until the next change.
     * Do not modify it directly or store a reference to it.
     */
    getPos(): Vector { return this.player_state.pos }

    /**
     * Do not modify IPlayerControlState.pos outside the control directly.
     * Use this method instead.
     */
    setPos(pos: IVector): void {
        this.player_state.pos.copyFrom(pos).roundSelf(PHYSICS_POS_DECIMALS)
    }

    updateControlsFromMob(params: MobControlParams): void {
        const controls = this.controls
        this.player_state.yaw = params.yaw
        controls.forward = params.forward
        controls.jump = params.jump
        controls.sneak = params.sneak
        controls.pitch = params.pitch
    }

    /**
     * Resets the state after the player control change.
     * Override it to reset something specific to that control.
     */
    resetState(): void {
        this.player_state.vel.zero()
    }

    /**
     * Backs up the part of the state that may become corrupted if the simulation throws an exception.
     * Which data is backed up, is up to the implementation. It doesn't have to back up the position,
     * because it's backed up externally.
     */
    abstract backupPartialState(): void

    /** Restores the state corrupted by failed simulation to the values previously saved by {@link backupPartialState} */
    abstract restorePartialState(pos: Vector): void

    /** Performs player's movement during one physics tick, see {@link PHYSICS_INTERVAL_MS} */
    abstract simulatePhysicsTick(driving?: Driving<any> | null): boolean

    /**
     * Server-only.
     * It's used when it's impossible to perform the simulation (e.g. the chunk data is missing).
     * It validates the client data for obvious cheating or incorrect data format.
     * @returns true if the  data is valid
     * @throws if the data is invalid (it has the same effect as returning false).
     */
    abstract validateWithoutSimulation(prevData: PlayerTickData | undefined, data: PlayerTickData): boolean
}