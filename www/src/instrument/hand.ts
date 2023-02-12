export class Instrument_Hand {

    /**
     * @param { import("../player_inventory.js").PlayerInventory } inventory 
     * @param {*} inventory_item 
     */
    constructor(inventory, inventory_item) {
        const bm = inventory.player.world.block_manager
        this.inventory_item = inventory_item;
        this.material = inventory_item ? bm.fromId(inventory_item.id) : null;
        this.inventory = inventory;
    }

    //
    destroyBlock(block) {
        // @todo inventory
        let inventory_item = this.inventory_item;
        if(inventory_item) {
            if(inventory_item.item?.instrument_id) {
                let damage = 1;
                inventory_item.power = inventory_item.power - damage;
                if(inventory_item.power <= 0) {
                    // @todo inventory
                    console.error('Нужно перенести на сервер');
                }
            }
        }
        return true;
    }

}