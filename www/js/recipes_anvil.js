import { BLOCK, ITEM_LABEL_MAX_LENGTH } from "./blocks.js";
import { RecipeManager } from "./recipes.js"
import { InventoryComparator } from "./inventory_comparator.js";

export class AnvilRecipeManager {

    constructor() {
        const that = this;
        this.recipes = new Map();

        this.addRecipe('renaming',
            function(first_item, second_item, label) {
                if (first_item == null || second_item != null) {
                    return null;
                }
                if (AnvilRecipeManager.getCurrentLabel(first_item) === label) {
                    return null;
                }
                return that.cloneWithLabelAndIncrement(first_item, label);
            }
        );
    }

    addRecipe(id, getResult) {
        this.recipes.set(id, {id, getResult});
    }

    getRecipe(id) {
        if(typeof id !== 'string') {
            throw 'error_invalid_recipe_id';
        }
        return this.recipes.get(id);
    }

    /**
     * @returns {Object} {recipe, result} - the recipe that can be applied to the given
     * arguments, and the resulting item. If no recipe is applicable, returns null.
     */
    findRecipeAndResult(first_item, second_item, label) {
        for(const recipe of this.recipes.values()) {
            const result = recipe.getResult(first_item, second_item, label);
            if (result) {
                return {recipe, result};
            }
        }
        return null;
    }

    static getCurrentLabel(item) {
        return item.extra_data?.label ?? BLOCK.getBlockTitle(item);
    }

    cloneWithLabelAndIncrement(item, label) {
        // validate the label (it's for the server; the client validates before that)
        if (typeof label !== 'string' || label.length > ITEM_LABEL_MAX_LENGTH) {
            throw `error_incorrect_value|label=${label}`
        }
        // clone and edit the item
        const res = {...item};
        res.extra_data = res.extra_data ? {...res.extra_data} : {};
        if (label !== BLOCK.fromId(item.id).name) {
            res.extra_data.label = label;
        } else {
            delete res.extra_data.label;
        }
        // increase the number of anvil uses
        res.extra_data.anvil = (res.extra_data.anvil ?? 0) + 1;
        return res;
    }

    /**
     * @param {Object} {
     *   recipe_id: Int
     *   used_items: Array of reslts of {@link toUsedSimpleItem}
     *   count: Int
     *   label: String
     * }
     * @param {Map} simple_items
     * @throws if it's imposible
     */
    applyUsedRecipeToSimpleItems(used_recipe, simple_items) {
        const recipe_id = used_recipe.recipe_id;
        // Get recipe by ID
        const recipe = this.getRecipe(recipe_id);
        if (!recipe) {
            throw 'error_recipe_not_found|' + recipe_id;
        }
        // Find the items in the inventory, check and reduce their quantities
        const used_items = RecipeManager.getValidateAndDecrementUsedItems(
            simple_items, used_recipe.used_items, used_recipe.count, recipe_id);
        // the recipes use item.count, so set it now
        for(let i in used_items) {
            if (used_items[i]) {
                used_items[i] = {
                    ...used_items[i],
                    count: used_recipe.count
                };
            }
        }
        // Try to apply recipe
        const result = recipe.getResult(used_items[0], used_items[1], used_recipe.label);
        if (!result) {
            throw 'error_recipe_does_not_match_used_items';
        }
        InventoryComparator.addToSimpleItems(simple_items, result);
        return result;
    }

}