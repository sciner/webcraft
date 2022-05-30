import { ServerClient } from "../../../www/js/server_client.js";
import {PlayerEvent} from "../../player_event.js";

const MAX_DIST_FOR_PICKUP = 2.5;

export class CMD_DROP_ITEM_PICKUP {

    constructor(player, data) {

        const world = player.world;

        for(let i = 0; i < data.length; i++) {

            const entity_id = data[i];

            // find
            const drop_item = world.all_drop_items.get(entity_id);
            if(!drop_item) {
                continue;
            }
            // check dist
            const dist = drop_item.pos.distance(player.state.pos);
            if(dist > MAX_DIST_FOR_PICKUP) {
                continue;
            }

            // get chunk
            const chunk = world.chunks.get(drop_item.chunk_addr);
            if(!chunk) {
                continue;
            }

            // 1. add items to inventory
            const items = drop_item.items;
            for(const item of items) {
                const ok = player.inventory.increment(item);
                // @todo check if not ok!
            }

            // delete from chunk
            chunk.drop_items.delete(entity_id);

            // unload drop item
            drop_item.onUnload();

            // deactive drop item in database
            world.db.deleteDropItem(entity_id);
            
            // @todo players must receive this packet after 200ms after player send request
            // because animation not ended
            setTimeout(() => {
                
                // play sound on client
                let packets_sound = [{
                    name: ServerClient.CMD_PLAY_SOUND,
                    data: {tag: 'madcraft:entity.item.pickup', action: 'hit'}
                }];
                world.sendSelected(packets_sound, [player.session.user_id], []);

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

    }

}