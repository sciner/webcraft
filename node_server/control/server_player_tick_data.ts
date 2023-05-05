import {PlayerTickData} from "@client/control/player_tick_data.js";
import {ACCEPTABLE_PLAYER_POS_ERROR, ACCEPTABLE_PLAYER_VELOCITY_ERROR} from "../server_constant.js";
import type {ServerPlayer} from "../server_player.js";
import {packBooleans, unpackBooleans} from "@client/packet_compressor.js";
import {Player} from "@client/player.js";

export class ServerPlayerTickData extends PlayerTickData {

    /** @returns true if the outputs of two simulations are similar enough that a client doesn't need a correction */
    outputSimilar(other: ServerPlayerTickData): boolean {
        return this.outControlFlags === other.outControlFlags &&
            this.outPlayerFlags === other.outPlayerFlags &&
            this.outPos.distanceSqr(other.outPos) < ACCEPTABLE_PLAYER_POS_ERROR * ACCEPTABLE_PLAYER_POS_ERROR &&
            this.outVelocity.distanceSqr(other.outVelocity) < ACCEPTABLE_PLAYER_VELOCITY_ERROR * ACCEPTABLE_PLAYER_VELOCITY_ERROR &&
            (!this.isContextDriving() ||
                this.outVehiclePos.distanceSqr(other.outVehiclePos) < ACCEPTABLE_PLAYER_POS_ERROR * ACCEPTABLE_PLAYER_POS_ERROR &&
                this.outVehicleYaw == other.outVehicleYaw &&
                this.outVehicleAngularVelocity == other.outVehicleAngularVelocity
            )
    }

    applyOutputToPlayer(player: ServerPlayer) {
        this.applyOutputToControl(player.controlManager.current)
        const [sneak] = unpackBooleans(this.outPlayerFlags, PlayerTickData.OUT_PLAYER_FLAGS_COUNT)
        player.changePosition(this.outPos, this.inputRotation, sneak)
    }
}