import {Vector} from "../helpers/vector.js";
import type {PlayerControl} from "./player_control.js";
import {DataValidator, InDeltaCompressor, OutDeltaCompressor, packBooleans, unpackBooleans} from "../packet_compressor.js";
import {GameMode} from "../game_mode.js";
import type {Player} from "../player.js";
import {PHYSICS_ROTATION_DECIMALS} from "../constant.js";
import type {PlayerControlManager} from "./player_control_manager.js";

export enum PLAYER_TICK_DATA_STATUS {
    NEW = 1,
    PROCESSED_SEND_ASAP,
    PROCESSED_SENDING_DELAYED,
    SENT
}

/** It represents input and output of player controls & physics in one several consecutive physics ticks. */
export class PlayerTickData {
    protected static INPUT_FLAGS_COUNT = 8
    protected static OUT_FLAGS_COUNT = 2

    private static SEQUENCE_INPUT = 0
    private static SEQUENCE_CONTEXT_AND_OUTPUT = 1

    // input data
    inputFlags: int
    inputRotation = new Vector()
    // it's not a direct user input, but it's initialized/transferred along with input, because it fulfills a similar role
    physicsTicks: int // how many simulated physics ticks are contained in this data
    // context data - needed to repeat ticks correctly (acts somewhat like input, but from the game rather than the user)
    contextGameModeIndex: int
    contextControlType: int
    // output data
    outFlags: int
    outPos = new Vector()
    outVelocity = new Vector()

    /** Returns true if every serializable field is equal except {@link physicsTicks} */
    equal(other: PlayerTickData): boolean {
        return this.outEqual(other) && this.contextEqual(other) &&
            this.inputFlags === other.inputFlags &&
            this.inputRotation.equal(other.inputRotation)
    }

    initInputEmpty(prev: PlayerTickData | null, physicsTicks: int) {
        this.physicsTicks = physicsTicks
        this.inputFlags = 0
        if (prev) {
            this.inputRotation.copyFrom(prev.inputRotation)
        } else {
            this.inputRotation.set(0, 0, 0)
        }
    }

    copyInputFrom(src: PlayerTickData) {
        this.physicsTicks = src.physicsTicks
        this.inputFlags = src.inputFlags
        this.inputRotation.copyFrom(src.inputRotation)
    }

    applyInputTo(controlManager: PlayerControlManager, pc: PlayerControl) {
        const controls = pc.controls
        const player_state = pc.player_state
        // TODO rewrite it into a single destructing assignment when IntellijIDEA starts understanding it
        const [back, forward, right, left, jump, sneak, sprint, switchFlying] = unpackBooleans(
            this.inputFlags, PlayerTickData.INPUT_FLAGS_COUNT)
        controls.back       = back
        controls.forward    = forward
        controls.right      = right
        controls.left       = left
        controls.jump       = jump
        controls.sneak      = sneak
        controls.sprint     = sprint
        player_state.yaw = this.inputRotation.z

        const game_mode = GameMode.byIndex[this.contextGameModeIndex]
        if (switchFlying && game_mode.can_fly) {
            player_state.flying = !player_state.flying
        }
    }

    initContextFrom(player: Player) {
        const controlManager = player.controlManager
        this.contextGameModeIndex  = player.game_mode.getCurrent().index
        this.contextControlType   = controlManager.current.type
    }

    copyContextFrom(src: PlayerTickData) {
        this.contextControlType = src.contextControlType
        this.contextGameModeIndex = src.contextGameModeIndex
    }

    contextEqual(other: PlayerTickData): boolean {
        return this.contextControlType === other.contextControlType &&
            this.contextGameModeIndex === other.contextGameModeIndex
    }

    initOutputFrom(pc: PlayerControl) {
        this.outFlags = packBooleans(pc.sneak, pc.player_state.flying)
        this.outPos.copyFrom(pc.player_state.pos)
        this.outVelocity.copyFrom(pc.player_state.vel)
    }

    copyOutputFrom(src: PlayerTickData) {
        this.outFlags = src.outFlags
        this.outPos.copyFrom(src.outPos)
        this.outVelocity.copyFrom(src.outVelocity)
    }

    applyOutputToControl(pc: PlayerControl) {
        const [sneak, flying] = unpackBooleans(this.outFlags, PlayerTickData.OUT_FLAGS_COUNT)
        const player_state = pc.player_state
        player_state.flying = flying
        player_state.pos.copyFrom(this.outPos)
        player_state.vel.copyFrom(this.outVelocity)
    }

    outEqual(other: PlayerTickData): boolean {
        return this.outFlags === other.outFlags &&
            this.outPos.equal(other.outPos) &&
            this.outVelocity.equal(other.outVelocity)
    }

    writeInput(dc: OutDeltaCompressor) {
        dc.startSequence(PlayerTickData.SEQUENCE_INPUT)
            .putInt(this.physicsTicks)
            .putInt(this.inputFlags)
            .putFloatVector(this.inputRotation)
    }

    writeContextAndOutput(dc: OutDeltaCompressor) {
        dc.startSequence(PlayerTickData.SEQUENCE_CONTEXT_AND_OUTPUT)
            // context
            .putInt(this.contextControlType)
            .putInt(this.contextGameModeIndex)
            // output
            .putInt(this.outFlags)
            .putFloatVector(this.outPos)
            .putFloatVector(this.outVelocity)
    }

    readInput(dc: InDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_INPUT)
        this.physicsTicks = dc.getInt()
        DataValidator.checkMinMax(this.physicsTicks, 1)
        this.inputFlags = dc.getInt()
        dc.getFloatVector(this.inputRotation)
    }

    readContextAndOutput(dc: InDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_CONTEXT_AND_OUTPUT)
        // context
        this.contextControlType = dc.getInt()
        this.contextGameModeIndex = dc.getInt()
        // output
        this.outFlags = dc.getInt()
        dc.getFloatVector(this.outPos)
        dc.getFloatVector(this.outVelocity)
    }

    toStr(startingPhysicsTick: int): string {
        return `t${startingPhysicsTick}+${this.physicsTicks}=t${startingPhysicsTick+this.physicsTicks} ${this.outPos}`
    }
}

export class ClientPlayerTickData extends PlayerTickData {
    // local data, not serialized
    startingPhysicsTick?: int
    status = PLAYER_TICK_DATA_STATUS.NEW
    /**
     * It means the following:
     * - results of the previous physics ticks have been corrected, so this result is likely incorrect
     * - it must be processed again
     * - it shouldn't be sent again, because it was already sent
     */
    invalidated?: boolean

    constructor(startingPhysicsTick: int) {
        super()
        this.startingPhysicsTick = startingPhysicsTick
    }

    initInputFrom(player: Player, physicsTicks: int) {
        const state = player.state
        const controls = player.controls
        const controlManager = player.controlManager
        const applyControl = controls.enabled && !state.sleep && !state.sitting && !state.lies

        this.inputFlags = applyControl
            ? packBooleans(controls.back,
                controls.forward,
                controls.right,
                controls.left,
                controls.jump,
                controls.sneak,
                controls.sprint,
                controlManager.instantControls.switchFlying
            ) : 0
        player.controlManager.instantControls.switchFlying = false
        this.inputRotation.copyFrom(player.rotate).roundSelf(PHYSICS_ROTATION_DECIMALS)
        this.physicsTicks = physicsTicks
    }

    // Not inclusive
    get endPhysicsTick() { return this.startingPhysicsTick + this.physicsTicks }
}