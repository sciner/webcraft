import {BLOCK} from "../blocks.js";

export class Instrument_Hand {

    constructor(inventory_item, inventory) {
        this.inventory_item = inventory_item;
        this.inventory = inventory;
    }

    //
    destroyBlock(block) {
        // @todo inventory
        // console.error('Нужно перенести на сервер');
        let inventory_item = this.inventory_item;
        if(inventory_item) {
            if(inventory_item.instrument_id) {
                let damage = .01;
                inventory_item.power = Math.round((inventory_item.power - damage) * 100) / 100;
                if(inventory_item.power <= 0) {
                    // @todo inventory
                    console.error('Нужно перенести на сервер');
                    // this.inventory.decrement();
                }
            }
        }
        if(block.id == BLOCK.CONCRETE.id) {
            block = BLOCK.fromId(BLOCK.COBBLESTONE.id);
        }
        if(block.id == BLOCK.DIRT_PATH.id) {
            block = BLOCK.fromId(BLOCK.DIRT.id);
        }
        if([BLOCK.GRASS.id, BLOCK.CHEST.id].indexOf(block.id) < 0 || block.tags.indexOf('leaves') >= 0) {
            // this.inventory.increment({count: 1, id: block.id, power: block.power});
        }
        return true;
    }

}