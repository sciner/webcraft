import {Vector} from "../helpers/vector.js";
import type {PlayerControl} from "./player_control.js";
import {DataValidator, InDeltaCompressor, OutDeltaCompressor, packBooleans, unpackBooleans} from "../packet_compressor.js";
import {GAME_MODE, GameMode} from "../game_mode.js";
import {PHYSICS_ROTATION_DECIMALS} from "../constant.js";
import type {ClientPlayerControlManager, PlayerControlManager} from "./player_control_manager.js";
import type {PLAYER_CONTROL_TYPE} from "./player_control.js";
import {ObjectHelpers} from "../helpers/object_helpers.js";
import type {Player} from "../player.js";
import type {PrismarinePlayerState} from "../prismarine-physics/index.js";
import {canSwitchFlying} from "./player_control.js";

export enum PLAYER_TICK_DATA_STATUS {
    NEW = 1,
    PROCESSED_SEND_ASAP,
    PROCESSED_SENDING_DELAYED,
    SENT
}

export enum PLAYER_TICK_MODE {
    NORMAL = 0,
    SITTING_OR_LYING,
    FLYING,
    DRIVING_FREE_YAW, // вождение, со свободным поворотом мышью
    DRIVING_ANGULAR_SPEED, // вождение, с медленным поворотом транспортного средства стрелками
    DRIVING_FLYING_FREE_YAW,
    DRIVING_FLYING_ANGULAR_SPEED
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

    // выходные данные, используемые только при вождении
    outVehiclePos = new Vector()
    /** Угол поворота транспоттного средства (только во время вождения, только если поворотом транспорта нельзя свободно управлять) */
    outVehicleYaw: float | null
    /** Угловая скорость транспоттного средства (только во время вождения, только если поворотом транспорта нельзя свободно управлять) */
    outVehicleAngularVelocity: float | null

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

    applyInputTo(controlManager: PlayerControlManager<any>, pc: PlayerControl): void {
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
        const driving = controlManager.player.driving
        if (controlsEnabled && switchFlying && canSwitchFlying(game_mode, driving)) {
            player_state.flying = !player_state.flying
        }
    }

    initContextFrom(controlManager: PlayerControlManager<any>): void {
        const player = controlManager.player as Player
        const pc = controlManager.current
        const state = player.state
        this.contextGameModeIndex  = player.game_mode.getCurrent().index
        this.contextControlType   = pc.type
        if (state.sitting || state.sleep) {
            this.contextTickMode = PLAYER_TICK_MODE.SITTING_OR_LYING
        } else if (player.driving) {
            if (pc.player_state.flying) {
                this.contextTickMode = player.driving.config.useAngularSpeed
                    ? PLAYER_TICK_MODE.DRIVING_FLYING_ANGULAR_SPEED
                    : PLAYER_TICK_MODE.DRIVING_FLYING_FREE_YAW
            } else {
                this.contextTickMode = player.driving.config.useAngularSpeed
                    ? PLAYER_TICK_MODE.DRIVING_ANGULAR_SPEED
                    : PLAYER_TICK_MODE.DRIVING_FREE_YAW
            }
        } else if (pc.player_state.flying) {
            this.contextTickMode = PLAYER_TICK_MODE.FLYING
        } else {
            this.contextTickMode = PLAYER_TICK_MODE.NORMAL
        }
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
        if (this.contextTickMode == null) {
            throw new Error() // сначала нужно инициализировать контекст
        }
        const ps = pc.player_state
        this.outControlFlags = packBooleans(ps.flying)
        this.outPlayerFlags = packBooleans(ps.sneak)
        this.outPos.copyFrom(ps.pos)
        this.outVelocity.copyFrom(ps.vel)

        // вождение
        const drivingCombinedState = pc.drivingCombinedState as (PrismarinePlayerState | null)
        if (this.isContextDriving()) {
            if (drivingCombinedState) {
                this.outVehiclePos.copyFrom(drivingCombinedState.pos)
                if (this.isContextDrivingAngularSpeed()) {
                    this.outVehicleYaw = drivingCombinedState.yaw
                    this.outVehicleAngularVelocity = drivingCombinedState.angularVelocity
                } else {
                    this.outVehicleYaw = null
                    this.outVehicleAngularVelocity = null
                }
            } else {
                // Несмотря на то, что данные могут относиться к водению, drivingCombinedState может отсутствовать.
                // Например, если на клиент пришла коррекция, но вождения еще/уже нет.
                // Нам неоткуда взять значения, связанные с вождением.
                // Чтобы сохранить целостность данных, пометим что в этих данных их нет.
                this.contextTickMode = PLAYER_TICK_MODE.NORMAL
            }
        }
    }

