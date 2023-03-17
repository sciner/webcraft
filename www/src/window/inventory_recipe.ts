import type { RecipeManager } from "../recipes.js";
import { RecipeWindow } from "./recipe.js";

// RecipeWindow...
export class InventoryRecipeWindow extends RecipeWindow {

    constructor(recipe_manager : RecipeManager) {

        super(recipe_manager, 'frmInventoryRecipe')
    }

}