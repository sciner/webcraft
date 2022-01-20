import {BLOCK} from "../blocks.js";

export class Instrument_Hand {

    constructor(inventory, inventory_item) {
        this.inventory_item = inventory_item;
        this.material = inventory_item ? BLOCK.fromId(inventory_item.id) : null;
        this.inventory = inventory;
    }

    //
    destroyBlock(block) {
        // @todo inventory
        let inventory_item = this.inventory_item;
        if(inventory_item) {
            if(inventory_item.item?.instrument_id) {
                let damage = .01;
                inventory_item.power = Math.round((inventory_item.power - damage) * 100) / 100;
                if(inventory_item.power <= 0) {
                    // @todo inventory
                    console.error('Нужно перенести на сервер');
                    // this.inventory.decrement();
                }
            }
        }
        return true;
    }

}