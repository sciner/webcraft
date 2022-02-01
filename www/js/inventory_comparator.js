import {BLOCK, ITEM_INVENTORY_PROPS} from "./blocks.js";
import {RecipeManager} from "./recipes.js";

export class InventoryComparator {

    static rm = null;

    static async checkEqual(old_items, new_items) {

        const rm = await InventoryComparator.getRecipeManager();

        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        // 1. Check full equal
        let equal = new_simple.size == old_simple.size;
        if(equal) {
            for(let [key, item] of new_simple) {
                let old_item = old_simple.get(key);
                if(!old_item) {
                    console.log('* Item not found', JSON.stringify(item));
                    equal = false;
                    break;
                }
                if(!InventoryComparator.itemsIsEqual(item, old_item)) {
                    console.log('* Comparator not equal', JSON.stringify([item, old_item]));
                    equal = false;
                    break;
                }
            }
        }

        // 2. Check if converted|crafted
        if(!equal) {
            for(let [key, item] of new_simple) {
                if(!old_simple.has(key)) {
                    // new item, not exists in old state
                    const recipe = rm.getRecipe(item.id);
                    console.log('recipe: ', recipe);
                }
            }
        }

        console.log('equal', equal);

        return equal;

    }

    // getRecipeManager
    static async getRecipeManager() {
        if(InventoryComparator.rm) {
            return InventoryComparator.rm;
        }
        InventoryComparator.rm = new RecipeManager();
        await InventoryComparator.rm.load(() => {});
        return InventoryComparator.rm;
    }

    static itemsIsEqual(a, b) {
        return JSON.stringify(a) == JSON.stringify(b);
    }

    //
    static groupToSimpleItems(items) {
        let resp = new Map();
        for(let item of items) {
            if(item) {
                if('id' in item && 'count' in item) {
                    let b = BLOCK.fromId(item.id);
                    if(!b || b.id < 0) {
                        continue;
                    }
                    const new_item = BLOCK.convertItemToInventoryItem(item);
                    // let is_item = (typeof b?.item !== 'undefined') && (b?.item !== null);
                    // generate key
                    let key = new_item.id;
                    for(let prop of ['entity_name', 'entity_id', 'power']) {
                        if(new_item.entity) {
                            key += `|${prop}:${new_item[prop]}`;
                        }
                    }
                    if(resp.has(key)) {
                        resp.get(key).count += new_item.count;
                    } else {
                        resp.set(key, new_item);
                    }
                }
            }
        }
        return resp;
    }

}