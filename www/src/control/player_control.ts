"use strict";

import type {Vector} from "../helpers/vector.js";
import type {PlayerTickData} from "./player_tick_data.js";
import {PHYSICS_POS_DECIMALS} from "../constant.js";
import type {ClientPlayerControlManager} from "./player_control_manager.js";
import {GAME_MODE, GameModeData} from "../game_mode.js";
import type {Driving} from "./driving.js";

export enum PLAYER_CONTROL_TYPE {
    PRISMARINE,
    SPECTATOR
}

/** Fields used to update both controls and state by mobs. */
export type MobControlParams = {
    yaw ?       : float
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
    sneak?      : boolean
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

export function canSwitchFlying(gameMode: GameModeData, driving: Driving<any> | null): boolean {
    return gameMode.id === GAME_MODE.CREATIVE && driving == null || driving?.config.canFly
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
export abstract class PlayerControl<TState extends IPlayerControlState = IPlayerControlState> {
    controls    : IPlayerControls       // Input
    player_state: TState   // Input-output
    /**
     * Input-output. Определено только в состоянии вождения для водителя.
     * Если определено - это состояние общего объекта, который симулируется вместо {@link player_state}
     * Устанавливается непосредственно преде симуляцией и корректно во время симуляции. В другое время может содержать мусор.
     */
    drivingCombinedState?: TState | null
    /**
     * Копия состояния (или подмножества его полей), которые могут меняются при симуляции
     * и могут быть испорчены при неудачной симуляции
     */
    abstract backupState: Dict

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
    abstract get playerHeight(): float

    /** @return состояние, которое участвует в симуляции (самого объекта, или общего объекта вождения) */
    get simulatedState(): TState {
        return this.drivingCombinedState ?? this.player_state
    }

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

    /** @param mob - типа Mob (на сервере) */
    updateControlsFromMob(params: MobControlParams, defaultYaw: float): void {
        const controls = this.controls
        this.player_state.yaw = params.yaw ?? defaultYaw
        if (params.forward != null) {
            controls.forward = params.forward
        }
        if (params.jump != null) {
            controls.jump = params.jump
        }
        if (params.sneak != null) {
            controls.sneak = params.sneak
        }
        if (params.pitch != null) {
            controls.pitch = params.pitch
        }
    }

    /**
     * Resets the state after the player control change.
     * Override it to reset something specific to that control.
     */
    resetState(): void {
        this.player_state.vel.zero()
    }

    /** Вызывается в каждом кадре на клиенте */
    updateFrame(controlManger: ClientPlayerControlManager): void {
        // ничего; переопределено в подклассах
    }

    /**
     * Copies a part of the state that may become corrupted if the simulation throws an exception.
     * Which data is backed up, is up to the implementation.
     */
    abstract copyPartialStateFromTo(src: any, dst: any): void

    /** Performs player's movement during one physics tick, see {@link PHYSICS_INTERVAL_MS} */
    abstract simulatePhysicsTick(): boolean

    /**
     * Server-only.
     * It's used when it's impossible to perform the simulation (e.g. the chunk data is missing).
     * It validates the client data for obvious cheating or incorrect data format.
     * @returns true if the  data is valid
     * @throws if the data is invalid (it has the same effect as returning false).
     */
    abstract validateWithoutSimulation(prevData: PlayerTickData | undefined, data: PlayerTickData): boolean
}