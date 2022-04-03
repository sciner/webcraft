// Static class, key game event handler
export class PlayerEvent {

    static SET_BLOCK                 = 'set_block'; // player set the block
    static DESTROY_BLOCK             = 'destroy_block'; // player destroyed the block
    static PICKUP_ITEMS              = 'pickup_items'; // player picked something up
    static CRAFT                     = 'craft'; // player crafted something
    static PUT_ITEM_TO_INVENTORY     = 'insert_item_to_inventory'; //

    static player_handlers           = new Map();

    static addHandler(user_id, handler) {
        PlayerEvent.player_handlers.set(user_id, handler);
    }

    static removeHandler(user_id) {
        PlayerEvent.player_handlers.delete(user_id);
    }

    // On game event
    static trigger(e) {
        const player_handler = PlayerEvent.player_handlers.get(e.player.session.user_id);
        if(player_handler) {
            player_handler.trigger(e);
        }
    }

}