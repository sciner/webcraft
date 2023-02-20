import { Vector } from "../../../www/src/helpers.js";
import { isBlockRoughlyWithinPickatRange } from "../../../www/src/block_helpers.js";
import { ServerClient } from "../../../www/src/server_client.js";
import { PacketHelpers } from "../../server_helpers.js";
import { CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD 
    } from "../../../www/src/constant.js";

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
     * @param { import("../server_player.js").ServerPlayer } player
     * @param {*} packet 
     * @returns 
     */
    static async read(player, packet) {

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
        let chest;
        try {
            chest = await player.world.chests.get(pos, true);
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