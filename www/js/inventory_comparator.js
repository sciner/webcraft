import {BLOCK, ITEM_INVENTORY_PROPS, ITEM_INVENTORY_KEY_PROPS} from "./blocks.js";
import {RecipeManager} from "./recipes.js";

export class InventoryComparator {

    static rm = null;

    //
    static makeItemCompareKey(same_items, item, b) {
        // generate key
        let key = item.id;
        if('entity_id' in item && item.entity_id) {
            key = item.entity_id;
        } else {
            let entity_key = null;
            for(let prop of ITEM_INVENTORY_KEY_PROPS) {
                if(prop in b) {
                    if(prop != 'power' || b.power != 0) {
                        if(prop in item) {
                            const jvalue = JSON.stringify(item[prop]);
                            const prop_key = `|${prop}:${jvalue}`;
                            key += prop_key;
                            entity_key += `/${item.id}:${prop_key}`;
                        }
                    }
                }
            }
            //
            if(entity_key) {
                let counter = same_items.get(entity_key);
                if(!counter) {
                    counter = 0;
                }
                same_items.set(entity_key, counter + 1);
                key += `|_:${counter}`;
            }
        }
        return key;
    }

    // В новом наборе не должны появиться новые айтемы с extra_data или entity_id,
    // а также extra_data или entity_id не могут отличаться от старой версии
    static compareNestedExtraData(old_simple, new_simple) {
        // old flat
        const old_flat = new Map();
        for(let [_, item] of old_simple) {
            if(item.extra_data || item.entity_id) {
                old_flat.set(InventoryComparator.flatStringifyObject(item));
            }
        }
        // new flat
        for(let [_, item] of new_simple) {
            if(item.extra_data || item.entity_id) {
                const new_flat = InventoryComparator.flatStringifyObject(item);
                if(!old_flat.has(new_flat)) {
                    return false;
                }
            }
        }
        return true;
    }

    static async checkEqual(old_items, new_items, used_recipes) {

        const rm = await InventoryComparator.getRecipeManager();

        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

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
                    result_item = BLOCK.convertItemToInventoryItem(result_item, result_item, true);
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

        if(equal) {
            // Проверка extra_data и entity_id у айтемов
            // В новом наборе от клиента не должны появиться новые айтемы с extra_data или entity_id,
            // а также extra_data или entity_id не могут быть изменены на стороне клиента
            equal = InventoryComparator.compareNestedExtraData(old_simple, new_simple);
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
                    console.log('* Comparator not equal (new,old):', JSON.stringify([item, old_item]));
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
        const resp = new Map();
        const same_items = new Map();
        for(let item of items) {
            if(item) {
                if('id' in item && 'count' in item) {
                    const b = BLOCK.fromId(item.id);
                    if(!b || b.id < 0) {
                        continue;
                    }
                    const new_item = BLOCK.convertItemToInventoryItem(item, b);
                    const key = InventoryComparator.makeItemCompareKey(same_items, new_item, b);
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

    // Объект приводится к плоскому виду с сортировкой свойств по названию
    static flatStringifyObject(obj) {
        const flattenObject = function(ob) {
            const toReturn = {};
            for (var i in ob) {
                if (!ob.hasOwnProperty(i)) {
                    continue;
                }
                if ((typeof ob[i]) == 'object') {
                    var flatObject = flattenObject(ob[i]);
                    for (var x in flatObject) {
                        if (!flatObject.hasOwnProperty(x)) {
                            continue;
                        }
                        toReturn[i + '.' + x] = flatObject[x];
                    }
                } else {
                    toReturn[i] = ob[i];
                }
            }
            return toReturn;
        };
        const myFlattenedObj = flattenObject(obj);
        return JSON.stringify(myFlattenedObj, Object.keys(myFlattenedObj).sort());
    }

}