    copyOutputFrom(src: PlayerTickData): void {
        this.outControlFlags = src.outControlFlags
        this.outPlayerFlags = src.outPlayerFlags
        this.outPos.copyFrom(src.outPos)
        this.outVelocity.copyFrom(src.outVelocity)
        // вождение
        if (this.isContextDriving()) {
            if (src.isContextDriving()) {
                this.outVehiclePos.copyFrom(src.outVehiclePos)
                this.outVehicleYaw = src.outVehicleYaw
                this.outVehicleAngularVelocity = src.outVehicleAngularVelocity
            } else {
                // нештатная ситуация, см. комментарий в похожем месте в initOutputFrom
                this.contextTickMode = PLAYER_TICK_MODE.NORMAL
            }
        }
    }

    applyOutputToControl(pc: PlayerControl): void {
        const [flying] = unpackBooleans(this.outControlFlags, PlayerTickData.OUT_CONTROL_FLAGS_COUNT)
        const [sneak] = unpackBooleans(this.outPlayerFlags, PlayerTickData.OUT_PLAYER_FLAGS_COUNT)
        const player_state = pc.player_state
        player_state.flying = flying
        player_state.sneak = sneak
        player_state.pos.copyFrom(this.outPos)
        player_state.vel.copyFrom(this.outVelocity)

        // вождение
        const drivingCombinedState = pc.drivingCombinedState as (PrismarinePlayerState | null)
        // Несмотря на то, что данные могут относиться к водению, drivingCombinedState может отсутствовать.
        // Например, если на клиент пришла коррекция, но вождения еще/уже нет.
        if (drivingCombinedState && this.isContextDriving()) {
            drivingCombinedState.pos.copyFrom(this.outVehiclePos)
            if (this.outVehicleYaw != null) {
                drivingCombinedState.yaw = this.outVehicleYaw
                drivingCombinedState.angularVelocity = this.outVehicleAngularVelocity
            }
        }
    }

    outEqual(other: PlayerTickData): boolean {
        return this.outControlFlags === other.outControlFlags &&
            this.outPlayerFlags === other.outPlayerFlags &&
            this.outPos.equal(other.outPos) &&
            this.outVelocity.equal(other.outVelocity) &&
            (!this.isContextDriving() ||
                this.outVehiclePos.equal(other.outVehiclePos) &&
                this.outVehicleYaw === other.outVehicleYaw &&
                this.outVehicleAngularVelocity === other.outVehicleAngularVelocity
            )
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
        // вождение
        if (this.isContextDriving()) {
            dc.putFloatVector(this.outVehiclePos)
            if (this.isContextDrivingAngularSpeed()) {
                dc.putFloat(this.outVehicleYaw)
                dc.putFloat(this.outVehicleAngularVelocity)
            }
        }
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
        // вождение
        if (this.isContextDriving()) {
            dc.getFloatVector(this.outVehiclePos)
            if (this.isContextDrivingAngularSpeed()) {
                this.outVehicleYaw = dc.getFloat()
                this.outVehicleAngularVelocity = dc.getFloat()
            } else {
                this.outVehicleYaw = null
                this.outVehicleAngularVelocity = null
            }
        }
    }

    toString(): string {
        const ids = this.inputWorldActionIds ? `ids=[${this.inputWorldActionIds.join()}] ` : ''
        let res = `t${this.startingPhysicsTick}+${this.physicsTicks}=t${this.endPhysicsTick} ${ids}${this.outPos} if${this.inputFlags}`
        if (this.contextGameModeIndex)  res += ` GM${this.contextGameModeIndex}`
        if (this.contextTickMode)       res += ` tm${this.contextTickMode}`
        if (this.outControlFlags)       res += ` Cf${this.outControlFlags}`
        if (this.outPlayerFlags)        res += ` Pf${this.outPlayerFlags}`
        if (this.isContextDriving()) {
            res += `driving(${this.outVehiclePos} ${this.outVehicleYaw} ${this.outVehicleAngularVelocity})`
        }
        return res
    }

    protected isContextDriving(): boolean {
        const tm = this.contextTickMode
        return tm >= PLAYER_TICK_MODE.DRIVING_FREE_YAW && tm <= PLAYER_TICK_MODE.DRIVING_FLYING_ANGULAR_SPEED
    }

    protected isContextDrivingAngularSpeed(): boolean {
        const tm = this.contextTickMode
        return tm === PLAYER_TICK_MODE.DRIVING_ANGULAR_SPEED && tm <= PLAYER_TICK_MODE.DRIVING_FLYING_ANGULAR_SPEED
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

    initInputFrom(controlManager: ClientPlayerControlManager, startingPhysicsTick: int, physicsTicks: int, fromCamera = false) {
        const player = controlManager.player
        const state = player.state
        const controls = player.controls
        const applyControl = controls.enabled && !state.sleep && !state.sitting

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
        const rotation = fromCamera ? player.controlManager.getCamRotation() : player.rotate
        this.inputRotation.copyFrom(rotation).roundSelf(PHYSICS_ROTATION_DECIMALS)
        this.physicsTicks = physicsTicks
        this.startingPhysicsTick = startingPhysicsTick
    }
}