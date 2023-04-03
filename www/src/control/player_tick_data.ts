import {Vector} from "../helpers/vector.js";
import type {PlayerControl} from "./player_control.js";
import {DataValidator, InDeltaCompressor, OutDeltaCompressor, packBooleans, unpackBooleans} from "../packet_compressor.js";
import {GAME_MODE, GameMode} from "../game_mode.js";
import {PHYSICS_ROTATION_DECIMALS} from "../constant.js";
import type {ClientPlayerControlManager, PlayerControlManager} from "./player_control_manager.js";
import type {PLAYER_CONTROL_TYPE} from "./player_control.js";
import {ObjectHelpers} from "../helpers/object_helpers.js";

export enum PLAYER_TICK_DATA_STATUS {
    NEW = 1,
    PROCESSED_SEND_ASAP,
    PROCESSED_SENDING_DELAYED,
    SENT
}

export enum PLAYER_TICK_MODE {
    NORMAL = 0,
    SITTING_OR_LYING,
    FLYING
}

/** It represents input and output of player controls & physics in one several consecutive physics ticks. */
export class PlayerTickData {
    protected static INPUT_FLAGS_COUNT = 8
    protected static OUT_CONTROL_FLAGS_COUNT = 1
    protected static OUT_PLAYER_FLAGS_COUNT = 1

    private static SEQUENCE_INPUT = 0
    private static SEQUENCE_CONTEXT_AND_OUTPUT = 1

    // input data
    inputFlags: int
    inputRotation = new Vector()
    // If it's not null, it's WorldAction ids that are used to change the player's position in this player tick
    inputWorldActionIds: (string | int)[] | null

    // it's not a direct user input, but it's initialized/transferred along with input, because it fulfills a similar role
    physicsTicks: int // how many simulated physics ticks are contained in this data

    // it's serialized one per packet, not for each PlayerTickData
    startingPhysicsTick: int
    // declared here, but server-only
    physicsSessionId: int

    // context data - needed to repeat ticks correctly (acts somewhat like input, but from the game rather than the user)
    contextGameModeIndex: int
    contextControlType: PLAYER_CONTROL_TYPE
    contextTickMode: PLAYER_TICK_MODE // a mode within of the same control that affects physics and/or how controls are processed

    // output data
    outControlFlags: int    // boolean values that are stored in the control's state
    outPlayerFlags: int     // boolean values that are stored in the player's state
    outPos = new Vector()
    outVelocity = new Vector()

    // Not inclusive
    get endPhysicsTick() { return this.startingPhysicsTick + this.physicsTicks }

    /** Returns true if every serializable field is equal except {@link physicsTicks} */
    equal(other: PlayerTickData): boolean {
        return this.outEqual(other) && this.contextEqual(other) &&
            this.inputFlags === other.inputFlags &&
            this.inputRotation.equal(other.inputRotation)
    }

    initInputEmpty(prev: PlayerTickData | null, startingPhysicsTick: int, physicsTicks: int): void {
        this.startingPhysicsTick = startingPhysicsTick
        this.physicsTicks = physicsTicks
        this.inputFlags = 0
        if (prev) {
            this.inputRotation.copyFrom(prev.inputRotation)
        } else {
            this.inputRotation.set(0, 0, 0)
        }
        this.inputWorldActionIds = null
    }

    copyInputFrom(src: PlayerTickData): void {
        this.startingPhysicsTick = src.startingPhysicsTick
        this.physicsTicks = src.physicsTicks
        this.inputFlags = src.inputFlags
        this.inputRotation.copyFrom(src.inputRotation)
        this.inputWorldActionIds = ObjectHelpers.deepClone(src.inputWorldActionIds)
    }

    applyInputTo(controlManager: PlayerControlManager, pc: PlayerControl): void {
        const controls = pc.controls
        const player_state = pc.player_state

        // This allows checking whether the controls are enabled both on the server and on the client.
        // E.g., controls are disabled on the server after the player sits on a chair.
        // On the client, controls are disabled in an addition place before they are placed into PlayerTickData.
        const controlsEnabled = this.contextTickMode !== PLAYER_TICK_MODE.SITTING_OR_LYING

        // TODO rewrite it into a single destructing assignment when IntellijIDEA starts understanding it
        const [back, forward, right, left, jump, sneak, sprint, switchFlying] = unpackBooleans(
            this.inputFlags, PlayerTickData.INPUT_FLAGS_COUNT)
        controls.back       = controlsEnabled && back
        controls.forward    = controlsEnabled && forward
        controls.right      = controlsEnabled && right
        controls.left       = controlsEnabled && left
        controls.jump       = controlsEnabled && jump
        controls.sneak      = controlsEnabled && sneak
        controls.sprint     = controlsEnabled && sprint
        player_state.yaw = this.inputRotation.z

        const game_mode = GameMode.byIndex[this.contextGameModeIndex]
        if (controlsEnabled && switchFlying && game_mode.id === GAME_MODE.CREATIVE) {
            player_state.flying = !player_state.flying
        }
    }

