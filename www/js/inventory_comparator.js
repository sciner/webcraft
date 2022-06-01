import {BLOCK, ITEM_INVENTORY_PROPS, ITEM_INVENTORY_KEY_PROPS} from "./blocks.js";
import {RecipeManager} from "./recipes.js";

export class InventoryComparator {

    static rm = null;

    static async checkEqual(old_items, new_items, used_recipes) {

        const rm = await InventoryComparator.getRecipeManager();

        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        console.log(new_simple)

        // 1. Check full equal
        let equal = InventoryComparator.compareSimpleItems(old_simple, new_simple);

        if(!equal && Array.isArray(used_recipes)) {
            try {
                // Apply all recipes
                for(let recipe_id of used_recipes) {
                    // Get recipe by ID
                    const recipe = rm.getRecipe(recipe_id);
                    if(!recipe) {
                        throw 'error_recipe_not_found|' + recipe_id;
                    }
                    // Spending resources
                    for(let nr of recipe.need_resources) {
                        let used_item = old_simple.get(nr.item_id);
                        if(!used_item) {
                            throw 'error_recipe_item_not_found_in_inventory|' + recipe_id;
                        }
                        used_item.count -= nr.count;
                        if(used_item.count < 0) {
                            throw 'error_recipe_item_not_enough';
                        }
                        if(used_item.count == 0) {
                            old_simple.delete(nr.item_id);
                        }
                    }
                    // Append result item
                    let result_item = BLOCK.fromId(recipe.result.item_id);
                    result_item = BLOCK.convertItemToInventoryItem(result_item, result_item);
                    result_item.count = recipe.result.count;
                    // Generate next simple state of inventory previous state
                    old_items = Array.from(old_simple.values());
                    old_items.push(result_item);
                    // Group items to simple form
                    old_simple = InventoryComparator.groupToSimpleItems(old_items);
                }
                equal = InventoryComparator.compareSimpleItems(old_simple, new_simple);
            } catch(e) {
                equal = false;
                console.log('error', e);
            }
        }

        return equal;

    }

    // compareSimpleItems...
    static compareSimpleItems(old_simple, new_simple) {
        let equal = new_simple.size == old_simple.size;
        if(equal) {
            for(let [key, item] of new_simple) {
                let old_item = old_simple.get(key);
                if(!old_item) {
                    console.log(`* Item not found (${key}); item: ` + JSON.stringify(item));
                    equal = false;
                    break;
                }
                if(!InventoryComparator.itemsIsEqual(old_item, item)) {
                    console.log('* Comparator not equal', JSON.stringify([item, old_item]));
                    equal = false;
                    break;
                }
            }
        }
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

    //
    static itemsIsEqual(old_item, new_item) {
        //
        function isObject(object) {
            return object != null && typeof object === 'object';
        }
        //
        function deepEqual(object1, object2) {
            const keys1 = Object.keys(object1);
            for (const key of keys1) {
                if(ITEM_INVENTORY_PROPS.indexOf(key) < 0) {
                    continue;
                }
                const val1 = object1[key];
                const val2 = object2[key];
                const areObjects = isObject(val1) && isObject(val2);
                if (areObjects && !deepEqual(val1, val2) || !areObjects && val1 !== val2) {
                    return false;
                }
            }
            return true;
        }
        return deepEqual(new_item, old_item);
    }

    //
    static groupToSimpleItems(items) {
        let resp = new Map();
        let entities = new Map();
        for(let item of items) {
            if(item) {
                if('id' in item && 'count' in item) {
                    const b = BLOCK.fromId(item.id);
                    if(!b || b.id < 0) {
                        continue;
                    }
                    const new_item = BLOCK.convertItemToInventoryItem(item, b);
                    // let is_item = (typeof b?.item !== 'undefined') && (b?.item !== null);
                    // generate key
                    let key = new_item.id;
                    let entity_key = false;
                    if('entity_id' in item) {
                        key = entity_key = item.entity_id;
                    } else {
                        for(let prop of ITEM_INVENTORY_KEY_PROPS) {
                            if(prop in b) {
                                if(prop != 'power' || b.power != 0) {
                                    if(prop in new_item) {
                                        const jvalue = JSON.stringify(new_item[prop]);
                                        const prop_key = `|${prop}:${jvalue}`;
                                        key += prop_key;
                                        entity_key = new_item.id + prop_key;
                                    }
                                }
                            }
                        }
                        //
                        if(entity_key) {
                            let counter = entities.get(entity_key);
                            if(!counter) {
                                counter = 0;
                            }
                            entities.set(entity_key, counter + 1);
                            key += `|_:${counter}`;
                        }
                    }
                    //
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