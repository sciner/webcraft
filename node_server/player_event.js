import {BLOCK} from "../www/js/blocks.js";

// Static class, key game event handler
export class PlayerEvent {

    static SET_BLOCK                 = 'set_block'; // player set the block
    static DESTROY_BLOCK             = 'destroy_block'; // player destroyed the block
    static PICKUP_ITEMS              = 'pickup_items'; // player picked something up
    static CRAFT                     = 'craft'; // player crafted something
    static PUT_ITEM_TO_INVENTORY     = 'insert_item_to_inventory'; //

    static sendMessage(player, message) {
        player.world.chat.sendSystemChatMessageToSelectedPlayers(message, [player.session.user_id]);
    }

    // On game event
    static trigger(e) {
        switch(e.type) {

            case PlayerEvent.SET_BLOCK: {
                const block = BLOCK.fromId(e.data.block.id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                const pos = e.data.pos.toHash();
                PlayerEvent.sendMessage(e.player, `${e.player.session.username} set block ${block.name} on pos ${pos}`);
                break;
            }

            case PlayerEvent.DESTROY_BLOCK: {
                const block = BLOCK.fromId(e.data.block_id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                const pos = e.data.pos.toHash();
                PlayerEvent.sendMessage(e.player, `${e.player.session.username} destroy block ${block.name} on pos ${pos}`);
                break;
            }

            case PlayerEvent.PICKUP_ITEMS: {
                const items_string = JSON.stringify(e.data.items);
                PlayerEvent.sendMessage(e.player, `${e.player.session.username} pick up dropped items ${items_string}`);
                break;
            }

            case PlayerEvent.CRAFT: {
                const item = e.data.item;
                const block = BLOCK.fromId(item.block_id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                PlayerEvent.sendMessage(e.player, `${e.player.session.username} crafted ${block.name} (count: ${item.count})`);
                break;
            }

            case PlayerEvent.PUT_ITEM_TO_INVENTORY: {
                const item = e.data.item;
                const block = BLOCK.fromId(item.block_id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                PlayerEvent.sendMessage(e.player, `${e.player.session.username} put item ${block.name} to inventory`);
                break;
            }

        }
    }

}