    initContextFrom(controlManager: PlayerControlManager): void {
        const player = controlManager.player
        const pc = controlManager.current
        const state = player.state
        this.contextGameModeIndex  = player.game_mode.getCurrent().index
        this.contextControlType   = pc.type
        this.contextTickMode = state.sitting || state.lies || state.sleep
            ? PLAYER_TICK_MODE.SITTING_OR_LYING
            : pc.player_state.flying
                ? PLAYER_TICK_MODE.FLYING
                : PLAYER_TICK_MODE.NORMAL
    }

    copyContextFrom(src: PlayerTickData): void {
        this.contextControlType = src.contextControlType
        this.contextGameModeIndex = src.contextGameModeIndex
        this.contextTickMode = src.contextTickMode
    }

    contextEqual(other: PlayerTickData): boolean {
        return this.contextControlType === other.contextControlType &&
            this.contextGameModeIndex === other.contextGameModeIndex &&
            this.contextTickMode === other.contextTickMode
    }

    initOutputFrom(pc: PlayerControl): void {
        this.outControlFlags = packBooleans(pc.player_state.flying)
        this.outPlayerFlags = packBooleans(pc.sneak)
        this.outPos.copyFrom(pc.player_state.pos)
        this.outVelocity.copyFrom(pc.player_state.vel)
    }

    copyOutputFrom(src: PlayerTickData): void {
        this.outControlFlags = src.outControlFlags
        this.outPlayerFlags = src.outPlayerFlags
        this.outPos.copyFrom(src.outPos)
        this.outVelocity.copyFrom(src.outVelocity)
    }

    applyOutputToControl(pc: PlayerControl): void {
        const [flying] = unpackBooleans(this.outControlFlags, PlayerTickData.OUT_CONTROL_FLAGS_COUNT)
        const player_state = pc.player_state
        player_state.flying = flying
        player_state.pos.copyFrom(this.outPos)
        player_state.vel.copyFrom(this.outVelocity)
    }

    outEqual(other: PlayerTickData): boolean {
        return this.outControlFlags === other.outControlFlags &&
            this.outPlayerFlags === other.outPlayerFlags &&
            this.outPos.equal(other.outPos) &&
            this.outVelocity.equal(other.outVelocity)
    }

    writeInput(dc: OutDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_INPUT)
            .putInt(this.physicsTicks)
            .putInt(this.inputFlags)
            .putFloatVector(this.inputRotation)
        dc.buf.putAnyOrNull(this.inputWorldActionIds)
    }

    writeContextAndOutput(dc: OutDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_CONTEXT_AND_OUTPUT)
            // context
            .putInt(this.contextControlType)
            .putInt(this.contextGameModeIndex)
            .putInt(this.contextTickMode)
            // output
            .putInt(this.outControlFlags)
            .putInt(this.outPlayerFlags)
            .putFloatVector(this.outPos)
            .putFloatVector(this.outVelocity)
    }

    readInput(dc: InDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_INPUT)
        this.physicsTicks = dc.getInt()
        DataValidator.checkMinMax(this.physicsTicks, 1)
        this.inputFlags = dc.getInt()
        dc.getFloatVector(this.inputRotation)
        this.inputWorldActionIds = dc.buf.getAnyOrNull()
        if (this.inputWorldActionIds != null &&
            (!Array.isArray(this.inputWorldActionIds) || !this.inputWorldActionIds.length || this.physicsTicks !== 1)
        ) {
            throw 'incorrect inputWorldActionIds or physicsTicks'
        }
    }

    readContextAndOutput(dc: InDeltaCompressor): void {
        dc.startSequence(PlayerTickData.SEQUENCE_CONTEXT_AND_OUTPUT)
        // context
        this.contextControlType = dc.getInt()
        this.contextGameModeIndex = dc.getInt()
        this.contextTickMode = dc.getInt()
        // output
        this.outControlFlags = dc.getInt()
        this.outPlayerFlags = dc.getInt()
        dc.getFloatVector(this.outPos)
        dc.getFloatVector(this.outVelocity)
    }

    toString(): string {
        const ids = this.inputWorldActionIds ? `ids=[${this.inputWorldActionIds.join()}] ` : ''
        return `t${this.startingPhysicsTick}+${this.physicsTicks}=t${this.endPhysicsTick} m${this.contextTickMode} i${this.inputFlags} ${ids}${this.outPos}`
    }
}

export class ClientPlayerTickData extends PlayerTickData {
    status = PLAYER_TICK_DATA_STATUS.NEW
    /**
     * It means the following:
     * - results of the previous physics ticks have been corrected, so this result is likely incorrect
     * - it must be processed again
     * - it shouldn't be sent again, because it was already sent
     */
    invalidated?: boolean

    initInputFrom(controlManager: ClientPlayerControlManager, startingPhysicsTick: int, physicsTicks: int) {
        const player = controlManager.player
        const state = player.state
        const controls = player.controls
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
        this.startingPhysicsTick = startingPhysicsTick
    }
}