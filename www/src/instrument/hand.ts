import type {PlayerInventory} from "../player_inventory.js";

export class Instrument_Hand {

    inventory       : PlayerInventory
    inventory_item  : IInventoryItem | null
    material        : IBlockMaterial | null

    constructor(inventory: PlayerInventory, inventory_item: IInventoryItem | null) {
        const bm = inventory.player.world.block_manager
        this.inventory_item = inventory_item;
        this.material = inventory_item ? bm.fromId(inventory_item.id) : null;
        this.inventory = inventory;
    }

    /*
    It's unused and has a bug

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
    */

}