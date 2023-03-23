import {PlayerTickData} from "@client/control/player_tick_data.js";
import {ACCEPTABLE_PLAYER_POS_ERROR, ACCEPTABLE_PLAYER_VELOCITY_ERROR} from "../server_constant.js";
import type {ServerPlayer} from "../server_player.js";
import {unpackBooleans} from "@client/packet_compressor.js";

export class ServerPlayerTickData extends PlayerTickData {

    /** @returns true if the outputs of two simulations are similar enough that a client doesn't need a correction */
    outputSimilar(other: ServerPlayerTickData): boolean {
        return this.outFlags === other.outFlags &&
            this.outPos.distanceSqr(other.outPos) < ACCEPTABLE_PLAYER_POS_ERROR * ACCEPTABLE_PLAYER_POS_ERROR &&
            this.outVelocity.distanceSqr(other.outVelocity) < ACCEPTABLE_PLAYER_VELOCITY_ERROR * ACCEPTABLE_PLAYER_VELOCITY_ERROR
    }

    applyOutputToPlayer(player: ServerPlayer) {
        this.applyOutputToControl(player.controlManager.current)
        const [sneak, flying] = unpackBooleans(this.outFlags, PlayerTickData.OUT_FLAGS_COUNT)
        player.changePosition(this.outPos, this.inputRotation, sneak)
    }
}