import { Vector } from "@client/helpers.js";
import { isBlockRoughlyWithinPickatRange } from "@client/block_helpers.js";
import { ServerClient } from "@client/server_client.js";
import { PacketHelpers } from "../../server_helpers.js";
import { CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD
    } from "@client/constant.js";
import type { ServerPlayer } from "../../server_player.js";
import type { TBlock } from "@client/typed_blocks3.js";

const TTL = 3000;
const MAX_ATTEMPTS = 1000;

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_LOAD_CHEST;
    }

    /**
     * Request chest content
     */
    static async read(player: ServerPlayer, packet) {

        function forceClose(removeCurrentChests) {
            if (removeCurrentChests) {
                player.currentChests = null;
            }
            player.sendPackets([{
                name: ServerClient.CMD_CHEST_FORCE_CLOSE,
                data: { chestSessionId: packet.data.chestSessionId }
            }]);
        }

        const withinRange = isBlockRoughlyWithinPickatRange(player,
            CHEST_INTERACTION_MARGIN_BLOCKS + CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD,
            packet.data.pos, packet.data.otherPos);
        if (!player.game_mode.canBlockAction() || !withinRange) {
            forceClose(true);
            return true;
        }
        //
        const pos = new Vector(packet.data.pos);
        let chest: TBlock | null;
        try {
            chest = player.world.chests.get(pos, true);
        } catch(e) { // chest is invalid, it's unrecoverable
            forceClose(true);
            throw e;
        }

        // remember which chests the player is interacting with
        player.currentChests = [packet.data.pos];
        if (packet.data.otherPos) {
            player.currentChests.push(packet.data.otherPos);
        }

        if (!chest) { // if the chest is not loaded
            if (PacketHelpers.waitInQueue(packet, TTL, MAX_ATTEMPTS)) {
                return false;
            }
            forceClose(false);
            throw `error_chest_not_found|${pos.x},${pos.y},${pos.z}`;
        } else {
            await player.world.chests.sendContentToPlayers([player], chest);
        }
        return true;
    }

}