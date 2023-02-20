import {BLOCK} from "./blocks.js";
import {RecipeManager} from "./recipes.js";
import {ObjectHelpers, ArrayOrMap, ArrayOrScalar} from "./helpers.js"
import { AnvilRecipeManager } from "./recipes_anvil.js";

export class InventoryComparator {
    [key: string]: any;

    // The values can be either classes, of async functions that return classes (for lazy initialization)
    static recipeManagers = {
        'crafting':
            async function() {
                const rm = new RecipeManager();
                await rm.load(() => {});
                return rm;
            },
        'anvil': new AnvilRecipeManager()
    };

    static itemsEqual(itemA, itemB) {
        return ObjectHelpers.deepEqual(itemA, itemB);
    }

    static itemsEqualExceptCount(itemA, itemB) {
        if (itemA == null) {
            return itemB == null;
        }
        return itemB != null &&
            itemA.id === itemB.id &&
            itemA.power === itemB.power &&
            itemA.entity_id === itemB.entity_id &&
            ObjectHelpers.deepEqual(itemA.extra_data, itemB.extra_data);
    }

    /**
     * @param { object } item
     * @param {(Array of Int)|Int|Object} needs - array of item ids, an item id, or an item
     */
    static itemMatchesNeeds(item, needs) {
        if (item == null) {
            return false;
        }
        const type = typeof needs;
        if (type === 'number') {
            return item.id === needs;
        }
        if (type !== 'object') {
            throw new Error("type !== 'object'");
        }
        return Array.isArray(needs)
            ? needs.includes(item.id)
            : this.itemsEqualExceptCount(item, needs);
    }

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
            // id and power should be Int after sanitizaion, but stringiy them just in case
            let res = 'i' + JSON.stringify(item.id);
            if (item.power != null) {
                res += ',p' + JSON.stringify(item.power);
            }
            if (item.extra_data != null) {
                res += ',e' + ObjectHelpers.sortedStringify(item.extra_data);
            }
            return res;
        }
    }

    /** Compares lists exactly - item stacks must match. */
    static listsExactEqual(listA, listB) {
        return ObjectHelpers.deepEqual(listA, listB);
    }

    /**
     * Sanitizes (see {@link BLOCK.sanitizeAndValidateInventoryItem}) and validates
     * the items from the client.
     * @param {Array or Object} list - the items
     * @param { object } keysObject - optional - provides keys that are being processed.
     *   The values are boolean, indicating whether the key is non-optional.
     * @return null if success, or the first invlid item or error message
     */
    static sanitizeAndValidateItems(list, keysObject = null, mustCheckEqual? : any, player = null) {
        if (!list || typeof list !== 'object') {
            return 'not a list';
        }
        const isArray = Array.isArray(list);
        const keys = keysObject ?? list;
        for(let key in keys) {
            const item = list[key];
            if (item != null) {
                const new_item = BLOCK.sanitizeAndValidateInventoryItem(item)
                if(!new_item && mustCheckEqual === false) {
                    list[key] = null
                    // don't silently fix bugged items, report them
                    player?.sendError(`!alertError: invalid item ${key} ${item} mustCheckEqual === false`)
                } else {
                    if (!new_item) {
                        return list[key];
                    }
                    list[key] = new_item;
                }
            } else {
                const isMandatory = keysObject ? keysObject[key] : !isArray;
                if (isMandatory) {
                    return 'null value';
                }
            }
        }
        return null;
    }

    // static sanitizeAndValidatePropertyItems(obj, arrayOfKeys) {
    //     if (!obj || typeof obj !== 'object') {
    //         return null;
    //     }
    //     for(let key of arrayOfKeys) {
    //         const new_item = BLOCK.sanitizeAndValidateInventoryItem(list[key]);
    //         if (!new_item) {
    //             return list[key];
    //         }
    //         list[key] = new_item;
    //     }
    //     return null;
    // }

    /**
     * Applies recipes, if they are passed. Then compares total quantities of each item,
     * regardless of their invetory positions and split between stacks.
     * @param {Array or Object} old_items - the server items, assumed to be correct
     * @param {Array or Object} new_items - new, suspicious items
     * @param {Array of Object} used_recipes - the exact fields differ slight dependeing on
     *   the recipe mamanger used, see {@link AnvilRecipeManager.applyUsedRecipe}, {@link RecipeManager.applyUsedRecipe}
     *   recipe_id: Int
     *   used_items_keys: Array of String   // item comparison keys
     *   count: (Int|Array of Int)          // the number of used items
     *   label: String                      // for anvil only
     * @param {RecipeManager} recipeManager - optional, used only if recipes are not null
     * @return { boolean } true if equal
     */
    static checkEqual(old_items, new_items, used_recipes, recipeManager) {
        let old_simple = InventoryComparator.groupToSimpleItems(old_items);
        let new_simple = InventoryComparator.groupToSimpleItems(new_items);

        if(Array.isArray(used_recipes)) {
            try {
                // Apply all recipes
                for(let used_recipe of used_recipes) {
                    const recipe_id = used_recipe.recipe_id;
                    // Get recipe by ID
                    const recipe = recipeManager.getRecipe(recipe_id);
                    if(!recipe) {
                        throw 'error_recipe_not_found|' + recipe_id;
                    }
                    // proeprocess and validate count
                    ArrayOrScalar.setArrayLength(used_recipe.count, used_recipe.used_items_keys.length);
                    used_recipe.count = ArrayOrScalar.mapSelf(used_recipe.count, c => {
                        c = Math.floor(c);
                        if (typeof c !== 'number' || !(c > 0)) { // !(c < 0) is for NaN
                            throw 'error_incorrect_value|count=' +c;
                        }
                        return c;
                    });
                    // validate and get the used items
                    const used_items = [];
                    for(const [i, key] of used_recipe.used_items_keys.entries()) {
                        // check the item, remove it them from the simple inventory
                        let item = old_simple.get(key);
                        let count = used_recipe.count;
                        // if count for each item is important, set it to each item
                        if (Array.isArray(count)) {
                            count = count[i];
                            item = { ...item, count };
                        }
                        if (!item) {
                            throw 'error_recipe_item_not_found_in_inventory|' + recipe_id;
                        }
                        if (!InventoryComparator.decrementSimpleItemsKey(old_simple, key, count)) {
                            throw 'error_recipe_item_not_enough';
                        }
                        used_items.push(item);
                    }
                    const result = recipeManager.applyUsedRecipe(used_recipe, recipe, used_items, old_simple);
                    if (!result) {
                        throw 'error_recipe_does_not_match_used_items';
                    }
                    InventoryComparator.addToSimpleItems(old_simple, result);
                    // remember some info used when all recipes are applied
                    used_recipe.onCraftedData = {
                        block_id:   result.id,
                        count:      result.count
                    };
                }
            } catch(e) {
                console.log('error', e);
                return false;
            }
        }
        // Note: "extra_data" and "entity_id" are compared in compareSimpleItems()
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
            if(!this.itemsEqual(old_item, item)) {
                console.error('* Comparator not equal (new,old):', JSON.stringify([item, old_item], null, 2));
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

    // Supported types: 'crafting', 'anvil'
    static async getRecipeManager(type) {
        type = type ?? 'crafting';
        let rm = this.recipeManagers[type];
        if(typeof rm === 'function') {
            rm = await rm();
            this.recipeManagers[type] = rm;
        }
        return rm;
    }

    /**
     * @param {Array or Object} - items
     * @return {Map} of shallow copies of items, grouped by {@link makeItemCompareKey}.
     */
    static groupToSimpleItems(items, additionalItems = null) {
        const resp = new Map();
        for(let item of ArrayOrMap.values(items, null)) {
            this.addToSimpleItems(resp, item);
        }
        if (additionalItems) {
            for(let item of ArrayOrMap.values(additionalItems, null)) {
                this.addToSimpleItems(resp, item);
            }
        }
        return resp;
    }

    static addToSimpleItems(simple_items, item) {
        const key = InventoryComparator.makeItemCompareKey(item);
        const existing_item = simple_items.get(key);
        if(existing_item) {
            existing_item.count += item.count;
        } else {
            simple_items.set(key, {...item});
        }
    }

    static decrementSimpleItemsKey(simple_items, key, count) {
        const existing_item = simple_items.get(key);
        if (existing_item === null) {
            return false;
        }
        existing_item.count -= count;
        if (existing_item.count <= 0) {
            simple_items.delete(key);
            if (existing_item.count < 0) {
                return false;
            }
        }
        return true;
    }

}