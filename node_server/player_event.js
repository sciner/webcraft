import {BLOCK} from "../www/js/blocks.js";

// Static class, key game event handler
export class PlayerEvent {

    static DESTROY_BLOCK             = 'destroy_block'; // player destroyed the block
    static PICKUP_ITEMS              = 'pickup_items'; // player picked something up
    static CRAFT                     = 'craft'; // player crafted something
    static PUT_ITEM_TO_INVENTORY     = 'insert_item_to_inventory'; //

    // On game event
    static trigger(e) {
        switch(e.type) {

            case PlayerEvent.DESTROY_BLOCK: {
                console.log(e.player.session.username + ' destroy block ', e.data.block_id, ' on pos ', e.data.pos);
                break;
            }

            case PlayerEvent.PICKUP_ITEMS: {
                console.log(e.player.session.username + ' pick up dropped items ', e.data.items);
                break;
            }

            case PlayerEvent.CRAFT: {
                const item = e.data.item;
                const block = BLOCK.fromId(item.block_id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                console.log(`${e.player.session.username} crafted ${block.name} (count: ${item.count})`);
                break;
            }

            case PlayerEvent.PUT_ITEM_TO_INVENTORY: {
                const item = e.data.item;
                const block = BLOCK.fromId(item.block_id);
                if(!block) {
                    throw 'error_invalid_block';
                }
                console.log(`${e.player.session.username} put item ${block.name} to inventory`);
                break;
            }

        }
    }

}