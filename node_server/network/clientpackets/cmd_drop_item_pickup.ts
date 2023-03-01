import { WorldAction } from "../../../www/src/world_action.js";
import { ServerClient } from "../../../www/src/server_client.js";
import { PlayerEvent } from "../../player_event.js";
import { MAX_DIST_FOR_PICKUP } from "../../../www/src/constant.js";

export default class packet_reader {

    // must be put to queue
    static get queue() {
        return true;
    }

    // which command can be parsed with this class
    static get command() {
        return ServerClient.CMD_DROP_ITEM_PICKUP;
    }

    static async read(player, packet) {

        const world = player.world;
        const data = packet.data;

        for(let i = 0; i < data.length; i++) {

            const entity_id = data[i];

            // find
            const drop_item = world.all_drop_items.get(entity_id);
            if(!drop_item) {
                continue;
            }

            // check dist
            const dist = drop_item.pos.distance(player.state.pos);
            if(dist > MAX_DIST_FOR_PICKUP * 2 || !player.game_mode.canPickupItems()) {
                console.error(`ERROR: pickup item so far from player ${dist}m > ${MAX_DIST_FOR_PICKUP}`);
                this.restoreDropItemForPlayer(player, drop_item);
                continue;
            }

            // get chunk
            const chunk = drop_item.getChunk();
            if(!chunk) {
                continue;
            }

            // 1. add items to inventory
            const items = drop_item.items;
            const restored_items = [];
            for(const item of items) {
                const ok = player.inventory.increment(item, true);
                // check if not ok!
                if(!ok) {
                    restored_items.push(item);
                    continue;
                }
            }

            // restore if not applyed no one item
            if(restored_items.length == items.length) {
                console.log(`restore if not applyed no one item ${restored_items.length} == ${items.length}`)
                this.restoreDropItemForPlayer(player, drop_item);
                continue;
            }

            world.chunks.itemWorld.delete(drop_item, true);

            // @todo players must receive this packet after 200ms after player send request
            // because animation not ended
            setTimeout(async () => {

                // Create new drop item
                if(restored_items.length > 0) {
                    const actions = new WorldAction();
                    actions.addDropItem({pos: drop_item.pos, items: restored_items, force: true});
                    world.actions_queue.add(null, actions);
                }

                // play sound on client
                let packets_sound = [{
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: {tag: 'madcraft:entity.item.pickup', action: 'hit'}
                }];
                world.sendSelected(packets_sound, player);

                // delete item for all players, who controll this chunk
                let packets = [{
                    name: ServerClient.CMD_DROP_ITEM_DELETED,
                    data: [entity_id]
                }];
                chunk.sendAll(packets, []);
                PlayerEvent.trigger({
                    type: PlayerEvent.PICKUP_ITEMS,
                    player: player,
                    data: {items: items}
                });
            }, 200);

        }

        return true;

    }

    //
    static restoreDropItemForPlayer(player, drop_item) {
        // need to restore item in player game
        const packets = [{
            name: ServerClient.CMD_DROP_ITEM_ADDED,
            data: [drop_item.getItemFullPacket()]
        }];
        player.sendPackets(packets);
        return true;
    }

}