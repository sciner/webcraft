import { Vector } from "@client/helpers.js";
import {isBlockRoughlyWithinPickatRange, TChestInfo} from "@client/block_helpers.js";
import { BLOCK_ACTION, ServerClient } from "@client/server_client.js";
import { PacketHelpers } from "../../server_helpers.js";
import { CHEST_INTERACTION_MARGIN_BLOCKS, CHEST_INTERACTION_MARGIN_BLOCKS_SERVER_ADD
    } from "@client/constant.js";
import type { ServerPlayer } from "../../server_player.js";
import type { TBlock } from "@client/typed_blocks3.js";
import { WorldAction } from "@client/world_action.js";

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
    static async read(player: ServerPlayer, packet: INetworkMessage<TChestInfo>) {

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
        let tblock: TBlock | null;
        try {
            tblock = player.world.chests.get(pos, true)
        } catch(e) { // chest is invalid, it's unrecoverable
            forceClose(true)
            throw e
        }

        // remember which chests the player is interacting with
        player.currentChests = [packet.data.pos];
        if (packet.data.otherPos) {
            player.currentChests.push(packet.data.otherPos);
        }

        if (!tblock) { // if the chest is not loaded
            if (PacketHelpers.waitInQueue(packet, TTL, MAX_ATTEMPTS)) {
                return false;
            }
            forceClose(false);
            throw `error_chest_not_found|${pos.x},${pos.y},${pos.z}`;
        } else {
            const mat = tblock.material
            if (mat.chest) {
                // TODO: need to change opened state
                const world = player.world
                const actions = new WorldAction()
                const extra_data = tblock.extra_data || {}
                extra_data.opened = true
                actions.addBlocks([{pos: tblock.posworld, item: {id: tblock.id, rotate: tblock.rotate, extra_data}, action_id: BLOCK_ACTION.MODIFY}])
                world.actions_queue.add(null, actions)
            }
            const success = await player.world.chests.loadAndSendToPlayers(player, tblock)
            if (!success) {
                forceClose(true)
            }
        }
        return true;
    }

}