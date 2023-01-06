import {BLOCK, INVENTORY_ITEM_EQUAL_SCHEMA, ITEM_INVENTORY_KEY_PROPS, ITEM_INVENTORY_EXCEPT_KEYS_OBJ} from "./blocks.js";
import {RecipeManager} from "./recipes.js";
import {ObjectHelpers} from "./helpers.js"

export class InventoryComparator {

    static rm = null;

    //
    static makeItemCompareKey(same_items, item, b) {
        // generate key
        let key = item.id;
        if('entity_id' in item && item.entity_id) {
            // если есть entity id, то нужно брать только это поле
            key = item.entity_id;
        } else {
            let entity_key = null;
            for(let prop of ITEM_INVENTORY_KEY_PROPS) {
                if(prop != 'power' || b.power != 0) {
                    if(prop in item) {
                        const jvalue = JSON.stringify(item[prop]);
                        const prop_key = `|${prop}:${jvalue}`;
                        key += prop_key;
                        entity_key += `/${item.id}:${prop_key}`;
                    }
                }
            }
            //
            if(entity_key) {
                const counter = same_items.get(entity_key) ?? 0;
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
                old_flat.set(InventoryComparator.flatStringifyObject(item, ITEM_INVENTORY_EXCEPT_KEYS_OBJ));
            }
        }
        // new flat
        for(let [_, item] of new_simple) {
            if(item.extra_data || item.entity_id) {
                const new_flat = InventoryComparator.flatStringifyObject(item, ITEM_INVENTORY_EXCEPT_KEYS_OBJ);
                if(!old_flat.has(new_flat)) {
                    return false;
                }
            }
        }
        return true;
    }

    /** Compares lists exactly - item stacks must match. */
    static listsExactEqual(listA, listB) {
        return ObjectHelpers.deepEqualSchema(listA, listB, [INVENTORY_ITEM_EQUAL_SCHEMA]);
    }

    /* Compares total quantities of each item, regardless of their invetory positions
    and split between stacks. 
    Note: it's ok if the client sends extra garabe fields. They are cleared in Inventory.applyNewItems().
    */
    static async checkEqual(old_items, new_items, used_recipes) {

        const rm = await InventoryComparator.getRecipeManager();

        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        // 1. Check full equal
        let equal = InventoryComparator.compareSimpleItems(old_simple, new_simple);

        if(!equal && Array.isArray(used_recipes)) {
            try {
                // Apply all recipes
                for(let used_recipe of used_recipes) {
                    const recipe_id = used_recipe.recipe_id;
                    // Get recipe by ID
                    const recipe = rm.getRecipe(recipe_id);
                    if(!recipe) {
                        throw 'error_recipe_not_found|' + recipe_id;
                    }
                    // Spending resources
                    const need_resources = ObjectHelpers.deepClone(recipe.need_resources, 2);
                    for(let item_id of used_recipe.item_ids) {
                        // check that the item_id is used in the recipe is actually in the recipe
                        const resource = need_resources.find(it => 
                            it.count && it.item_ids.includes(item_id)
                        );
                        if (!resource) {
                            throw `error_item_not_found_in_recipe|${recipe_id},${item_id}`;
                        }
                        resource.count--;
                        // check that the item is in the inventory
                        let used_item = old_simple.get(item_id);
                        if(!used_item) {
                            throw 'error_recipe_item_not_found_in_inventory|' + recipe_id;
                        }
                        used_item.count--;
                        if(used_item.count < 0) {
                            throw 'error_recipe_item_not_enough';
                        }
                        if(used_item.count == 0) {
                            old_simple.delete(item_id);
                        }
                    }
                    // Check that all the items in the recipe are used
                    if (need_resources.find(it => it.count)) {
                        throw 'error_not_all_recipe_items_are_used|' + recipe_id;
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

    // Returns true if two maps of simple items are equal.
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
                if(!ObjectHelpers.deepEqualSchema(old_item, item, INVENTORY_ITEM_EQUAL_SCHEMA)) {
                    console.error('* Comparator not equal (new,old):', JSON.stringify([item, old_item], 2, null));
                    equal = false;
                    break;
                }
            }
        }
        return equal;
    }

    /**
     * It creates a new array, where items from the first array are arranged exactly
     * like in the second array.
     * 
     * The purpose of this method: it allows the client to as the server to
     * freely move its inventory items, but it can't put any data drectly to
     * the server inventory.
     * 
     * @param {Array} srcList - the items to be rearranged
     * @param {Array} likeList - the items used to determine the arrangement.
     * @returns {Array} the new list with shallow clones of elements of srcList,
     *  or null if it's impossible.
     */
    static rearrangeLikeOtherList(srcList, likeList) {
        // get the array of comparison keys of likeList
        const result = [];
        this.groupToSimpleItems(likeList, result);
        if (srcList.length !== result.length) {
            return null;
        }

        // get the source items grouped by key
        const srcMap = this.groupToSimpleItems(srcList, null, true);

        // replace the keys in the result with the source items
        for (let i = 0; i < result.length; i++) {
            const key = result[i];
            if (key == null) {
                continue;
            }
            const count = likeList[i].count;
            if (count <= 0) {
                return null;
            }
            const srcItem = srcMap.get(key);
            if (srcItem == null) {
                return null;
            }
            srcItem.count -= count;
            if (srcItem.count < 0) {
                return null;
            }
            let item;
            if (srcItem.count) {
                item = {...srcItem};
            } else {
                // optimization: don't clone the last remaining item of this type
                item = srcItem;
                srcMap.delete(key);
            }
            item.count = likeList[i].count;
            result[i] = item;
        }
        // check if the count matches
        return srcMap.size ? null : result;
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

    /**
     * @param items
     * @param {Array} outArrayOfKeys - if it's not null, it will return an array of keys
     *  with the same indices as the source items.
     * @param {Boolean} returnSourceItems - if it's true, the method returns shallow clones
     *  of the source items with full data, instead of simple items.
     */
    static groupToSimpleItems(items, outArrayOfKeys = null, returnSourceItems = false) {
        const resp = new Map();
        const same_items = new Map();
        if (outArrayOfKeys) {
            outArrayOfKeys.length = 0;
        }
        for(let item of items) {
            if(item) {
                if('id' in item && 'count' in item) {
                    const b = BLOCK.fromId(item.id);
                    if(!b || b.id < 0) {
                        outArrayOfKeys?.push(null);
                        continue;
                    }
                    const new_item = BLOCK.convertItemToInventoryItem(item, b);
                    const key = InventoryComparator.makeItemCompareKey(same_items, new_item, b);
                    //
                    const existingValue = resp.get(key);
                    if(existingValue) {
                        existingValue.count += new_item.count;
                    } else {
                        const newValue = returnSourceItems ? {...item} : new_item;
                        resp.set(key, newValue);
                    }
                    outArrayOfKeys?.push(key);
                } else {
                    outArrayOfKeys?.push(null);
                }
            } else {
                outArrayOfKeys?.push(null);
            }
        }
        return resp;
    }

    // Объект приводится к плоскому виду с сортировкой свойств по названию
    static flatStringifyObject(obj, exceptKeys = null) {
        const flattenObject = function(ob) {
            const toReturn = {};
            for (var i in ob) {
                if (!ob.hasOwnProperty(i) || exceptKeys && exceptKeys[i]) {
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