import {BLOCK, INVENTORY_ITEM_EQUAL_SCHEMA, INVENTORY_ITEM_STRINGIFY_KEY_SCHEMA} from "./blocks.js";
import {RecipeManager} from "./recipes.js";
import {ObjectHelpers} from "./helpers.js"

export class InventoryComparator {

    static rm = null;

    /**
     * Returns a string with the following property:
     * if it's equal for 2 items, then these items are the identical for all pratical
     * purposes, and could be in the same stack (if their stack size were > 1).
     */
    static makeItemCompareKey(item) {
        if('entity_id' in item && item.entity_id) {
            // если есть entity id, то нужно брать только это поле
            return item.entity_id;
        } else {
            return ObjectHelpers.sortedStringifySchema(item, INVENTORY_ITEM_STRINGIFY_KEY_SCHEMA);
        }
    }

    /** Compares lists exactly - item stacks must match. */
    static listsExactEqual(listA, listB) {
        const schema = Array.isArray(listA)
            ? [INVENTORY_ITEM_EQUAL_SCHEMA]
            : { 'default:': INVENTORY_ITEM_EQUAL_SCHEMA };
        return ObjectHelpers.deepEqualSchema(listA, listB, schema);
    }

    /**
     * Sanitizes (see {@link BLOCK.sanitizeAndValidateInventoryItem}) and validates
     * the items from the client.
     * @param {Array or Object} list - the items
     * @return null if success, or the first invlid item
    */
    static sanitizeAndValidateInventoryItems(list) {
        for(let key of list) {
            const new_item = BLOCK.sanitizeAndValidateInventoryItem(list[key]);
            if (!new_item) {
                return list[key];
            }
            list[key] = new_item;
        }
        return null;
    }

    /**
     * Applies recipes, if they are passed. Then compares total quantities of each item,
     * regardless of their invetory positions and split between stacks.
     * @param {Array or Object} old_items - the server items, assumed to be correct
     * @param {Array or Object} new_items - new, suspicious items
     * @param {Array of objects} used_recipes - array of {
     *   recipe_id: Int
     *   item_ids: Array of Int
     * }
     * @param {RecipeManager} em - optional, used only if recipes are not null
     * @return {Boolean} true if equal
     */
    static checkEqual(old_items, new_items, used_recipes, rm) {
        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        if(Array.isArray(used_recipes)) {
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
            } catch(e) {
                console.log('error', e);
                return false;
            }
        }

        // Note: "extra_data" and "entity_id" are compared in compareSimpleItems(), see INVENTORY_ITEM_EQUAL_SCHEMA
        return InventoryComparator.compareSimpleItems(old_simple, new_simple);
    }

    // Returns true if two maps of simple items are equal.
    static compareSimpleItems(old_simple, new_simple) {
        if (new_simple.size != old_simple.size) {
            return false;
        }
        for(let [key, item] of new_simple) {
            let old_item = old_simple.get(key);
            if(!old_item) {
                console.log(`* Item not found (${key}); item: ` + JSON.stringify(item));
                return false;
            }
            if(!ObjectHelpers.deepEqualSchema(old_item, item, INVENTORY_ITEM_EQUAL_SCHEMA)) {
                console.error('* Comparator not equal (new,old):', JSON.stringify([item, old_item], 2, null));
                return false;
            }
        }
        for(let [key, item] of old_simple) {
            if(!new_simple.get(key)) {
                console.log(`* Old item not found (${key}); item: ` + JSON.stringify(item));
                return false;
            }
        }
        return true;
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
     * @param {Array or Object} - items
     * @return {Map} of shallow copies of items, grouped by {@link makeItemCompareKey}.
     */
    static groupToSimpleItems(items) {
        const resp = new Map();
        for(let item of items) {
            if(item) {
                const new_item = {...item};
                const key = InventoryComparator.makeItemCompareKey(new_item);
                const existingValue = resp.get(key);
                if(existingValue) {
                    existingValue.count += new_item.count;
                } else {
                    resp.set(key, new_item);
                }
            }
        }
        return resp;
    }

}