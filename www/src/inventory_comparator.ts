import {BLOCK} from "./blocks.js";
import {RecipeManager, TUsedCraftingRecipe} from "./recipes.js";
import {ObjectHelpers, ArrayOrMap, ArrayOrScalar} from "./helpers.js"
import {AnvilRecipeManager, TUsedAnvilRecipe} from "./recipes_anvil.js";

/**
 * Describes one recipe applied to the inventory.
 * The exact fields differ slight depending on the recipe manager used,
 * see {@link AnvilRecipeManager.applyUsedRecipe}, {@link RecipeManager.applyUsedRecipe}
 */
export type TUsedRecipe = (TUsedCraftingRecipe | TUsedAnvilRecipe) & {
    onCraftedData ? : {             // the result of the recipe, server-only
        block_id: int
        count: int
    }
}

export interface IRecipeManager<RecipeT = any> {
    getRecipe(recipe_id: int | string): RecipeT | null | undefined
    applyUsedRecipe(used_recipe: TUsedRecipe, recipe: RecipeT, used_items: IInventoryItem[]): IInventoryItem | null
}

/** Describes requirements for an item (e.g. used in recipes) */
export type TItemNeeds = int[] | int | IInventoryItem

export class InventoryComparator {

    static recipeManagers: { [key: string]: (() => Promise<IRecipeManager>) | IRecipeManager } = {
        'crafting':
            async function(): Promise<IRecipeManager> {
                const rm = new RecipeManager();
                await rm.load(() => {});
                return rm;
            },
        'anvil': new AnvilRecipeManager()
    };

    static itemsEqual(itemA: IInventoryItem, itemB: IInventoryItem): boolean {
        return ObjectHelpers.deepEqual(itemA, itemB);
    }

    static itemsEqualExceptCount(itemA: IInventoryItem, itemB: IInventoryItem): boolean {
        if (itemA == null) {
            return itemB == null;
        }
        return itemB != null &&
            itemA.id === itemB.id &&
            itemA.power === itemB.power &&
            itemA.entity_id === itemB.entity_id &&
            ObjectHelpers.deepEqual(itemA.extra_data, itemB.extra_data);
    }

    static itemMatchesNeeds(item: IInventoryItem, needs: TItemNeeds): boolean {
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
            : this.itemsEqualExceptCount(item, needs as IInventoryItem);
    }

    /**
     * Returns a string with the following property:
     * if it's equal for 2 items, then these items are the identical for all pratical
     * purposes, and could be in the same stack (if their stack size were > 1).
     */
    static makeItemCompareKey(item: IInventoryItem): string {
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
    static listsExactEqual(listA: (IInventoryItem | null)[] | Dict<IInventoryItem>,
                           listB: (IInventoryItem | null)[] | Dict<IInventoryItem>): boolean {
        return ObjectHelpers.deepEqual(listA, listB);
    }

    /**
     * Sanitizes (see {@link BLOCK.sanitizeAndValidateInventoryItem}) and validates
     * the items from the client. Invalid items are removed from the list.
     * @param keysObject - optional - provides keys that are being processed.
     *   The values are boolean, indicating whether the key is non-optional.
     * @return null if success, or an error message. It's messy, but good enough for debug.
     */
    static sanitizeAndValidateItems(list: (IInventoryItem | null)[] | Dict<IInventoryItem>,
                                    keysObject?: Dict | null): null | string {
        const errors = []
        if (!list || typeof list !== 'object') {
            return 'not a list';
        }
        const isArray = Array.isArray(list);
        const keys = keysObject ?? list;
        for(let key in keys) {
            const item = list[key];
            if (item != null) {
                const new_item = BLOCK.sanitizeAndValidateInventoryItem(item)
                if (!new_item) {
                    ArrayOrMap.delete(list, key, null)
                    errors.push(`invalid item ${JSON.stringify(item)}`)
                } else {
                    list[key] = new_item
                }
            } else {
                const isMandatory = keysObject ? keysObject[key] : !isArray;
                if (isMandatory) {
                    errors.push('null value')
                }
            }
        }
        return errors.length ? errors.join() : null;
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
     * regardless of their inventory positions and split between stacks.
     * @param old_items - the server items, assumed to be correct
     * @param new_items - new, suspicious items
     * @param recipeManager - optional, used only if recipes are not null
     * @return true if equal
     */
    static checkEqual(
        old_items: (IInventoryItem | null)[],
        new_items: (IInventoryItem | null)[],
        used_recipes?: TUsedRecipe[],
        recipeManager?: IRecipeManager,
        thrownItems?: IInventoryItem[]
    ): boolean {
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
                    // preprocess and validate count
                    ArrayOrScalar.setArrayLength(used_recipe.count, used_recipe.used_items_keys.length);
                    used_recipe.count = ArrayOrScalar.mapSelf(used_recipe.count, c => {
                        c = Math.floor(c);
                        if (typeof c !== 'number' || !(c > 0)) { // !(c < 0) is for NaN
                            throw 'error_incorrect_value|count=' +c;
                        }
                        return c;
                    });
                    // validate and get the used items
                    const used_items: IInventoryItem[] = [];
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
                    const result = recipeManager.applyUsedRecipe(used_recipe, recipe, used_items);
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
        if (Array.isArray(thrownItems)) {
            for(let thrownItem of thrownItems) {
                if (typeof thrownItem.count !== 'number' || thrownItem.count <= 0) {
                    console.log('incorrect thrownItem')
                    return false
                }
                if (!this.subtractFromSimpleItems(old_simple, thrownItem)) {
                    console.log("thrownItem isn't found, or not enough count")
                    return false
                }
            }
        }
        // Note: "extra_data" and "entity_id" are compared in compareSimpleItems()
        return InventoryComparator.compareSimpleItems(old_simple, new_simple);
    }

    /** @returns true if two maps of simple items are equal */
    static compareSimpleItems(old_simple: Map<string, IInventoryItem>, new_simple: Map<string, IInventoryItem>): boolean {
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

    static async getRecipeManager(type: string | null): Promise<IRecipeManager | undefined> {
        type = type ?? 'crafting';
        let rm = this.recipeManagers[type];
        if(typeof rm === 'function') {
            rm = await rm();
            this.recipeManagers[type] = rm;
        }
        return rm;
    }

    /**
     * @return shallow copies of items, grouped by {@link makeItemCompareKey}.
     */
    static groupToSimpleItems(items: (IInventoryItem | null)[] | Dict<IInventoryItem>, additionalItems?: (IInventoryItem | null)[] | Dict<IInventoryItem>
    ): Map<string, IInventoryItem> {
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

    static addToSimpleItems(simple_items: Map<string, IInventoryItem>, item: IInventoryItem): void {
        const key = this.makeItemCompareKey(item);
        const existing_item = simple_items.get(key);
        if(existing_item) {
            existing_item.count += item.count;
        } else {
            simple_items.set(key, {...item});
        }
    }

    static subtractFromSimpleItems(simple_items: Map<string, IInventoryItem>, item: IInventoryItem): boolean {
        const key = this.makeItemCompareKey(item)
        return this.decrementSimpleItemsKey(simple_items, key, item.count)
    }

    /**
     * Subtracts {@link count} from the simple item with the given key. Deletes the item if its count becomes 0 or less.
     * @returns true if there was at least {@link count} of that item.
     */
    static decrementSimpleItemsKey(simple_items: Map<string, IInventoryItem>, key: string, count: int): boolean {
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